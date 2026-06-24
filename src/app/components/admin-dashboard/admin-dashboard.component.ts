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
  lastRefreshedAt: Date | null = null;
  isRefreshing: boolean = false;

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

    this.loadDashboardData();
  }

  loadDashboardData(): void {
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
        this.isRefreshing = false;
        this.lastRefreshedAt = new Date();
        this.cdr.markForCheck();
      },
      error: (e: any) => {
        this.logger.error('Admin dashboard load error:', e);
        this.isLoading = false;
        this.isRefreshing = false;
        this.lastRefreshedAt = new Date();
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load dashboard data.');
      }
    });
  }

  refreshDashboard(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.loadDashboardData();
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

  usagePctRaw(current: number, max: number | null): number {
    if (!max || max <= 0) return 0;
    return Math.round((current / max) * 100);
  }

  usageBarColor(pct: number, softPct: number | null, hardPct: number | null): string {
    const soft = softPct ?? 90;
    const hard = hardPct ?? 105;
    if (pct >= hard) return '#dc2626';
    if (pct >= soft) return '#d97706';
    return '#059669';
  }

  daysUntil(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  countdownLabel(): string {
    if (!this.entitlement) return '';
    const s = this.entitlement.subscriptionStatus;
    if (s === 'EXPIRED') return 'Subscription expired';
    if (s === 'GRACE') {
      const d = this.daysUntil(this.entitlement.graceEndsAt);
      if (d === null) return 'Grace period active';
      return d <= 0 ? 'Grace period ended' : d === 1 ? '1 day left in grace' : `${d} days left in grace`;
    }
    if (s === 'TRIAL') {
      const d = this.daysUntil(this.entitlement.trialEndsAt);
      if (d === null || d > 14) return '';
      return d <= 0 ? 'Trial expired' : d === 1 ? '1 day left' : `${d} days left`;
    }
    if (s === 'ACTIVE') {
      const d = this.daysUntil(this.entitlement.expiresAt);
      if (d === null || d > 14) return '';
      return d <= 0 ? 'Expired' : d === 1 ? '1 day left' : `${d} days left`;
    }
    return '';
  }

  showUpgradeCta(): boolean {
    if (!this.entitlement) return false;
    const s = this.entitlement.subscriptionStatus;
    if (s === 'EXPIRED' || s === 'GRACE') return true;
    const d = s === 'TRIAL'
      ? this.daysUntil(this.entitlement.trialEndsAt)
      : this.daysUntil(this.entitlement.expiresAt);
    return d !== null && d <= 7;
  }

  countdownUrgency(): 'critical' | 'warn' | 'info' {
    if (!this.entitlement) return 'info';
    const s = this.entitlement.subscriptionStatus;
    if (s === 'EXPIRED' || s === 'GRACE') return 'critical';
    const d = s === 'TRIAL'
      ? this.daysUntil(this.entitlement.trialEndsAt)
      : this.daysUntil(this.entitlement.expiresAt);
    if (d === null) return 'info';
    if (d <= 3) return 'critical';
    if (d <= 7) return 'warn';
    return 'info';
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
