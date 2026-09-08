import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { StudentPromotionComponent } from './student-promotion.component';
import {
  StudentService, PromotionCandidate, PromotionPreviewDTO, PromotionResultDTO
} from '../../services/student.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { AcademicSession } from '../../interfaces/academic-session';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

/**
 * Phase G3: the promotion screen was migrated off the obsolete {studentId, action} contract
 * (grouped-by-className preview, hardcoded "Class 12" pass-out check) onto the E2 explicit
 * source/target AcademicSession API, ported from the web implementation. These tests exercise
 * the new contract end-to-end at the component level: session selection/defaulting, preview-first
 * staleness invalidation, decision/section handling (including the "omission must never become
 * DETAIN" rule), the execute payload built from authoritative preview IDs, and per-student
 * partial-success result rendering — never a single generic success/failure toast. The standalone
 * "fix orphaned sections" maintenance action (no web equivalent) is also covered.
 */
describe('G3 StudentPromotionComponent', () => {
  let component: StudentPromotionComponent;
  let fixture: ComponentFixture<StudentPromotionComponent>;
  let studentServiceSpy: jasmine.SpyObj<StudentService>;
  let academicSessionServiceSpy: jasmine.SpyObj<AcademicSessionService>;
  let schoolServiceSpy: jasmine.SpyObj<SchoolService>;
  let sectionServiceSpy: jasmine.SpyObj<SectionService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  const session = (id: number, label: string, startDate: string, endDate: string, current = false): AcademicSession =>
    ({ id, label, startDate, endDate, current });

  const SOURCE = session(1, '2026-2027', '2026-04-01', '2027-03-31', true);
  const TARGET = session(2, '2027-2028', '2027-04-01', '2028-03-31', false);
  const UNRELATED = session(3, '2024-2025', '2024-04-01', '2025-03-31', false);

  const schoolClass = (id: number, name: string, displayOrder: number): SchoolClass =>
    ({ id, name, displayOrder, active: true, streamEligible: false });

  const section = (id: number, classId: number, name: string): Section => ({ id, classId, name, active: true });

  function candidate(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
    return {
      studentId: 'S1',
      studentName: 'Student One',
      sourceEnrollmentId: 500,
      sourceSessionId: SOURCE.id,
      sourceClassId: 10,
      sourceClassName: '8',
      sourceSectionId: 20,
      sourceSectionName: 'A',
      availableDecisions: ['PROMOTE', 'DETAIN'],
      recommendedDecision: 'PROMOTE',
      promoteTargetClassId: 11,
      promoteTargetClassName: '9',
      detainTargetClassId: 10,
      detainTargetClassName: '8',
      promoteTargetSectionRequired: true,
      proposedPromoteTargetSectionId: null,
      proposedDetainTargetSectionId: 20,
      proposedTargetStatus: 'PLANNED',
      errors: [],
      warnings: [],
      appliedDecisionState: 'NOT_APPLIED',
      ...overrides,
    };
  }

  function preview(candidates: PromotionCandidate[], overrides: Partial<PromotionPreviewDTO> = {}): PromotionPreviewDTO {
    return {
      sourceSessionId: SOURCE.id,
      targetSessionId: TARGET.id,
      valid: true,
      errors: [],
      candidates,
      uncoveredStudents: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    studentServiceSpy = jasmine.createSpyObj('StudentService', ['getPromotionPreview', 'executePromotion', 'fixOrphanedSections']);
    academicSessionServiceSpy = jasmine.createSpyObj('AcademicSessionService', ['getAllSessions']);
    schoolServiceSpy = jasmine.createSpyObj('SchoolService', ['getManagedClasses']);
    sectionServiceSpy = jasmine.createSpyObj('SectionService', ['getSectionsForClass']);
    toastSpy = jasmine.createSpyObj('ToastService', ['success', 'error', 'warning', 'info', 'confirm']);

    academicSessionServiceSpy.getAllSessions.and.returnValue(of([TARGET, SOURCE, UNRELATED]));
    schoolServiceSpy.getManagedClasses.and.returnValue(of([schoolClass(10, '8', 1), schoolClass(11, '9', 2)]));
    sectionServiceSpy.getSectionsForClass.and.returnValue(of([section(20, 10, 'A'), section(21, 11, 'B')]));

    await TestBed.configureTestingModule({
      imports: [StudentPromotionComponent],
      providers: [
        { provide: StudentService, useValue: studentServiceSpy },
        { provide: AcademicSessionService, useValue: academicSessionServiceSpy },
        { provide: SchoolService, useValue: schoolServiceSpy },
        { provide: SectionService, useValue: sectionServiceSpy },
        { provide: LoggerService, useValue: jasmine.createSpyObj('LoggerService', ['error', 'warn', 'info']) },
        { provide: ToastService, useValue: toastSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentPromotionComponent);
    component = fixture.componentInstance;
  });

  // ─── Session loading + defaulting ───────────────────────────────────────

  it('loads sessions and classes, and defaults source to current / target to the contiguous next session', () => {
    fixture.detectChanges();

    expect(academicSessionServiceSpy.getAllSessions).toHaveBeenCalled();
    expect(schoolServiceSpy.getManagedClasses).toHaveBeenCalled();
    expect(component.sessionsLoading).toBeFalse();
    expect(component.sourceSessionId).toBe(SOURCE.id);
    expect(component.targetSessionId).toBe(TARGET.id);
  });

  it('leaves target unset when no existing session is contiguous with the current one, rather than guessing', () => {
    academicSessionServiceSpy.getAllSessions.and.returnValue(of([SOURCE, UNRELATED]));
    fixture.detectChanges();

    expect(component.sourceSessionId).toBe(SOURCE.id);
    expect(component.targetSessionId).toBeNull();
  });

  it('degrades safely on a session-loading error', () => {
    academicSessionServiceSpy.getAllSessions.and.returnValue(throwError(() => new Error('network error')));
    fixture.detectChanges();

    expect(component.sessionsLoading).toBeFalse();
    expect(toastSpy.error).toHaveBeenCalled();
  });

  // ─── Preview request + staleness (items 1, 2, 8, 9) ──────────────────────

  it('sends the selected session IDs (and optional filters) to the preview endpoint', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate()])));

    component.classFilter = 10;
    component.studentIdFilter = 'S1';
    component.loadPreview();

    expect(studentServiceSpy.getPromotionPreview).toHaveBeenCalledWith(SOURCE.id, TARGET.id, 10, 'S1');
  });

  it('omits optional filters entirely when unset', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate()])));

    component.loadPreview();

    expect(studentServiceSpy.getPromotionPreview).toHaveBeenCalledWith(SOURCE.id, TARGET.id, null, null);
  });

  it('invalidates the loaded preview and clears decisions when either session selector changes', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate()])));
    component.loadPreview();
    expect(component.preview).not.toBeNull();
    expect(component.decisions.size).toBeGreaterThan(0);

    component.targetSessionId = UNRELATED.id;
    component.onTargetSessionChange();

    expect(component.preview).toBeNull();
    expect(component.decisions.size).toBe(0);
  });

  it('flags the preview as stale the moment a filter changes it was not loaded with', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate()])));
    component.loadPreview();
    expect(component.previewIsStale).toBeFalse();

    (component as any).previewedClassFilter = 999;
    expect(component.previewIsStale).toBeTrue();
  });

  it('prevents execution while sessions have changed since the preview was loaded', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    component.loadPreview();
    expect(component.canExecute).toBeTrue();

    component.targetSessionId = UNRELATED.id; // drift without reloading

    expect(component.canExecute).toBeFalse();
  });

  it('does not retain decisions from a previous preview after a fresh one loads', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate({ studentId: 'S1' })])));
    component.loadPreview();
    expect(component.decisions.has('S1')).toBeTrue();

    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate({ studentId: 'S2' })])));
    component.loadPreview();

    expect(component.decisions.has('S1')).toBeFalse();
    expect(component.decisions.has('S2')).toBeTrue();
  });

  // ─── Invalid preview (item 14) ────────────────────────────────────────────

  it('shows preview errors and blocks execution outright when the session pairing is invalid', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(
      preview([], { valid: false, errors: [{ code: 'SESSIONS_NOT_CONTIGUOUS', message: 'Sessions are not contiguous.' }] })
    ));
    component.loadPreview();

    expect(component.preview?.valid).toBeFalse();
    expect(component.preview?.errors[0].message).toContain('not contiguous');
    expect(component.canExecute).toBeFalse();
    expect(studentServiceSpy.executePromotion).not.toHaveBeenCalled();
  });

  // ─── Recommendations + decision handling ────────────────────────────────

  it('preselects the backend-recommended decision for an eligible candidate', () => {
    fixture.detectChanges();
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([candidate({ recommendedDecision: 'PROMOTE' })])));
    component.loadPreview();

    expect(component.getDecision('S1')).toBe('PROMOTE');
  });

  it('never preselects a decision for an already-applied or errored candidate', () => {
    fixture.detectChanges();
    const already = candidate({ studentId: 'S1', appliedDecisionState: 'ALREADY_APPLIED:PROMOTE' });
    const errored = candidate({ studentId: 'S2', errors: [{ code: 'INVALID_SOURCE', message: 'bad' }] });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([already, errored])));
    component.loadPreview();

    expect(component.getDecision('S1')).toBe('NONE');
    expect(component.getDecision('S2')).toBe('NONE');
  });

  it('leaving a student unselected keeps it as NO DECISION, never DETAIN', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', appliedDecisionState: 'ALREADY_APPLIED:PROMOTE' });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    component.loadPreview();

    expect(component.getDecision('S1')).toBe('NONE');
    expect(component.getDecision('S1')).not.toBe('DETAIN');
    expect(component.readyCandidates).toEqual([]);
  });

  // ─── Target sections (item 7) ─────────────────────────────────────────────

  it('requires an explicit target section for PROMOTE into a sectioned class', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: true, proposedPromoteTargetSectionId: null });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');

    expect(component.rowNeedsSection(c)).toBeTrue();
    expect(component.rowIsReady(c)).toBeFalse();

    component.setTargetSection('S1', 21);
    expect(component.rowNeedsSection(c)).toBeFalse();
    expect(component.rowIsReady(c)).toBeTrue();
  });

  it('does not show a section picker or require one when the target class has no sections', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false, proposedPromoteTargetSectionId: null });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');

    expect(component.showSectionPicker(c)).toBeFalse();
    expect(component.rowNeedsSection(c)).toBeFalse();
  });

  // ─── Execute payload (items 4, 5, 6, 10) ─────────────────────────────────

  it('builds the execute payload from the loaded preview, preserving expected source IDs', () => {
    fixture.detectChanges();
    const c = candidate({
      studentId: 'S1', sourceEnrollmentId: 777, sourceClassId: 10,
      promoteTargetClassId: 11, promoteTargetSectionRequired: true,
    });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    studentServiceSpy.executePromotion.and.returnValue(of({ submitted: 1, summary: {}, outcomes: [] }));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');
    component.setTargetSection('S1', 21);

    (component as any).doExecute();

    expect(studentServiceSpy.executePromotion).toHaveBeenCalledWith({
      sourceSessionId: SOURCE.id,
      targetSessionId: TARGET.id,
      decisions: [{
        studentId: 'S1', action: 'PROMOTE',
        expectedSourceEnrollmentId: 777, expectedSourceClassId: 10,
        targetClassId: 11, targetSectionId: 21,
      }],
    });
  });

  it('never sends a target class or section for PASS_OUT', () => {
    fixture.detectChanges();
    const c = candidate({
      studentId: 'S1', availableDecisions: ['DETAIN', 'PASS_OUT'], recommendedDecision: 'PASS_OUT',
      sourceEnrollmentId: 777, sourceClassId: 10,
    });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    studentServiceSpy.executePromotion.and.returnValue(of({ submitted: 1, summary: {}, outcomes: [] }));
    component.loadPreview();
    component.setDecision(c, 'PASS_OUT');

    (component as any).doExecute();

    const sent = studentServiceSpy.executePromotion.calls.mostRecent().args[0];
    expect(sent.decisions[0].targetClassId).toBeNull();
    expect(sent.decisions[0].targetSectionId).toBeNull();
  });

  it('excludes blocking (errored) rows and rows still missing a required section from the submitted batch', () => {
    fixture.detectChanges();
    const blocked = candidate({ studentId: 'S1', errors: [{ code: 'INVALID_SOURCE', message: 'bad' }] });
    const missingSection = candidate({ studentId: 'S2', promoteTargetSectionRequired: true, proposedPromoteTargetSectionId: null });
    const ready = candidate({ studentId: 'S3', promoteTargetSectionRequired: false });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([blocked, missingSection, ready])));
    studentServiceSpy.executePromotion.and.returnValue(of({ submitted: 1, summary: {}, outcomes: [] }));
    component.loadPreview();
    component.setDecision(ready, 'PROMOTE');

    expect(component.canExecute).toBeTrue();
    (component as any).doExecute();

    const sent = studentServiceSpy.executePromotion.calls.mostRecent().args[0];
    expect(sent.decisions.map((d: any) => d.studentId)).toEqual(['S3']);
    expect(component.blockedSelectedCount).toBe(1);
  });

  it('prevents execution when no decisions are selected', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1' });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    component.loadPreview();
    component.setDecision(c, 'NONE');

    expect(component.canExecute).toBeFalse();
  });

  // ─── Partial-success results (items 11, 12, 13) ──────────────────────────

  it('renders a successful PROMOTED outcome correctly', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false });
    const result: PromotionResultDTO = {
      submitted: 1, summary: { PROMOTED: 1 },
      outcomes: [{ studentId: 'S1', code: 'PROMOTED', message: 'Year-end decision applied', sourceEnrollmentId: 500, targetEnrollmentId: 900, targetEnrollmentStatus: 'PLANNED', lifecycleFinalizationPending: true }],
    };
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    studentServiceSpy.executePromotion.and.returnValue(of(result));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');

    (component as any).doExecute();

    expect(component.result).toEqual(result);
    expect(component.isSuccessOutcome('PROMOTED')).toBeTrue();
    expect(component.isInfoOutcome('PROMOTED')).toBeFalse();
  });

  it('renders an ALREADY_APPLIED outcome as informational, not success or error', () => {
    expect(component.isInfoOutcome('ALREADY_APPLIED')).toBeTrue();
    expect(component.isSuccessOutcome('ALREADY_APPLIED')).toBeFalse();
  });

  it('renders a CONFLICT outcome as an error, not success or info', () => {
    expect(component.isSuccessOutcome('CONFLICT')).toBeFalse();
    expect(component.isInfoOutcome('CONFLICT')).toBeFalse();
    expect(component.isSuccessOutcome('INVALID_SOURCE')).toBeFalse();
    expect(component.isInfoOutcome('INVALID_SOURCE')).toBeFalse();
  });

  it('renders per-student mixed outcomes rather than a single generic success toast', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false });
    const result: PromotionResultDTO = {
      submitted: 2,
      summary: { PROMOTED: 1, CONFLICT: 1 },
      outcomes: [
        { studentId: 'S1', code: 'PROMOTED', message: 'Year-end decision applied', sourceEnrollmentId: 500, targetEnrollmentId: 900, targetEnrollmentStatus: 'PLANNED', lifecycleFinalizationPending: false },
        { studentId: 'S9', code: 'CONFLICT', message: 'Target-session enrollment already exists', sourceEnrollmentId: 501, targetEnrollmentId: null, targetEnrollmentStatus: null, lifecycleFinalizationPending: false },
      ],
    };
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    studentServiceSpy.executePromotion.and.returnValue(of(result));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');

    (component as any).doExecute();

    expect(component.isSuccessOutcome(result.outcomes[0].code)).toBeTrue();
    expect(component.isSuccessOutcome(result.outcomes[1].code)).toBeFalse();
  });

  it('reloads the preview after execution so the UI reflects authoritative backend state', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false });
    studentServiceSpy.getPromotionPreview.and.returnValues(of(preview([c])), of(preview([c], { candidates: [] })));
    studentServiceSpy.executePromotion.and.returnValue(of({ submitted: 1, summary: { PROMOTED: 1 }, outcomes: [] }));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');

    (component as any).doExecute();

    expect(studentServiceSpy.getPromotionPreview).toHaveBeenCalledTimes(2);
  });

  it('keeps the just-shown per-student results visible after the automatic post-execute preview reload', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false });
    const result: PromotionResultDTO = { submitted: 1, summary: { PROMOTED: 1 }, outcomes: [] };
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    studentServiceSpy.executePromotion.and.returnValue(of(result));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');

    (component as any).doExecute();

    expect(component.result).toEqual(result);
  });

  // ─── Double-submit prevention ─────────────────────────────────────────────

  it('disables execution once a request is already in flight', () => {
    fixture.detectChanges();
    const c = candidate({ studentId: 'S1', promoteTargetSectionRequired: false });
    studentServiceSpy.getPromotionPreview.and.returnValue(of(preview([c])));
    studentServiceSpy.executePromotion.and.returnValue(of({ submitted: 1, summary: {}, outcomes: [] }));
    component.loadPreview();
    component.setDecision(c, 'PROMOTE');
    expect(component.canExecute).toBeTrue();

    component.executing = true;

    expect(component.canExecute).toBeFalse();
  });

  // ─── Maintenance (Android-only) ───────────────────────────────────────────

  it('reports affected count on successful orphaned-section cleanup', async () => {
    toastSpy.confirm.and.resolveTo(true);
    studentServiceSpy.fixOrphanedSections.and.returnValue(of({ affected: 3, message: '3 fixed' }));

    component.fixOrphanedSections();
    await Promise.resolve(); await Promise.resolve();

    expect(toastSpy.success).toHaveBeenCalledWith('Done', '3 fixed');
  });

  it('reports no issues found when nothing was affected', async () => {
    toastSpy.confirm.and.resolveTo(true);
    studentServiceSpy.fixOrphanedSections.and.returnValue(of({ affected: 0, message: 'none' }));

    component.fixOrphanedSections();
    await Promise.resolve(); await Promise.resolve();

    expect(toastSpy.info).toHaveBeenCalled();
  });

  it('does not call the cleanup endpoint when the admin cancels', async () => {
    toastSpy.confirm.and.resolveTo(false);

    component.fixOrphanedSections();
    await Promise.resolve();

    expect(studentServiceSpy.fixOrphanedSections).not.toHaveBeenCalled();
  });
});
