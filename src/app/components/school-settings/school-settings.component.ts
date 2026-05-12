import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SchoolService, SchoolSettings } from '../../services/school.service';
import { TenantService } from '../../services/tenant.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-school-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './school-settings.component.html',
  styleUrl: './school-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  role = '';
  settings: SchoolSettings | null = null;
  loading = false;
  saving = false;
  savingRazorpay = false;

  // Edit mode for general settings
  isEditing = false;
  editForm: Partial<SchoolSettings> = {};

  activeTab: 'general' | 'razorpay' = 'general';
  razorpayKeyId = '';
  razorpayKeySecret = '';

  // Logo upload
  logoPreviewUrl: string | null = null;
  logoFile: File | null = null;
  uploadingLogo = false;

  readonly boardTypes = ['CBSE', 'ICSE', 'STATE', 'IB', 'IGCSE', 'OTHER'];

  constructor(
    private schoolService: SchoolService,
    private authStateService: AuthStateService,
    public tenantService: TenantService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSettings(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.schoolService.getSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => {
        this.settings = s;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load school settings', e);
        this.toast.error('Error', 'Failed to load school settings.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  startEdit(): void {
    if (!this.settings) return;
    this.editForm = {
      name: this.settings.name,
      slug: this.settings.slug,
      address: this.settings.address,
      city: this.settings.city,
      state: this.settings.state,
      pincode: this.settings.pincode,
      phone: this.settings.phone,
      email: this.settings.email,
      website: this.settings.website,
      boardType: this.settings.boardType,
    };
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.editForm = {};
  }

  saveSettings(): void {
    if (!this.editForm.name?.trim()) {
      this.toast.error('Validation', 'School name is required.');
      return;
    }
    if (this.editForm.phone && !/^\d{10}$/.test(this.editForm.phone.trim())) {
      this.toast.warning('Validation', 'Phone number must be exactly 10 digits.');
      return;
    }
    if (this.editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editForm.email.trim())) {
      this.toast.warning('Validation', 'Please enter a valid email address.');
      return;
    }
    if (this.editForm.pincode && !/^\d{6}$/.test(this.editForm.pincode.trim())) {
      this.toast.warning('Validation', 'Pincode must be exactly 6 digits.');
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    this.schoolService.updateSettings(this.editForm).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.settings = updated;
        this.isEditing = false;
        this.editForm = {};
        this.saving = false;
        this.toast.success('Saved', 'School settings updated successfully.');
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to save school settings', e);
        this.toast.error('Error', 'Failed to save settings. Please try again.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveRazorpayKeys(): void {
    if (!this.razorpayKeyId.trim() || !this.razorpayKeySecret.trim()) {
      this.toast.error('Validation', 'Both Razorpay Key ID and Key Secret are required.');
      return;
    }
    this.savingRazorpay = true;
    this.cdr.markForCheck();
    this.schoolService.updateRazorpayKeys(this.razorpayKeyId.trim(), this.razorpayKeySecret.trim())
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.razorpayKeySecret = '';
          this.savingRazorpay = false;
          if (this.settings) this.settings.razorpayConfigured = true;
          this.toast.success('Saved', 'Razorpay keys updated successfully.');
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Failed to save Razorpay keys', e);
          this.toast.error('Error', 'Failed to save Razorpay keys. Please try again.');
          this.savingRazorpay = false;
          this.cdr.markForCheck();
        }
      });
  }

  onTabChange(tab: 'general' | 'razorpay'): void {
    this.activeTab = tab;
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.warning('Invalid File', 'Please select an image file (JPG, PNG, etc.).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.warning('File Too Large', 'Logo must be under 5 MB.');
      return;
    }

    this.logoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.logoPreviewUrl = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  cancelLogoUpload(): void {
    this.logoFile = null;
    this.logoPreviewUrl = null;
    this.cdr.markForCheck();
  }

  uploadLogo(): void {
    if (!this.logoFile) return;
    this.uploadingLogo = true;
    this.cdr.markForCheck();

    this.schoolService.uploadLogo(this.logoFile).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (this.settings) this.settings.logoUrl = res.logoUrl;
        this.logoFile = null;
        this.logoPreviewUrl = null;
        this.uploadingLogo = false;
        this.toast.success('Logo Updated', 'School logo has been uploaded successfully.');
        this.cdr.markForCheck();
        // Refresh TenantService cache so the branded login screen shows the new logo
        const slug = this.tenantService.slug;
        if (slug) {
          this.tenantService.lookupSchool(slug).then(info => {
            if (info) this.tenantService.setSchool(slug, info);
          });
        }
      },
      error: (e) => {
        this.logger.error('Failed to upload school logo', e);
        this.toast.error('Upload Failed', e?.error?.message || 'Could not upload logo. Please try again.');
        this.uploadingLogo = false;
        this.cdr.markForCheck();
      }
    });
  }

  getInitials(name?: string | null): string {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get isSuperAdmin(): boolean {
    return this.role === 'SUPER_ADMIN';
  }
}
