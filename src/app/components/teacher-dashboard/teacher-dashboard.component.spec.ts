import { of, throwError } from 'rxjs';
import { TeacherDashboardComponent } from './teacher-dashboard.component';
import { TimetableEntry } from '../../interfaces/timetable';

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
  let component: TeacherDashboardComponent;

  const buildComponent = (): TeacherDashboardComponent =>
    new TeacherDashboardComponent(
      authState, teacherService, studentService, attendanceService, leaveService,
      cdr, logger, toast, checkinService, teacherLeaveService, timetableService
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
});
