import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SchoolService, SchoolSettings } from '../../services/school.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

interface DashboardStats {
  totalSchools: number;
  activeSchools: number;
  totalStudents: number;
  totalTeachers: number;
  revenueThisMonth: number;
}

interface OnboardForm {
  name: string;
  shortName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phoneNumber: string;
  email: string;
  website: string;
  boardType: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
}

interface SubscriptionForm {
  plan: string;
  maxStudents: number | null;
  expiryDate: string;
  active: boolean;
}

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './super-admin-dashboard.component.html',
  styleUrl: './super-admin-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperAdminDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'overview' | 'schools' = 'overview';
  stats: DashboardStats | null = null;
  schools: SchoolSettings[] = [];
  loading = false;
  loadingSchools = false;

  // Onboard form
  showOnboardForm = false;
  onboarding = false;
  onboardForm: OnboardForm = this.emptyOnboardForm();

  // Subscription edit
  editingSchoolId: number | null = null;
  subForm: SubscriptionForm = { plan: '', maxStudents: null, expiryDate: '', active: true };
  savingSub = false;

  readonly plans = ['FREE', 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];
  readonly boardTypes = ['CBSE', 'ICSE', 'STATE', 'IB', 'IGCSE', 'OTHER'];

  constructor(
    private schoolService: SchoolService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOverview(): void {
    this.loading = true;
    this.cdr.markForCheck();
    forkJoin({
      stats: this.schoolService.getDashboard(),
      schools: this.schoolService.listAllSchools(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, schools }) => {
        this.stats = stats;
        this.schools = schools;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error loading super-admin data', e);
        this.toast.error('Error', 'Failed to load dashboard data.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadSchools(): void {
    this.loadingSchools = true;
    this.cdr.markForCheck();
    this.schoolService.listAllSchools().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.schools = list;
        this.loadingSchools = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error loading schools', e);
        this.toast.error('Error', 'Failed to load schools.');
        this.loadingSchools = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Onboarding ───────────────────────────────────────────────────────────

  openOnboardForm(): void {
    this.onboardForm = this.emptyOnboardForm();
    this.showOnboardForm = true;
  }

  cancelOnboard(): void {
    this.showOnboardForm = false;
  }

  submitOnboard(): void {
    const f = this.onboardForm;
    if (!f.name.trim() || !f.adminUserId.trim() || !f.adminEmail.trim() || !f.adminPassword.trim()) {
      this.toast.error('Validation', 'School name, admin user ID, email and password are required.');
      return;
    }
    this.onboarding = true;
    this.cdr.markForCheck();
    this.schoolService.onboardSchool(f).pipe(takeUntil(this.destroy$)).subscribe({
      next: (school) => {
        this.schools = [school, ...this.schools];
        this.showOnboardForm = false;
        this.onboarding = false;
        this.toast.success('Success', `School "${school.name}" onboarded successfully.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error onboarding school', e);
        const msg = e?.error ?? 'Failed to onboard school. Please try again.';
        this.toast.error('Error', typeof msg === 'string' ? msg : 'Failed to onboard school.');
        this.onboarding = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Subscription ─────────────────────────────────────────────────────────

  openSubEdit(school: SchoolSettings): void {
    this.editingSchoolId = school.id;
    this.subForm = {
      plan: school.plan ?? 'FREE',
      maxStudents: null,
      expiryDate: '',
      active: school.active,
    };
    this.cdr.markForCheck();
  }

  cancelSubEdit(): void {
    this.editingSchoolId = null;
  }

  saveSub(): void {
    if (!this.editingSchoolId) return;
    const payload: any = {
      plan: this.subForm.plan,
      active: this.subForm.active,
    };
    if (this.subForm.maxStudents != null) payload.maxStudents = this.subForm.maxStudents;
    if (this.subForm.expiryDate) payload.expiryDate = this.subForm.expiryDate;

    this.savingSub = true;
    this.cdr.markForCheck();
    this.schoolService.updateSubscription(this.editingSchoolId, payload)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (updated) => {
          this.schools = this.schools.map(s => s.id === updated.id ? updated : s);
          this.editingSchoolId = null;
          this.savingSub = false;
          this.toast.success('Saved', 'Subscription updated.');
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error updating subscription', e);
          this.toast.error('Error', 'Failed to update subscription.');
          this.savingSub = false;
          this.cdr.markForCheck();
        }
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private emptyOnboardForm(): OnboardForm {
    return {
      name: '', shortName: '', address: '', city: '', state: '', pincode: '',
      phoneNumber: '', email: '', website: '', boardType: '',
      adminUserId: '', adminEmail: '', adminPassword: '',
    };
  }

  get activeCount(): number {
    return this.schools.filter(s => s.active).length;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }
}
