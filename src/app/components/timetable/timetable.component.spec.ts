import { of, Subject, throwError } from 'rxjs';
import { TimetableComponent } from './timetable.component';
import { AcademicSession } from '../../interfaces/academic-session';
import { sessionKind, writableSession } from '../academic-session-selector/academic-session-selector.component';

const current: AcademicSession = { id: 1, label: 'Current', startDate: '2000-01-01', endDate: '2001-01-01', current: true };
const future: AcademicSession = { id: 2, label: 'Future', startDate: '2998-01-01', endDate: '2999-01-01', current: false };
const historical: AcademicSession = { id: 3, label: 'Past', startDate: '2000-01-01', endDate: '2001-01-01', current: false };
describe('G1 timetable screen', () => {
  let c: TimetableComponent;
  let api: any;
  let toast: any;
  beforeEach(() => {
    api = jasmine.createSpyObj('TimetableService', ['createEntry', 'updateEntry', 'deleteEntry', 'addSimultaneous', 'getClassTimetable', 'getTeacherTimetable', 'getCorrections', 'requestCorrection', 'reviewCorrection']);
    for (const key of ['createEntry', 'updateEntry', 'deleteEntry', 'addSimultaneous']) api[key].and.returnValue(of({}));
    api.getCorrections.and.returnValue(of([])); api.requestCorrection.and.returnValue(of({})); api.reviewCorrection.and.returnValue(of({}));
    api.getClassTimetable.and.returnValue(of([])); api.getTeacherTimetable.and.returnValue(of([]));
    toast = { success: jasmine.createSpy(), confirm: jasmine.createSpy().and.resolveTo(true) };
    c = new TimetableComponent(api, { getTeacher: () => of({}) } as any, {} as any, {} as any, { error: () => {} } as any, { markForCheck: () => {} } as any, toast, {} as any, {} as any, { snapshot: { queryParamMap: { get: () => null } } } as any, {} as any, { getForTeacher: () => of([]) } as any);
    c.role = 'ADMIN'; c.selectedSession = current; c.selectedClassId = 8; c.selectedClass = '8'; c.sectionsLoaded = true;
    c.modalForm = { id: 10, academicSessionId: 1, classId: 8, className: 'Untrusted display', sectionId: null, day: 'MONDAY', periodNumber: 1, startTime: '09:00', endTime: '10:00', subjectName: 'Math', teacherId: 'T1' };
  });
  afterEach(() => c.ngOnDestroy());
  it('uses authoritative current flag even outside date range', () => { expect(sessionKind(current)).toBe('CURRENT'); expect(writableSession(current)).toBeTrue(); });
  it('enables future configuration and disables historical/no-session writes', () => {
    c.selectedSession = future; expect(c.canWrite()).toBeTrue();
    for (const session of [historical, null]) { c.selectedSession = session; expect(c.canWrite()).toBeFalse(); c.openAddPeriod(); c.saveEntry(); }
    expect(api.createEntry).not.toHaveBeenCalled();
  });
  it('does not expose ADMIN writes to SUB_ADMIN', () => { c.role = 'SUB_ADMIN'; expect(c.canWrite()).toBeFalse(); c.saveEntry(); expect(api.createEntry).not.toHaveBeenCalled(); });
  it('creates with canonical IDs and strips display names and group tags', () => {
    c.modalForm.simultaneousGroup = 'preserve-on-server'; c.saveEntry();
    const body = api.createEntry.calls.mostRecent().args[0];
    expect(body.academicSessionId).toBe(1); expect(body.classId).toBe(8); expect(body.sectionId).toBeNull();
    expect(body.className).toBeUndefined(); expect(body.simultaneousGroup).toBeUndefined();
  });
  it('creates explicitly in a future session', () => { c.selectedSession = future; c.modalForm.academicSessionId = 2; c.saveEntry(); expect(api.createEntry.calls.mostRecent().args[0].academicSessionId).toBe(2); });
  it('requires a canonical section when the class has sections', () => {
    c.sections = [{ id: 4, classId: 8, name: 'A', active: true }]; c.saveEntry(); expect(api.createEntry).not.toHaveBeenCalled();
    c.modalForm.sectionId = 4; c.saveEntry(); expect(api.createEntry.calls.mostRecent().args[0].sectionId).toBe(4);
  });
  it('fails closed when section lookup fails', () => { c.sectionsLoaded = false; c.saveEntry(); expect(api.createEntry).not.toHaveBeenCalled(); });
  it('retains IDs on edit and sends them to update', () => { const entry = { ...c.modalForm }; c.openEdit(entry); c.saveEntry(); expect(api.updateEntry.calls.mostRecent().args[0]).toBe(10); expect(api.updateEntry.calls.mostRecent().args[1].classId).toBe(8); });
  it('sends explicit selected session on simultaneous assignment', () => {
    c.openAddSimultaneous(c.modalForm); c.modalForm.subjectName = 'Biology'; c.modalForm.teacherId = 'T2'; c.saveEntry();
    expect(api.addSimultaneous).toHaveBeenCalledWith(10, 'Biology', 'T2', 1);
  });
  it('deletes only after confirmation with captured session', async () => { c.deleteEntry(); await Promise.resolve(); expect(api.deleteEntry).toHaveBeenCalledWith(10, 1); });
  it('does not delete when session changes during confirmation', async () => { c.deleteEntry(); c.selectedSession = future; await Promise.resolve(); expect(api.deleteEntry).not.toHaveBeenCalled(); });
  it('rejects stale edit session', () => { c.selectedSession = future; c.saveEntry(); expect(api.createEntry).not.toHaveBeenCalled(); });
  it('cancels stale class timetable reads on selection change', () => {
    const stale = new Subject<any[]>(); api.getClassTimetable.and.returnValues(stale, of([]));
    c.loadClassTimetable(); c.onSessionSelected(future); stale.next([{ id: 900 }]); expect(c.entries).toEqual([]);
    expect(api.getClassTimetable.calls.mostRecent().args[3]).toBe(2);
  });
  it('keeps teacher creation operational and preserves supplied canonical ID', () => {
    c.role = 'TEACHER'; c.saveEntry(); const body = api.createEntry.calls.mostRecent().args[0];
    expect(body.classId).toBe(8); expect(body.academicSessionId).toBeUndefined();
    expect(api.getTeacherTimetable).toHaveBeenCalled();
  });

  it('lets teachers edit only their own loaded operational rows', () => {
    c.role = 'TEACHER'; c.userId = 'T1'; c.teacherEntries = [{ ...c.modalForm }];
    expect(c.canEditEntry(c.modalForm)).toBeTrue();
    expect(c.canEditEntry({ ...c.modalForm, teacherId: 'T2' })).toBeFalse();
    expect(c.canEditEntry({ ...c.modalForm, id: 999 })).toBeFalse();
    c.openEdit(c.modalForm); c.saveEntry();
    expect(api.updateEntry.calls.mostRecent().args[1].academicSessionId).toBe(1);
    expect(api.updateEntry.calls.mostRecent().args[1].teacherId).toBe('T1');
  });
  it('deletes a teacher-owned operational row with its explicit session', async () => {
    c.role = 'TEACHER'; c.userId = 'T1'; c.selectedSession = null; c.teacherEntries = [{ ...c.modalForm }];
    c.deleteEntry(); await Promise.resolve(); expect(api.deleteEntry).toHaveBeenCalledWith(10, 1);
    expect(api.getTeacherTimetable).toHaveBeenCalled();
  });
  it('does not open or delete another teacher assignment', async () => {
    c.role = 'TEACHER'; c.userId = 'T2'; c.teacherEntries = [{ ...c.modalForm }];
    c.openEdit(c.modalForm); c.deleteEntry(); await Promise.resolve();
    expect(c.showModal).toBeFalse(); expect(api.deleteEntry).not.toHaveBeenCalled();
  });
  it('offers correction for structured ownership conflict without simultaneous recovery', () => {
    c.role = 'TEACHER'; c.userId = 'T1';
    api.createEntry.and.returnValue(throwError(() => ({ status: 409, error: {
      code: 'SAME_SUBJECT_ASSIGNED_TO_ANOTHER_TEACHER', timetableEntryId: 22,
      message: 'Biology is already scheduled for this period and is assigned to another teacher.'
    }})));
    c.saveEntry(); expect(c.correctionTargetId).toBe(22); expect(c.isSimultaneousMode).toBeFalse();
    expect(api.getClassTimetable).not.toHaveBeenCalled();
    c.correctionReason = ' I teach Biology '; c.requestCorrection();
    expect(api.requestCorrection).toHaveBeenCalledWith(22, 'I teach Biology');
    expect(api.getCorrections).toHaveBeenCalled();
  });
  it('preserves different-subject simultaneous recovery', () => {
    c.role = 'TEACHER'; c.userId = 'T1';
    api.createEntry.and.returnValue(throwError(() => ({ status: 409, error: 'Period is assigned' })));
    api.getClassTimetable.and.returnValue(of([{ ...c.modalForm, subjectName: 'Biology' }]));
    c.saveEntry(); expect(c.isSimultaneousMode).toBeTrue(); expect(c.correctionTargetId).toBeNull();
  });
  it('does not allow SUB_ADMIN to review corrections', () => {
    c.role = 'SUB_ADMIN'; c.reviewCorrection({ id: 1 } as any, 'approve'); expect(api.reviewCorrection).not.toHaveBeenCalled();
  });
  it('admin review refreshes correction requests and timetable', () => {
    c.reviewCorrection({ id: 4 } as any, 'approve'); expect(api.reviewCorrection).toHaveBeenCalledWith(4, 'approve');
    expect(api.getCorrections).toHaveBeenCalled(); expect(api.getClassTimetable).toHaveBeenCalled();
  });
  it('shows review errors without reporting success', () => {
    api.reviewCorrection.and.returnValue(throwError(() => ({ error: { message: 'Entry changed' } })));
    c.reviewCorrection({ id: 4 } as any, 'approve'); expect(c.correctionsError).toBe('Entry changed');
    expect(toast.success).not.toHaveBeenCalled(); expect(c.correctionBusy).toBeFalse();
  });
});
