import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { AdminService } from '../../services/admin.service';
import { Router } from '@angular/router';
import { AuthStateService } from '../../auth/auth-state.service';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { Admin } from '../../interfaces/admin';

@Component({
  selector: 'app-admin-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-list.component.html',
  styleUrl: './admin-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminListComponent implements OnInit, OnDestroy {
  admins: Admin[] = [];
  isLoading: boolean = true;
  loggedInUserRole: string = '';
  currentUserId: string = '';
  private ngUnsubscribe = new Subject<void>();

  constructor(
    private adminService: AdminService,
    private router: Router,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.checkAccessAndLoadAdmins();
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  checkAccessAndLoadAdmins(): void {
    const user = this.authStateService.getUser();
    if (user) {
      this.loggedInUserRole = user.role;
      this.currentUserId = user.userId;

      if (this.loggedInUserRole === 'ADMIN' || this.loggedInUserRole === 'SUPER_ADMIN') {
        this.loadAdmins();
      } else {
        this.router.navigate(['/dashboard']);
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  loadAdmins(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.adminService.getAllAdmins()
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (data) => {
          this.admins = data;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Error fetching admins:', err);
          this.isLoading = false;
          this.cdr.markForCheck();
          Swal.fire('Error', 'Failed to load administrators. Please try again.', 'error');
        }
      });
  }

  viewAdminDetails(adminId: string): void {
    this.router.navigate(['/dashboard/admin-details', adminId]);
  }

  deleteAdmin(event: Event, adminId: string): void {
    event.stopPropagation();

    if (adminId === this.currentUserId) {
      Swal.fire('Error', 'You cannot delete your own account.', 'error');
      return;
    }

    Swal.fire({
      title: 'Are you sure?',
      text: "This admin will be permanently removed!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminService.deleteAdmin(adminId).subscribe({
          next: () => {
            this.admins = this.admins.filter(a => a.adminId !== adminId);
            this.cdr.markForCheck();
            Swal.fire('Deleted!', 'Admin has been deleted.', 'success');
          },
          error: (err) => Swal.fire('Error', 'Failed to delete admin.', 'error')
        });
      }
    });
  }

  trackByAdminId(index: number, admin: Admin): string { return admin.adminId; }

  navigateToRegisterAdmin(): void {
    this.router.navigate(['/dashboard/register-admin']);
  }
}