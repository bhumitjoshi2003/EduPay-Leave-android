import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../services/student.service';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';
import { Subject, forkJoin, takeUntil, switchMap } from 'rxjs';
import { Location } from '@angular/common';
import { environment } from '../../../environments/environment';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';
import { StudentExitRequest, PendingDuesInfo } from '../../interfaces/student';

interface StudentDetails {
  studentId?: string;
  name?: string;
  className?: string;
  sectionId?: number | null;
  sectionName?: string;
  phoneNumber?: string;
  email?: string;
  gender?: string;
  dob?: string;
  fatherName?: string;
  motherName?: string;
  takesBus?: boolean;
  distance?: number | null;
  joiningDate?: string;
  leavingDate?: string;
  status?: string;
  photoUrl?: string;
  reasonForLeaving?: string;
  conductAtLeaving?: string;
  exitRemarks?: string;
}

@Component({
  selector: 'app-student-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-details.component.html',
  styleUrl: './student-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StudentDetailsComponent implements OnInit, OnDestroy {
  studentId: string = '';
  studentDetails: StudentDetails | null = null;
  role: string = '';
  isEditing: boolean = false;
  updatedDetails: StudentDetails | null = null;
  private ngUnsubscribe = new Subject<void>();
  effectiveFromMonth: number | null = null;

  // Track validation errors for CSS classes
  validationErrors: { [key: string]: boolean } = {};

  // Photo upload state
  photoUploading = false;
  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  // Change-password modal state
  showPasswordModal = false;
  cpOldPw = '';
  cpNewPw = '';
  cpConfirmPw = '';
  cpShowOld = false;
  cpShowNew = false;
  cpShowConfirm = false;
  cpShowOldField = false;

  academicMonths = [
    { value: 0, label: 'New Academic Year' },
    { value: 1, label: 'April' }, { value: 2, label: 'May' }, { value: 3, label: 'June' },
    { value: 4, label: 'July' }, { value: 5, label: 'August' }, { value: 6, label: 'September' },
    { value: 7, label: 'October' }, { value: 8, label: 'November' }, { value: 9, label: 'December' },
    { value: 10, label: 'January' }, { value: 11, label: 'February' }, { value: 12, label: 'March' }
  ];
  classList: string[] = [];
  managedClasses: SchoolClass[] = [];
  sections: Section[] = [];

  // Exit modal state
  showExitModal = false;
  exitLoading = false;
  exitRequest: StudentExitRequest = {
    exitType: 'WITHDRAWN',
    reasonForLeaving: '',
    conductAtLeaving: '',
    leavingDate: new Date().toISOString().split('T')[0],
    exitRemarks: ''
  };
  pendingDues: PendingDuesInfo | null = null;

  readonly exitReasons = [
    'Family relocation',
    'Admitted to another school',
    'Financial reasons',
    'Health reasons',
    'Completed studies',
    'Disciplinary action',
    'Migration abroad',
    'Other'
  ];

  readonly conductOptions = ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement'];

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private studentService: StudentService,
    private authService: AuthService,
    private location: Location,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private sectionService: SectionService
  ) { }

  ngOnInit(): void {
    this.role = this.authService.getUserRole();

    // Load both class lists first, then process route params.
    // This ensures managedClasses is populated before loadStudentDetails
    // calls loadSectionsForClass — preventing the race where sections never load.
    forkJoin({
      classes: this.schoolService.getClasses(),
      managedClasses: this.schoolService.getManagedClasses(),
    }).pipe(
      takeUntil(this.ngUnsubscribe),
      switchMap(({ classes, managedClasses }) => {
        this.classList = classes;
        this.managedClasses = managedClasses;
        this.cdr.markForCheck();
        return this.route.params;
      })
    ).subscribe((params) => {
      this.studentId = params['studentId'];
      if (this.studentId) {
        this.loadStudentDetails(this.studentId);
      }
    });
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  loadStudentDetails(studentId: string): void {
    this.studentService.getStudent(studentId).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: (details) => {
        this.studentDetails = details;
        this.updatedDetails = { ...details };
        if (details.className) this.loadSectionsForClass(details.className);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.logger.error('Error fetching details:', error);
        this.toast.error('Error', 'Failed to load details.');
      }
    });
  }

  getUserRole(): string {
    return this.role;
  }

  enableEditMode(): void {
    this.toast.confirm({
      title: 'Are you sure?',
      message: 'Do you want to edit the details?',
      confirmText: 'Yes, edit it!',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (confirmed) {
        this.isEditing = true;
        this.validationErrors = {};
        this.cdr.markForCheck();
      }
    });
  }

  cancelEditMode(): void {
    this.isEditing = false;
    this.updatedDetails = { ...this.studentDetails! };
    this.effectiveFromMonth = null;
    this.validationErrors = {};
    this.toast.info('Cancelled', 'Edit mode cancelled. No changes saved.');
  }

  validateFields(): boolean {
    this.validationErrors = {};
    let isValid = true;
    let errors: string[] = [];

    if (!this.updatedDetails) return false;

    // Name Validation
    if (!this.updatedDetails.name || this.updatedDetails.name.trim().length === 0) {
      this.validationErrors['name'] = true;
      errors.push("Student Name is mandatory.");
      isValid = false;
    }

    // Phone Validation
    const phoneRegex = /^[0-9]{10}$/;
    if (!this.updatedDetails.phoneNumber || this.updatedDetails.phoneNumber.trim().length === 0) {
      this.validationErrors['phoneNumber'] = true;
      errors.push("Phone Number is mandatory.");
      isValid = false;
    } else if (!phoneRegex.test(this.updatedDetails.phoneNumber)) {
      this.validationErrors['phoneNumber'] = true;
      errors.push("Phone Number must be exactly 10 digits.");
      isValid = false;
    }

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.updatedDetails.email || this.updatedDetails.email.trim().length === 0) {
      this.validationErrors['email'] = true;
      errors.push("Email Address is mandatory.");
      isValid = false;
    } else if (!emailRegex.test(this.updatedDetails.email)) {
      this.validationErrors['email'] = true;
      errors.push("Please enter a valid email address.");
      isValid = false;
    }

    // Distance Validation
    if (this.updatedDetails.takesBus && (this.updatedDetails.distance === null || this.updatedDetails.distance === undefined)) {
      this.validationErrors['distance'] = true;
      errors.push("Distance is required when Bus Facility is enabled.");
      isValid = false;
    }

    if (!isValid) {
      this.toast.confirm({
        title: 'Validation Failed',
        html: `<ul style="text-align: left;">${errors.map(err => `<li>${err}</li>`).join('')}</ul>`,
        confirmText: 'OK',
        icon: 'danger',
      });
    }

    return isValid;
  }

  async saveStudentDetails(): Promise<void> {
    if (!this.validateFields()) {
      return;
    }

    let needsEffectiveMonth = false;

    if (this.updatedDetails && this.studentDetails) {
      if (this.updatedDetails.takesBus !== this.studentDetails.takesBus) {
        needsEffectiveMonth = true;
      } else if (this.updatedDetails.takesBus && this.studentDetails.takesBus && this.updatedDetails.distance !== this.studentDetails.distance) {
        needsEffectiveMonth = true;
      }
    }


    if (needsEffectiveMonth) {
      const month = await this.toast.selectMonth({
        title: 'Select Effective Month',
        options: this.academicMonths,
        confirmText: 'Save with Selected Month',
      });

      if (month !== null) {
        this.effectiveFromMonth = month;
        this.executeUpdate();
      }
    } else {
      this.executeUpdate();
    }
  }

  executeUpdate(): void {
    this.toast.confirm({
      title: 'Are you sure?',
      message: 'Do you want to save the changes to the details?',
      icon: 'question',
      confirmText: 'Yes, save it!',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (confirmed) {
        if (this.updatedDetails) {
          const payload = {
            studentDetails: this.updatedDetails,
            effectiveFromMonth: this.effectiveFromMonth
          };
          this.studentService.updateStudent(this.studentId, payload).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
            next: (response) => {
              this.studentDetails = { ...this.updatedDetails };
              this.isEditing = false;
              this.effectiveFromMonth = null;
              this.validationErrors = {};
              this.cdr.markForCheck();
              this.toast.success('Success!', 'Details have been updated.');
            },
            error: (error) => {
              this.logger.error('Error updating details:', error);
              this.toast.error('Error!', 'Failed to update details.');
            }
          });
        }
      }
    });
  }

  updateFieldValue(field: keyof StudentDetails, event: Event): void {
    if (this.updatedDetails) {
      const target = event.target as HTMLInputElement;
      (this.updatedDetails as Record<string, unknown>)[field] = (field === 'takesBus') ? target.checked : target.value;

      // Clear error immediately when user fixes the field
      if (this.validationErrors[field]) {
        delete this.validationErrors[field];
      }
    }
  }

  viewAttendanceSummary(): void {
    this.router.navigate(['/dashboard/attendance-summary'], {
      queryParams: { studentId: this.studentId, className: this.studentDetails?.className }
    });
  }

  viewPaymentHistory(): void {
    this.router.navigate(['/dashboard/payment-history', this.studentId]);
  }

  viewLeaves(): void {
    this.router.navigate(['/dashboard/view-leaves', this.studentId]);
  }

  viewFeeDetails(): void {
    this.router.navigate(['/dashboard/fees', this.studentId]);
  }

  openPasswordModal(): void {
    this.cpOldPw = '';
    this.cpNewPw = '';
    this.cpConfirmPw = '';
    this.cpShowOld = false;
    this.cpShowNew = false;
    this.cpShowConfirm = false;
    this.cpShowOldField = (this.role !== 'ADMIN');
    this.showPasswordModal = true;
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.cdr.markForCheck();
  }

  submitPasswordChange(): void {
    if (this.cpShowOldField && !this.cpOldPw) {
      this.toast.error('Error', 'Current password is required');
      return;
    }
    if (!this.cpNewPw || !this.cpConfirmPw) {
      this.toast.error('Error', 'New password and confirmation are required');
      return;
    }
    if (this.cpNewPw.length < 6) {
      this.toast.error('Error', 'New password must be at least 6 characters');
      return;
    }
    if (this.cpNewPw !== this.cpConfirmPw) {
      this.toast.error('Error', 'New passwords do not match');
      return;
    }
    const payload = { userId: this.studentId, oldPassword: this.cpOldPw, newPassword: this.cpNewPw };
    this.authService.changePassword(payload).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: () => {
        this.closePasswordModal();
        this.toast.success('Success', 'Password changed successfully!');
      },
      error: (error) => {
        this.logger.error('Error changing password', error);
        this.toast.error('Error', error.error || 'Failed to change password');
      }
    });
  }

  canUploadPhoto(): boolean {
    const role = this.getUserRole();
    return role === 'ADMIN' || role === 'SUB_ADMIN' || role === 'SUPER_ADMIN';
  }

  getInitials(): string {
    return this.studentDetails?.name?.charAt(0).toUpperCase() ?? '?';
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

    this.studentService.uploadStudentPhoto(this.studentId, file).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: (res) => {
        if (this.studentDetails) {
          this.studentDetails = { ...this.studentDetails, photoUrl: res.photoUrl + '?t=' + Date.now() };
        }
        this.photoUploading = false;
        this.cdr.markForCheck();
        this.toast.success('Photo updated!');
      },
      error: (err) => {
        this.logger.error('Photo upload error:', err);
        this.photoUploading = false;
        this.cdr.markForCheck();
        this.toast.error('Upload failed', 'Could not upload photo. Please try again.');
      }
    });
  }

  loadSectionsForClass(className: string): void {
    const cls = this.managedClasses.find(c => c.name === className);
    if (!cls) { this.sections = []; return; }
    this.sectionService.getSectionsForClass(cls.id).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: sections => { this.sections = sections; this.cdr.markForCheck(); },
      error: () => { this.sections = []; }
    });
  }

  onClassChangeInEdit(className: string): void {
    this.sections = [];
    if (this.updatedDetails) {
      this.updatedDetails.sectionId = undefined;
      this.updatedDetails.sectionName = undefined;
    }
    this.loadSectionsForClass(className);
  }

  // ── Exit Workflow ──────────────────────────────────────────────────

  isExitStatus(): boolean {
    const s = this.studentDetails?.status;
    return s === 'GRADUATED' || s === 'TRANSFERRED' || s === 'WITHDRAWN';
  }

  openExitModal(): void {
    this.exitRequest = {
      exitType: 'WITHDRAWN',
      reasonForLeaving: '',
      conductAtLeaving: '',
      leavingDate: new Date().toISOString().split('T')[0],
      exitRemarks: ''
    };
    this.pendingDues = null;
    this.showExitModal = true;
    this.cdr.markForCheck();

    this.studentService.checkPendingDues(this.studentId).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: (dues) => { this.pendingDues = dues; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  closeExitModal(): void {
    this.showExitModal = false;
    this.cdr.markForCheck();
  }

  submitExit(): void {
    if (!this.exitRequest.reasonForLeaving) {
      this.toast.error('Required', 'Please select a reason for leaving.');
      return;
    }
    if (!this.exitRequest.leavingDate) {
      this.toast.error('Required', 'Please set a leaving date.');
      return;
    }

    this.exitLoading = true;
    this.cdr.markForCheck();

    this.studentService.exitStudent(this.studentId, this.exitRequest).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
      next: (student) => {
        this.studentDetails = student;
        this.updatedDetails = { ...student };
        this.showExitModal = false;
        this.exitLoading = false;
        this.cdr.markForCheck();

        const label = this.exitRequest.exitType === 'GRADUATED' ? 'graduated' :
                      this.exitRequest.exitType === 'TRANSFERRED' ? 'transferred' : 'withdrawn';
        this.toast.success('Done', `Student has been marked as ${label}.`);
      },
      error: (err) => {
        this.exitLoading = false;
        this.cdr.markForCheck();
        const msg = typeof err?.error === 'string' ? err.error : 'Failed to exit student.';
        this.toast.error('Error', msg);
      }
    });
  }

  readmitStudent(): void {
    this.toast.confirm({
      title: 'Re-admit Student?',
      message: `This will set ${this.studentDetails?.name} back to ACTIVE status and clear all exit details. Continue?`,
      confirmText: 'Yes, re-admit',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.studentService.readmitStudent(this.studentId).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
        next: (student) => {
          this.studentDetails = student;
          this.updatedDetails = { ...student };
          this.cdr.markForCheck();
          this.toast.success('Re-admitted', `${student.name} is now active again.`);
        },
        error: (err) => {
          const msg = typeof err?.error === 'string' ? err.error : 'Failed to re-admit student.';
          this.toast.error('Error', msg);
        }
      });
    });
  }

  goBack(): void {
    this.location.back();
  }
}