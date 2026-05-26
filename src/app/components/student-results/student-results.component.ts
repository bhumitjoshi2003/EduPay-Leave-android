import {
  AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, ElementRef, Inject, OnDestroy, OnInit, PLATFORM_ID, QueryList, ViewChild, ViewChildren
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import Chart from 'chart.js/auto';
import { MarksService, ExamResult } from '../../services/marks.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-student-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-results.component.html',
  styleUrl: './student-results.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentResultsComponent implements OnInit, OnDestroy, AfterViewChecked {
  private destroy$ = new Subject<void>();
  private charts: Map<number, Chart> = new Map();
  private chartsNeedRender = false;
  private progressChart: Chart | null = null;
  private progressNeedsRender = false;

  @ViewChildren('barCanvas') barCanvases!: QueryList<ElementRef>;
  @ViewChild('progressCanvas') progressCanvas!: ElementRef;

  sessions: string[] = [];
  selectedSession = '';
  studentId = '';
  results: ExamResult[] = [];
  expandedExamId: number | null = null;
  loading = false;
  showProgress = false;

  constructor(
    private marksService: MarksService,
    private authState: AuthStateService,
    private academicSessionService: AcademicSessionService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    @Inject(PLATFORM_ID) private platformId: object
  ) { }

  ngOnInit(): void {
    this.studentId = this.authState.getUserId();
    this.academicSessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: sessions => {
        this.sessions = sessions.map(s => s.label);
        const current = sessions.find(s => s.current);
        this.selectedSession = current ? current.label : (this.sessions[0] ?? '');
        this.cdr.markForCheck();
        this.loadResults();
      },
      error: (e) => this.logger.error('Failed to load sessions', e)
    });
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
    if (this.progressChart) { this.progressChart.destroy(); }
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewChecked(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.chartsNeedRender) {
      this.chartsNeedRender = false;
      this.renderCharts();
    }
    if (this.progressNeedsRender) {
      this.progressNeedsRender = false;
      this.renderProgressChart();
    }
  }

  loadResults(): void {
    this.loading = true;
    this.results = [];
    this.expandedExamId = null;
    this.charts.forEach(c => c.destroy());
    this.charts.clear();
    if (this.progressChart) { this.progressChart.destroy(); this.progressChart = null; }

    this.marksService.getStudentResults(this.studentId, this.selectedSession)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.results = data;
          this.loading = false;
          if (this.showProgress && this.results.length > 0) {
            this.progressNeedsRender = true;
          }
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error loading results:', e);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleProgress(): void {
    this.showProgress = !this.showProgress;
    if (this.showProgress && this.results.length > 0) {
      this.progressNeedsRender = true;
    } else if (!this.showProgress && this.progressChart) {
      this.progressChart.destroy();
      this.progressChart = null;
    }
    this.cdr.markForCheck();
  }

  // ── Progress Tracker computed values ────────────────────────────

  get bestExam(): ExamResult | null {
    if (!this.results.length) return null;
    return this.results.reduce((best, r) => r.percentage > best.percentage ? r : best);
  }

  get averagePercentage(): number {
    if (!this.results.length) return 0;
    return this.results.reduce((sum, r) => sum + r.percentage, 0) / this.results.length;
  }

  get trend(): string {
    if (this.results.length < 2) return '—';
    const last = this.results[this.results.length - 1].percentage;
    const prev = this.results[this.results.length - 2].percentage;
    if (last > prev + 1) return '↑';
    if (last < prev - 1) return '↓';
    return '→';
  }

  get trendClass(): string {
    const t = this.trend;
    if (t === '↑') return 'trend-up';
    if (t === '↓') return 'trend-down';
    return 'trend-flat';
  }

  get uniqueSubjects(): string[] {
    const seen = new Set<string>();
    this.results.forEach(r => r.subjects.forEach(s => seen.add(s.subjectName)));
    return Array.from(seen);
  }

  getSubjectMarks(exam: ExamResult, subjectName: string): { obtained: number | null; max: number } | null {
    const s = exam.subjects.find(sub => sub.subjectName === subjectName);
    return s ? { obtained: s.marksObtained, max: s.maxMarks } : null;
  }

  getSubjectTrend(subjectName: string): string {
    const entries = this.results
      .map(r => r.subjects.find(s => s.subjectName === subjectName))
      .filter((s): s is NonNullable<typeof s> => !!s && s.marksObtained !== null);
    if (entries.length < 2) return '—';
    const firstPct = (entries[0].marksObtained! / entries[0].maxMarks) * 100;
    const lastPct  = (entries[entries.length - 1].marksObtained! / entries[entries.length - 1].maxMarks) * 100;
    if (lastPct > firstPct + 2) return '↑';
    if (lastPct < firstPct - 2) return '↓';
    return '→';
  }

  getSubjectTrendClass(subjectName: string): string {
    const t = this.getSubjectTrend(subjectName);
    if (t === '↑') return 'trend-up';
    if (t === '↓') return 'trend-down';
    return 'trend-flat';
  }

  private renderProgressChart(): void {
    if (!this.progressCanvas) return;
    const canvas = this.progressCanvas.nativeElement;
    if (this.progressChart) { this.progressChart.destroy(); this.progressChart = null; }

    const labels = this.results.map(r => r.examName);
    const studentData = this.results.map(r => parseFloat(r.percentage.toFixed(1)));
    const classAvgData = this.results.map(r => {
      const totalMax = r.subjects.reduce((sum, s) => sum + s.maxMarks, 0);
      const totalAvg = r.subjects.reduce((sum, s) => sum + (s.classAverage ?? 0), 0);
      return totalMax > 0 ? parseFloat(((totalAvg / totalMax) * 100).toFixed(1)) : 0;
    });

    const isMobile = window.innerWidth <= 600;

    this.progressChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Your %',
            data: studentData,
            borderColor: '#1f6f8b',
            backgroundColor: 'rgba(31,111,139,0.12)',
            borderWidth: 3,
            pointBackgroundColor: '#1f6f8b',
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.35,
          } as any,
          {
            label: 'Class Avg %',
            data: classAvgData,
            borderColor: '#4fbdbd',
            backgroundColor: 'rgba(79,189,189,0.08)',
            borderWidth: 2,
            borderDash: [6, 4],
            pointBackgroundColor: '#4fbdbd',
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: false,
            tension: 0.35,
          } as any,
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: isMobile ? 10 : 14,
              font: { size: isMobile ? 10 : 12 },
              padding: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 0,
            max: 100,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              font: { size: isMobile ? 10 : 12 },
              callback: (v) => v + '%',
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: isMobile ? 9 : 12 },
              maxRotation: isMobile ? 30 : 0,
            },
          },
        },
      },
    });
  }

  toggleExam(examId: number): void {
    if (this.expandedExamId === examId) {
      this.expandedExamId = null;
      const chart = this.charts.get(examId);
      if (chart) { chart.destroy(); this.charts.delete(examId); }
    } else {
      this.expandedExamId = examId;
      this.chartsNeedRender = true;
      this.cdr.markForCheck();
    }
  }

  private renderCharts(): void {
    if (!this.expandedExamId) return;
    const exam = this.results.find(r => r.examId === this.expandedExamId);
    if (!exam) return;

    const canvas = this.barCanvases.find(
      (el) => el.nativeElement.dataset['examId'] === String(exam.examId)
    );
    if (!canvas) return;

    const existing = this.charts.get(exam.examId);
    if (existing) existing.destroy();

    const isMobile = window.innerWidth <= 600;

    const labels = exam.subjects.map(s => s.subjectName);
    const studentData = exam.subjects.map(s => s.marksObtained ?? 0);
    const avgData = exam.subjects.map(s => s.classAverage ?? 0);
    const maxData = exam.subjects.map(s => s.maxMarks);

    const chart = new Chart(canvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Your Marks',
            data: studentData,
            backgroundColor: 'rgba(31, 111, 139, 0.75)',
            borderColor: '#1f6f8b',
            borderWidth: 2,
            borderRadius: 4,
            ...(isMobile ? { barThickness: 18 } : {}),
          },
          {
            label: 'Class Avg',
            data: avgData,
            backgroundColor: 'rgba(79, 189, 189, 0.55)',
            borderColor: '#4fbdbd',
            borderWidth: 2,
            borderRadius: 4,
            ...(isMobile ? { barThickness: 18 } : {}),
          },
          {
            label: 'Max',
            data: maxData,
            backgroundColor: 'rgba(200, 200, 200, 0.3)',
            borderColor: '#bbb',
            borderWidth: 1,
            borderRadius: 4,
            ...(isMobile ? { barThickness: 18 } : {}),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: isMobile ? 'bottom' : 'top',
            labels: {
              boxWidth: isMobile ? 10 : 14,
              font: { size: isMobile ? 10 : 12 },
              padding: isMobile ? 8 : 12,
            },
          },
          title: { display: false },
          tooltip: {
            titleFont: { size: isMobile ? 11 : 13 },
            bodyFont: { size: isMobile ? 11 : 12 },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { font: { size: isMobile ? 10 : 12 } },
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: isMobile ? 9 : 12 },
              maxRotation: isMobile ? 30 : 0,
            },
          },
        },
      },
    });
    this.charts.set(exam.examId, chart);
  }

  getGrade(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  getGradeClass(percentage: number): string {
    if (percentage >= 80) return 'grade-a';
    if (percentage >= 60) return 'grade-b';
    if (percentage >= 40) return 'grade-c';
    return 'grade-f';
  }

  openReportCard(examId: number | null): void {
    const queryParams: Record<string, string> = {
      studentId: this.studentId,
      session: this.selectedSession,
    };
    if (examId !== null) queryParams['examId'] = String(examId);
    this.router.navigate(['/dashboard/report-card'], { queryParams });
  }

  trackById(index: number, item: { examId: number }): number { return item.examId; }
  trackByIndex(index: number): number { return index; }
}
