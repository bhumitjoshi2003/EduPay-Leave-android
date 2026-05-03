import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TeacherService } from '../../services/teacher.service';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth.service';
import { EMPTY } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-register-teacher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-teacher.component.html',
  styleUrls: ['./register-teacher.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterTeacherComponent implements OnInit {
  teacherForm: FormGroup;
  classList: string[] = [
    'Play group', 'Nursery', 'LKG', 'UKG',
    '1', '2', '3', '4', '5', '6', '7',
    '8', '9', '10', '11', '12'
  ];

  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private router: Router,
    private authService: AuthService,
    private logger: LoggerService,
    private toast: ToastService
  ) {
    this.teacherForm = this.fb.group({
      teacherId: ['', Validators.required],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.pattern('^[0-9]{10}$')],
      dob: ['', Validators.required],
      gender: ['', Validators.required],
      classTeacher: ['']
    });
  }

  ngOnInit(): void {
  }

  onSubmit() {
    if (this.teacherForm.valid) {
      this.teacherService.addTeacher(this.teacherForm.value).pipe(
        switchMap((response: any) => {
          const tempPassword = this.generateTempPassword();
          return this.authService.register({
            userId: response.teacherId,
            password: tempPassword,
            role: 'TEACHER',
            email: this.teacherForm.value.email
          }).pipe(
            map(() => tempPassword),
            catchError((authError) => {
              this.logger.error('Error registering user in auth service:', authError);
              this.toast.error('Error', 'Teacher record created but account setup failed. Please retry.');
              return EMPTY;
            })
          );
        })
      ).subscribe({
        next: (tempPassword) => {
          this.toast.success('Teacher Registered!', `Registration complete. Temporary Password: ${tempPassword} — Share this with the teacher. They should change it on first login.`);
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

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    const array = new Uint32Array(10);
    crypto.getRandomValues(array);
    return Array.from(array, v => chars[v % chars.length]).join('');
  }

  goBack() {
    this.teacherForm.reset();
  }
}