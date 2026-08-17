import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';

/** Mirrors the backend's validatePasswordStrength policy in AuthController. */
function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value || '';
  if (!value) return null;
  const strong = value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
  return strong ? null : { passwordWeak: true };
}

@Component({
  selector: 'app-change-initial-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './change-initial-password.component.html',
  styleUrl: './change-initial-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangeInitialPasswordComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  form: FormGroup;
  loading = false;
  hideNewPassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private authState: AuthStateService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, passwordStrengthValidator]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.checkPasswordMatch });
  }

  get userName(): string {
    return this.authState.getUser()?.name || this.authState.getUserId();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkPasswordMatch(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.loading) return; // prevent duplicate submits
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.authService.changeInitialPassword({
      newPassword: this.form.value.newPassword,
      confirmPassword: this.form.value.confirmPassword
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loading = false;
        // The backend does not grant a new session on this response — clear local
        // state to match, and require a normal sign-in with the new password.
        this.authState.clearUser();
        this.toast.confirm({
          title: 'Password Changed',
          message: 'Password changed successfully. Please sign in with your new password.',
          icon: 'success',
          confirmText: 'Sign In'
        }).then(() => {
          this.router.navigate(['/home']);
        });
      },
      error: (error) => {
        this.loading = false;
        this.cdr.markForCheck();
        const msg = typeof error?.error === 'string' && error.error.length < 300
          ? error.error
          : 'Failed to change password. Please try again.';
        this.toast.error('Could Not Change Password', msg);
      }
    });
  }

  logout(): void {
    this.authService.logout().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => this.router.navigate(['/home'])
    });
  }

  toggleNewPasswordVisibility(): void {
    this.hideNewPassword = !this.hideNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }
}
