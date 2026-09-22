import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AuthStateService } from '../../auth/auth-state.service';
import { AdminService } from '../../services/admin.service';
import { DashboardAnalyticsService } from '../../services/dashboard-analytics.service';
import { LeaveService } from '../../services/leave.service';
import { SchoolService } from '../../services/school.service';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { StaffAdoptionService } from '../../services/staff-adoption.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

describe('AdminDashboardComponent — Daily Action Center (Phase 1)', () => {
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let component: AdminDashboardComponent;
  let staffAdoptionService: jasmine.SpyObj<StaffAdoptionService>;

  function configure(role: string, opts: { stats?: any; staffAttendance?: any } = {}): void {
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'U1', role, name: 'Test', className: '' } as any);
    authState.hasFeature.and.returnValue(false);

    staffAdoptionService = jasmine.createSpyObj('StaffAdoptionService', ['getStaffAdoption']);
    staffAdoptionService.getStaffAdoption.and.returnValue(of({
      summary: { totalTeachers: 22, startedTeachers: 18, notStartedTeachers: 3, attendanceUsedTeachers: 16, disabledTeachers: 1 },
      teachers: [],
    }));

    const stats = opts.stats ?? { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 };
    const staffAttendance = opts.staffAttendance ?? { date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1 };

    TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: AdminService, useValue: { getAdminById: () => of({ name: 'Test Admin' }) } },
        { provide: DashboardAnalyticsService, useValue: { getStats: () => of(stats) } },
        { provide: LeaveService, useValue: { getLeavesPaginated: () => of({ content: [] }) } },
        { provide: SchoolService, useValue: { getEntitlement: () => of(null) } },
        { provide: TeacherCheckinService, useValue: { getTodaySummary: () => of(staffAttendance) } },
        { provide: StaffAdoptionService, useValue: staffAdoptionService },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['error']) },
      ],
    });
    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  }

  it('renders Staff Attendance Today before Staff Adoption', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    const staffAttendanceIdx = text.indexOf('Staff Attendance Today');
    expect(staffAttendanceIdx).toBeGreaterThan(-1);
    expect(staffAttendanceIdx).toBeLessThan(text.lastIndexOf('Staff Adoption'));
  });

  it('renders Pending Leave Requests before Staff Adoption', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    const pendingIdx = text.indexOf('Pending Leave Requests');
    expect(pendingIdx).toBeGreaterThan(-1);
    expect(pendingIdx).toBeLessThan(text.lastIndexOf('Staff Adoption'));
  });

  it('computes Not Yet Checked In as totalTeachers minus the five accounted-for buckets', () => {
    configure('ADMIN', {
      stats: { totalStudents: 0, totalTeachers: 10, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 },
      staffAttendance: { date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 0, halfDayCount: 0, onLeaveCount: 1 },
    });
    fixture.detectChanges();
    expect(component.notYetCheckedIn).toBe(4); // 10 - (4+1+0+0+1)
    expect(fixture.nativeElement.textContent).toContain('Not Yet Checked In');
  });

  it('clamps Not Yet Checked In to zero rather than going negative', () => {
    configure('ADMIN', {
      stats: { totalStudents: 0, totalTeachers: 5, feesCollectedThisMonth: 0, overdueStudents: 0, todayAttendanceRate: 0, pendingLeaves: 0 },
      staffAttendance: { date: '2026-09-22', presentCount: 4, lateCount: 1, absentCount: 1, halfDayCount: 0, onLeaveCount: 1 },
    });
    fixture.detectChanges();
    expect(component.notYetCheckedIn).toBe(0);
  });

  it('never labels the not-yet-checked-in metric as "Absent"', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const pill = Array.from(fixture.nativeElement.querySelectorAll('.ad-staff-att-pill'))
      .find((el: any) => el.textContent.includes('Not Yet Checked In')) as HTMLElement;
    expect(pill).toBeTruthy();
    expect(pill.textContent).not.toContain('Absent');
  });

  it('renders the compact daily quick actions with the correct existing routes', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const routes = ['/dashboard/staff-attendance', '/dashboard/view-leaves', '/dashboard/notice', '/dashboard/staff-adoption'];
    for (const route of routes) {
      const link = fixture.nativeElement.querySelector(`.ad-daily-actions-grid a[routerLink="${route}"]`);
      expect(link).withContext(route).toBeTruthy();
    }
  });

  it('hides the Staff Adoption quick action for a non-ADMIN role, matching existing ADMIN-only behavior', () => {
    configure('SUB_ADMIN');
    fixture.detectChanges();
    expect(staffAdoptionService.getStaffAdoption).not.toHaveBeenCalled();
    const link = fixture.nativeElement.querySelector('.ad-daily-actions-grid a[routerLink="/dashboard/staff-adoption"]');
    expect(link).toBeNull();
    expect(fixture.nativeElement.querySelector('.ad-daily-actions-grid a[routerLink="/dashboard/staff-attendance"]')).toBeTruthy();
  });

  it('still renders the full existing Quick Actions grid unchanged', () => {
    configure('ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.ad-actions-grid')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Quick Actions');
  });

  it('renders the repositioned Staff Adoption card for an ADMIN, with its existing CTA route', () => {
    configure('ADMIN');
    fixture.detectChanges();
    expect(staffAdoptionService.getStaffAdoption).toHaveBeenCalled();
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.ad-adoption a[routerLink="/dashboard/staff-adoption"]');
    expect(link).not.toBeNull();
  });

  it('keeps the existing dashboard sections intact (stat cards, pending-leave empty state)', () => {
    configure('ADMIN');
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Total Students');
    expect(text).toContain('Total Teachers');
    expect(text).toContain('No pending leave requests');
  });
});
