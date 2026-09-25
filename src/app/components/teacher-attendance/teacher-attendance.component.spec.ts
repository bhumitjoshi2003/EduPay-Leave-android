import { of, throwError } from 'rxjs';
import { TeacherAttendanceComponent } from './teacher-attendance.component';
import { AttendanceSheet } from '../../interfaces/attendance-sheet';

describe('TeacherAttendanceComponent (Attendance V2)', () => {
  let attendanceService: any;
  let authState: any;
  let logger: any;
  let cdr: any;
  let toast: any;
  let schoolService: any;
  let sectionService: any;
  let router: any;

  const sheet = (overrides: Partial<AttendanceSheet> = {}): AttendanceSheet => ({
    classId: 10, className: '8', sectionId: 3, sectionName: 'A', date: '2026-09-25',
    submitted: false, markedBy: null, markedAt: null, updatedAt: null,
    markable: true, blockedReason: null,
    students: [
      { studentId: 'S1', name: 'Aarav', status: null, approvedLeave: false },
      { studentId: 'S2', name: 'Bina', status: null, approvedLeave: true },
    ],
    ...overrides,
  });

  const build = () => new TeacherAttendanceComponent(
    attendanceService, authState, logger, cdr, toast, schoolService, sectionService, router);

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 8, 25, 10, 0, 0));
    attendanceService = jasmine.createSpyObj('AttendanceService', ['getSheet', 'submitSheet', 'deleteSheet', 'getCalendarConfig']);
    attendanceService.getCalendarConfig.and.returnValue(of({ workingDays: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY', timezone: 'Asia/Kolkata' }));
    attendanceService.getSheet.and.returnValue(of(sheet()));
    authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'getUserRole']);
    authState.getUser.and.returnValue({ userId: 'T1', role: 'TEACHER', schoolSlug: 'demo' });
    authState.getUserRole.and.returnValue('TEACHER');
    logger = jasmine.createSpyObj('LoggerService', ['error']);
    cdr = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning', 'confirm']);
    toast.confirm.and.returnValue(Promise.resolve(true));
    schoolService = jasmine.createSpyObj('SchoolService', ['getManagedClasses']);
    sectionService = jasmine.createSpyObj('SectionService', ['getSectionsForClass']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    localStorage.clear();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('defaults everyone to PRESENT and students on approved leave to ABSENT', () => {
    const component = build();
    component.ngOnInit();

    expect(attendanceService.getSheet).toHaveBeenCalledWith(null, null, null);
    expect(component.rows.map(r => r.status)).toEqual(['PRESENT', 'ABSENT']);
    expect(component.rows[1].approvedLeave).toBeTrue();
    expect(component.approvedLeaveCount).toBe(1);
  });

  it('shows saved statuses instead of defaults once submitted', () => {
    attendanceService.getSheet.and.returnValue(of(sheet({
      submitted: true,
      students: [
        { studentId: 'S1', name: 'Aarav', status: 'ABSENT', approvedLeave: false },
        { studentId: 'S2', name: 'Bina', status: 'PRESENT', approvedLeave: true },
      ],
    })));
    const component = build();
    component.ngOnInit();

    expect(component.rows.map(r => r.status)).toEqual(['ABSENT', 'PRESENT']);
  });

  it('submits an explicit status for every student; a teacher never sends a class or section', async () => {
    attendanceService.submitSheet.and.returnValue(of(sheet({ submitted: true })));
    const component = build();
    component.ngOnInit();
    component.toggle(component.rows[0]);

    await component.saveAttendance();

    expect(attendanceService.submitSheet).toHaveBeenCalledOnceWith({
      classId: null, sectionId: null, date: '2026-09-25',
      students: [{ studentId: 'S1', status: 'ABSENT' }, { studentId: 'S2', status: 'ABSENT' }],
    });
    expect(component.sheet?.submitted).toBeTrue();
  });

  it('ignores a second save while the first is in flight', async () => {
    let resolveConfirm!: (v: boolean) => void;
    toast.confirm.and.returnValue(new Promise<boolean>(r => resolveConfirm = r));
    attendanceService.submitSheet.and.returnValue(of(sheet({ submitted: true })));
    const component = build();
    component.ngOnInit();

    const first = component.saveAttendance();
    component.isSaving = true; // the first request is already on its way
    resolveConfirm(true);
    await first;

    expect(attendanceService.submitSheet).not.toHaveBeenCalled();
  });

  it('locks editing when the server says the date is not markable', () => {
    attendanceService.getSheet.and.returnValue(of(sheet({ markable: false, blockedReason: '2026-09-22 is a school holiday.' })));
    const component = build();
    component.ngOnInit();
    component.toggle(component.rows[0]);

    expect(component.canEdit).toBeFalse();
    expect(component.rows[0].status).toBe('PRESENT');
  });

  it('keeps teachers inside their three-day edit window', () => {
    attendanceService.getSheet.and.returnValue(of(sheet({ date: '2026-09-18' })));
    const component = build();
    component.ngOnInit();
    component.onDateChange({ value: new Date(2026, 8, 18) });

    expect(component.isWithinTeacherWindow).toBeFalse();
    expect(component.canEdit).toBeFalse();
  });

  it('admin picks a class and is placed on its first section', () => {
    authState.getUser.and.returnValue({ userId: 'A1', role: 'ADMIN', schoolSlug: 'demo' });
    authState.getUserRole.and.returnValue('ADMIN');
    schoolService.getManagedClasses.and.returnValue(of([
      { id: 10, name: '8', displayOrder: 1, active: true, streamEligible: false },
      { id: 11, name: '9', displayOrder: 2, active: false, streamEligible: false },
    ]));
    sectionService.getSectionsForClass.and.returnValue(of([
      { id: 3, classId: 10, name: 'A', active: true },
      { id: 4, classId: 10, name: 'B', active: true },
    ]));
    const component = build();
    component.ngOnInit();

    expect(component.classes.map(c => c.name)).toEqual(['8']);
    expect(attendanceService.getSheet).not.toHaveBeenCalled();

    component.onClassSelect(component.classes[0]);
    expect(attendanceService.getSheet).toHaveBeenCalledWith(null, 10, 3);

    component.onSectionSelect(4);
    expect(attendanceService.getSheet).toHaveBeenCalledWith(null, 10, 4);
  });

  it('shows the server error when the roster cannot be loaded', () => {
    attendanceService.getSheet.and.returnValue(throwError(() => ({ status: 400, error: { message: 'Choose a section — attendance is marked per section.' } })));
    const component = build();
    component.ngOnInit();

    expect(component.loadError).toContain('Choose a section');
    expect(component.rows).toEqual([]);
  });
});
