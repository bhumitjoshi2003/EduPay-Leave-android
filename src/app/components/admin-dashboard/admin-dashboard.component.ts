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
import { SchoolService, SchoolEntitlementSummary } from '../../services/school.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

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
  entitlement: SchoolEntitlementSummary | null = null;

  constructor(
    private authState: AuthStateService,
    private adminService: AdminService,
    private analyticsService: DashboardAnalyticsService,
    private leaveService: LeaveService,
    private schoolService: SchoolService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const user = this.authState.getUser();
    if (user?.userId) {
      this.adminService.getAdminById(user.userId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: a => { this.adminName = a.name; this.cdr.markForCheck(); },
          error: e => this.logger.error('Failed to load admin name:', e)
        });
    }

    forkJoin([
      this.analyticsService.getStats(),
      this.leaveService.getLeavesPaginated(0, 10),
      this.schoolService.getEntitlement(),
    ]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([stats, leavesPage, entitlement]) => {
        this.stats = stats as DashboardStats;
        const pending = (leavesPage as any).content.filter((l: any) => l.status === 'PENDING');
        this.recentLeaves = pending.slice(0, 5);
        this.entitlement = entitlement as SchoolEntitlementSummary;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e: any) => {
        this.logger.error('Admin dashboard load error:', e);
        this.isLoading = false;
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load dashboard data.');
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

  usagePct(current: number, max: number | null): number {
    if (!max || max <= 0) return 0;
    return Math.min(100, Math.round((current / max) * 100));
  }

  usageBarColor(pct: number, softPct: number, hardPct: number): string {
    if (pct >= hardPct) return '#dc2626';
    if (pct >= softPct) return '#d97706';
    return '#059669';
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
