import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Router } from '@angular/router';
import { LoggerService } from '../../services/logger.service';
import { PushNotificationService } from '../../services/push-notification.service';

import { FormsModule } from '@angular/forms';
import { DemoService } from '../../services/demo.service';
import { timeout, TimeoutError } from 'rxjs';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  authenticated    = false;
  showLoginForm    = false;
  showDemoForm     = false;
  showForgotForm   = false;
  userId   = '';
  password = '';
  hidePassword = true;

  forgotUserId  = '';
  forgotEmail   = '';
  sendingReset  = false;

  demo = {
    schoolName:   '',
    contactName:  '',
    email:        '',
    phone:        '',
    students:     '',
    city:         '',
    message:      ''
  };

  constructor(
    private authService: AuthService,
    private authStateService: AuthStateService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private pushNotificationService: PushNotificationService,
    private demoService: DemoService
  ) { }

  ngOnInit() {
    if (this.authStateService.isLoggedIn()) {
      this.authenticated = true;
      this.router.navigate(['/dashboard']);
    }
  }

  login() {
    this.showLoginForm = true;
  }

  cancelLogin() {
    this.showLoginForm = false;
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
        this.cdr.markForCheck();

        this.pushNotificationService.init();

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

  openDemo() {
    this.showDemoForm = true;
    this.cdr.markForCheck();
  }

  closeDemo() {
    this.showDemoForm = false;
    this.cdr.markForCheck();
  }

  submitDemo() {
    const { schoolName, contactName, email, phone } = this.demo;
    if (!schoolName.trim() || !contactName.trim() || !email.trim() || !phone.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required Fields', text: 'Please fill in School Name, Contact Name, Email and Phone.', confirmButtonColor: '#1e3a5f' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Swal.fire({ icon: 'warning', title: 'Invalid Email', text: 'Please enter a valid email address.', confirmButtonColor: '#1e3a5f' });
      return;
    }

    Swal.fire({ title: 'Sending your request…', didOpen: () => Swal.showLoading(), allowOutsideClick: false, showConfirmButton: false });

    this.demoService.submitRequest({
      schoolName:       this.demo.schoolName.trim(),
      contactName:      this.demo.contactName.trim(),
      email:            this.demo.email.trim(),
      phone:            this.demo.phone.trim(),
      numberOfStudents: this.demo.students.trim() || undefined,
      city:             this.demo.city.trim() || undefined,
      message:          this.demo.message.trim() || undefined
    }).pipe(timeout(20000)).subscribe({
      next: () => {
        this.showDemoForm = false;
        this.demo = { schoolName: '', contactName: '', email: '', phone: '', students: '', city: '', message: '' };
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'success',
          title: 'Demo Request Received!',
          html: '<p style="color:#64748b;font-size:.88rem;line-height:1.6">Thank you! Our team will reach out within <strong style="color:#1e3a5f">24 hours</strong> to schedule your personalised demo.</p>',
          confirmButtonColor: '#1e3a5f',
          confirmButtonText: 'Awesome, Thanks!'
        });
      },
      error: (err) => {
        this.logger.error('Demo request failed:', err);
        const isTimeout = err instanceof TimeoutError;
        Swal.fire({
          icon: 'error',
          title: isTimeout ? 'Request Timed Out' : 'Submission Failed',
          text: isTimeout
            ? 'The server took too long to respond. Please check your connection and try again.'
            : 'Could not send your request. Please try again or contact us directly.',
          confirmButtonColor: '#1e3a5f'
        });
      }
    });
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  forgotPassword() {
    this.showLoginForm  = false;
    this.forgotUserId   = '';
    this.forgotEmail    = '';
    this.sendingReset   = false;
    this.showForgotForm = true;
    this.cdr.markForCheck();
  }

  cancelForgot() {
    this.showForgotForm = false;
    this.cdr.markForCheck();
  }

  submitForgot() {
    const uid   = this.forgotUserId.trim();
    const email = this.forgotEmail.trim();
    if (!uid || !email) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter both your User ID and registered email.', confirmButtonColor: '#1e3a5f' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Swal.fire({ icon: 'warning', title: 'Invalid Email', text: 'Please enter a valid email address.', confirmButtonColor: '#1e3a5f' });
      return;
    }

    this.sendingReset = true;
    this.cdr.markForCheck();

    this.authService.requestPasswordReset(uid, email).subscribe({
      next: (response: any) => {
        this.sendingReset   = false;
        this.showForgotForm = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'success',
          title: 'Reset Link Sent!',
          html: `<p style="color:#64748b;font-size:.88rem;line-height:1.6">
                   A password reset link has been sent to <strong style="color:#1e3a5f">${email}</strong>.
                   Check your inbox and follow the link to set your new password.
                 </p>`,
          confirmButtonColor: '#1e3a5f',
          confirmButtonText: 'Got it!'
        });
      },
      error: (error: any) => {
        this.sendingReset = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'error',
          title: 'Could Not Send Link',
          text: error?.error || 'Please verify your User ID and registered email, then try again.',
          confirmButtonColor: '#1e3a5f'
        });
      }
    });
  }
}

