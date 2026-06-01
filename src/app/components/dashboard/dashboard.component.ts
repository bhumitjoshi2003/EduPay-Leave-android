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
import { SchoolService } from '../../services/school.service';
import { TenantService } from '../../services/tenant.service';
import { MatDialog } from '@angular/material/dialog';
import { WelcomeDialogComponent } from '../welcome-dialog/welcome-dialog.component';
import { Subject, takeUntil, interval, Subscription } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

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
  showUpdateBanner = false;
  latestAppVersion = '';
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
    private schoolService: SchoolService,
    public tenantService: TenantService,
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
    this.checkForAppUpdate();
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    if (this.pollingIntervalSubscription) {
      this.pollingIntervalSubscription.unsubscribe();
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.authStateService.loadCurrentUser()
        .then(() => this.cdr.markForCheck())
        .catch(() => {});
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
    } else if (this.Role === 'SUPER_ADMIN') {
      this.Name = 'Super Admin';
      this.cdr.markForCheck();
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
    // Expired ADMIN must renew — override whatever page they were on.
    if (this.Role === 'ADMIN' && this.subscriptionStatus === 'EXPIRED') {
      this.router.navigate(['/dashboard/school-settings']);
      return;
    }

    // Only redirect to the role-specific home page when the user lands on the bare
    // /dashboard route (no child path). On a page refresh, the router already has
    // the full URL in router.url, so we must leave it alone to stay on the same page.
    const url = this.router.url.split('?')[0]; // strip query params for comparison
    const isBareDashboard = url === '/dashboard' || url === '/dashboard/';
    if (!isBareDashboard) return;

    if (this.Role === 'STUDENT') {
      this.router.navigate(['/dashboard/student-dashboard']);
    } else if (this.Role === 'TEACHER') {
      this.router.navigate(['/dashboard/teacher-dashboard']);
    } else if (this.Role === 'ADMIN' || this.Role === 'SUB_ADMIN') {
      this.router.navigate(['/dashboard/admin-dashboard']);
    } else if (this.Role === 'SUPER_ADMIN') {
      this.router.navigate(['/dashboard/super-admin-dashboard']);
    }
  }

  isStudent(): boolean {
    return this.Role === 'STUDENT';
  }

  isTeacher(): boolean {
    return this.Role === 'TEACHER';
  }

  isAdmin(): boolean {
    return this.Role === 'ADMIN' || this.Role === 'SUB_ADMIN';
  }

  isSuperAdmin(): boolean {
    return this.Role === 'SUPER_ADMIN';
  }

  get subscriptionStatus(): string | null {
    return this.authStateService.getSubscriptionStatus();
  }

  /**
   * Returns true if the school's active plan includes the given feature key.
   * Falls back to true when featureKeys is empty (no subscription data loaded)
   * so the nav is never completely blank due to a data-load failure.
   * This is a UX-only guard — the backend always enforces authorisation.
   */
  hasFeature(key: string): boolean {
    const keys = this.authStateService.getUser()?.featureKeys;
    if (!keys || keys.length === 0) return true;
    return keys.includes(key);
  }

  showSubscriptionWarning(): boolean {
    return this.authStateService.isSubscriptionWarning() && this.isAdmin();
  }

  private async checkForAppUpdate(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const info = await AppUpdate.getAppUpdateInfo();
      if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
        this.latestAppVersion = info.availableVersionName ?? '';
        this.showUpdateBanner = true;
        this.cdr.markForCheck();
      }
    } catch { /* plugin not available or check failed */ }
  }

  openPlayStore(): void {
    AppUpdate.openAppStore().catch(() => {
      window.open('https://play.google.com/store/apps/details?id=in.edunexify.app', '_system');
    });
  }

  dismissUpdateBanner(): void {
    this.showUpdateBanner = false;
    this.cdr.markForCheck();
  }

  logout() {
    localStorage.removeItem(this.welcomeMessageKey);
    this.pushNotificationService.clearToken();
    this.schoolService.invalidateClasses();
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/home']),
      error: () => this.router.navigate(['/home'])
    });
  }

  fetchUnreadCount(): void {
    if (this.Role === 'SUPER_ADMIN') return;
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

  navigateToStudentSearch(): void {
    this.router.navigate(['/dashboard/student-search']);
  }

  getRoleLabel(): string {
    const labels: Record<string, string> = {
      'STUDENT': 'Student',
      'TEACHER': 'Teacher',
      'ADMIN': 'Admin',
      'SUB_ADMIN': 'Sub Admin',
      'SUPER_ADMIN': 'Super Admin',
    };
    return labels[this.Role] ?? this.Role;
  }

  getRoleChipClass(): string {
    const classes: Record<string, string> = {
      'STUDENT': 'chip-student',
      'TEACHER': 'chip-teacher',
      'ADMIN': 'chip-admin',
      'SUB_ADMIN': 'chip-subadmin',
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