import { AcademicSession } from './academic-session';

/** Phase G: the class-teacher activation contract behind "Make Current" — kept as its own
 *  file (rather than pulled in from the web's teaching-configuration domain) since Android
 *  only needs the activation outcome/preview shapes, not responsibility configuration or
 *  timetable-copy, which remain web-admin-only features. */
export type ActivationState = 'NEVER_APPLIED' | 'APPLIED_IN_SYNC' | 'APPLIED_BUT_DRIFTED';
export interface ActivationRow {
  classId: number | null;
  className: string | null;
  sectionId: number | null;
  sectionName: string | null;
  configuredTeacherId: string | null;
  configuredTeacherName: string | null;
  priorLiveTeacherId: string | null;
  priorLiveTeacherName: string | null;
  outcome: string;
  reason: string | null;
}
export interface ActivationResult {
  academicSessionId: number;
  activationState: ActivationState;
  lastAppliedAt: string | null;
  lastAppliedBy: string | null;
  unchanged: number;
  ineligibleTeacher: number;
  invalidClassOrSection: number;
  details: ActivationRow[];
}
export interface ActivationPreview extends ActivationResult {
  inSync: boolean;
  hasIssues: boolean;
  /** Raw class_teacher_responsibility row count for this session, BEFORE validity filtering —
   *  lets a caller distinguish "zero rows configured" from "rows configured but all ineligible/
   *  invalid" from "rows configured and valid but already matching live," none of which can be
   *  told apart from becomingLive/changing/clearing alone. */
  configuredCount?: number;
  becomingLive: number;
  changing: number;
  clearing: number;
}
export interface ActivationApply extends ActivationResult { applied: number; cleared: number; }
export interface SessionActivationOutcome {
  session: AcademicSession;
  /** False only when the target was ALREADY the current session — a genuine no-op, not a
   *  redundant re-apply. {@code activation} is null in that case. */
  activationPerformed: boolean;
  activation: ActivationApply | null;
}
