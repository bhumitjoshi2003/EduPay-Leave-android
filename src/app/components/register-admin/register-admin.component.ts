import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { ToastService } from '../../services/toast.service';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-register-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-admin.component.html',
  styleUrl: './register-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterAdminComponent {
  // Initializing with empty strings for the registration form
  adminData = {
    adminId: '',
    name: '',
    email: '',
    phoneNumber: '',
    gender: '',
    dob: ''
  };

  constructor(private adminService: AdminService, private router: Router, private toast: ToastService) { }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      Object.values(form.controls).forEach(control => control.markAsTouched());

      this.toast.warning('Form Invalid', 'Please fill in all required fields correctly.');
      return;
    }

    this.adminService.createAdmin(this.adminData).subscribe({
      next: () => {
        this.toast.success('Success!', 'New Administrator has been registered.');
        this.router.navigate(['/dashboard/admin-list']);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'Failed to register admin. Check if ID/Email exists.');
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/dashboard/admin-list']);
  }
}