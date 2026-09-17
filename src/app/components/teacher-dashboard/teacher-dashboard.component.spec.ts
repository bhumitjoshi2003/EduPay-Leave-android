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

  it('falls back to "Period N" when an entry has no reliable start/end time', () => {
    timetableService.getTeacherTimetable.and.returnValue(of([
      entry({ id: 1, day: 'THURSDAY', periodNumber: 4, startTime: null as any, endTime: null as any }),
    ]));
    component = buildComponent();
    component.ngOnInit();

    expect(component.todayView.current).toBeNull();
    expect(component.classTimeLabel(component.todayView.upcoming[0])).toBe('Period 4');
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
});
