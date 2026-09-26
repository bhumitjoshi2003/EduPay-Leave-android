import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { AttendanceService } from '../../services/attendance.service';
import { ClassAttendanceInsights, ClassInsightStudent } from '../../interfaces/attendance-insights';

type StudentFilter = 'all' | 'low' | 'streak';

/**
 * Read-only class/section attendance insights. mode="teacher" always shows the teacher's own
 * class/section (the server decides); mode="admin" shows the given classId (+ optional section).
 */
@Component({
  selector: 'app-class-attendance-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './class-attendance-insights.component.html',
  styleUrl: './attendance-insights.shared.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassAttendanceInsightsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() mode: 'teacher' | 'admin' = 'teacher';
  @Input() classId: number | null = null;
  @Input() sectionId: number | null = null;

  insights: ClassAttendanceInsights | null = null;
  loading = false;
  error: string | null = null;
  expanded = false;
  /** A teacher without a class-teacher assignment gets nothing to show, not an error. */
  hidden = false;
  filter: StudentFilter = 'all';

  private readonly destroy$ = new Subject<void>();
  private readonly load$ = new Subject<void>();

  constructor(private attendanceService: AttendanceService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.load$.pipe(
      switchMap(() => {
        this.loading = true;
        this.error = null;
        this.cdr.markForCheck();
        const request$ = this.mode === 'teacher'
          ? this.attendanceService.getMyClassInsights()
          : this.attendanceService.getClassInsights(this.classId!, this.sectionId);
        return request$.pipe(
          map(insights => ({ insights, error: null as string | null })),
          catchError(err => of({
            insights: null,
            error: err?.status === 403 ? 'FORBIDDEN' : err?.error?.message || 'Class attendance insights could not be loaded.',
          }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(({ insights, error }) => {
      this.hidden = error === 'FORBIDDEN' && this.mode === 'teacher';
      this.insights = insights;
      this.error = error === 'FORBIDDEN'
        ? (this.hidden ? null : 'You do not have access to this class.')
        : error;
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
    if (this.mode === 'admin' && this.classId == null) {
      this.insights = null;
      this.cdr.markForCheck();
      return;
    }
    this.load$.next();
  }

  get scopeLabel(): string {
    const i = this.insights;
    if (!i) return '';
    return i.sectionName ? `Class ${i.className} – ${i.sectionName}` : `Class ${i.className}`;
  }

  get visibleStudents(): ClassInsightStudent[] {
    const all = this.insights?.students ?? [];
    const streak = this.insights?.streakThreshold ?? 3;
    if (this.filter === 'low') return all.filter(s => s.lowAttendance);
    if (this.filter === 'streak') return all.filter(s => s.currentAbsenceStreak >= streak);
    return all;
  }

  setFilter(filter: StudentFilter): void {
    this.filter = filter;
    this.expanded = true;
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  pctClass(s: ClassInsightStudent): string {
    if (s.submittedDays === 0) return 'ai-pct-none';
    return s.lowAttendance ? 'ai-pct-low' : s.percentage >= 90 ? 'ai-pct-great' : 'ai-pct-ok';
  }

  trackByStudent(_: number, s: ClassInsightStudent): string { return s.studentId; }
}
