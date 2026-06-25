import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  Inject, OnDestroy, OnInit, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { MarksService, ExamResult } from '../../services/marks.service';
import { ReportCardTemplateService, ReportCardData, TemplateSection, BrandingConfig } from '../../services/report-card-template.service';
import { LoggerService } from '../../services/logger.service';
import { SchoolService } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Capacitor } from '@capacitor/core';
import { ToastService } from '../../services/toast.service';

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

    if (!this.studentId || !this.session) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // STUDENT role can only view own report card
    const role = this.authState.getUserRole();
    const authUserId = this.authState.getUserId();
    if (role === 'STUDENT' && this.studentId && this.studentId !== String(authUserId)) {
      this.toast.error('Access Denied', 'You can only view your own report card.');
      this.router.navigate(['/dashboard']);
      return;
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

  get primaryColor(): string { return this.branding.primaryColor ?? '#1565c0'; }

  get headerStyle(): string {
    // White document header with a thick colored top stripe — no gradient.
    return `border-top: 4px solid ${this.primaryColor}`;
  }

  get rcLabelStyle(): string {
    // Bordered box with primary color text and border — not a solid fill.
    return `color: ${this.primaryColor}; border: 2px solid ${this.primaryColor}`;
  }

  get sectionBarStyle(): string {
    return `background: ${this.primaryColor}; border-color: ${this.primaryColor}`;
  }

  get thStyle(): string {
    return `background: ${this.primaryColor}; border-color: ${this.primaryColor}; color: #fff`;
  }

  get showCgpa(): boolean {
    return (this.branding.showCgpa !== false) && !!this.reportCardData?.cgpa;
  }

  get showGradePoints(): boolean {
    return this.branding.showGradePoints === true;
  }

  private darken(hex: string, factor: number): string {
    try {
      const h = hex.replace('#', '');
      const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - factor));
      const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - factor));
      const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - factor));
      return `rgb(${r},${g},${b})`;
    } catch { return '#0f172a'; }
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

  trackByExamId(index: number, exam: ExamResult): number { return exam.examId; }
  trackByIndex(index: number): number { return index; }
  trackBySection(index: number, section: TemplateSection): string { return section.sectionType; }
}
