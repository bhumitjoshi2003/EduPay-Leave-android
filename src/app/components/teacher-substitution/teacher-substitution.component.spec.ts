import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TeacherSubstitutionComponent } from './teacher-substitution.component';
import { TeacherSubstitutionService } from '../../services/teacher-substitution.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { UncoveredPeriod } from '../../interfaces/teacher-substitution';

describe('TeacherSubstitutionComponent', () => {
  let fixture: ComponentFixture<TeacherSubstitutionComponent>;
  let component: TeacherSubstitutionComponent;
  let substitutions: jasmine.SpyObj<TeacherSubstitutionService>;
  let authState: jasmine.SpyObj<AuthStateService>;
  let toast: jasmine.SpyObj<ToastService>;

  const period = (overrides: Partial<UncoveredPeriod> = {}): UncoveredPeriod => ({
    timetableEntryId: 100, originalTeacherId: 'T1', originalTeacherName: 'Mr Original',
    className: 'X', sectionName: 'A', subjectName: 'Maths', periodNumber: 3,
    startTime: '09:10', endTime: '09:50', assignment: null,
    freeTeachers: [{ teacherId: 'T2', name: 'Ms Free' }],
    ...overrides,
  });

  function configure(role: 'ADMIN' | 'SUB_ADMIN', opts: { hasTimetableEdit?: boolean } = {}): void {
    substitutions = jasmine.createSpyObj('TeacherSubstitutionService',
      ['getUncovered', 'getFreeTeachers', 'assign', 'change', 'cancel', 'getMine']);
    substitutions.getUncovered.and.returnValue(of([period()]));

    authState = jasmine.createSpyObj('AuthStateService', ['getUser', 'hasPermission']);
    authState.getUser.and.returnValue({ role } as any);
    authState.hasPermission.and.returnValue(!!opts.hasTimetableEdit);

    toast = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'confirm']);
    toast.confirm.and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [TeacherSubstitutionComponent],
      providers: [
        provideRouter([]),
        { provide: TeacherSubstitutionService, useValue: substitutions },
        { provide: AuthStateService, useValue: authState },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error']) },
        { provide: ToastService, useValue: toast },
      ],
    });
    fixture = TestBed.createComponent(TeacherSubstitutionComponent);
    component = fixture.componentInstance;
  }

  it('loads uncovered periods with their eligible free teachers on init', () => {
    configure('ADMIN');
    fixture.detectChanges();

    expect(substitutions.getUncovered).toHaveBeenCalled();
    expect(component.periods.length).toBe(1);
    expect(component.periods[0].freeTeachers[0].name).toBe('Ms Free');
  });

  it('shows an isolated fallback with Retry when uncovered periods fail to load', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(throwError(() => new Error('offline')));
    fixture.detectChanges();

    expect(component.failed).toBeTrue();
    expect(component.loading).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
  });

  it('shows a truthful empty state when there are no uncovered periods', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([]));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No uncovered periods for this date.');
  });

  it('ADMIN can assign a free teacher to an uncovered period', () => {
    configure('ADMIN');
    fixture.detectChanges();
    substitutions.assign.and.returnValue(of({} as any));

    component.selections[100] = 'T2';
    component.save(component.periods[0]);

    expect(substitutions.assign).toHaveBeenCalledWith(100, component.selectedDate, 'T2');
    expect(toast.success).toHaveBeenCalled();
  });

  it('permitted SUB_ADMIN (has TIMETABLE_EDIT) can manage substitutions', () => {
    configure('SUB_ADMIN', { hasTimetableEdit: true });
    fixture.detectChanges();

    expect(component.canManage).toBeTrue();
    expect(fixture.nativeElement.querySelector('.sub-assign select')).toBeTruthy();
  });

  it('unpermitted SUB_ADMIN (no TIMETABLE_EDIT) sees a view-only notice, not the assign controls', () => {
    configure('SUB_ADMIN', { hasTimetableEdit: false });
    fixture.detectChanges();

    expect(component.canManage).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sub-assign')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('does not have permission');
  });

  it('changes the substitute for a period that already has one', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([period({
      assignment: {
        id: 5, revision: 0, date: '2026-09-17', timetableEntryId: 100,
        originalTeacherId: 'T1', originalTeacherName: 'Mr Original',
        substituteTeacherId: 'T2', substituteTeacherName: 'Ms Free',
        className: 'X', sectionName: 'A', subjectName: 'Maths', periodNumber: 3,
        startTime: '09:10', endTime: '09:50', status: 'ACTIVE', assignedBy: 'A1',
        assignedAt: '2026-09-17T08:00:00', updatedAt: '2026-09-17T08:00:00',
      },
    })]));
    fixture.detectChanges();
    substitutions.change.and.returnValue(of({} as any));

    component.selections[100] = 'T3';
    component.save(component.periods[0]);

    expect(substitutions.change).toHaveBeenCalledWith(5, 'T3');
    expect(substitutions.assign).not.toHaveBeenCalled();
  });

  it('cancels a substitute after user confirmation', fakeAsync(() => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([period({
      assignment: {
        id: 5, revision: 0, date: '2026-09-17', timetableEntryId: 100,
        originalTeacherId: 'T1', originalTeacherName: 'Mr Original',
        substituteTeacherId: 'T2', substituteTeacherName: 'Ms Free',
        className: 'X', sectionName: 'A', subjectName: 'Maths', periodNumber: 3,
        startTime: '09:10', endTime: '09:50', status: 'ACTIVE', assignedBy: 'A1',
        assignedAt: '2026-09-17T08:00:00', updatedAt: '2026-09-17T08:00:00',
      },
    })]));
    fixture.detectChanges();
    substitutions.cancel.and.returnValue(of({} as any));

    component.remove(component.periods[0]);
    tick();

    expect(toast.confirm).toHaveBeenCalled();
    expect(substitutions.cancel).toHaveBeenCalledWith(5);
    expect(toast.success).toHaveBeenCalled();
  }));

  it('does not cancel when the user declines the confirmation', fakeAsync(() => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([period({
      assignment: {
        id: 5, revision: 0, date: '2026-09-17', timetableEntryId: 100,
        originalTeacherId: 'T1', originalTeacherName: 'Mr Original',
        substituteTeacherId: 'T2', substituteTeacherName: 'Ms Free',
        className: 'X', sectionName: 'A', subjectName: 'Maths', periodNumber: 3,
        startTime: '09:10', endTime: '09:50', status: 'ACTIVE', assignedBy: 'A1',
        assignedAt: '2026-09-17T08:00:00', updatedAt: '2026-09-17T08:00:00',
      },
    })]));
    fixture.detectChanges();
    toast.confirm.and.resolveTo(false);

    component.remove(component.periods[0]);
    tick();

    expect(substitutions.cancel).not.toHaveBeenCalled();
  }));

  it('warns instead of saving when no free teacher is selected', () => {
    configure('ADMIN');
    fixture.detectChanges();

    component.selections[100] = '';
    component.save(component.periods[0]);

    expect(toast.warning).toHaveBeenCalled();
    expect(substitutions.assign).not.toHaveBeenCalled();
  });

  // ─── UI polish: status chip, "Absent teacher:", collapsed substitute view, summary ───

  const assignedPeriod = () => period({
    assignment: {
      id: 5, revision: 0, date: '2026-09-17', timetableEntryId: 100,
      originalTeacherId: 'T1', originalTeacherName: 'Mr Original',
      substituteTeacherId: 'T2', substituteTeacherName: 'Ms Free',
      className: 'X', sectionName: 'A', subjectName: 'Maths', periodNumber: 3,
      startTime: '09:10', endTime: '09:50', status: 'ACTIVE', assignedBy: 'A1',
      assignedAt: '2026-09-17T08:00:00', updatedAt: '2026-09-17T08:00:00',
    },
  });

  it('shows "Absent teacher: X" instead of "Replacing X"', () => {
    configure('ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Absent teacher: Mr Original');
    expect(fixture.nativeElement.textContent).not.toContain('Replacing');
  });

  it('shows a "Needs substitute" chip for an unassigned period, and counts it in the summary', () => {
    configure('ADMIN');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sub-chip')?.textContent).toContain('Needs substitute');
    expect(fixture.nativeElement.textContent).toContain('1 period needs attention');
  });

  it('shows a "Covered" chip and the substitute\'s name once assigned — with no summary attention needed', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([assignedPeriod()]));
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.sub-chip');
    expect(chip?.textContent).toContain('Covered');
    expect(fixture.nativeElement.textContent).toContain('Substitute: Ms Free');
    expect(fixture.nativeElement.textContent).toContain('All uncovered periods are covered.');
  });

  it('does not permanently show the teacher selector once a period is covered', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([assignedPeriod()]));
    fixture.detectChanges();

    // The <select> stays in the DOM (hidden) rather than being destroyed/recreated —
    // see the "Change substitute" fix below — so visibility is asserted via [hidden],
    // not mere DOM presence.
    expect(fixture.nativeElement.querySelector('.sub-assign-changing').hidden).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Change substitute');
    expect(fixture.nativeElement.textContent).toContain('Remove');
  });

  it('reveals the selector and a confirm action only after "Change substitute" is clicked', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([assignedPeriod()]));
    fixture.detectChanges();
    expect(component.changingEntryId).toBeNull();

    component.startChange(component.periods[0]);
    fixture.detectChanges();

    expect(component.changingEntryId).toBe(100);
    const changingBlock = fixture.nativeElement.querySelector('.sub-assign-changing');
    expect(changingBlock.hidden).toBeFalse();
    expect(changingBlock.querySelector('select')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Confirm change');
  });

  it('the <select> element is never recreated across a "Change substitute" toggle — only its container\'s [hidden] state changes (this is what keeps a mobile browser from mispositioning its native options popup)', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([assignedPeriod()]));
    fixture.detectChanges();
    const selectBeforeToggle = fixture.nativeElement.querySelector('.sub-assign-changing select');

    component.startChange(component.periods[0]);
    fixture.detectChanges();
    const selectAfterToggle = fixture.nativeElement.querySelector('.sub-assign-changing select');

    expect(selectBeforeToggle).toBe(selectAfterToggle);
  });

  it('cancelling the change collapses the selector back to the substitute name', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([assignedPeriod()]));
    fixture.detectChanges();
    component.startChange(component.periods[0]);
    fixture.detectChanges();

    component.cancelChange(component.periods[0]);
    fixture.detectChanges();

    expect(component.changingEntryId).toBeNull();
    expect(fixture.nativeElement.querySelector('.sub-assign-changing').hidden).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Substitute: Ms Free');
  });

  it('collapses the change-selector back after a successful change', () => {
    configure('ADMIN');
    substitutions.getUncovered.and.returnValue(of([assignedPeriod()]));
    substitutions.change.and.returnValue(of({} as any));
    fixture.detectChanges();
    component.startChange(component.periods[0]);
    component.selections[100] = 'T3';

    component.save(component.periods[0]);

    expect(component.changingEntryId).toBeNull();
  });
});
