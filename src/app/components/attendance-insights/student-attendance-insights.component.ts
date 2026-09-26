import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { AttendanceService } from '../../services/attendance.service';
import { StudentAttendanceInsights } from '../../interfaces/attendance-insights';

/**
 * A student's current-session attendance insights (read-only). With no studentId it loads the
 * signed-in student's own figures; a parent passes the selected child's id.
 */
@Component({
  selector: 'app-student-attendance-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-attendance-insights.component.html',
  styleUrl: './attendance-insights.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentAttendanceInsightsComponent implements OnInit, OnChanges, OnDestroy {
  /** Leave empty for the signed-in student; set for a parent's selected child. */
  @Input() studentId: string | null = null;
  /** A parent must pick a child first — nothing loads until then. */
  @Input() requireStudentId = false;

  insights: StudentAttendanceInsights | null = null;
  loading = false;
  error: string | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly load$ = new Subject<string | null>();

  constructor(private attendanceService: AttendanceService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load$.pipe(
      switchMap(id => {
        this.loading = true;
        this.error = null;
        this.cdr.markForCheck();
        const request$ = id ? this.attendanceService.getStudentInsights(id) : this.attendanceService.getMyInsights();
        return request$.pipe(
          map(insights => ({ insights, error: null as string | null })),
          catchError(err => of({ insights: null, error: err?.error?.message || 'Attendance insights could not be loaded.' }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(({ insights, error }) => {
      this.insights = insights;
      this.error = error;
      this.loading = false;
      this.cdr.markForCheck();
    });
    this.reload();
  }

  ngOnChanges(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private reload(): void {
    if (!this.load$.observed) return;          // ngOnChanges runs before ngOnInit
    if (this.requireStudentId && !this.studentId) {
      this.insights = null;
      this.cdr.markForCheck();
      return;
    }
    this.load$.next(this.studentId || null);
  }

  get status(): 'none' | 'low' | 'healthy' {
    if (!this.insights || this.insights.submittedDays === 0) return 'none';
    return this.insights.lowAttendance ? 'low' : 'healthy';
  }

  /** Consecutive present days needed to reach the threshold again (0 when already there). */
  get daysToRecover(): number {
    const i = this.insights;
    if (!i || !i.lowAttendance) return 0;
    const t = i.lowAttendanceThreshold / 100;
    return Math.max(0, Math.ceil((t * i.submittedDays - i.present) / (1 - t)));
  }

  /** conic-gradient ring for the headline percentage. */
  ringStyle(pct: number): string {
    const color = pct >= (this.insights?.lowAttendanceThreshold ?? 75) ? '#10b981' : '#ef4444';
    return `conic-gradient(${color} ${Math.min(100, Math.max(0, pct)) * 3.6}deg, #e2e8f0 0deg)`;
  }

  barClass(pct: number): string {
    const threshold = this.insights?.lowAttendanceThreshold ?? 75;
    return pct >= 90 ? 'ai-bar-great' : pct >= threshold ? 'ai-bar-ok' : 'ai-bar-low';
  }

  trackByMonth(_: number, m: { year: number; month: number }): string { return `${m.year}-${m.month}`; }
  trackByDate(_: number, d: { date: string }): string { return d.date; }
}
