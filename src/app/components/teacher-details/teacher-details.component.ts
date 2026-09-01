import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TeacherAttendanceSchedule,
  TeacherService,
} from '../../services/teacher.service';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';
import { SchoolClass, SchoolService } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';
import { MatIconModule } from '@angular/material/icon';
import { TeacherExitRequest } from '../../interfaces/teacher';

interface TeacherDetails {
  teacherId?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  dob?: string;
  classTeacher?: string | null;
  classTeacherSectionId?: number | null;
  photoUrl?: string;
  status?: 'ACTIVE' | 'LEFT';
  leavingDate?: string;
  reasonForLeaving?: string;
  exitRemarks?: string;
}

@Component({
  selector: 'app-teacher-details',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './teacher-details.component.html',
  styleUrl: './teacher-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherDetailsComponent implements OnInit, OnDestroy {
  teacherId: string = '';
  teacherDetails: TeacherDetails | null = null;
  role: string = '';
  isEditing: boolean = false;
  updatedDetails: TeacherDetails | null = null;
  private ngUnsubscribe = new Subject<void>();

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

  classList: string[] = [];
  /** Full class records (name + id) — the id is what the section lookup needs. */
  managedClasses: SchoolClass[] = [];
  /** Active sections of the class currently shown/selected; empty means it has none. */
  sections: Section[] = [];
  /**
   * True when the SAVED record is ambiguous: its class has sections configured but no
   * section was ever assigned (a legacy assignment made before sections existed).
   */
  legacySectionMissing = false;
  readonly scheduleDays = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];
  scheduleType: 'SCHOOL' | 'CUSTOM' = 'SCHOOL';
  selectedScheduleDays: string[] = [];
  scheduleEffectiveFrom = new Date().toISOString().slice(0, 10);
  scheduleHistory: TeacherAttendanceSchedule[] = [];
  schoolWorkingDays: string[] = [];
  scheduleSaving = false;
  showExitModal = false;
  exitLoading = false;
  exitRequest: TeacherExitRequest = {
    reasonForLeaving: '',
    leavingDate: new Date().toISOString().slice(0, 10),
    exitRemarks: '',
  };
  readonly exitReasons = [
    'Resigned',
    'Contract completed',
    'Relocation',
    'Retired',
    'Health reasons',
    'Personal reasons',
    'Terminated',
    'Other',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private teacherService: TeacherService,
    private authService: AuthService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private sectionService: SectionService,
  ) {}

  ngOnInit(): void {
    this.role = this.authService.getUserRole();
    if (this.role === 'ADMIN') {
      this.schoolService
        .getSettings()
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe((settings) => {
          this.schoolWorkingDays = this.parseDays(settings.workingDays);
          if (this.scheduleType === 'SCHOOL') {
            this.selectedScheduleDays = [...this.schoolWorkingDays];
          }
          this.cdr.markForCheck();
        });
    }
    // Class names drive the dropdown; the managed records supply the classId the
    // section lookup needs. This races the teacher fetch below, so whichever finishes
    // last triggers the section resolution.
    forkJoin({
      classes: this.schoolService.getClasses(),
      managed: this.schoolService.getManagedClasses(),
    })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: ({ classes, managed }) => {
          this.classList = classes;
          this.managedClasses = managed;
          this.cdr.markForCheck();
          if (this.teacherDetails) {
            this.loadSectionsForClass(
              this.teacherDetails.classTeacher ?? null,
              true,
            );
          }
        },
        error: () =>
          this.toast.error('Error', 'Failed to load the class list.'),
      });
    this.route.params
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((params) => {
        this.teacherId = params['teacherId'];
        if (this.teacherId) {
          this.loadTeacherDetails(this.teacherId);
        }
      });
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  loadTeacherDetails(teacherId: string): void {
    this.teacherService
      .getTeacher(teacherId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (details) => {
          this.teacherDetails = details;
          this.updatedDetails = { ...details };
          this.loadSectionsForClass(details.classTeacher ?? null, true);
          if (this.role === 'ADMIN') this.loadScheduleHistory();
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.logger.error('Error fetching teacher details:', error);
          this.toast.error('Error', 'Failed to load teacher details.');
        },
      });
  }

  /**
   * Loads the active sections of `className`. An empty result means the class has no
   * sections, so the Section field stays hidden and the id stays null — exactly the
   * shape the backend requires.
   *
   * @param isSavedRecord true when resolving the saved teacher's own class, which is
   *   also when the legacy "class has sections but none assigned" flag is recomputed.
   */
  private loadSectionsForClass(
    className: string | null,
    isSavedRecord = false,
  ): void {
    this.sections = [];
    if (isSavedRecord) this.legacySectionMissing = false;
    if (!className) {
      this.cdr.markForCheck();
      return;
    }
    const schoolClass = this.managedClasses.find((c) => c.name === className);
    // Managed classes may not have arrived yet — that subscription retries this.
    if (!schoolClass) {
      this.cdr.markForCheck();
      return;
    }
    this.sectionService
      .getSectionsForClass(schoolClass.id)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (sections) => {
          // A slower response for a class the admin has since switched away from must
          // not repopulate the dropdown.
          const currentClass = isSavedRecord
            ? (this.teacherDetails?.classTeacher ?? null)
            : (this.updatedDetails?.classTeacher || null);
          if (currentClass !== className) return;
          this.sections = sections;
          if (isSavedRecord) {
            this.legacySectionMissing =
              sections.length > 0 &&
              (this.teacherDetails?.classTeacherSectionId ?? null) === null;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.sections = [];
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Class changed while editing: drop any previously chosen section (it belongs to the
   * old class) and reload the list for the new one.
   */
  onClassTeacherChange(event: Event): void {
    if (!this.updatedDetails) return;
    const className = (event.target as HTMLSelectElement).value;
    this.updatedDetails.classTeacher = className;
    this.updatedDetails.classTeacherSectionId = null;
    this.loadSectionsForClass(className || null);
  }

  /** Name of the saved record's section, for the read-only display. */
  get savedSectionName(): string | null {
    const sectionId = this.teacherDetails?.classTeacherSectionId ?? null;
    if (sectionId === null) return null;
    return this.sections.find((s) => s.id === sectionId)?.name ?? null;
  }

  /** Read-only label for the class responsibility, e.g. "Class 12 — Science". */
  get classResponsibilityLabel(): string {
    if (!this.teacherDetails?.classTeacher) return 'Not assigned';
    const sectionName = this.savedSectionName;
    return sectionName
      ? `Class ${this.teacherDetails.classTeacher} — ${sectionName}`
      : `Class ${this.teacherDetails.classTeacher}`;
  }

  loadScheduleHistory(): void {
    this.teacherService
      .getAttendanceSchedules(this.teacherId)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (history) => {
          this.scheduleHistory = history;
          const current =
            history.find((item) => !item.effectiveTo) ?? history.at(-1);
          this.scheduleType = current?.scheduleType ?? 'SCHOOL';
          this.selectedScheduleDays =
            current?.scheduleType === 'CUSTOM'
              ? this.parseDays(current.workingDays)
              : [...this.schoolWorkingDays];
          this.cdr.markForCheck();
        },
        error: () =>
          this.toast.error(
            'Schedule unavailable',
            'Could not load this teacher’s attendance schedule.',
          ),
      });
  }

  toggleScheduleDay(day: string): void {
    this.selectedScheduleDays = this.selectedScheduleDays.includes(day)
      ? this.selectedScheduleDays.filter((value) => value !== day)
      : [...this.selectedScheduleDays, day];
  }

  saveAttendanceSchedule(): void {
    if (
      this.scheduleType === 'CUSTOM' &&
      this.selectedScheduleDays.length === 0
    ) {
      this.toast.warning(
        'Select working days',
        'Choose at least one day for a custom schedule.',
      );
      return;
    }
    this.scheduleSaving = true;
    this.teacherService
      .changeAttendanceSchedule(this.teacherId, {
        scheduleType: this.scheduleType,
        workingDays:
          this.scheduleType === 'CUSTOM'
            ? this.selectedScheduleDays.join(',')
            : null,
        effectiveFrom: this.scheduleEffectiveFrom,
      })
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: () => {
          this.scheduleSaving = false;
          this.toast.success(
            'Schedule saved',
            'Attendance calculations will use this schedule from the selected date.',
          );
          this.loadScheduleHistory();
        },
        error: (error) => {
          this.scheduleSaving = false;
          this.cdr.markForCheck();
          this.toast.error(
            'Could not save schedule',
            error?.error || 'Please try again.',
          );
        },
      });
  }

  scheduleDayLabel(day: string): string {
    return day.charAt(0) + day.slice(1).toLowerCase();
  }
  private parseDays(value: string | null | undefined): string[] {
    return value
      ? value
          .split(',')
          .map((day) => day.trim().toUpperCase())
          .filter(Boolean)
      : [];
  }

  getUserRole(): string {
    return this.role;
  }

  enableEditMode(): void {
    this.toast
      .confirm({
        title: 'Are you sure?',
        message: 'Do you want to edit the teacher details?',
        confirmText: 'Yes, edit it!',
      })
      .then((confirmed) => {
        if (confirmed) {
          this.isEditing = true;
          this.cdr.markForCheck();
        }
      });
  }

  cancelEditMode(): void {
    this.isEditing = false;
    this.updatedDetails = { ...this.teacherDetails! };
    // Sections may have been reloaded for a different class during the edit — restore
    // the ones belonging to the saved record.
    this.loadSectionsForClass(this.teacherDetails?.classTeacher ?? null, true);
    this.toast.info('Cancelled', 'Edit mode cancelled. No changes saved.');
  }

  // Accepts NgForm now
  saveTeacherDetails(form: NgForm): void {
    if (form.invalid) {
      // 1. Mark all fields as touched to trigger CSS red borders
      form.control.markAllAsTouched();

      // 2. Compile specific error messages based on validation rules
      let errorMessages = '<ul class="swal-error-list">';

      const controls = form.controls;
      if (controls['name']?.errors?.['required'])
        errorMessages += '<li>Name is required.</li>';

      if (controls['email']?.errors) {
        if (controls['email'].errors['required'])
          errorMessages += '<li>Email is required.</li>';
        if (controls['email'].errors['email'])
          errorMessages += '<li>Please enter a valid email address.</li>';
      }

      if (controls['phoneNumber']?.errors) {
        if (controls['phoneNumber'].errors['required'])
          errorMessages += '<li>Phone number is required.</li>';
        if (controls['phoneNumber'].errors['pattern'])
          errorMessages += '<li>Phone number must be exactly 10 digits.</li>';
      }

      if (controls['dob']?.errors?.['required'])
        errorMessages += '<li>Date of Birth is required.</li>';

      if (controls['classTeacherSectionId']?.errors?.['required'])
        errorMessages +=
          '<li>This class has sections — choose the one this teacher is class teacher of.</li>';

      errorMessages += '</ul>';

      // 3. Show detailed toast
      this.toast.error('Oops... Invalid Details', errorMessages);
      return;
    }

    // Proceeds normally if form is valid
    this.toast
      .confirm({
        title: 'Are you sure?',
        message: 'Do you want to save the changes?',
        confirmText: 'Yes, save it!',
      })
      .then((confirmed) => {
        if (confirmed) {
          if (this.updatedDetails) {
            const payload = {
              ...this.updatedDetails,
              // Belt-and-braces: a class with no sections must never carry a sectionId.
              classTeacherSectionId:
                this.sections.length > 0
                  ? (this.updatedDetails.classTeacherSectionId ?? null)
                  : null,
            };
            this.teacherService
              .updateTeacher(this.teacherId, payload)
              .pipe(takeUntil(this.ngUnsubscribe))
              .subscribe({
                next: () => {
                  this.updatedDetails = { ...payload };
                  this.teacherDetails = { ...payload };
                  this.isEditing = false;
                  // The ambiguity is resolved (or has moved to a new class) — recompute.
                  this.loadSectionsForClass(payload.classTeacher ?? null, true);
                  this.cdr.markForCheck();
                  this.toast.success(
                    'Success!',
                    'Teacher details have been updated.',
                  );
                },
                error: (error) => {
                  this.logger.error('Error updating teacher details:', error);
                  this.toast.error(
                    'Error!',
                    'Failed to update teacher details.',
                  );
                },
              });
          }
        }
      });
  }

  updateFieldValue(field: 'name' | 'email' | 'phoneNumber' | 'dob', event: Event): void {
    if (this.updatedDetails) {
      this.updatedDetails[field] = (event.target as HTMLInputElement).value;
    }
  }

  canUploadPhoto(): boolean {
    const role = this.getUserRole();
    return role === 'ADMIN' || role === 'SUB_ADMIN' || role === 'SUPER_ADMIN';
  }

  getInitials(): string {
    return this.teacherDetails?.name?.charAt(0).toUpperCase() ?? '?';
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

    // Issue #58: File size check
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error(
        'File Too Large',
        'Profile photo must be less than 5MB.',
      );
      return;
    }

    this.photoUploading = true;
    this.cdr.markForCheck();

    this.teacherService
      .uploadTeacherPhoto(this.teacherId, file)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (res) => {
          if (this.teacherDetails) {
            this.teacherDetails = {
              ...this.teacherDetails,
              photoUrl: res.photoUrl + '?t=' + Date.now(),
            };
          }
          this.photoUploading = false;
          this.cdr.markForCheck();
          this.toast.success('Photo updated!');
        },
        error: (err) => {
          this.logger.error('Photo upload error:', err);
          this.photoUploading = false;
          this.cdr.markForCheck();
          this.toast.error(
            'Upload failed',
            'Could not upload photo. Please try again.',
          );
        },
      });
  }

  goBackToTeacherList(): void {
    this.router.navigate(['/dashboard/teacher-list']);
  }

  openPasswordModal(): void {
    this.cpOldPw = '';
    this.cpNewPw = '';
    this.cpConfirmPw = '';
    this.cpShowOld = false;
    this.cpShowNew = false;
    this.cpShowConfirm = false;
    this.cpShowOldField = this.role !== 'ADMIN';
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
    const payload = {
      userId: this.teacherId,
      oldPassword: this.cpOldPw,
      newPassword: this.cpNewPw,
    };
    this.authService
      .changePassword(payload)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: () => {
          this.closePasswordModal();
          this.toast.success('Success', 'Password changed successfully!');
        },
        error: (error) => {
          this.logger.error('Error changing password', error);
          this.toast.error('Error', error.error || 'Failed to change password');
        },
      });
  }

  get todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  openExitModal(): void {
    this.exitRequest = { reasonForLeaving: '', leavingDate: this.todayStr, exitRemarks: '' };
    this.showExitModal = true;
    this.cdr.markForCheck();
  }

  closeExitModal(): void {
    this.showExitModal = false;
    this.cdr.markForCheck();
  }

  submitExit(): void {
    if (!this.exitRequest.reasonForLeaving || !this.exitRequest.leavingDate) {
      this.toast.error('Required', 'Please select a reason and leaving date.');
      return;
    }
    this.exitLoading = true;
    this.teacherService.exitTeacher(this.teacherId, this.exitRequest)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (teacher) => {
          this.teacherDetails = teacher;
          this.updatedDetails = { ...teacher };
          this.exitLoading = false;
          this.showExitModal = false;
          this.cdr.markForCheck();
          this.toast.success('Teacher marked as left', 'Historical records have been preserved.');
        },
        error: (err) => {
          this.exitLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Unable to update teacher', typeof err?.error === 'string' ? err.error : 'Please try again.');
        },
      });
  }

  reactivateTeacher(): void {
    this.toast.confirm({
      title: 'Re-activate teacher?',
      message: `This will make ${this.teacherDetails?.name} an active staff member again.`,
      confirmText: 'Re-activate',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.teacherService.reactivateTeacher(this.teacherId)
        .pipe(takeUntil(this.ngUnsubscribe))
        .subscribe({
          next: (teacher) => {
            this.teacherDetails = teacher;
            this.updatedDetails = { ...teacher };
            this.cdr.markForCheck();
            this.toast.success('Teacher re-activated');
          },
          error: (err) => this.toast.error('Unable to re-activate teacher', typeof err?.error === 'string' ? err.error : 'Please try again.'),
        });
    });
  }
}
