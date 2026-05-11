import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Router } from '@angular/router';
import { LoggerService } from '../../services/logger.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { TenantService } from '../../services/tenant.service';

import { FormsModule } from '@angular/forms';
import { DemoService } from '../../services/demo.service';
import { timeout, TimeoutError } from 'rxjs';

import { ToastService } from '../../services/toast.service';

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
  sendingDemo   = false;

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
    private demoService: DemoService,
    private toast: ToastService,
    public tenantService: TenantService
  ) { }

  ngOnInit() {
    if (this.authStateService.isLoggedIn()) {
      this.authenticated = true;
      this.router.navigate(['/dashboard']);
    }
  }

  changeSchool() {
    this.tenantService.clearSchool();
    this.showForgotForm = false;
    this.userId   = '';
    this.password = '';
    this.cdr.markForCheck();
  }

  getInitials(name?: string | null): string {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  login() {
    this.showLoginForm = true;
  }

  cancelLogin() {
    this.showLoginForm = false;
  }

  submitLogin() {
    if (!this.userId.trim() || !this.password.trim()) {
      this.toast.warning('Missing Information', 'Please enter your User ID and Password.');
      return;
    }

    this.authService.login(this.userId, this.password).subscribe({
      next: (response) => {
        this.authStateService.setUser(response);

        // If school slug is not stored yet but the login response carries one,
        // resolve and store it so the X-School-Slug header is sent on all subsequent requests.
        const afterSchool = (response.schoolSlug && !this.tenantService.slug)
          ? this.tenantService.lookupSchool(response.schoolSlug).then(info => {
              if (info) this.tenantService.setSchool(response.schoolSlug!, info);
            })
          : Promise.resolve();

        afterSchool.then(() => {
          this.authenticated = true;
          this.showLoginForm = false;
          this.cdr.markForCheck();

          this.pushNotificationService.init();

          const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
          localStorage.removeItem('redirectUrl');
          this.router.navigateByUrl(redirectUrl);
        });
      },
      error: (error) => {
        const text = error.status === 0
          ? 'Cannot reach the server. Please check your internet connection.'
          : 'Incorrect User ID or Password.';
        this.toast.error('Login Failed', text);
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
      this.toast.warning('Required Fields', 'Please fill in School Name, Contact Name, Email and Phone.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      this.toast.warning('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    this.sendingDemo = true;
    this.cdr.markForCheck();

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
        this.sendingDemo = false;
        this.showDemoForm = false;
        this.demo = { schoolName: '', contactName: '', email: '', phone: '', students: '', city: '', message: '' };
        this.cdr.markForCheck();
        this.toast.confirm({ title: 'Demo Request Received!', html: '<p style="color:#64748b;font-size:.88rem;line-height:1.6">Thank you! Our team will reach out within <strong style="color:#1e3a5f">24 hours</strong> to schedule your personalised demo.</p>', confirmText: 'Awesome, Thanks!', icon: 'success' });
      },
      error: (err) => {
        this.sendingDemo = false;
        this.cdr.markForCheck();
        this.logger.error('Demo request failed:', err);
        const isTimeout = err instanceof TimeoutError;
        isTimeout
          ? this.toast.error('Request Timed Out', 'The server took too long to respond. Please check your connection and try again.')
          : this.toast.error('Submission Failed', 'Could not send your request. Please try again or contact us directly.');
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
      this.toast.warning('Required', 'Please enter both your User ID and registered email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toast.warning('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    this.sendingReset = true;
    this.cdr.markForCheck();

    this.authService.requestPasswordReset(uid, email).subscribe({
      next: (response: any) => {
        this.sendingReset   = false;
        this.showForgotForm = false;
        this.cdr.markForCheck();
        this.toast.confirm({
          title: 'Reset Link Sent!',
          html: `<p style="color:#64748b;font-size:.88rem;line-height:1.6">A password reset link has been sent to <strong style="color:#1e3a5f">${email}</strong>. Check your inbox and follow the link to set your new password.</p>`,
          confirmText: 'Got it!',
          icon: 'success',
        });
      },
      error: (error: any) => {
        this.sendingReset = false;
        this.cdr.markForCheck();
        this.toast.error('Could Not Send Link', error?.error || 'Please verify your User ID and registered email, then try again.');
      }
    });
  }
}

