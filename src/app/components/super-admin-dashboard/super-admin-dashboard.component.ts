import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SchoolService, SchoolSettings } from '../../services/school.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import Swal from 'sweetalert2';

interface DashboardStats {
  totalSchools: number;
  activeSchools: number;
  totalStudents: number;
  totalTeachers: number;
  revenueThisMonth: number;
}

interface OnboardForm {
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  boardType: string;
  adminUserId: string;
  adminEmail: string;
  adminPassword: string;
}

interface EditSchoolForm {
  // School info
  name: string;
  boardType: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPersonName: string;
  // Subscription
  plan: string;
  maxStudents: number | null;
  expiryDate: string;
  active: boolean;
  // Password change
  newAdminPassword: string;
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

  // Onboard form
  showOnboardForm = false;
  onboarding = false;
  onboardForm: OnboardForm = this.emptyOnboardForm();

  // Edit form
  editingSchoolId: number | null = null;
  editForm: EditSchoolForm = this.emptyEditForm();
  saving = false;
  showPasswordField = false;

  readonly plans = ['TRIAL', 'FREE', 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];
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

  // ── Onboarding ──────────────────────────────────────────────────────────────

  openOnboardForm(): void {
    this.onboardForm = this.emptyOnboardForm();
    this.showOnboardForm = true;
    this.editingSchoolId = null;
  }

  cancelOnboard(): void {
    this.showOnboardForm = false;
  }

  submitOnboard(): void {
    const f = this.onboardForm;
    if (!f.name.trim() || !f.slug.trim() || !f.adminUserId.trim() || !f.adminEmail.trim() || !f.adminPassword.trim()) {
      this.toast.error('Validation', 'School name, slug, admin user ID, email and password are required.');
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
        const msg = e?.error?.message ?? e?.error ?? 'Failed to onboard school.';
        this.toast.error('Error', typeof msg === 'string' ? msg : 'Failed to onboard school.');
        this.onboarding = false;
        this.cdr.markForCheck();
      }
    });
  }

  // ── Edit School ─────────────────────────────────────────────────────────────

  openEdit(school: SchoolSettings): void {
    this.editingSchoolId = school.id;
    this.showOnboardForm = false;
    this.showPasswordField = false;
    this.editForm = {
      name: school.name ?? '',
      boardType: school.boardType ?? '',
      email: school.email ?? '',
      phone: school.phone ?? '',
      website: school.website ?? '',
      address: school.address ?? '',
      city: school.city ?? '',
      state: school.state ?? '',
      pincode: school.pincode ?? '',
      contactPersonName: school.contactPersonName ?? '',
      plan: school.plan ?? 'TRIAL',
      maxStudents: school.maxStudents ?? null,
      expiryDate: school.expiryDate ?? '',
      active: school.active,
      newAdminPassword: '',
    };
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingSchoolId = null;
    this.showPasswordField = false;
  }

  saveEdit(): void {
    if (!this.editingSchoolId) return;
    const f = this.editForm;

    if (!f.name.trim()) {
      this.toast.error('Validation', 'School name is required.');
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    const payload: any = {
      name: f.name.trim(),
      boardType: f.boardType || null,
      email: f.email || null,
      phone: f.phone || null,
      website: f.website || null,
      address: f.address || null,
      city: f.city || null,
      state: f.state || null,
      pincode: f.pincode || null,
      contactPersonName: f.contactPersonName || null,
      plan: f.plan || null,
      maxStudents: f.maxStudents ?? null,
      expiryDate: f.expiryDate || null,
      active: f.active,
    };

    this.schoolService.updateSchoolAll(this.editingSchoolId, payload)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (updated) => {
          this.schools = this.schools.map(s => s.id === updated.id ? updated : s);

          // If password also needs reset
          if (f.newAdminPassword.trim()) {
            this.schoolService.resetAdminPassword(this.editingSchoolId!, f.newAdminPassword.trim())
              .pipe(takeUntil(this.destroy$)).subscribe({
                next: () => {
                  this.toast.success('Saved', 'School updated and admin password changed.');
                  this.saving = false;
                  this.editingSchoolId = null;
                  this.showPasswordField = false;
                  this.cdr.markForCheck();
                },
                error: (e) => {
                  this.logger.error('Error resetting password', e);
                  this.toast.error('Warning', 'School info saved, but password reset failed.');
                  this.saving = false;
                  this.editingSchoolId = null;
                  this.showPasswordField = false;
                  this.cdr.markForCheck();
                }
              });
          } else {
            this.toast.success('Saved', 'School updated successfully.');
            this.saving = false;
            this.editingSchoolId = null;
            this.showPasswordField = false;
            this.cdr.markForCheck();
          }
        },
        error: (e) => {
          this.logger.error('Error updating school', e);
          const msg = e?.error?.message ?? 'Failed to update school.';
          this.toast.error('Error', typeof msg === 'string' ? msg : 'Failed to update school.');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  confirmToggleActive(school: SchoolSettings): void {
    const isActive = school.active;
    Swal.fire({
      title: isActive ? 'Deactivate School?' : 'Activate School?',
      html: isActive
        ? `This will deactivate <strong>${school.name}</strong> and prevent login for all its users.`
        : `This will reactivate <strong>${school.name}</strong> and restore access for all its users.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isActive ? '#dc2626' : '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: isActive ? 'Yes, deactivate' : 'Yes, activate',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.schoolService.deleteSchool(school.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          const newActive = !isActive;
          this.schools = this.schools.map(s =>
            s.id === school.id ? { ...s, active: newActive } : s
          );
          // Also update the edit form so the checkbox reflects the new state
          if (this.editingSchoolId === school.id) {
            this.editForm = { ...this.editForm, active: newActive };
          }
          this.toast.success('Done', `"${school.name}" has been ${newActive ? 'activated' : 'deactivated'}.`);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error toggling school active state', e);
          this.toast.error('Error', `Failed to ${isActive ? 'deactivate' : 'activate'} school.`);
          this.cdr.markForCheck();
        }
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  generateSlug(): void {
    this.onboardForm.slug = this.onboardForm.name.trim().toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  get activeCount(): number {
    return this.schools.filter(s => s.active).length;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }

  trackById(_: number, item: SchoolSettings): number { return item.id; }

  private emptyOnboardForm(): OnboardForm {
    return {
      name: '', slug: '', address: '', city: '', state: '', pincode: '',
      phone: '', email: '', website: '', boardType: '',
      adminUserId: '', adminEmail: '', adminPassword: '',
    };
  }

  private emptyEditForm(): EditSchoolForm {
    return {
      name: '', boardType: '', email: '', phone: '', website: '',
      address: '', city: '', state: '', pincode: '', contactPersonName: '',
      plan: 'TRIAL', maxStudents: null, expiryDate: '', active: true,
      newAdminPassword: '',
    };
  }
}
