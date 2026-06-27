import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  Inject, OnDestroy, OnInit, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { MarksService, ExamResult } from '../../services/marks.service';
import {
  ReportCardTemplateService, ReportCardData, TemplateSection, BrandingConfig,
  ExamColumn, SubjectRow
} from '../../services/report-card-template.service';
import { LoggerService } from '../../services/logger.service';
import { SchoolService } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Capacitor } from '@capacitor/core';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-report-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-card.component.html',
  styleUrl: './report-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  studentId = '';
  session = '';

  // ── Demo mode ─────────────────────────────────────────────────────────
  demoMode = false;
  demoStyleName = '';

  // ── Legacy exam-based mode ────────────────────────────────────────────
  examId: number | null = null;
  allResults: ExamResult[] = [];
  displayResults: ExamResult[] = [];
  studentName = '';
  className = '';
  legacyGradingSystem = 'CBSE';

  // ── Template-based mode ───────────────────────────────────────────────
  templateId: number | null = null;
  reportCardData: ReportCardData | null = null;

  loading = true;
  notPublished = false;  // true when STUDENT hits a 403 (report not yet published)
  private originalTitle = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private titleService: Title,
    private marksService: MarksService,
    private rcTemplateService: ReportCardTemplateService,
    private schoolService: SchoolService,
    private authState: AuthStateService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: object
  ) { }

  ngOnInit(): void {
    this.originalTitle = this.titleService.getTitle();
    const params = this.route.snapshot.queryParamMap;
    this.studentId = params.get('studentId') ?? '';
    this.session   = params.get('session') ?? '';
    const examIdStr    = params.get('examId');
    const templateIdStr = params.get('templateId');
    this.examId     = examIdStr     ? Number(examIdStr)     : null;
    this.templateId = templateIdStr ? Number(templateIdStr) : null;

    this.demoMode = params.get('demo') === 'true';
    this.demoStyleName = params.get('styleName') ?? 'CBSE Standard';
    if (this.demoMode) {
      this.reportCardData = this.buildSampleData();
      this.templateId = -1;
      this.loading = false;
      this.cdr.markForCheck();
      this.titleService.setTitle('Sample Report Card — Indra Academy Style');
      return;
    }

    if (!this.studentId || !this.session) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // STUDENT role can only view own report card
    if (!this.demoMode) {
      const role = this.authState.getUserRole();
      const authUserId = this.authState.getUserId();
      if (role === 'STUDENT' && this.studentId && this.studentId !== String(authUserId)) {
        this.toast.error('Access Denied', 'You can only view your own report card.');
        this.router.navigate(['/dashboard']);
        return;
      }
    }

    if (this.templateId) {
      this.loadTemplateMode();
    } else {
      this.loadLegacyMode();
    }
  }

  ngOnDestroy(): void {
    this.titleService.setTitle(this.originalTitle);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Template-based mode ───────────────────────────────────────────────

  private loadTemplateMode(): void {
    this.rcTemplateService
      .getReportCard(this.studentId, this.templateId!, this.session)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.reportCardData = data;
          this.loading = false;
          this.cdr.markForCheck();
          this.titleService.setTitle(
            `ReportCard_${data.studentName.replace(/\s+/g, '_')}_${this.session}`
          );
        },
        error: (e) => {
          if (e.status === 403) {
            this.notPublished = true;
          } else {
            this.logger.error('Error loading template report card:', e);
            this.toast.error('Error', 'Failed to load report card.');
          }
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // ── Legacy exam-based mode ────────────────────────────────────────────

  private loadLegacyMode(): void {
    this.schoolService.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => { this.legacyGradingSystem = s.gradingSystem ?? 'CBSE'; this.cdr.markForCheck(); },
      error: (err) => this.logger.error('Failed to load school settings', err)
    });

    this.marksService.getStudentResults(this.studentId, this.session)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.allResults = data;
          if (data.length > 0) {
            this.studentName = data[0].studentName;
            this.className   = data[0].className;
          }
          this.displayResults = this.examId
            ? data.filter(r => r.examId === this.examId)
            : data;
          this.loading = false;
          this.cdr.markForCheck();
          this.updateDocumentTitle();
        },
        error: (e) => {
          this.logger.error('Error loading report card:', e);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ── Branding helpers ──────────────────────────────────────────────────

  get branding(): BrandingConfig {
    if (!this.reportCardData?.template?.brandingJson) return {};
    try { return JSON.parse(this.reportCardData.template.brandingJson); } catch { return {}; }
  }

  get headerStyle(): string {
    return '';
  }

  get rcLabelStyle(): string {
    return '';
  }

  // logoSrc — resolves the relative logo path (e.g. /uploads/school-logos/1.png)
  // to a full URL the same way the login page does via TenantService.getLogoUrl()
  get logoSrc(): string {
    const url = this.reportCardData?.schoolLogoUrl;
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${environment.apiUrl}${url}`;
  }

  // photoSrc — resolves student photo relative path to a full URL
  get photoSrc(): string {
    const url = this.reportCardData?.photoUrl;
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${environment.apiUrl}${url}`;
  }

  // classDisplay — e.g. "10" or "10 – A" when section exists
  get classDisplay(): string {
    const cls = this.reportCardData?.className ?? '';
    const sec = this.reportCardData?.sectionName;
    return sec ? `${cls} – ${sec}` : cls;
  }

  // boardLabel — human-readable board type shown in school header
  get boardLabel(): string {
    const map: Record<string, string> = {
      CBSE: 'CBSE Affiliated',
      ICSE: 'ICSE Affiliated',
      STATE: 'State Board',
      OTHER: ''
    };
    return map[this.reportCardData?.boardType ?? ''] ?? '';
  }

  // gradeLegend — rows for the grade scale legend shown below marks table
  get gradeLegend(): { grade: string; range: string; descriptor: string }[] {
    const gs = this.reportCardData?.gradingSystem ?? 'CBSE';
    if (gs === 'CBSE') {
      return [
        { grade: 'A1', range: '91–100', descriptor: 'Outstanding' },
        { grade: 'A2', range: '81–90',  descriptor: 'Excellent' },
        { grade: 'B1', range: '71–80',  descriptor: 'Very Good' },
        { grade: 'B2', range: '61–70',  descriptor: 'Good' },
        { grade: 'C1', range: '51–60',  descriptor: 'Satisfactory' },
        { grade: 'C2', range: '41–50',  descriptor: 'Average' },
        { grade: 'D',  range: '33–40',  descriptor: 'Needs Improvement' },
        { grade: 'E',  range: '0–32',   descriptor: 'Fail' },
      ];
    }
    if (gs === 'LETTER') {
      return [
        { grade: 'A+', range: '90–100', descriptor: 'Outstanding' },
        { grade: 'A',  range: '80–89',  descriptor: 'Excellent' },
        { grade: 'B+', range: '70–79',  descriptor: 'Very Good' },
        { grade: 'B',  range: '60–69',  descriptor: 'Good' },
        { grade: 'C+', range: '50–59',  descriptor: 'Satisfactory' },
        { grade: 'C',  range: '40–49',  descriptor: 'Average' },
        { grade: 'D',  range: '33–39',  descriptor: 'Needs Improvement' },
        { grade: 'F',  range: '0–32',   descriptor: 'Fail' },
      ];
    }
    return []; // PERCENTAGE — no letter grade legend needed
  }

  get showCgpa(): boolean {
    return (this.branding.showCgpa !== false) && !!this.reportCardData?.cgpa;
  }

  get showGradePoints(): boolean {
    return this.branding.showGradePoints === true;
  }

  get marksRowCount(): number {
    return this.reportCardData?.weightedResult?.marksTable?.subjectRows?.length ?? 0;
  }

  get examColumnCount(): number {
    return this.reportCardData?.weightedResult?.marksTable?.examColumns?.length ?? 0;
  }

  get coScholasticCount(): number {
    return this.reportCardData?.coScholasticGrades?.length || this.coScholasticActivities.length || 0;
  }

  get isDenseReport(): boolean {
    return this.marksRowCount > 6 || this.examColumnCount > 2 || this.coScholasticCount > 4;
  }

  get isVeryDenseReport(): boolean {
    return this.marksRowCount > 9 || this.examColumnCount > 3 || this.coScholasticCount > 6;
  }

  get schoolInitials(): string {
    const name = this.reportCardData?.schoolName ?? '';
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }
  get schoolMotto(): string { return this.branding.schoolMotto ?? ''; }
  get examTerm(): string { return this.branding.examTerm ?? ''; }
  get examDisplay(): string {
    const term = this.examTerm.trim();
    if (!term) return '';
    return term.toLowerCase().includes('exam') ? term : `${term} Examination`;
  }
  get watermarkEnabled(): boolean { return this.branding.showWatermark === true; }
  get watermarkType(): string { return this.branding.watermarkType ?? 'TEXT'; }
  get watermarkText(): string { return this.branding.watermarkText ?? (this.reportCardData?.schoolName ?? ''); }

  get affiliationLine(): string {
    const parts: string[] = [];
    const aff = this.reportCardData?.affiliationNumber;
    const code = this.reportCardData?.schoolCode;
    const city = this.reportCardData?.schoolCity;
    if (aff) parts.push(`Affiliation No. ${aff}`);
    if (code) parts.push(`School Code ${code}`);
    if (city) parts.push(city);
    return parts.join(' \u00b7 ');
  }

  cbseGradePoint(pct: number): number {
    const grade = this.getGradeFromPct(pct);
    const map: Record<string, number> = {
      'A1': 10, 'A2': 9, 'B1': 8, 'B2': 7,
      'C1': 6,  'C2': 5, 'D':  4, 'E':  0,
      'A+': 10, 'A':  9, 'B+': 8, 'B':  7,
      'C+': 6,  'C':  5, 'F':  0
    };
    return map[grade] ?? 0;
  }

  // ── Template helpers ──────────────────────────────────────────────────

  get enabledSections(): TemplateSection[] {
    return (this.reportCardData?.template?.sections ?? [])
      .filter(s => s.enabled)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  sectionConfig(sectionType: string): any {
    const sec = this.reportCardData?.template?.sections?.find(s => s.sectionType === sectionType);
    if (!sec?.configJson) return {};
    try { return JSON.parse(sec.configJson); } catch { return {}; }
  }

  get coScholasticActivities(): string[] {
    const cfg = this.sectionConfig('CO_SCHOLASTIC');
    return cfg?.activities ?? ['Discipline', 'Sports', 'Co-Curricular'];
  }

  get coScholasticGradeScale(): string[] {
    const cfg = this.sectionConfig('CO_SCHOLASTIC');
    return cfg?.gradeScale ?? ['A', 'B', 'C', 'D'];
  }

  isPass(pct: number): boolean { return pct >= 33; }

  // ── Grading (used by both modes) ──────────────────────────────────────

  private get activeGradingSystem(): string {
    return this.reportCardData?.gradingSystem ?? this.legacyGradingSystem;
  }

  getGrade(obtained: number | null, max: number): string {
    if (obtained === null) return 'Ab';
    return this.gradeFromPct((obtained / max) * 100);
  }

  getGradeClass(obtained: number | null, max: number): string {
    if (obtained === null) return 'grade-absent';
    const pct = (obtained / max) * 100;
    if (pct >= 81) return 'grade-a';
    if (pct >= 61) return 'grade-b';
    if (pct >= 33) return 'grade-c';
    return 'grade-fail';
  }

  getOverallGrade(percentage: number): string {
    return this.gradeFromPct(percentage);
  }

  getGradeFromPct(pct: number): string { return this.gradeFromPct(pct); }

  getGradeClassFromPct(pct: number): string {
    if (pct >= 81) return 'grade-a';
    if (pct >= 61) return 'grade-b';
    if (pct >= 33) return 'grade-c';
    return 'grade-fail';
  }

  private gradeFromPct(pct: number): string {
    switch (this.activeGradingSystem) {
      case 'PERCENTAGE':
        return `${Math.round(pct)}%`;
      case 'LETTER':
        if (pct >= 90) return 'A+';
        if (pct >= 80) return 'A';
        if (pct >= 70) return 'B+';
        if (pct >= 60) return 'B';
        if (pct >= 50) return 'C+';
        if (pct >= 40) return 'C';
        if (pct >= 33) return 'D';
        return 'F';
      case 'CBSE':
      default:
        if (pct >= 91) return 'A1';
        if (pct >= 81) return 'A2';
        if (pct >= 71) return 'B1';
        if (pct >= 61) return 'B2';
        if (pct >= 51) return 'C1';
        if (pct >= 41) return 'C2';
        if (pct >= 33) return 'D';
        return 'E';
    }
  }

  // ── Legacy mode helpers ───────────────────────────────────────────────

  private updateDocumentTitle(): void {
    const namePart = this.studentName.trim().replace(/\s+/g, '_');
    const examPart = this.isPerExam && this.displayResults.length > 0
      ? this.displayResults[0].examName.trim().replace(/\s+/g, '_')
      : 'Full_Report';
    const sessionPart = this.session.replace('-', '_');
    this.titleService.setTitle(`ReportCard_${namePart}_${examPart}_${sessionPart}`);
  }

  get isPerExam(): boolean { return this.examId !== null; }

  get cardTitle(): string {
    if (this.isPerExam && this.displayResults.length > 0) {
      return this.displayResults[0].examName + ' — Report Card';
    }
    return 'Annual Report Card';
  }

  // ── Actions ───────────────────────────────────────────────────────────

  print(): void {
    if (Capacitor.isNativePlatform()) {
      this.toast.info('Not Available', 'Printing is not supported on the mobile app. Please use the web version.');
      return;
    }
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  downloadingPdf = false;

  downloadPdf(): void {
    if (!this.templateId || !this.studentId || !this.session) return;

    if (Capacitor.isNativePlatform()) {
      this.toast.info('Not Available', 'PDF download is not available in the app. Use the web version.');
      return;
    }

    this.downloadingPdf = true;
    this.cdr.markForCheck();

    this.rcTemplateService.downloadPdf(this.studentId, this.templateId, this.session)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const name = this.reportCardData?.studentName?.replace(/\s+/g, '_') ?? 'Student';
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${name}_${this.session}_ReportCard.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          this.downloadingPdf = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('PDF download failed', e);
          this.toast.error('Download Failed', 'Could not generate PDF. Please try again.');
          this.downloadingPdf = false;
          this.cdr.markForCheck();
        }
      });
  }

  goBack(): void { this.location.back(); }

  private buildSampleData(): ReportCardData {
    const sections: TemplateSection[] = [
      { sectionType: 'SCHOOL_HEADER',      enabled: true, displayOrder: 1 },
      { sectionType: 'STUDENT_INFO',       enabled: true, displayOrder: 2 },
      { sectionType: 'MARKS_TABLE',        enabled: true, displayOrder: 3 },
      { sectionType: 'ASSESSMENT_SUMMARY', enabled: true, displayOrder: 4 },
      { sectionType: 'ATTENDANCE',         enabled: true, displayOrder: 5 },
      { sectionType: 'CO_SCHOLASTIC',      enabled: true, displayOrder: 6 },
      { sectionType: 'TEACHER_REMARKS',    enabled: true, displayOrder: 7 },
      { sectionType: 'PRINCIPAL_REMARKS',  enabled: true, displayOrder: 8 },
      { sectionType: 'PROMOTION_STATUS',   enabled: true, displayOrder: 9 },
      { sectionType: 'SIGNATURES',         enabled: true, displayOrder: 10 },
    ];
    const examColumns: ExamColumn[] = [
      { examId: 1, examName: 'Half-Yearly', maxTotal: 80, weightage: 1.0 },
    ];
    const subjectRows: SubjectRow[] = [
      { subjectName: 'Computer', examMarks: [
          { obtained: 78, max: 80, percentage: 97.5 },
        ], weightedPercentage: 97.5 },
      { subjectName: 'General Knowledge', examMarks: [
          { obtained: 71, max: 80, percentage: 88.75 },
        ], weightedPercentage: 88.75 },
      { subjectName: 'Mathematics', examMarks: [
          { obtained: 75, max: 80, percentage: 93.75 },
        ], weightedPercentage: 93.75 },
    ];
    return {
      studentId: 'S102',
      studentName: 'Himani',
      rollNumber: 'S102',
      className: 'II',
      sectionName: 'A',
      session: '2026-2027',
      dateOfBirth: '29 Jun 2015',
      schoolName: 'Indra Academy',
      affiliationNumber: '2130456',
      schoolCode: '41207',
      schoolCity: 'Lucknow 226001',
      gradingSystem: 'CBSE',
      cgpa: 9.7,
      template: {
        id: -1,
        schoolId: 0,
        name: 'Sample Template',
        assessmentGroupId: 0,
        assessmentGroupName: 'Half-Yearly Assessment',
        isDefault: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections,
        brandingJson: JSON.stringify({
          showCgpa: true,
          schoolMotto: 'Scientia · Disciplina · Servitium',
          examTerm: 'Half-Yearly',
        } as BrandingConfig),
      },
      weightedResult: {
        groupId: 0,
        groupName: 'Half-Yearly Assessment',
        groupType: 'EXAM_BASED',
        weightedPercentage: 93.3,
        rank: 0,
        subjectResults: [],
        marksTable: {
          examColumns,
          subjectRows,
          examTotals: [
            { obtained: 224, max: 240 },
          ],
        },
      },
      attendance: {
        workingDays: 200,
        presentDays: 188,
        percentage: 94,
      },
      teacherRemarks: 'Himani is a diligent and curious learner who participates wholeheartedly.',
      principalRemarks: 'A commendable performance. Promoted with distinction.',
      coScholasticGrades: [
        { activity: 'Work Education',      grade: 'A' },
        { activity: 'Art Education',       grade: 'A' },
        { activity: 'Health & Phys. Edu.', grade: 'A' },
      ],
    };
  }

  trackByExamId(index: number, exam: ExamResult): number { return exam.examId; }
  trackByIndex(index: number): number { return index; }
  trackBySection(index: number, section: TemplateSection): string { return section.sectionType; }
}
