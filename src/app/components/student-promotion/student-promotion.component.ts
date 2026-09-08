import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import {
  StudentService, PromotionAction, PromotionCandidate, PromotionDecisionPayload,
  PromotionExecuteRequest, PromotionPreviewDTO, PromotionResultDTO, PromotionStudentOutcome
} from '../../services/student.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { AcademicSession } from '../../interfaces/academic-session';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

/** 'NONE' is the explicit "no decision" state — distinct from every real PromotionAction so
 *  an unselected student is never confused with, or silently treated as, DETAIN. */
type RowDecision = PromotionAction | 'NONE';

interface CandidateGroup {
  classId: number | null;
  className: string;
  candidates: PromotionCandidate[];
}

@Component({
  selector: 'app-student-promotion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-promotion.component.html',
  styleUrl: './student-promotion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentPromotionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // ── Sessions ──────────────────────────────────────────────────────────
  sessionsLoading = true;
  sessions: AcademicSession[] = [];
  sourceSessionId: number | null = null;
  targetSessionId: number | null = null;

  // ── Filters ───────────────────────────────────────────────────────────
  classes: SchoolClass[] = [];
  classFilter: number | null = null;
  studentIdFilter = '';

  // ── Preview ───────────────────────────────────────────────────────────
  previewLoading = false;
  preview: PromotionPreviewDTO | null = null;
  /** The exact session/filter combination the currently-loaded preview was fetched with —
   *  compared against the live selectors so any change is caught before execute. */
  private previewedSourceSessionId: number | null = null;
  private previewedTargetSessionId: number | null = null;
  private previewedClassFilter: number | null = null;
  private previewedStudentIdFilter = '';

  // ── Decisions (per studentId) ────────────────────────────────────────
  decisions = new Map<string, RowDecision>();
  /** Chosen target section per studentId — only populated when the row actually needs one
   *  (PROMOTE into a sectioned class, or a DETAIN replacement for an invalid source section). */
  targetSections = new Map<string, number>();

  // ── Section option cache, keyed by classId ───────────────────────────
  sectionOptions = new Map<number, Section[]>();
  private sectionsLoading = new Set<number>();

  // ── Execute / results ─────────────────────────────────────────────────
  executing = false;
  result: PromotionResultDTO | null = null;

  constructor(
    private studentService: StudentService,
    private academicSessionService: AcademicSessionService,
    private schoolService: SchoolService,
    private sectionService: SectionService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadSessionsAndClasses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Session + class loading ───────────────────────────────────────────

  loadSessionsAndClasses(): void {
    this.sessionsLoading = true;
    this.cdr.markForCheck();
    forkJoin({
      sessions: this.academicSessionService.getAllSessions(),
      classes: this.schoolService.getManagedClasses(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ sessions, classes }) => {
        this.sessions = sessions;
        this.classes = [...classes].sort((a, b) => a.displayOrder - b.displayOrder);
        this.applySessionDefaults();
        this.sessionsLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Error loading academic sessions:', e);
        this.sessionsLoading = false;
        this.toast.error('Error', 'Failed to load academic sessions.');
        this.cdr.markForCheck();
      }
    });
  }

  /** Sensible, safe defaults only — never creates a session. Source defaults to the
   *  configured current session; target defaults to whichever existing session starts the
   *  day the source ends, if one exists. Either can be left unset for the admin to pick. */
  private applySessionDefaults(): void {
    const current = this.sessions.find(s => s.current) ?? null;
    if (!current) return;
    this.sourceSessionId = current.id;
    const nextDay = this.addDays(current.endDate, 1);
    const next = this.sessions.find(s => s.startDate === nextDay);
    this.targetSessionId = next ? next.id : null;
  }

  private addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  sessionLabel(id: number | null): string {
    if (id == null) return '';
    return this.sessions.find(s => s.id === id)?.label ?? '';
  }

  /** Labels for the session pair the CURRENTLY LOADED preview belongs to (never the live,
   *  possibly-since-changed selector values) — used in messaging shown alongside preview rows
   *  and results, which must describe what was actually previewed/executed. */
  get previewedSourceLabel(): string { return this.sessionLabel(this.previewedSourceSessionId); }
  get previewedTargetLabel(): string { return this.sessionLabel(this.previewedTargetSessionId); }

  // ── Selector change handlers — any change invalidates the loaded preview ────

  onSourceSessionChange(): void {
    this.invalidatePreview();
  }
  onTargetSessionChange(): void {
    this.invalidatePreview();
  }
  onClassFilterChange(): void {
    this.invalidatePreview();
  }
  onStudentIdFilterChange(): void {
    this.invalidatePreview();
  }

  private invalidatePreview(): void {
    if (!this.preview && !this.result) return;
    this.preview = null;
    this.result = null;
    this.decisions.clear();
    this.targetSections.clear();
    this.cdr.markForCheck();
  }

  get sessionsSelected(): boolean {
    return this.sourceSessionId != null && this.targetSessionId != null;
  }

  /** True once the live selectors/filters have drifted from what the loaded preview reflects —
   *  the execute action must never fire against a preview that no longer matches the screen. */
  get previewIsStale(): boolean {
    if (!this.preview) return true;
    return this.previewedSourceSessionId !== this.sourceSessionId
      || this.previewedTargetSessionId !== this.targetSessionId
      || this.previewedClassFilter !== this.classFilter
      || this.previewedStudentIdFilter !== this.studentIdFilter.trim();
  }

  // ── Preview loading ────────────────────────────────────────────────────

  loadPreview(): void {
    if (!this.sessionsSelected || this.sourceSessionId === this.targetSessionId) return;
    this.previewLoading = true;
    // Deliberately does NOT clear `result` here: doExecute() reloads the preview immediately
    // after a successful execute to reflect authoritative backend state, and the just-shown
    // per-student outcomes must survive that reload rather than vanishing the instant it
    // completes. Only an explicit session/filter change (invalidatePreview) or the admin
    // dismissing it (dismissResult) should clear a shown result.
    this.cdr.markForCheck();

    const source = this.sourceSessionId!;
    const target = this.targetSessionId!;
    const classFilter = this.classFilter;
    const studentIdFilter = this.studentIdFilter.trim();

    this.studentService.getPromotionPreview(source, target, classFilter, studentIdFilter || null)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (preview) => {
          this.preview = preview;
          this.previewedSourceSessionId = source;
          this.previewedTargetSessionId = target;
          this.previewedClassFilter = classFilter;
          this.previewedStudentIdFilter = studentIdFilter;
          this.seedDefaultDecisions(preview);
          this.prefetchSectionsForPreview(preview);
          this.previewLoading = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error loading promotion preview:', e);
          this.previewLoading = false;
          this.toast.error('Error', 'Failed to load the promotion preview.');
          this.cdr.markForCheck();
        }
      });
  }

  /** Pre-selects the backend's recommended decision as a convenience default for every
   *  candidate that's actually ready for one — never for a row with a blocking error or one
   *  that's already applied. The admin can still explicitly clear any preselection to "No
   *  decision" before executing. */
  private seedDefaultDecisions(preview: PromotionPreviewDTO): void {
    this.decisions.clear();
    this.targetSections.clear();
    for (const c of preview.candidates) {
      if (c.errors.length > 0 || c.appliedDecisionState !== 'NOT_APPLIED') {
        this.decisions.set(c.studentId, 'NONE');
        continue;
      }
      this.decisions.set(c.studentId, c.recommendedDecision);
      if (c.recommendedDecision === 'DETAIN' && c.proposedDetainTargetSectionId != null) {
        this.targetSections.set(c.studentId, c.proposedDetainTargetSectionId);
      }
      if (c.recommendedDecision === 'PROMOTE' && c.proposedPromoteTargetSectionId != null) {
        this.targetSections.set(c.studentId, c.proposedPromoteTargetSectionId);
      }
    }
  }

  private prefetchSectionsForPreview(preview: PromotionPreviewDTO): void {
    const classIds = new Set<number>();
    for (const c of preview.candidates) {
      if (c.promoteTargetClassId != null) classIds.add(c.promoteTargetClassId);
      if (c.detainTargetClassId != null) classIds.add(c.detainTargetClassId);
    }
    for (const classId of classIds) this.ensureSectionsLoaded(classId);
  }

  private ensureSectionsLoaded(classId: number): void {
    if (this.sectionOptions.has(classId) || this.sectionsLoading.has(classId)) return;
    this.sectionsLoading.add(classId);
    this.sectionService.getSectionsForClass(classId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (sections) => {
        this.sectionOptions.set(classId, sections);
        this.sectionsLoading.delete(classId);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error(`Error loading sections for class ${classId}:`, e);
        this.sectionsLoading.delete(classId);
        this.cdr.markForCheck();
      }
    });
  }

  sectionsFor(classId: number | null): Section[] {
    if (classId == null) return [];
    return this.sectionOptions.get(classId) ?? [];
  }

  // ── Grouping (display only — every candidate keeps its own authoritative IDs) ──

  get groups(): CandidateGroup[] {
    if (!this.preview) return [];
    const byClass = new Map<string, CandidateGroup>();
    for (const c of this.preview.candidates) {
      const key = `${c.sourceClassId ?? 'null'}|${c.sourceClassName ?? ''}`;
      let group = byClass.get(key);
      if (!group) {
        group = { classId: c.sourceClassId, className: c.sourceClassName ?? 'Unknown class', candidates: [] };
        byClass.set(key, group);
      }
      group.candidates.push(c);
    }
    return [...byClass.values()];
  }

  // ── Decision handling ─────────────────────────────────────────────────

  getDecision(studentId: string): RowDecision {
    return this.decisions.get(studentId) ?? 'NONE';
  }

  setDecision(candidate: PromotionCandidate, decision: RowDecision): void {
    this.decisions.set(candidate.studentId, decision);
    if (decision !== 'PROMOTE' && decision !== 'DETAIN') {
      this.targetSections.delete(candidate.studentId);
    } else if (decision === 'DETAIN' && candidate.proposedDetainTargetSectionId != null) {
      this.targetSections.set(candidate.studentId, candidate.proposedDetainTargetSectionId);
    } else if (decision === 'PROMOTE' && candidate.proposedPromoteTargetSectionId != null) {
      this.targetSections.set(candidate.studentId, candidate.proposedPromoteTargetSectionId);
    } else {
      this.targetSections.delete(candidate.studentId);
    }
    this.cdr.markForCheck();
  }

  getTargetSection(studentId: string): number | null {
    return this.targetSections.get(studentId) ?? null;
  }

  setTargetSection(studentId: string, sectionId: number | ''): void {
    if (sectionId === '') this.targetSections.delete(studentId);
    else this.targetSections.set(studentId, Number(sectionId));
    this.cdr.markForCheck();
  }

  /** Whether this row still needs an explicit section pick before it can be submitted. */
  rowNeedsSection(candidate: PromotionCandidate): boolean {
    const decision = this.getDecision(candidate.studentId);
    if (decision === 'PROMOTE') {
      return candidate.promoteTargetSectionRequired && this.getTargetSection(candidate.studentId) == null;
    }
    if (decision === 'DETAIN') {
      if (candidate.proposedDetainTargetSectionId != null) return false;
      const detainClassId = candidate.detainTargetClassId ?? candidate.sourceClassId;
      const hasSections = detainClassId != null && this.sectionsFor(detainClassId).length > 0;
      return hasSections && this.getTargetSection(candidate.studentId) == null;
    }
    return false;
  }

  showSectionPicker(candidate: PromotionCandidate): boolean {
    const decision = this.getDecision(candidate.studentId);
    if (decision === 'PROMOTE') return candidate.promoteTargetSectionRequired;
    if (decision === 'DETAIN') {
      const detainClassId = candidate.detainTargetClassId ?? candidate.sourceClassId;
      return detainClassId != null && this.sectionsFor(detainClassId).length > 0;
    }
    return false;
  }

  sectionPickerClassId(candidate: PromotionCandidate): number | null {
    const decision = this.getDecision(candidate.studentId);
    if (decision === 'PROMOTE') return candidate.promoteTargetClassId;
    if (decision === 'DETAIN') return candidate.detainTargetClassId ?? candidate.sourceClassId;
    return null;
  }

  /** True only for a row the admin can actually submit right now: a real decision is chosen,
   *  the row carries no blocking error, and any required section has been picked. */
  rowIsReady(candidate: PromotionCandidate): boolean {
    const decision = this.getDecision(candidate.studentId);
    if (decision === 'NONE') return false;
    if (candidate.errors.length > 0) return false;
    if (candidate.appliedDecisionState !== 'NOT_APPLIED') return false;
    return !this.rowNeedsSection(candidate);
  }

  get readyCandidates(): PromotionCandidate[] {
    if (!this.preview) return [];
    return this.preview.candidates.filter(c => this.rowIsReady(c));
  }

  get blockedSelectedCount(): number {
    if (!this.preview) return 0;
    return this.preview.candidates.filter(c => this.getDecision(c.studentId) !== 'NONE' && !this.rowIsReady(c)).length;
  }

  get promoteCount(): number { return this.readyCandidates.filter(c => this.getDecision(c.studentId) === 'PROMOTE').length; }
  get detainCount(): number { return this.readyCandidates.filter(c => this.getDecision(c.studentId) === 'DETAIN').length; }
  get passOutCount(): number { return this.readyCandidates.filter(c => this.getDecision(c.studentId) === 'PASS_OUT').length; }
  get omittedCount(): number {
    if (!this.preview) return 0;
    return this.preview.candidates.length - this.readyCandidates.length;
  }

  get canExecute(): boolean {
    return !!this.preview && this.preview.valid && !this.previewIsStale && !this.executing
      && this.readyCandidates.length > 0;
  }

  // ── Confirmation + execute ────────────────────────────────────────────

  async confirmAndExecute(): Promise<void> {
    if (!this.canExecute) return;
    const promote = this.promoteCount, detain = this.detainCount, passOut = this.passOutCount;
    const omitted = this.omittedCount;
    const sourceLabel = this.sessionLabel(this.previewedSourceSessionId);
    const targetLabel = this.sessionLabel(this.previewedTargetSessionId);

    const confirmed = await this.toast.confirm({
      title: 'Confirm Year-End Decisions',
      html: `
        <p style="margin-bottom:12px;color:#374151;">
          This records year-end decisions from <strong>${sourceLabel}</strong> to <strong>${targetLabel}</strong>
          for <strong>${promote + detain + passOut}</strong> student(s):
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <span style="background:#dcfce7;color:#166534;padding:6px 14px;border-radius:20px;font-weight:700;">${promote} to Promote</span>
          <span style="background:#fef9c3;color:#854d0e;padding:6px 14px;border-radius:20px;font-weight:700;">${detain} to Detain</span>
          <span style="background:#dbeafe;color:#1e40af;padding:6px 14px;border-radius:20px;font-weight:700;">${passOut} to Pass Out</span>
        </div>
        ${omitted > 0 ? `<p style="margin-top:10px;font-size:0.82rem;color:#64748b;">${omitted} student(s) with no decision selected will be left unchanged.</p>` : ''}
        <p style="margin-top:14px;font-size:0.85rem;color:#334155;">
          This only <strong>records</strong> the decision. A future-dated target does not change a student's
          current class until its session actually begins; a Pass Out does not graduate the student until
          ${sourceLabel} ends.
        </p>
      `,
      icon: 'warning',
      danger: passOut > 0,
      confirmText: 'Yes, Record Decisions',
      cancelText: 'Cancel',
    });
    if (confirmed) this.doExecute();
  }

  private doExecute(): void {
    if (!this.preview || this.previewedSourceSessionId == null || this.previewedTargetSessionId == null) return;
    this.executing = true;
    this.cdr.markForCheck();

    const decisions: PromotionDecisionPayload[] = this.readyCandidates.map((c) => {
      const action = this.getDecision(c.studentId) as PromotionAction;
      const payload: PromotionDecisionPayload = {
        studentId: c.studentId,
        action,
        expectedSourceEnrollmentId: c.sourceEnrollmentId,
        expectedSourceClassId: c.sourceClassId as number,
      };
      if (action === 'PROMOTE') {
        payload.targetClassId = c.promoteTargetClassId;
        payload.targetSectionId = c.promoteTargetSectionRequired ? this.getTargetSection(c.studentId) : null;
      } else if (action === 'DETAIN') {
        payload.targetClassId = c.detainTargetClassId;
        payload.targetSectionId = this.getTargetSection(c.studentId) ?? c.proposedDetainTargetSectionId ?? null;
      } else {
        payload.targetClassId = null;
        payload.targetSectionId = null;
      }
      return payload;
    });

    const request: PromotionExecuteRequest = {
      sourceSessionId: this.previewedSourceSessionId,
      targetSessionId: this.previewedTargetSessionId,
      decisions,
    };

    this.studentService.executePromotion(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.result = result;
        this.executing = false;
        this.cdr.markForCheck();
        // Reflect authoritative backend state — never assume the UI's own optimistic view.
        this.loadPreview();
      },
      error: (e) => {
        this.logger.error('Error executing promotion:', e);
        this.executing = false;
        this.toast.error('Error', 'Recording year-end decisions failed. Please try again.');
        this.cdr.markForCheck();
      }
    });
  }

  // ── Result display helpers ────────────────────────────────────────────

  outcomeStudentName(outcome: PromotionStudentOutcome): string {
    return this.preview?.candidates.find(c => c.studentId === outcome.studentId)?.studentName ?? outcome.studentId;
  }

  isSuccessOutcome(code: string): boolean {
    return code === 'PROMOTED' || code === 'DETAINED' || code === 'PASSED_OUT';
  }

  isInfoOutcome(code: string): boolean {
    return code === 'ALREADY_APPLIED';
  }

  summaryEntries(): { code: string; count: number }[] {
    if (!this.result) return [];
    return Object.entries(this.result.summary).map(([code, count]) => ({ code, count }));
  }

  dismissResult(): void {
    this.result = null;
    this.cdr.markForCheck();
  }

  // ── Maintenance (Android-only carryover — no equivalent UI on web; endpoint is a
  //    standalone backend cleanup action unrelated to the E2 preview/execute contract) ──

  fixOrphanedSections(): void {
    this.toast.confirm({
      title: 'Fix Orphaned Sections?',
      message: 'This will clear section assignments for any students whose section belongs to a different class (e.g., promoted students who retained their old section). This is safe to run at any time.',
      confirmText: 'Yes, Fix',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.studentService.fixOrphanedSections().pipe(takeUntil(this.destroy$)).subscribe({
        next: ({ affected, message }) => {
          if (affected > 0) {
            this.toast.success('Done', message);
          } else {
            this.toast.info('No Issues Found', 'All student section assignments are valid.');
          }
        },
        error: (e) => {
          this.logger.error('Error fixing orphaned sections:', e);
          this.toast.error('Error', 'Failed to fix orphaned sections.');
        }
      });
    });
  }

  // ── trackBy ────────────────────────────────────────────────────────────
  trackByGroup(_: number, g: CandidateGroup): string { return `${g.classId}`; }
  trackByCandidate(_: number, c: PromotionCandidate): string { return c.studentId; }
  trackByOutcome(_: number, o: PromotionStudentOutcome): string { return o.studentId; }
  trackBySession(_: number, s: AcademicSession): number { return s.id; }
  trackByClass(_: number, c: SchoolClass): number { return c.id; }
}
