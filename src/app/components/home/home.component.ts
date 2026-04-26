import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { LoggerService } from '../../services/logger.service';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSnackBarModule, FormsModule, MatIconModule, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  authenticated = false;
  showLoginForm = false;
  userId = '';
  password = '';
  loginState = 'initial';
  hidePassword = true;

  constructor(
    private authService: AuthService,
    private authStateService: AuthStateService,
    private snackBar: MatSnackBar,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    if (this.authStateService.isLoggedIn()) {
      this.authenticated = true;
      this.router.navigate(['/dashboard']);
    }
  }

  login() {
    this.showLoginForm = true;
    this.loginState = 'loginActive';
  }

  cancelLogin() {
    this.showLoginForm = false;
    this.loginState = 'initial';
  }

  submitLogin() {
    if (!this.userId.trim() || !this.password.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please enter your User ID and Password.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    this.authService.login(this.userId, this.password).subscribe({
      next: (response) => {
        this.authStateService.setUser(response);
        this.authenticated = true;
        this.showLoginForm = false;
        this.loginState = 'initial';
        this.cdr.markForCheck();

        const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
        localStorage.removeItem('redirectUrl');
        this.router.navigateByUrl(redirectUrl);
      },
      error: (error) => {
        const text = error.status === 0
          ? 'Cannot reach the server. Please check your internet connection.'
          : 'Incorrect User ID or Password.';
        Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text,
          confirmButtonColor: '#d33',
        });
        this.logger.error('Login error:', error);
      }
    });
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => { this.authenticated = false; this.cdr.markForCheck(); },
      error: () => { this.authenticated = false; this.cdr.markForCheck(); }
    });
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  forgotPassword() {
    // Defer dialog opening to next macrotask so the button tap doesn't block the UI thread
    setTimeout(() => {
      Swal.fire({
        title: 'Forgot Password',
        html: `<input id="swal-fp-userid" class="swal2-input" placeholder="User ID">
               <input id="swal-fp-email" class="swal2-input" placeholder="Registered Email">`,
        showCancelButton: true,
        confirmButtonText: 'Reset Password',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3085d6',
        preConfirm: () => {
          const userId = (document.getElementById('swal-fp-userid') as HTMLInputElement).value.trim();
          const email = (document.getElementById('swal-fp-email') as HTMLInputElement).value.trim();
          if (!userId || !email) {
            Swal.showValidationMessage('Please enter both your User ID and Email Address');
            return false;
          }
          return { userId, email };
        }
      }).then((result) => {
        if (!result.isConfirmed) return;
        const { userId, email } = result.value;
        Swal.fire({ title: 'Sending reset link...', didOpen: () => Swal.showLoading(), allowOutsideClick: false, showConfirmButton: false });
        this.authService.requestPasswordReset(userId, email).subscribe({
          next: (response: any) => {
            Swal.fire({ icon: 'success', title: 'Email Sent', text: response || 'A password reset link has been sent to your email.', confirmButtonColor: '#3085d6' });
          },
          error: (error: any) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.error || 'Failed to send reset link. Please check your User ID and Email.', confirmButtonColor: '#d33' });
          }
        });
      });
    }, 0);
  }
}

