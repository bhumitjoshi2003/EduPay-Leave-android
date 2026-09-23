import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideRouter, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { TeacherDashboardComponent } from './teacher-dashboard.component';
import { TimetableEntry } from '../../interfaces/timetable';
import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import { AttendanceService } from '../../services/attendance.service';
import { LeaveService } from '../../services/leave.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherLeaveService } from '../../services/teacher-leave.service';
import { TimetableService } from '../../services/timetable.service';
import { NotificationStateService, UnreadCountState } from '../../services/notification-state.service';
import { EventService } from '../../services/event.service';

describe('TeacherDashboardComponent', () => {
  let authState: any;
  let teacherService: any;
  let studentService: any;
  let attendanceService: any;
  let leaveService: any;
  let cdr: any;
  let logger: any;
  let toast: any;
  let checkinService: any;
  let teacherLeaveService: any;
  let timetableService: any;
  let notificationService: any;
  let eventService: any;
  let component: TeacherDashboardComponent;

  const buildComponent = (): TeacherDashboardComponent =>
    new TeacherDashboardComponent(
      authState, teacherService, studentService, attendanceService, leaveService,
      cdr, logger, toast, checkinService, teacherLeaveService, timetableService, notificationService, eventService
    );

  beforeEach(() => {
    authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'T1' });
    authState.hasFeature.and.returnValue(false);

    teacherService = jasmine.createSpyObj('TeacherService', ['getTeacher']);
    teacherService.getTeacher.and.returnValue(of({ name: 'Ms. Rao', classTeacher: null }));

    studentService = jasmine.createSpyObj('StudentService', ['getActiveStudentsByClass']);
    attendanceService = jasmine.createSpyObj('AttendanceService', ['getAttendanceByDateAndClass', 'getClassSummary']);
    leaveService = jasmine.createSpyObj('LeaveService', ['getLeavesPaginated', 'updateLeaveStatus']);
    cdr = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
    logger = jasmine.createSpyObj('LoggerService', ['log', 'error']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'warning', 'error', 'info']);

    checkinService = jasmine.createSpyObj('TeacherCheckinService', ['getMyAttendance']);
    checkinService.getMyAttendance.and.returnValue(of({
      totalWorkingDays: 0, presentDays: 0, lateDays: 0, absentDays: 0,
      halfDayDays: 0, onLeaveDays: 0, onTimePercentage: 0,
      attendancePercentage: 0, trackingStartDate: null, records: [],
    }));

    teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getMyLeaves']);
    teacherLeaveService.getMyLeaves.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 3 }));

    timetableService = jasmine.createSpyObj('TimetableService', ['getTeacherTimetable']);
    timetableService.getTeacherTimetable.and.returnValue(of([]));

    notificationService = jasmine.createSpyObj('NotificationStateService', ['getUnreadNotificationCount']);
    notificationService.getUnreadNotificationCount.and.returnValue(of(0));
    notificationService.unreadState$ = new BehaviorSubject<UnreadCountState>({ status: 'loading', count: 0 });

    eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));
  });

  const entry = (overrides: Partial<TimetableEntry>): TimetableEntry => ({
    id: 1,
    className: 'X',
    sectionName: null,
    day: 'THURSDAY',
    periodNumber: 1,
    startTime: '09:10',
    endTime: '09:50',
    subjectName: 'English',
    teacherId: 'T1',
    ...overrides,
  });

  it('loads today\'s classes independently of the class-teacher data, using the existing teacher timetable API', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([entry({})]));
    component = buildComponent();

    component.ngOnInit();

    expect(timetableService.getTeacherTimetable).toHaveBeenCalledWith('T1');
    expect(component.todayClassesLoading).toBeFalse();
    expect(component.timetableEntries.length).toBe(1);
  });

  it('does not block the rest of the dashboard when the timetable call fails', () => {
    timetableService.getTeacherTimetable.and.returnValue(throwError(() => ({ error: { message: 'Timetable unavailable.' } })));
    component = buildComponent();

    component.ngOnInit();

    expect(component.todayClassesError).toBe('Timetable unavailable.');
    expect(component.todayClassesLoading).toBeFalse();
    // The rest of ngOnInit's independent loads still resolved normally.
    expect(component.isLoading).toBeFalse();
    expect(component.teacherName).toBe('Ms. Rao');
  });

  it('retryTodayClasses re-fetches using the current user id', () => {
    timetableService.getTeacherTimetable.and.returnValue(throwError(() => ({ error: 'Server error' })));
    component = buildComponent();
    component.ngOnInit();
    expect(component.todayClassesError).toBeTruthy();

    timetableService.getTeacherTimetable.and.returnValue(of([entry({})]));
    component.retryTodayClasses();

    expect(component.todayClassesError).toBeNull();
    expect(component.todayView.hasAnyToday).toBeTrue();
  });

  // 2026-09-17 10:00 is a fixed Thursday, far from any midnight rollover risk.
  const FIXED_NOW = new Date(2026, 8, 17, 10, 0, 0);

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(FIXED_NOW);
  });
  afterEach(() => jasmine.clock().uninstall());

  it('builds the current/upcoming view from today\'s entries', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, day: 'THURSDAY', periodNumber: 1, startTime: '09:55', endTime: '10:35' }),
      entry({ id: 2, day: 'THURSDAY', periodNumber: 2, startTime: '10:45', endTime: '11:25', className: 'IX' }),
    ]));
    component = buildComponent();
    component.ngOnInit();

    expect(component.todayView.current?.className).toBe('X');
    expect(component.todayView.upcoming.map(e => e.className)).toEqual(['IX']);
    expect(component.classLabel(component.todayView.current!)).toBe('Class X');
    expect(component.classLabel(component.todayView.upcoming[0])).toBe('Class IX');
  });

  it('falls back to "Period N" when an entry has no reliable start/end time, with no time range', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, day: 'THURSDAY', periodNumber: 4, startTime: null as any, endTime: null as any }),
    ]));
    component = buildComponent();
    component.ngOnInit();

    expect(component.todayView.current).toBeNull();
    const upcomingEntry = component.todayView.upcoming[0];
    expect(component.periodClassLabel(upcomingEntry)).toBe('Period 4 · Class X');
    expect(component.classTimeRange(upcomingEntry)).toBeNull();
  });

  it('reports no classes today for a teacher whose timetable has entries only on other days', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([entry({ id: 1, day: 'MONDAY' })]));
    component = buildComponent();
    component.ngOnInit();

    expect(component.todayView.hasAnyToday).toBeFalse();
    expect(component.timetableEntries.length).toBe(1); // has a timetable, just not today
  });

  it('reports the day complete once every class today has ended', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, day: 'THURSDAY', periodNumber: 1, startTime: '08:00', endTime: '08:40' }),
      entry({ id: 2, day: 'THURSDAY', periodNumber: 2, startTime: '08:50', endTime: '09:30' }),
    ]));
    component = buildComponent();
    component.ngOnInit();

    expect(component.todayView.current).toBeNull();
    expect(component.todayView.upcoming).toEqual([]);
    expect(component.todayView.allDone).toBeTrue();
  });

  it('reports no timetable assigned when the teacher has zero entries at all', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    component = buildComponent();
    component.ngOnInit();

    expect(component.timetableEntries.length).toBe(0);
    expect(component.todayView.hasAnyToday).toBeFalse();
  });

  it('preserves existing dashboard behavior: class-teacher branch still loads class data', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr. Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(of([{ studentId: 'S1' }, { studentId: 'S2' }]));
    attendanceService.getAttendanceByDateAndClass.and.returnValue(of([]));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }));
    attendanceService.getClassSummary.and.returnValue(of([]));

    component = buildComponent();
    component.ngOnInit();

    expect(component.isClassTeacher).toBeTrue();
    expect(component.totalStudents).toBe(2);
    expect(component.isLoading).toBeFalse();
  });

  it('preserves existing dashboard behavior: non-class-teacher path resolves isLoading without the class forkJoin', () => {
    component = buildComponent();
    component.ngOnInit();

    expect(component.isClassTeacher).toBeFalse();
    expect(studentService.getActiveStudentsByClass).not.toHaveBeenCalled();
    expect(component.isLoading).toBeFalse();
  });

  it('a class-data failure never fabricates "0 active students" / "no pending requests" — it flags classDataFailed instead', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr. Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(throwError(() => new Error('offline')));
    attendanceService.getAttendanceByDateAndClass.and.returnValue(of([]));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }));
    attendanceService.getClassSummary.and.returnValue(of([]));

    component = buildComponent();
    component.ngOnInit();

    expect(component.classDataFailed).toBeTrue();
    expect(component.isLoading).toBeFalse();
    expect(component.teacherName).toBe('Mr. Shah');
  });

  it('retrying class data re-requests only the class-data sources, and clears the failure on success', () => {
    teacherService.getTeacher.and.returnValue(of({ name: 'Mr. Shah', classTeacher: 'X' }));
    studentService.getActiveStudentsByClass.and.returnValue(throwError(() => new Error('offline')));
    attendanceService.getAttendanceByDateAndClass.and.returnValue(of([]));
    leaveService.getLeavesPaginated.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 }));
    attendanceService.getClassSummary.and.returnValue(of([]));

    component = buildComponent();
    component.ngOnInit();
    expect(component.classDataFailed).toBeTrue();

    studentService.getActiveStudentsByClass.and.returnValue(of([{ studentId: 'S1' }]));
    component.loadClassData();
    expect(component.classDataFailed).toBeFalse();
    expect(component.totalStudents).toBe(1);
  });

  // ─── Show Time parity — a per-device viewer preference, not a school/admin setting ───

  describe('show-times preference (shared localStorage key with the Timetable page)', () => {
    afterEach(() => localStorage.removeItem('tt_showTimes'));

    it('A: show times ON (the default) renders a valid time range', () => {
      localStorage.removeItem('tt_showTimes'); // unset == on
      timetableService.getTeacherTimetable.and.returnValue(of([entry({ startTime: '09:55', endTime: '10:35' })]));
      component = buildComponent();
      component.ngOnInit();
      expect(component.showTimes).toBeTrue();
      expect(component.classTimeRange(component.todayView.current!)).toBe('9:55 AM – 10:35 AM');
    });

    it('B: show times OFF suppresses the time range entirely (never renders a placeholder)', () => {
      localStorage.setItem('tt_showTimes', 'false');
      timetableService.getTeacherTimetable.and.returnValue(of([entry({ startTime: '09:55', endTime: '10:35' })]));
      component = buildComponent();
      component.ngOnInit();
      expect(component.showTimes).toBeFalse();
      expect(component.classTimeRange(component.todayView.current!)).toBeNull();
    });

    it('C: show times OFF still allows internal current/next classification using real start/end times', () => {
      localStorage.setItem('tt_showTimes', 'false');
      timetableService.getTeacherTimetable.and.returnValue(of([
        entry({ id: 1, startTime: '09:55', endTime: '10:35' }), // covers mocked "now" 10:00
        entry({ id: 2, startTime: '10:45', endTime: '11:25', className: 'IX' }),
      ]));
      component = buildComponent();
      component.ngOnInit();
      expect(component.todayView.current?.key).toBe('1');
      expect(component.todayView.upcoming[0].key).toBe('2');
    });

    it('D: re-enabling show times (new component instance) renders the time again', () => {
      timetableService.getTeacherTimetable.and.returnValue(of([entry({ startTime: '09:55', endTime: '10:35' })]));

      localStorage.setItem('tt_showTimes', 'false');
      const off = buildComponent();
      off.ngOnInit();
      expect(off.classTimeRange(off.todayView.current!)).toBeNull();

      localStorage.setItem('tt_showTimes', 'true');
      const on = buildComponent();
      on.ngOnInit();
      expect(on.classTimeRange(on.todayView.current!)).toBe('9:55 AM – 10:35 AM');
    });

    it('N: the preference is read synchronously at construction, so it can never briefly show times before the real value is known', () => {
      localStorage.setItem('tt_showTimes', 'false');
      component = buildComponent(); // showTimes is already correct before ngOnInit or any subscription resolves
      expect(component.showTimes).toBeFalse();
    });
  });

  // ─── Period number + subject icon — reused from the existing timetable, never hidden ───

  it('E/F: period number renders and remains visible regardless of the show-times preference', () => {
    localStorage.setItem('tt_showTimes', 'false');
    timetableService.getTeacherTimetable.and.returnValue(of([entry({ periodNumber: 3, startTime: '09:55', endTime: '10:35' })]));
    component = buildComponent();
    component.ngOnInit();
    expect(component.periodClassLabel(component.todayView.current!)).toBe('Period 3 · Class X');
    localStorage.removeItem('tt_showTimes');
  });

  it('G: reuses the existing timetable subject-icon mapping rather than a separate one', () => {
    component = buildComponent();
    expect(component.getSubjectIcon('Physics')).toBe('⚛️');
    expect(component.getSubjectIcon('Mathematics')).toBe('🔢');
    expect(component.getSubjectIcon('Something Unmapped')).toBe('📚');
  });

  it('H: a missing/zero period number still degrades cleanly (no crash, no invented label)', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ periodNumber: 0 as any, startTime: '09:55', endTime: '10:35' }), // covers mocked "now" 10:00
    ]));
    component = buildComponent();
    component.ngOnInit();
    const currentEntry = component.todayView.current!;
    expect(() => component.periodClassLabel(currentEntry)).not.toThrow();
    expect(component.periodClassLabel(currentEntry)).toBe('Period 0 · Class X');
  });

  it('I/J: an untimed entry follows Period N behaviour and is never classified Current', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, periodNumber: 2, startTime: null as any, endTime: null as any }),
    ]));
    component = buildComponent();
    component.ngOnInit();
    expect(component.todayView.current).toBeNull();
    expect(component.todayView.upcoming[0].status).toBe('scheduled');
  });

  it('K: current/next/later classification and labels remain correct with the new row layout', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, startTime: '09:55', endTime: '10:35' }), // current at mocked 10:00
      entry({ id: 2, startTime: '10:45', endTime: '11:25' }),
      entry({ id: 3, startTime: '11:30', endTime: '12:10' }),
    ]));
    component = buildComponent();
    component.ngOnInit();
    expect(component.todayView.current?.key).toBe('1');
    expect(component.todayView.upcoming.map(e => e.key)).toEqual(['2', '3']);
  });

  it('L: the visible list is still capped at 3 rows total (current + upcoming)', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, startTime: '09:55', endTime: '10:35' }),
      entry({ id: 2, startTime: '10:45', endTime: '11:25' }),
      entry({ id: 3, startTime: '11:30', endTime: '12:10' }),
      entry({ id: 4, startTime: '12:20', endTime: '13:00' }),
    ]));
    component = buildComponent();
    component.ngOnInit();
    expect(1 + component.todayView.upcoming.length).toBeLessThanOrEqual(3);
  });

  it('M: empty/error/completed states remain intact', () => {
    component = buildComponent();
    component.ngOnInit();
    expect(component.todayView.hasAnyToday).toBeFalse(); // no timetable / no classes today

    timetableService.getTeacherTimetable.and.returnValue(of([entry({ startTime: '08:00', endTime: '08:40' })]));
    component.retryTodayClasses();
    expect(component.todayView.allDone).toBeTrue(); // completed (mocked "now" 10:00 is after 08:40)

    timetableService.getTeacherTimetable.and.returnValue(throwError(() => ({ error: { message: 'boom' } })));
    component.retryTodayClasses();
    expect(component.todayClassesError).toBe('boom');
  });

  // ─── Updates (unread notification count) — reuses the dashboard shell's shared
  //     NotificationStateService.unreadState$ rather than fetching its own copy ───

  it('never calls getUnreadNotificationCount directly — it only subscribes to the shared shell state', () => {
    component = buildComponent();
    component.ngOnInit();
    expect(notificationService.getUnreadNotificationCount).not.toHaveBeenCalled();
  });

  it('renders a positive unread count from the shared shell state', () => {
    notificationService.unreadState$ = of({ status: 'success', count: 3 } as UnreadCountState);
    component = buildComponent();
    component.ngOnInit();
    expect(component.unreadCount).toBe(3);
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('shows a zero-unread state distinctly from a failed load', () => {
    notificationService.unreadState$ = of({ status: 'success', count: 0 } as UnreadCountState);
    component = buildComponent();
    component.ngOnInit();
    expect(component.unreadCount).toBe(0);
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('reflects the shared loading state while the shell refresh is still in flight', () => {
    notificationService.unreadState$ = new BehaviorSubject<UnreadCountState>({ status: 'loading', count: 0 });
    component = buildComponent();
    component.ngOnInit();
    expect(component.unreadCountLoading).toBeTrue();
    expect(component.unreadCountFailed).toBeFalse();
  });

  it('an unread-count failure never blocks the rest of the dashboard', () => {
    notificationService.unreadState$ = of({ status: 'error', count: 0 } as UnreadCountState);
    component = buildComponent();
    component.ngOnInit();
    expect(component.unreadCountFailed).toBeTrue();
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.teacherName).toBe('Ms. Rao');
    expect(component.isLoading).toBeFalse();
  });

  it('reacts live when the shared unread count changes after initial load (e.g. the shell\'s poll)', () => {
    const shared = new BehaviorSubject<UnreadCountState>({ status: 'success', count: 1 });
    notificationService.unreadState$ = shared;
    component = buildComponent();
    component.ngOnInit();
    expect(component.unreadCount).toBe(1);

    shared.next({ status: 'success', count: 6 });
    expect(component.unreadCount).toBe(6);
    expect(component.unreadCountLoading).toBeFalse();
    expect(component.unreadCountFailed).toBeFalse();
  });

  // ─── Leave status — derived from the already-fetched recentTeacherLeaves, no new request ───

  it('shows the pending count when the most recent leaves include a pending request', () => {
    teacherLeaveService.getMyLeaves.and.returnValue(of({
      content: [
        { id: 1, teacherId: 'T1', teacherName: 'Ms. Rao', startDate: '2026-10-01', endDate: '2026-10-01', reason: 'x', status: 'PENDING', appliedDate: '2026-09-15', days: 1 },
      ], totalElements: 1, totalPages: 1,
    }));
    component = buildComponent();
    component.ngOnInit();
    expect(component.leaveStatusLabel).toBe('1 request pending');
  });

  it('shows a neutral state when there are no pending or current leaves', () => {
    teacherLeaveService.getMyLeaves.and.returnValue(of({
      content: [
        { id: 1, teacherId: 'T1', teacherName: 'Ms. Rao', startDate: '2026-08-01', endDate: '2026-08-01', reason: 'x', status: 'REJECTED', appliedDate: '2026-07-15', days: 1 },
      ], totalElements: 1, totalPages: 1,
    }));
    component = buildComponent();
    component.ngOnInit();
    expect(component.leaveStatusLabel).toBe('No pending requests');
  });

  it('does not fire a second/duplicate request for the leave status card', () => {
    component = buildComponent();
    component.ngOnInit();
    expect(teacherLeaveService.getMyLeaves).toHaveBeenCalledTimes(1);
  });

  // ─── Upcoming event — bounded to at most 2 requests, isolated failure ───

  const event = (overrides: any = {}) => ({
    id: 1, title: 'Event', description: '', startDate: '2026-09-20', category: 'GENERAL', targetAudience: [],
    ...overrides,
  });

  it('picks the nearest upcoming event, excluding past ones', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(of([
      event({ id: 1, title: 'Past Event', startDate: '2026-09-10' }),
      event({ id: 2, title: 'Sooner Event', startDate: '2026-09-24' }),
      event({ id: 3, title: 'Later Event', startDate: '2026-09-28' }),
    ]));
    component = buildComponent();
    component.ngOnInit();
    expect(component.upcomingEvent?.title).toBe('Sooner Event');
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledTimes(1);
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledWith(2026, 9);
  });

  it('falls back to next month when the current month has no upcoming event', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(of([event({ id: 1, title: 'Past Event', startDate: '2026-09-10' })]));
    component = buildComponent();
    component.ngOnInit();

    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledWith(2026, 9);
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledWith(2026, 10);
    expect(eventService.getEventsForMonthAndYear).toHaveBeenCalledTimes(2);
  });

  it('shows a no-event state when neither the current nor next month has one', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));
    component = buildComponent();
    component.ngOnInit();
    expect(component.upcomingEvent).toBeNull();
    expect(component.upcomingEventLoading).toBeFalse();
    expect(component.upcomingEventFailed).toBeFalse();
  });

  it('isolates an event-load failure — the rest of the dashboard still loads normally', () => {
    eventService.getEventsForMonthAndYear.and.returnValue(throwError(() => new Error('offline')));
    component = buildComponent();
    component.ngOnInit();
    expect(component.upcomingEventFailed).toBeTrue();
    expect(component.upcomingEventLoading).toBeFalse();
    expect(component.teacherName).toBe('Ms. Rao');
    expect(component.isLoading).toBeFalse();
  });

  it('formats an event start time using the existing shared clock-time formatter', () => {
    expect(buildComponent().formatEventTime('10:00:00')).toBe('10:00 AM');
  });
});

