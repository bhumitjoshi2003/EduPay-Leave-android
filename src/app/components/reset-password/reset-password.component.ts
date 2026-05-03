import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../services/toast.service';
import { ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  resetForm: FormGroup;
  token: string | null = null;
  loading = false;
  hideNewPassword = true;
  hideConfirmPassword = true;
  resetToken: any;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) {
    this.resetForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.checkPasswordMatch });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.resetToken = params['token'];
      if (!this.resetToken) {
        this.toast.error('Invalid Reset Link', 'The password reset link is invalid or missing.');
        this.router.navigate(['/']);
      }
    });
  }



  checkPasswordMatch(group: FormGroup) {
    const newPassword = group.controls['newPassword'].value;
    const confirmPassword = group.controls['confirmPassword'].value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetForm.valid && this.resetToken) {
      this.loading = true;
      this.authService.resetPassword(this.resetToken, this.resetForm.value.newPassword).subscribe({
        next: (response: any) => {
          this.loading = false;
          this.cdr.markForCheck();
          this.toast.confirm({
            title: 'Password Reset Successful',
            message: response.message || 'Your password has been reset successfully. You can now log in with your new password.',
            confirmText: 'OK',
            icon: 'success',
          }).then(() => {
            this.router.navigate(['/']);
          });
        },
        error: (error: any) => {
          this.loading = false;
          this.cdr.markForCheck();
          this.toast.error('Password Reset Failed', error.error || 'Failed to reset password. The link might be invalid or expired. Please try again.');
        }
      });
    } else {
      this.toast.warning('Invalid Form', 'Please ensure all fields are filled correctly and passwords match.');
    }
  }
  

  toggleNewPasswordVisibility() {
    this.hideNewPassword = !this.hideNewPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }
}