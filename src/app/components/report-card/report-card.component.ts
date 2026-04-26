import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  Inject, OnDestroy, OnInit, PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { MarksService, ExamResult } from '../../services/marks.service';
import { LoggerService } from '../../services/logger.service';
import { Capacitor } from '@capacitor/core';
import Swal from 'sweetalert2';

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
  examId: number | null = null;

  allResults: ExamResult[] = [];
  displayResults: ExamResult[] = [];

  studentName = '';
  className = '';
  loading = true;

  private originalTitle = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private titleService: Title,
    private marksService: MarksService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    @Inject(PLATFORM_ID) private platformId: object
  ) { }

  ngOnInit(): void {
    this.originalTitle = this.titleService.getTitle();
    const params = this.route.snapshot.queryParamMap;
    this.studentId = params.get('studentId') ?? '';
    this.session   = params.get('session') ?? '';
    const examIdStr = params.get('examId');
    this.examId = examIdStr ? Number(examIdStr) : null;

    if (!this.studentId || !this.session) {
      this.router.navigate(['/dashboard']);
      return;
    }

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

  ngOnDestroy(): void {
    this.titleService.setTitle(this.originalTitle);
    this.destroy$.next();
    this.destroy$.complete();
  }

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

  // CBSE-style grading
  getGrade(obtained: number | null, max: number): string {
    if (obtained === null) return 'Ab';
    const pct = (obtained / max) * 100;
    if (pct >= 91) return 'A1';
    if (pct >= 81) return 'A2';
    if (pct >= 71) return 'B1';
    if (pct >= 61) return 'B2';
    if (pct >= 51) return 'C1';
    if (pct >= 41) return 'C2';
    if (pct >= 33) return 'D';
    return 'E';
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
    if (percentage >= 91) return 'A1';
    if (percentage >= 81) return 'A2';
    if (percentage >= 71) return 'B1';
    if (percentage >= 61) return 'B2';
    if (percentage >= 51) return 'C1';
    if (percentage >= 41) return 'C2';
    if (percentage >= 33) return 'D';
    return 'E';
  }

  print(): void {
    if (Capacitor.isNativePlatform()) {
      Swal.fire({ icon: 'info', title: 'Not Available', text: 'Printing is not supported on the mobile app. Please use the web version.' });
      return;
    }
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  goBack(): void {
    this.location.back();
  }

  trackByExamId(index: number, exam: ExamResult): number { return exam.examId; }
  trackByIndex(index: number): number { return index; }
}
