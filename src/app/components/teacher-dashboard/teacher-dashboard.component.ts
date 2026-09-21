import { WisdomCardsComponent } from '../wisdom/wisdom-cards.component';
import { TeacherGettingStartedComponent } from '../teacher-getting-started/teacher-getting-started.component';
import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ToastService } from '../../services/toast.service';

import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService, LeaveApplication } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherAttendanceRecord, TeacherAttendanceSummary } from '../../interfaces/teacher-checkin';
import { TeacherLeaveService } from '../../services/teacher-leave.service';
import { TeacherLeave } from '../../interfaces/teacher-leave';
import { formatTeacherAttendanceTime, teacherAttendanceErrorMessage } from '../../utils/teacher-attendance.util';
import { TimetableService } from '../../services/timetable.service';
import { TimetableEntry } from '../../interfaces/timetable';
import { subjectIcon } from '../../utils/subject-visual.util';
import { isShowTimesEnabled } from '../../utils/timetable-preferences.util';
import {
  buildTodayClassesView,
  TeacherTodayClassEntry,
  TeacherTodayClassesView,
} from '../../utils/teacher-timetable-today.util';

const EMPTY_TODAY_VIEW: TeacherTodayClassesView = { current: null, upcoming: [], allDone: false, hasAnyToday: false };

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [WisdomCardsComponent, TeacherGettingStartedComponent, CommonModule, RouterLink, MatIconModule],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  teacherName = '';
  className = '';
  isClassTeacher = false;
  isLoading = true;
  today = new Date();

  totalStudents = 0;
  todayAbsent = 0;
  attendanceTaken = false;   // true when 'X' record found → school was open that day
  pendingLeavesCount = 0;
  monthlyAttendanceRate = 0;
  recentLeaves: LeaveApplication[] = [];
  personalAttendance: TeacherAttendanceSummary | null = null;
  todayTeacherRecord: TeacherAttendanceRecord | null = null;
  personalSummaryLoading = true;
  recentTeacherLeaves: TeacherLeave[] = [];
  teacherLeavesLoading = true;

  timetableEntries: TimetableEntry[] = [];
  todayClassesLoading = true;
  todayClassesError: string | null = null;
  todayView: TeacherTodayClassesView = EMPTY_TODAY_VIEW;
  /** Read synchronously at construction — never loaded asynchronously, so the UI can never
   * briefly show clock times before the real "show times" preference is known. This is the
   * same per-device viewer preference as the full Timetable page's own "Show times" toggle
   * (localStorage, not a school/admin setting) — see timetable-preferences.util. */
  readonly showTimes: boolean = isShowTimesEnabled();

  constructor(
    private authState: AuthStateService,
    private teacherService: TeacherService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService,
    private checkinService: TeacherCheckinService,
    private teacherLeaveService: TeacherLeaveService,
    private timetableService: TimetableService
  ) { }

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (!user?.userId) { this.isLoading = false; return; }

    this.loadPersonalAttendance();
    this.loadRecentTeacherLeaves();
    this.loadTodayClasses(user.userId);

    this.teacherService.getTeacher(user.userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: teacher => {
          this.teacherName = teacher.name;
          this.className = teacher.classTeacher ?? '';
          this.isClassTeacher = !!teacher.classTeacher;
          if (this.isClassTeacher) {
            this.loadClassData();
          } else {
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        },
        error: e => {
          this.logger.error('Teacher fetch error:', e);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadRecentTeacherLeaves(): void {
    this.teacherLeaveService.getMyLeaves(0, 3)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.recentTeacherLeaves = response.content.slice(0, 3);
          this.teacherLeavesLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Recent teacher leaves load error:', error);
          this.teacherLeavesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadPersonalAttendance(): void {
    const month = this.today.getMonth() + 1;
    const year = this.today.getFullYear();

    this.checkinService.getMyAttendance(month, year)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: summary => {
          this.personalAttendance = summary;
          const todayKey = this.toLocalDateKey(this.today);
          this.todayTeacherRecord = summary.records.find(record => record.date === todayKey) ?? null;
          this.personalSummaryLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Personal attendance summary load error:', error);
          this.personalSummaryLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private toLocalDateKey(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** Independent of the class-teacher forkJoin below — every teacher has periods they
   * teach, and a timetable failure here must never block the rest of the dashboard. */
  private loadTodayClasses(teacherId: string): void {
    this.todayClassesLoading = true;
    this.todayClassesError = null;
    this.cdr.markForCheck();

    this.timetableService.getTeacherTimetable(teacherId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: entries => {
          this.timetableEntries = entries;
          this.todayView = buildTodayClassesView(entries, new Date());
          this.todayClassesLoading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Today\'s classes load error:', error);
          this.todayClassesError = teacherAttendanceErrorMessage(error, 'Unable to load today\'s classes.');
          this.todayClassesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  retryTodayClasses(): void {
    const user = this.authState.getUser();
    if (!user?.userId) return;
    this.loadTodayClasses(user.userId);
  }

  classLabel(entry: TeacherTodayClassEntry): string {
    return entry.sectionName ? `Class ${entry.className} – ${entry.sectionName}` : `Class ${entry.className}`;
  }

  /** Period identity + class — always shown regardless of the "show times" preference,
   * since that preference only governs clock-time visibility (see classTimeRange). */
  periodClassLabel(entry: TeacherTodayClassEntry): string {
    return `Period ${entry.periodNumber} · ${this.classLabel(entry)}`;
  }

  getSubjectIcon(subjectName: string): string {
    return subjectIcon(subjectName);
  }

  /**
   * The clock-time range, or null when there's nothing genuine to show — either the entry
   * has no reliable start/end time (an untimed "scheduled" fallback entry) or the viewer's
   * "show times" preference is off. Never invents a time and never returns a placeholder
   * like "--": the template hides the whole time element when this is null, so the row
   * layout reclaims that space instead of leaving it blank.
   */
  classTimeRange(entry: TeacherTodayClassEntry): string | null {
    if (!this.showTimes) return null;
    if (!entry.startTime || !entry.endTime) return null;
    return `${formatTeacherAttendanceTime(entry.startTime)} – ${formatTeacherAttendanceTime(entry.endTime)}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadClassData(): void {
    const now = this.today;
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    forkJoin([
      this.studentService.getActiveStudentsByClass(this.className),
      this.attendanceService.getAttendanceByDateAndClass(todayStr, this.className),
      this.leaveService.getLeavesPaginated(0, 50, this.className),
      this.attendanceService.getClassSummary(this.className, { year, month }),
    ]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([students, absentToday, leavesPage, summary]) => {
        this.totalStudents = students.length;
        // 'X' is a dummy record that marks the school as open that day.
        // Exclude it from the real absent count.
        this.attendanceTaken = absentToday.some(a => a.studentId === 'X');
        this.todayAbsent = absentToday.filter(a => a.studentId !== 'X'
          && (!a.status || a.status === 'ABSENT')).length;

        const pending = leavesPage.content.filter(l => l.status === 'PENDING');
        this.pendingLeavesCount = pending.length;
        this.recentLeaves = pending.slice(0, 5);

        if (summary.length > 0) {
          const avg = summary.reduce((s, r) => s + r.attendancePercentage, 0) / summary.length;
          this.monthlyAttendanceRate = avg;
        }

        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: e => {
        this.logger.error('Class data load error:', e);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  approveLeave(leaveId: number): void {
    this.leaveService.updateLeaveStatus(leaveId, 'APPROVED')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.recentLeaves = this.recentLeaves.filter(l => l.id !== leaveId);
          this.pendingLeavesCount = Math.max(0, this.pendingLeavesCount - 1);
          this.cdr.markForCheck();
        },
        error: e => {
          this.logger.error('Approve leave error:', e);
          this.toast.error('Error', 'Failed to approve leave. Please try again.');
        }
      });
  }

  rejectLeave(leaveId: number): void {
    this.leaveService.updateLeaveStatus(leaveId, 'REJECTED')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.recentLeaves = this.recentLeaves.filter(l => l.id !== leaveId);
          this.pendingLeavesCount = Math.max(0, this.pendingLeavesCount - 1);
          this.cdr.markForCheck();
        },
        error: e => {
          this.logger.error('Reject leave error:', e);
          this.toast.error('Error', 'Failed to reject leave. Please try again.');
        }
      });
  }

  get greeting(): string {
    const h = this.today.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get attendanceColor(): string {
    if (this.monthlyAttendanceRate >= 85) return '#059669';
    if (this.monthlyAttendanceRate >= 70) return '#d97706';
    return '#dc2626';
  }

  get todayPresentCount(): number {
    return Math.max(0, this.totalStudents - this.todayAbsent);
  }

  get personalAttendanceStatus(): string {
    if (!this.todayTeacherRecord) return 'Not checked in';
    return this.todayTeacherRecord.status.replaceAll('_', ' ').toLowerCase()
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  get personalAttendancePercent(): number {
    return Math.max(0, Math.min(100, this.personalAttendance?.attendancePercentage ?? 0));
  }

  formatAttendanceTime(value: string | null): string {
    return formatTeacherAttendanceTime(value);
  }

  get isWeekend(): boolean {
    return this.today.getDay() === 0; // Sunday only — Indian schools are open on Saturday
  }

  /** 'weekend' | 'not-marked' | 'marked' */
  get absentCardState(): 'weekend' | 'not-marked' | 'marked' {
    if (this.isWeekend) return 'weekend';
    // 'not-marked' = no 'X' record found → attendance was never submitted today
    // 'marked'     = 'X' record exists → school was open, attendance submitted
    //                (todayAbsent may be 0 = all present, or N = N real absences)
    return this.attendanceTaken ? 'marked' : 'not-marked';
  }

  hasFeature(featureKey: string): boolean {
    return this.authState.hasFeature(featureKey);
  }
}
