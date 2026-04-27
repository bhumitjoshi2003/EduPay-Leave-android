import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, takeUntil } from 'rxjs';

import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService, LeaveApplication } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
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

  constructor(
    private authState: AuthStateService,
    private teacherService: TeacherService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
  ) { }

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (!user?.userId) { this.isLoading = false; return; }

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
        this.todayAbsent = absentToday.filter(a => a.studentId !== 'X').length;

        const pending = leavesPage.content.filter(l => l.status === 'PENDING');
        this.pendingLeavesCount = pending.length;
        this.recentLeaves = pending.slice(0, 5);

        if (summary.length > 0) {
          const avg = summary.reduce((s, r) => s + r.attendancePercentage, 0) / summary.length;
          this.monthlyAttendanceRate = Math.round(avg);
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
        error: e => this.logger.error('Approve leave error:', e)
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
        error: e => this.logger.error('Reject leave error:', e)
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
}
