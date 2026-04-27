import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, takeUntil } from 'rxjs';

import { AuthStateService } from '../../auth/auth-state.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService, LeaveApplication } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  studentId = '';
  studentName = '';
  className = '';
  isLoading = true;
  today = new Date();

  attendancePercentage = 0;
  daysPresent = 0;
  daysAbsent = 0;
  totalWorkingDays = 0;
  pendingLeavesCount = 0;
  recentLeaves: LeaveApplication[] = [];

  constructor(
    private authState: AuthStateService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private leaveService: LeaveService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (!user?.userId) { this.isLoading = false; return; }
    this.studentId = user.userId;

    this.studentService.getStudent(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: student => {
          this.studentName = student.name;
          this.className = student.className;
          this.loadDashboardData();
        },
        error: e => {
          this.logger.error('Student fetch error:', e);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    const now = this.today;
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    forkJoin([
      this.attendanceService.getStudentSummary(this.studentId, { type: 'month', month, year }),
      this.leaveService.getLeavesByStudentId(this.studentId, 0, 10),
    ]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([summary, leavesPage]) => {
        this.attendancePercentage = Math.round(summary.attendancePercentage);
        this.daysPresent = summary.daysPresent;
        this.daysAbsent = summary.daysAbsent;
        this.totalWorkingDays = summary.totalWorkingDays;

        const leaves = leavesPage.content
          .slice()
          .sort((a, b) => b.leaveDate.localeCompare(a.leaveDate));
        this.pendingLeavesCount = leaves.filter(l => l.status === 'PENDING').length;
        this.recentLeaves = leaves.slice(0, 5);

        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: e => {
        this.logger.error('Student dashboard data error:', e);
        this.isLoading = false;
        this.cdr.markForCheck();
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
    if (this.attendancePercentage >= 85) return '#059669';
    if (this.attendancePercentage >= 70) return '#d97706';
    return '#dc2626';
  }

  getLeaveStatusClass(status: string): string {
    switch (status) {
      case 'APPROVED': return 'sd-status--approved';
      case 'REJECTED': return 'sd-status--rejected';
      default:         return 'sd-status--pending';
    }
  }

  getLeaveStatusLabel(status: string): string {
    switch (status) {
      case 'APPROVED': return 'Approved';
      case 'REJECTED': return 'Rejected';
      default:         return 'Pending';
    }
  }
}
