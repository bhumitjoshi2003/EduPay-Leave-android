import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../auth/auth.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { CommonModule } from '@angular/common';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../services/notification.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { MatDialog } from '@angular/material/dialog';
import { WelcomeDialogComponent } from '../welcome-dialog/welcome-dialog.component';
import { Subject, takeUntil, interval, Subscription } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    CommonModule,
    MatBadgeModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {

  Role: string = '';
  Id: string = '';
  Name: string = '';
  Class: string = '';
  ClassTeacher: string = '';
  hasShownWelcomeMessage: boolean = false;
  unreadNotificationCount: number = 0;
  showMoreMenu: boolean = false;
  private ngUnsubscribe = new Subject<void>();
  private welcomeMessageKey = 'hasShownWelcome';
  private pollingIntervalSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private authService: AuthService,
    private authStateService: AuthStateService,
    private studentService: StudentService,
    private teacherService: TeacherService,
    private adminService: AdminService,
    private notificationService: NotificationService,
    private pushNotificationService: PushNotificationService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService
  ) { }

  ngOnInit() {
    this.loadWelcomeMessageState();
    this.getDetails();
    this.handleInitialNavigation();
    this.fetchUnreadCount();
    // Re-fetch on every navigation (catches mark-all-read from notice board)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.ngUnsubscribe)
    ).subscribe(() => this.fetchUnreadCount());
    // Also poll every 60 seconds as a background fallback
    this.pollingIntervalSubscription = interval(60000)
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(() => this.fetchUnreadCount());
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    if (this.pollingIntervalSubscription) {
      this.pollingIntervalSubscription.unsubscribe();
    }
  }

  loadWelcomeMessageState() {
    const storedState = localStorage.getItem(this.welcomeMessageKey);
    if (storedState === 'true') {
      this.hasShownWelcomeMessage = true;
    } else {
      this.hasShownWelcomeMessage = false;
    }
  }

  saveWelcomeMessageState() {
    localStorage.setItem(this.welcomeMessageKey, 'true');
  }

  getDetails() {
    const user = this.authStateService.getUser();
    if (user) {
      this.Role = user.role;
      this.Id = user.userId;
      this.fetchUserDetails();
    }
  }

  fetchUserDetails() {
    if (this.Role === 'STUDENT' && this.Id) {
      this.studentService.getStudent(this.Id).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
        next: (student) => {
          this.Name = student.name;
          this.Class = student.className;
          this.showWelcomeMessageOnce();
        },
        error: (error) => {
          this.logger.error('Error fetching student details:', error);
        }
      });
    } else if (this.Role === 'TEACHER' && this.Id) {
      this.teacherService.getTeacher(this.Id).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
        next: (teacher) => {
          this.Name = teacher.name;
          this.ClassTeacher = teacher.classTeacher ?? '';
          this.showWelcomeMessageOnce();
        },
        error: (error) => {
          this.logger.error('Error fetching teacher details:', error);
        }
      });
    } else if (this.Role === 'ADMIN' && this.Id) {
      this.adminService.getAdminById(this.Id).pipe(takeUntil(this.ngUnsubscribe)).subscribe({
        next: (admin) => {
          this.Name = admin.name;
          this.showWelcomeMessageOnce();
        },
        error: (error) => {
          this.logger.error('Error fetching admin details:', error);
        }
      });
    }
  }

  showWelcomeMessageOnce() {
    if (!this.hasShownWelcomeMessage) {
      this.openWelcomeMessage();
      this.hasShownWelcomeMessage = true;
      this.saveWelcomeMessageState();
    }
  }

  openWelcomeMessage() {
    const dialogRef = this.dialog.open(WelcomeDialogComponent, {
      maxWidth: '520px',
      width: '100%',
      height: 'auto',
      disableClose: true,
      data: { name: this.Name },
      panelClass: 'custom-dialog-container'
    });

    setTimeout(() => {
      dialogRef.close();
    }, 3000);
  }

  handleInitialNavigation(): void {
    const currentUrl = this.router.url;
    if (!currentUrl.startsWith('/dashboard/payment-history-details/')) {
      if (this.Role === 'STUDENT') {
        this.router.navigate(['/dashboard/student-dashboard']);
      } else if (this.Role === 'TEACHER') {
        this.router.navigate(['/dashboard/teacher-dashboard']);
      } else if (this.Role === 'ADMIN') {
        this.router.navigate(['/dashboard/admin-dashboard']);
      } else if (this.Role === 'SUPER_ADMIN') {
        this.router.navigate(['/dashboard/admin-list']);
      } else {
        this.router.navigate(['/dashboard']);
      }
    }
  }

  isStudent(): boolean {
    return this.Role === 'STUDENT';
  }

  isTeacher(): boolean {
    return this.Role === 'TEACHER';
  }

  isAdmin(): boolean {
    return this.Role === 'ADMIN' || this.Role === 'SUB-ADMIN';
  }

  isSuperAdmin(): boolean {
    return this.Role === 'SUPER_ADMIN';
  }

  logout() {
    localStorage.removeItem(this.welcomeMessageKey);
    this.pushNotificationService.clearToken();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => this.router.navigate(['/home'])
    });
  }

  fetchUnreadCount(): void {
    this.notificationService.getUnreadNotificationCount()
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe({
        next: (count) => { this.unreadNotificationCount = count; this.cdr.markForCheck(); },
        error: (e) => this.logger.error('Error fetching unread count:', e),
      });
  }

  navigateToNoticeBoard(): void {
    this.router.navigate(['/dashboard/notice']);
  }

  getRoleLabel(): string {
    const labels: Record<string, string> = {
      'STUDENT': 'Student',
      'TEACHER': 'Teacher',
      'ADMIN': 'Admin',
      'SUB-ADMIN': 'Sub Admin',
      'SUPER_ADMIN': 'Super Admin',
    };
    return labels[this.Role] ?? this.Role;
  }

  getRoleChipClass(): string {
    const classes: Record<string, string> = {
      'STUDENT': 'chip-student',
      'TEACHER': 'chip-teacher',
      'ADMIN': 'chip-admin',
      'SUB-ADMIN': 'chip-subadmin',
      'SUPER_ADMIN': 'chip-superadmin',
    };
    return classes[this.Role] ?? 'chip-student';
  }

  toggleMoreMenu(): void {
    this.showMoreMenu = !this.showMoreMenu;
  }

  closeMoreMenu(): void {
    this.showMoreMenu = false;
  }

  navigateToMyProfile(): void {
    if (this.isStudent() && this.Id) {
      this.router.navigate(['/dashboard/student-details', this.Id]);
    }
    if (this.isTeacher() && this.Id) {
      this.router.navigate(['/dashboard/teacher-details', this.Id]);
    }
    if (this.isAdmin() && this.Id) {
      this.router.navigate(['/dashboard/admin-details', this.Id]);
    }
  }
}