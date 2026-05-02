import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Router } from '@angular/router';
import { LoggerService } from '../../services/logger.service';
import { PushNotificationService } from '../../services/push-notification.service';

import { FormsModule } from '@angular/forms';
import { DemoService } from '../../services/demo.service';

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
  authenticated = false;
  showLoginForm = false;
  showDemoForm  = false;
  userId   = '';
  password = '';
  hidePassword = true;

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
    }).subscribe({
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
        Swal.fire({
          icon: 'error',
          title: 'Submission Failed',
          text: 'Could not send your request. Please try again or contact us directly.',
          confirmButtonColor: '#1e3a5f'
        });
      }
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

