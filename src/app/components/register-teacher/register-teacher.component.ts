import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TeacherService } from '../../services/teacher.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { EMPTY, Subject, takeUntil } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { SchoolService } from '../../services/school.service';
import { strictEmailValidator, pastDateValidator, phoneValidator } from '../../validators/shared.validators';

@Component({
  selector: 'app-register-teacher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-teacher.component.html',
  styleUrls: ['./register-teacher.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterTeacherComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  teacherForm: FormGroup;
  classList: string[] = [];

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private router: Router,
    private authService: AuthService,
    private authState: AuthStateService,
    private logger: LoggerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private schoolService: SchoolService
  ) {
    this.teacherForm = this.fb.group({
      teacherId: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, strictEmailValidator()]],
      phoneNumber: ['', phoneValidator()],
      dob: ['', [Validators.required, pastDateValidator()]],
      gender: ['', Validators.required],
      classTeacher: [''],
      joiningDate: ['', Validators.required]
    });
  }

  get todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void {
    // Issue #13: Defense-in-depth role check — backend is authoritative, this is UX-only
    const role = this.authState.getUserRole();
    if (role !== 'ADMIN') {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => {
        this.classList = classes;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Error', 'Failed to load class list.');
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit() {
    if (this.teacherForm.valid) {
      // The backend derives the initial login password from the teacher's date of
      // birth (YYYYMMDD) — it is never generated or supplied by the frontend.
      this.teacherService.addTeacher(this.teacherForm.value).pipe(
        switchMap((response: { teacherId: string }) => {
          return this.authService.register({
            userId: response.teacherId,
            role: 'TEACHER',
            email: this.teacherForm.value.email
          }).pipe(
            catchError((authError) => {
              this.logger.error('Error registering user in auth service:', authError);
              this.toast.error('Error', 'Teacher record created but account setup failed. Please retry.');
              return EMPTY;
            })
          );
        })
      ).subscribe({
        next: () => {
          this.toast.success('Teacher Registered!', 'Registration successful. Initial password: Date of birth in YYYYMMDD format. ' +
            'Example: 23 May 1990 → 19900523. The user must create a new password during their first login.');
          this.teacherForm.reset();
        },
        error: (error) => {
          this.logger.error('Error registering teacher:', error);
          let errorMessage = 'Failed to register new teacher.';
          if (error.status === 409) {
            errorMessage = error.error;
          }
          this.toast.error('Error!', errorMessage);
        }
      });
    } else {
      this.toast.error('Validation Error!', 'Please fill in all the required fields correctly.');
    }
  }

  goBack() {
    this.teacherForm.reset();
  }
}
