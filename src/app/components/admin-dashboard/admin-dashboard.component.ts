import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, takeUntil } from 'rxjs';

import { AuthStateService } from '../../auth/auth-state.service';
import { AdminService } from '../../services/admin.service';
import { DashboardAnalyticsService, DashboardStats } from '../../services/dashboard-analytics.service';
import { LeaveService, LeaveApplication } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  adminName = '';
  isLoading = true;
  today = new Date();

  stats: DashboardStats | null = null;
  recentLeaves: LeaveApplication[] = [];

  constructor(
    private authState: AuthStateService,
    private adminService: AdminService,
    private analyticsService: DashboardAnalyticsService,
    private leaveService: LeaveService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (user?.userId) {
      this.adminService.getAdminById(user.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: a => { this.adminName = a.name; this.cdr.markForCheck(); } });
    }

    forkJoin([
      this.analyticsService.getStats(),
      this.leaveService.getLeavesPaginated(0, 10),
    ]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([stats, leavesPage]) => {
        this.stats = stats;
        const pending = leavesPage.content.filter(l => l.status === 'PENDING');
        this.recentLeaves = pending.slice(0, 5);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: e => {
        this.logger.error('Admin dashboard load error:', e);
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get greeting(): string {
    const h = this.today.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get attendanceColor(): string {
    const r = this.stats?.todayAttendanceRate ?? 0;
    if (r >= 85) return '#059669';
    if (r >= 70) return '#d97706';
    return '#dc2626';
  }

  get attendanceGradient(): string {
    const r = this.stats?.todayAttendanceRate ?? 0;
    if (r >= 85) return '--c1:#059669;--c2:#34d399';
    if (r >= 70) return '--c1:#d97706;--c2:#fbbf24';
    return '--c1:#dc2626;--c2:#f87171';
  }
}