// ─── Layout ordering — rendered via TestBed since it's a template-order concern, not state ───

@Component({ selector: 'app-wisdom-cards', standalone: true, template: '' })
class StubWisdomCardsComponent {}

@Component({ selector: 'app-teacher-getting-started', standalone: true, template: '<div class="stub-getting-started">Getting Started</div>', inputs: ['todaysClassesAvailable'] })
class StubTeacherGettingStartedComponent {}

describe('TeacherDashboardComponent layout order', () => {
  let fixture: ComponentFixture<TeacherDashboardComponent>;

  beforeEach(async () => {
    const authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasFeature']);
    authState.getUser.and.returnValue({ userId: 'T1' });
    authState.hasFeature.and.returnValue(false);
    const teacherService = jasmine.createSpyObj('TeacherService', ['getTeacher']);
    teacherService.getTeacher.and.returnValue(of({ name: 'Ms. Rao', classTeacher: null }));
    const checkinService = jasmine.createSpyObj('TeacherCheckinService', ['getMyAttendance']);
    checkinService.getMyAttendance.and.returnValue(of({
      totalWorkingDays: 0, presentDays: 0, lateDays: 0, absentDays: 0,
      halfDayDays: 0, onLeaveDays: 0, onTimePercentage: 0,
      attendancePercentage: 0, trackingStartDate: null, records: [],
    }));
    const teacherLeaveService = jasmine.createSpyObj('TeacherLeaveService', ['getMyLeaves']);
    teacherLeaveService.getMyLeaves.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0 }));
    const timetableService = jasmine.createSpyObj('TimetableService', ['getTeacherTimetable']);
    timetableService.getTeacherTimetable.and.returnValue(of([]));
    const notificationService = jasmine.createSpyObj('NotificationStateService', ['getUnreadNotificationCount']);
    notificationService.getUnreadNotificationCount.and.returnValue(of(2));
    notificationService.unreadState$ = of({ status: 'success', count: 2 } as UnreadCountState);
    const eventService = jasmine.createSpyObj('EventService', ['getEventsForMonthAndYear']);
    eventService.getEventsForMonthAndYear.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [TeacherDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStateService, useValue: authState },
        { provide: TeacherService, useValue: teacherService },
        { provide: StudentService, useValue: jasmine.createSpyObj('StudentService', ['getActiveStudentsByClass']) },
        { provide: AttendanceService, useValue: jasmine.createSpyObj('AttendanceService', ['getAttendanceByDateAndClass', 'getClassSummary']) },
        { provide: LeaveService, useValue: jasmine.createSpyObj('LeaveService', ['getLeavesPaginated', 'updateLeaveStatus']) },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'info', 'error']) },
        { provide: TeacherCheckinService, useValue: checkinService },
        { provide: TeacherLeaveService, useValue: teacherLeaveService },
        { provide: TimetableService, useValue: timetableService },
        { provide: NotificationStateService, useValue: notificationService },
        { provide: EventService, useValue: eventService },
      ],
    })
      .overrideComponent(TeacherDashboardComponent, {
        set: { imports: [StubWisdomCardsComponent, StubTeacherGettingStartedComponent, CommonModule, RouterLink, MatIconModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TeacherDashboardComponent);
    fixture.detectChanges();
  });

  it('keeps Check-in and Today\'s Classes near the top, above Getting Started', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text.indexOf('My attendance')).toBeGreaterThan(-1);
    expect(text.indexOf('Today\'s Classes')).toBeLessThan(text.indexOf('Getting Started'));
    expect(text.indexOf('My attendance')).toBeLessThan(text.indexOf('Getting Started'));
  });

  it('never renders Getting Started above the daily-operational sections (leave, workspaces)', () => {
    const text: string = fixture.nativeElement.textContent;
    const gettingStartedIndex = text.indexOf('Getting Started');
    expect(gettingStartedIndex).toBeGreaterThan(-1);
    expect(text.indexOf('Quick actions')).toBeLessThan(gettingStartedIndex);
    expect(fixture.nativeElement.querySelector('.td-insight-tile.insight-amber')).toBeTruthy();
  });

  it('renders the Updates tile visibly without dominating the layout, using the shared unread-count state', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Updates');
    expect(text).toContain('2');
    expect((TestBed.inject(NotificationStateService) as any).getUnreadNotificationCount).not.toHaveBeenCalled();
    const tile = fixture.nativeElement.querySelector('.td-insight-tile.insight-indigo');
    expect(tile).toBeTruthy();
  });

  it('orders Today\'s Classes, September attendance, Leaves, Updates and Upcoming Event ahead of Quick actions and the class workspace', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelector('.td-insight-tile.insight-amber')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.td-insight-tile.insight-teal')).toBeTruthy();
    const todayIdx = text.indexOf('Today\'s Classes');
    const attendanceIdx = text.indexOf('September attendance');
    const leavesIdx = text.indexOf('Leaves');
    const updatesIdx = text.indexOf('Updates');
    const eventIdx = text.indexOf('Upcoming Event');
    const quickActionsIdx = text.indexOf('Quick actions');
    const gettingStartedIdx = text.indexOf('Getting Started');
    expect(todayIdx).toBeLessThan(attendanceIdx);
    expect(attendanceIdx).toBeLessThan(leavesIdx);
    expect(leavesIdx).toBeLessThan(updatesIdx);
    expect(updatesIdx).toBeLessThan(eventIdx);
    expect(eventIdx).toBeLessThan(quickActionsIdx);
    expect(quickActionsIdx).toBeLessThan(gettingStartedIdx);
  });
});
