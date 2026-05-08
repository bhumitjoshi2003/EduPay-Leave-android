import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

interface Admin {
  adminId: string;
  name: string;
  email: string;
  phoneNumber: string;
  dob: string;
  gender: string;
  photoUrl?: string;
}

@Component({
  selector: 'app-admin-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-details.component.html',
  styleUrl: './admin-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDetailsComponent implements OnInit, OnDestroy {
  adminId: string = '';
  adminDetails: Admin | null = null;
  updatedDetails: Admin | null = null;

  loggedInUserRole: string = '';
  loggedInUserId: string = '';
  isEditing: boolean = false;
  isNewAdmin: boolean = false;

  // Change-password modal state
  showPasswordModal = false;
  cpOldPw = '';
  cpNewPw = '';
  cpConfirmPw = '';
  cpShowOld = false;
  cpShowNew = false;
  cpShowConfirm = false;
  cpShowOldField = false;

  private ngUnsubscribe = new Subject<void>();

  // Photo upload state
  photoUploading = false;
  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    private authService: AuthService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    if (user) {
      this.loggedInUserRole = user.role;
      this.loggedInUserId = user.userId;
    }

    this.route.params.pipe(takeUntil(this.ngUnsubscribe)).subscribe(params => {
      this.adminId = params['adminId'];
      if (this.adminId === 'new') {
        this.prepareCreateMode();
      } else if (this.adminId) {
        this.loadAdminDetails(this.adminId);
      }
    });
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  loadAdminDetails(id: string): void {
    this.adminService.getAdminById(id).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: (data) => {
        this.adminDetails = data;
        this.updatedDetails = { ...data };
        this.cdr.markForCheck();
      },
      error: () => this.toast.error('Error', 'Could not load admin details')
    });
  }

  prepareCreateMode(): void {
    if (this.loggedInUserRole !== 'SUPER_ADMIN') {
      this.router.navigate(['/dashboard/admin-list']);
      return;
    }
    this.isNewAdmin = true;
    this.isEditing = true;
    this.updatedDetails = { adminId: '', name: '', email: '', phoneNumber: '', dob: '', gender: '' };
  }

  canEdit(): boolean {
    return this.loggedInUserRole === 'SUPER_ADMIN' || this.loggedInUserId === this.adminId;
  }

  enableEditMode(): void {
    this.isEditing = true;
  }

  cancelEdit(): void {
    if (this.isNewAdmin) {
      this.router.navigate(['/dashboard/admin-list']);
    } else {
      this.isEditing = false;
      this.updatedDetails = { ...this.adminDetails! };
    }
  }

  saveAdmin(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      this.toast.error('Error', 'Please correct the invalid fields.');
      return;
    }

    const action = this.isNewAdmin
      ? this.adminService.createAdmin(this.updatedDetails!)
      : this.adminService.updateAdmin(this.adminId, this.updatedDetails!);

    this.toast.confirm({
      title: 'Confirm Save',
      message: 'Save administrator details?',
      confirmText: 'Yes, Save'
    }).then((confirmed) => {
      if (confirmed) {
        action.pipe(takeUntil(this.ngUnsubscribe)).subscribe({
          next: (savedAdmin) => {
            this.adminDetails = savedAdmin;
            this.updatedDetails = { ...savedAdmin };
            this.isEditing = false;
            this.cdr.markForCheck();
            this.toast.success('Saved!', 'Admin details updated successfully.');
          },
          error: (err) => this.toast.error('Error', err.error?.message || 'Server error occurred')
        });
      }
    });
  }

  openPasswordModal(): void {
    this.cpOldPw = '';
    this.cpNewPw = '';
    this.cpConfirmPw = '';
    this.cpShowOld = false;
    this.cpShowNew = false;
    this.cpShowConfirm = false;
    this.cpShowOldField = (this.loggedInUserId === this.adminId);
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.cdr.markForCheck();
  }

  submitPasswordChange(): void {
    if (this.cpShowOldField && !this.cpOldPw) {
      this.toast.error('Error', 'Current password is required to verify identity.');
      return;
    }
    if (!this.cpNewPw || !this.cpConfirmPw) {
      this.toast.error('Error', 'New password and confirmation are required.');
      return;
    }
    if (this.cpNewPw.length < 6) {
      this.toast.error('Error', 'New password must be at least 6 characters.');
      return;
    }
    if (this.cpNewPw !== this.cpConfirmPw) {
      this.toast.error('Error', 'New passwords do not match.');
      return;
    }
    const isSuperAdminResettingOther = (this.loggedInUserRole === 'SUPER_ADMIN' && this.loggedInUserId !== this.adminId);
    const payload = {
      userId: this.adminId,
      oldPassword: this.cpOldPw,
      newPassword: this.cpNewPw,
      isAdministrativeReset: isSuperAdminResettingOther
    };
    this.authService.changePassword(payload).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: () => {
        this.closePasswordModal();
        this.toast.success('Success', 'Password updated successfully');
      },
      error: (err) => this.toast.error('Error', err.error || 'Failed to update password')
    });
  }

  deleteAdmin(): void {
    this.toast.confirm({
      title: 'Are you sure?',
      message: 'This action cannot be undone!',
      confirmText: 'Yes, Delete Admin',
      danger: true
    }).then((confirmed) => {
      if (confirmed) {
        this.adminService.deleteAdmin(this.adminId).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
          next: () => {
            this.toast.success('Deleted', 'Administrator removed.');
            this.router.navigate(['/dashboard/admin-list']);
          }
        });
      }
    });
  }

  canUploadPhoto(): boolean {
    return !this.isNewAdmin && (
      this.loggedInUserRole === 'SUPER_ADMIN' || this.loggedInUserId === this.adminId
    );
  }

  getInitials(): string {
    return this.adminDetails?.name?.charAt(0).toUpperCase() ?? '?';
  }

  getPhotoUrl(relativePath: string): string {
    if (relativePath.startsWith('http')) return relativePath;
    return `${environment.apiUrl}${relativePath}`;
  }

  triggerPhotoUpload(): void {
    this.photoInput?.nativeElement.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    this.photoUploading = true;
    this.cdr.markForCheck();

    this.adminService.uploadAdminPhoto(this.adminId, file).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: (res) => {
        if (this.adminDetails) {
          this.adminDetails = { ...this.adminDetails, photoUrl: res.photoUrl + '?t=' + Date.now() };
        }
        this.photoUploading = false;
        this.cdr.markForCheck();
        this.toast.success('Photo updated!');
      },
      error: () => {
        this.photoUploading = false;
        this.cdr.markForCheck();
        this.toast.error('Upload failed', 'Could not upload photo. Please try again.');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/admin-list']);
  }
}