import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SchoolService, SchoolSettings } from '../../services/school.service';
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

  // Razorpay tab
  activeTab: 'general' | 'razorpay' = 'general';
  razorpayKeyId = '';
  razorpayKeySecret = '';

  readonly boardTypes = ['CBSE', 'ICSE', 'STATE', 'IB', 'IGCSE', 'OTHER'];

  constructor(
    private schoolService: SchoolService,
    private authStateService: AuthStateService,
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
      shortName: this.settings.shortName,
      address: this.settings.address,
      city: this.settings.city,
      state: this.settings.state,
      pincode: this.settings.pincode,
      phoneNumber: this.settings.phoneNumber,
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

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get isSuperAdmin(): boolean {
    return this.role === 'SUPER_ADMIN';
  }
}
