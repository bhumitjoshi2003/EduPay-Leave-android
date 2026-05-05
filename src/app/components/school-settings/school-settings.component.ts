import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SchoolService, SchoolSettings, SchoolClass } from '../../services/school.service';
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
  activeTab: 'general' | 'classes' | 'razorpay' = 'general';
  razorpayKeyId = '';
  razorpayKeySecret = '';

  // Classes tab
  managedClasses: SchoolClass[] = [];
  loadingClasses = false;
  newClassName = '';
  addingClass = false;
  savingOrder = false;

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

  // ── Class management ──────────────────────────────────────────────────────

  loadManagedClasses(): void {
    this.loadingClasses = true;
    this.cdr.markForCheck();
    this.schoolService.getManagedClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.managedClasses = list;
        this.loadingClasses = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load classes', e);
        this.loadingClasses = false;
        this.cdr.markForCheck();
      }
    });
  }

  addNewClass(): void {
    const name = this.newClassName.trim();
    if (!name) return;
    this.addingClass = true;
    this.cdr.markForCheck();
    this.schoolService.addClass(name).pipe(takeUntil(this.destroy$)).subscribe({
      next: (c) => {
        this.managedClasses = [...this.managedClasses, c];
        this.newClassName = '';
        this.addingClass = false;
        this.schoolService.invalidateClasses();
        this.toast.success('Added', `Class "${c.name}" added.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to add class', e);
        this.toast.error('Error', 'Could not add class. It may already exist.');
        this.addingClass = false;
        this.cdr.markForCheck();
      }
    });
  }

  removeClass(cls: SchoolClass): void {
    this.schoolService.deleteClass(cls.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.managedClasses = this.managedClasses.filter(c => c.id !== cls.id);
        this.schoolService.invalidateClasses();
        this.toast.success('Removed', `Class "${cls.name}" removed.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to delete class', e);
        this.toast.error('Error', 'Could not remove class.');
        this.cdr.markForCheck();
      }
    });
  }

  moveClass(index: number, direction: 'up' | 'down'): void {
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (swap < 0 || swap >= this.managedClasses.length) return;
    const list = [...this.managedClasses];
    [list[index], list[swap]] = [list[swap], list[index]];
    this.managedClasses = list;
    this.cdr.markForCheck();
  }

  saveOrder(): void {
    this.savingOrder = true;
    this.cdr.markForCheck();
    const ids = this.managedClasses.map(c => c.id);
    this.schoolService.reorderClasses(ids).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingOrder = false;
        this.schoolService.invalidateClasses();
        this.toast.success('Saved', 'Class order saved.');
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to reorder classes', e);
        this.toast.error('Error', 'Could not save order.');
        this.savingOrder = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleStreamEligible(cls: SchoolClass): void {
    const newValue = !cls.streamEligible;
    this.schoolService.toggleStreamEligible(cls.id, newValue).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.managedClasses = this.managedClasses.map(c => c.id === updated.id ? updated : c);
        this.cdr.markForCheck();
        this.toast.success(
          newValue ? 'Stream Eligible' : 'Removed',
          `"${cls.name}" ${newValue ? 'added to' : 'removed from'} stream assignment.`
        );
      },
      error: (e) => {
        this.logger.error('Failed to toggle stream eligibility', e);
        this.toast.error('Error', 'Could not update stream eligibility.');
      }
    });
  }

  onTabChange(tab: 'general' | 'classes' | 'razorpay'): void {
    this.activeTab = tab;
    if (tab === 'classes' && this.managedClasses.length === 0 && !this.loadingClasses) {
      this.loadManagedClasses();
    }
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get isSuperAdmin(): boolean {
    return this.role === 'SUPER_ADMIN';
  }
}
