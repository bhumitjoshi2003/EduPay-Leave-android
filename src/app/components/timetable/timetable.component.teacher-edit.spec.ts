import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TimetableComponent } from './timetable.component';
import { TimetableService } from '../../services/timetable.service';
import { TeacherService } from '../../services/teacher.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { StudentService } from '../../services/student.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { ActivatedRoute, Router } from '@angular/router';
import { TeacherClassGrantService } from '../../services/teacher-class-grant.service';

/**
 * Rendered-template regression coverage for the TEACHER edit flow.
 *
 * The rest of this component's spec file (timetable.component.spec.ts) instantiates
 * TimetableComponent directly (`new TimetableComponent(...)`) and never renders the HTML
 * template — that style cannot observe template-only issues (a mis-bound field, a control that
 * doesn't reflect its model, a button that isn't actually reachable from the rendered DOM). This
 * file uses TestBed + real change detection specifically to exercise the actual rendered page —
 * clicking the real "Edit / Delete" button, reading the real "Class" dropdown and Subject input —
 * the same way a teacher's browser would.
 */
describe('TEACHER edit flow (rendered template)', () => {
  let fixture: ComponentFixture<TimetableComponent>;
  let c: TimetableComponent;
  let api: any;
  let toast: any;

  const mathEntry: any = {
    id: 501, academicSessionId: 1, classId: 11, className: '11', sectionId: 3, sectionName: 'Science',
    day: 'WEDNESDAY', periodNumber: 3, startTime: '09:15', endTime: '09:50', subjectName: 'Mathematics',
    teacherId: 'T1', teacherName: 'Teacher One', simultaneousGroup: null
  };
  const otherTeacherEntry: any = {
    id: 502, academicSessionId: 1, classId: 11, className: '11', sectionId: 3, sectionName: 'Science',
    day: 'WEDNESDAY', periodNumber: 4, startTime: '09:50', endTime: '10:25', subjectName: 'Biology',
    teacherId: 'T2', teacherName: 'Teacher Two', simultaneousGroup: null
  };

  async function setup(entries: any[] = [mathEntry]) {
    api = jasmine.createSpyObj('TimetableService', [
      'getTeacherTimetable', 'getCorrections', 'requestCorrection', 'reviewCorrection',
      'updateEntry', 'deleteEntry', 'createEntry', 'addSimultaneous', 'getClassTimetable'
    ]);
    api.getTeacherTimetable.and.returnValue(of(entries));
    api.getCorrections.and.returnValue(of([]));
    api.requestCorrection.and.returnValue(of({}));
    api.updateEntry.and.returnValue(of({}));
    toast = { success: jasmine.createSpy(), confirm: jasmine.createSpy().and.resolveTo(true) };

    await TestBed.configureTestingModule({
      imports: [TimetableComponent],
      providers: [
        { provide: TimetableService, useValue: api },
        { provide: TeacherService, useValue: { getTeacher: () => of({}), getAllTeachers: () => of([]) } },
        { provide: AuthStateService, useValue: { getUser: () => ({ role: 'TEACHER', userId: 'T1', name: 'Teacher One' }) } },
        { provide: StudentService, useValue: {} },
        { provide: LoggerService, useValue: { error: () => { } } },
        { provide: ToastService, useValue: toast },
        { provide: SchoolService, useValue: { getSettings: () => of({}), getManagedClasses: () => of([{ id: 11, name: '11', displayOrder: 1, active: true, streamEligible: false }]) } },
        { provide: SectionService, useValue: { getSectionsForClass: () => of([]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: {} },
        { provide: TeacherClassGrantService, useValue: { getForTeacher: () => of([]) } },
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(TimetableComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function clickEdit(matchText: string) {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.tt-card-list .tt-btn-cancel'));
    const btn = buttons.find(b => b.closest('.tt-period-card')?.textContent?.includes(matchText));
    btn?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('1. opens a teacher\'s own current-session entry with no writable-session error', async () => {
    await setup();
    await clickEdit('Mathematics');
    expect(c.modalError).toBeNull();
    c.saveEntry();
    expect(c.modalError).toBeNull();
  });

  it('2. populates the existing subject exactly (not the section/stream name)', async () => {
    await setup();
    await clickEdit('Mathematics');
    const subjectInput: HTMLInputElement = fixture.nativeElement.querySelector('#modal-subject');
    expect(subjectInput.value).toBe('Mathematics');
    expect(c.modalForm.subjectName).toBe('Mathematics');
  });

  it('3. populates the existing class/section correctly', async () => {
    await setup();
    await clickEdit('Mathematics');
    expect(c.modalForm.classId).toBe(11);
    expect(c.modalForm.sectionId).toBe(3);
    expect(c.selectedMyClassKey).toBe('11::3');
    const classSelect: HTMLSelectElement = fixture.nativeElement.querySelector('#modal-my-class');
    expect(classSelect.value).toBe('11::3');
  });

  it('4. lets the teacher submit a valid update', async () => {
    await setup();
    await clickEdit('Mathematics');
    c.saveEntry();
    expect(api.updateEntry).toHaveBeenCalledWith(501, jasmine.objectContaining({
      classId: 11, sectionId: 3, subjectName: 'Mathematics', teacherId: 'T1', academicSessionId: 1
    }));
  });

  it('5. never requires admin-style session selection for a teacher', async () => {
    await setup();
    // The academic-session-selector and the session-writability admin check are gated to canManage().
    expect(fixture.nativeElement.querySelector('app-academic-session-selector')).toBeNull();
    await clickEdit('Mathematics');
    expect(c.canWrite()).toBeFalse(); // never true for a teacher — must not block their save
    c.saveEntry();
    expect(c.modalError).toBeNull();
  });

  it('6. another teacher\'s entry is not offered for edit and cannot be opened', async () => {
    await setup([mathEntry, otherTeacherEntry]);
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.tt-card-list .tt-btn-cancel'));
    expect(buttons.length).toBe(1); // only the Mathematics (own) row offers Edit / Delete
    c.openEdit(otherTeacherEntry);
    expect(c.showModal).toBeFalse();
  });

  it('7. a historical (non-current-session) entry is not editable even if otherwise owned', async () => {
    await setup();
    // A genuinely historical row is never present in teacherEntries at all — getByTeacher only
    // ever returns current-session rows — so it carries a different id, never one already loaded.
    const historical = { ...mathEntry, id: 999, academicSessionId: 9 };
    expect(c.canEditEntry(historical)).toBeFalse();
    c.openEdit(historical);
    expect(c.showModal).toBeFalse();
  });

  it('8. a same-subject conflict still offers Request Correction, phrased plainly', async () => {
    await setup();
    api.createEntry.and.returnValue(throwError(() => ({ status: 409, error: {
      code: 'SAME_SUBJECT_ASSIGNED_TO_ANOTHER_TEACHER', timetableEntryId: 502,
      message: 'Biology is already scheduled for this period and is assigned to another teacher.'
    }})));
    c.openAddPeriodAsTeacher();
    fixture.detectChanges();
    c.modalForm.subjectName = 'Biology';
    c.modalForm.day = 'TUESDAY';
    c.modalForm.periodNumber = 4;
    c.modalForm.startTime = '10:00';
    c.modalForm.endTime = '10:35';
    c.saveEntry();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(c.correctionTargetId).toBe(502);
    const conflictText: HTMLElement = fixture.nativeElement.querySelector('.tt-corr-conflict-text');
    expect(conflictText.textContent).toContain('Biology is already assigned to another teacher.');
    const requestBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.tt-corr-conflict-btn');
    expect(requestBtn).not.toBeNull();
    expect(requestBtn.textContent).toContain('Request Correction');

    requestBtn.click();
    expect(api.requestCorrection).toHaveBeenCalledWith(502, undefined);
  });

  it('9. editing one\'s own entry never invokes the correction-request flow', async () => {
    await setup();
    await clickEdit('Mathematics');
    expect(c.correctionTargetId).toBeNull();
    c.saveEntry();
    expect(api.requestCorrection).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.tt-corr-conflict')).toBeNull();
  });
});
