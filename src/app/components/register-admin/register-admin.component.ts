import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { SchoolService, SchoolSettings } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-register-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register-admin.component.html',
  styleUrl: './register-admin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterAdminComponent implements OnInit {
  adminData = {
    adminId: '',
    name: '',
    email: '',
    phoneNumber: '',
    gender: '',
    dob: '',
    schoolId: null as number | null
  };

  isSuperAdmin = false;
  schools: SchoolSettings[] = [];
  schoolsLoading = false;

  constructor(
    private adminService: AdminService,
    private schoolService: SchoolService,
    private authState: AuthStateService,
    private router: Router,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isSuperAdmin = this.authState.getUserRole() === 'SUPER_ADMIN';
    if (this.isSuperAdmin) {
      this.schoolsLoading = true;
      this.schoolService.listAllSchools().subscribe({
        next: (schools) => {
          this.schools = schools.filter(s => s.active);
          this.schoolsLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.schoolsLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load school list.');
        }
      });
    }
  }

  schoolLabel(school: SchoolSettings): string {
    return `${school.name}  ·  ${school.slug}`;
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      Object.values(form.controls).forEach(control => control.markAsTouched());
      this.toast.warning('Form Invalid', 'Please fill in all required fields correctly.');
      return;
    }

    if (this.isSuperAdmin && !this.adminData.schoolId) {
      this.toast.warning('Validation', 'Please select a school for this admin.');
      return;
    }

    this.adminService.createAdmin(this.adminData as any).subscribe({
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