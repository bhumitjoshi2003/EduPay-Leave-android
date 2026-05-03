import { ChangeDetectionStrategy, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Subject, takeUntil } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { StudentService } from '../../services/student.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-register-student',
  templateUrl: './register-student.component.html',
  imports: [CommonModule, ReactiveFormsModule],
  styleUrls: ['./register-student.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterStudentComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  studentForm: FormGroup;
  isBusUser = false;
  classList: string[] = [
    'Play group', 'Nursery', 'LKG', 'UKG',
    '1', '2', '3', '4', '5', '6', '7',
    '8', '9', '10', '11', '12'
  ];

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private router: Router,
    private authService: AuthService,
    private logger: LoggerService,
    private toast: ToastService
  ) {
    this.studentForm = this.fb.group({
      studentId: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.pattern('^[0-9]{10}$')],
      dob: ['', Validators.required],
      className: ['', Validators.required],
      gender: ['', Validators.required],
      fatherName: [''],
      motherName: [''],
      takesBus: [false],
      distance: [''],
      joiningDate: ['', Validators.required]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.studentForm.get('takesBus')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.isBusUser = value;
      if (this.isBusUser) {
        this.studentForm.get('distance')?.setValidators([Validators.required]);
      } else {
        this.studentForm.get('distance')?.clearValidators();
      }
      this.studentForm.get('distance')?.updateValueAndValidity();
    });
  }

  onSubmit() {
    if (this.studentForm.valid) {
      this.studentService.addStudent(this.studentForm.value).pipe(
        takeUntil(this.destroy$),
        switchMap((response: any) => {
          const tempPassword = this.generateTempPassword();
          return this.authService.register({
            userId: response.studentId,
            password: tempPassword,
            role: 'STUDENT',
            email: this.studentForm.value.email
          }).pipe(
            map(() => tempPassword),
            catchError((authError) => {
              this.logger.error('Error registering user in auth service:', authError);
              this.toast.error('Error', 'Student record created but account setup failed. Please retry.');
              return EMPTY;
            })
          );
        })
      ).subscribe({
        next: (tempPassword) => {
          this.toast.success('Student Registered!', `Registration complete. Temporary Password: ${tempPassword} — Share this with the student. They should change it on first login.`);
          this.studentForm.reset();
          this.isBusUser = false;
        },
        error: (error) => {
          this.logger.error('Error registering student:', error);
          let errorMessage = 'Failed to register new student.';
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

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    const array = new Uint32Array(10);
    crypto.getRandomValues(array);
    return Array.from(array, v => chars[v % chars.length]).join('');
  }

  goBack() {
    this.studentForm.reset();
    this.isBusUser = false;
  }
}

