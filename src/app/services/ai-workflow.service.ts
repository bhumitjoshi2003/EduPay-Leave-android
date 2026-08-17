import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FeeReminderDefaulter {
  studentId: string;
  studentName: string;
  className: string;
  /** null = amount unknown (no fee structure configured for this class/session) — not ₹0. */
  totalDue: number | null;
}

export interface FeeReminderSendResult {
  sentCount: number;
  failedCount: number;
  outcomes: { studentId: string; status: string }[];
  error?: string | null;
}

export interface FeeReminderWorkflowResponse {
  workflowId: string;
  status: string; // 'pending_approval' | 'rejected' | 'sent' | 'partially_sent' | 'failed' | 'no_defaulters'
  draftSummary: string;
  defaulterCount: number;
  /** null = amount unknown for every defaulter in this batch — not ₹0. */
  totalAmountDue: number | null;
  defaulters: FeeReminderDefaulter[];
  sendResult?: FeeReminderSendResult | null;
  error?: string | null;
}

export interface LowAttendanceStudent {
  studentId: string;
  studentName: string;
  className: string;
  attendancePercentage: number;
  daysPresent: number;
  daysAbsent: number;
  totalWorkingDays: number;
  /** Set only on a CONSECUTIVE_ABSENCE batch. null/undefined = selected by percentage, not a streak. */
  consecutiveAbsentDays?: number | null;
  /** The streak's actual school days (ISO), oldest first. Only on a CONSECUTIVE_ABSENCE batch. */
  absentDates?: string[] | null;
}

/** Which attendance pattern selected a teacher's batch — see AttendanceCriterion in graphs/state.py. */
export type AttendanceCriterion = 'BELOW_THRESHOLD' | 'CONSECUTIVE_ABSENCE';

export interface AttendanceReminderWorkflowResponse {
  workflowId: string;
  status: string; // 'pending_approval' | 'rejected' | 'sent' | 'partially_sent' | 'failed' | 'no_low_attendance_students'
  draftSummary: string;
  studentCount: number;
  threshold: number;
  students: LowAttendanceStudent[];
  sendResult?: FeeReminderSendResult | null;
  error?: string | null;
}

export interface TeacherAttendanceReminderWorkflowResponse {
  workflowId: string;
  status: string; // 'pending_approval' | 'rejected' | 'sent' | 'partially_sent' | 'failed' | 'no_low_attendance_students'
  draftSummary: string;
  studentCount: number;
  threshold: number;
  className: string;
  criterion: AttendanceCriterion;
  minConsecutiveDays?: number | null;
  students: LowAttendanceStudent[];
  sendResult?: FeeReminderSendResult | null;
  error?: string | null;
}

export interface LeaveRequestSummary {
  leaveId: number;
  studentId: string;
  studentName: string;
  className: string;
  leaveDate: string;
  reason: string;
  /** Current status. Anything other than PENDING is shown but will NOT be changed. */
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface LeaveApplyResult {
  appliedCount: number;
  /** Deliberately left alone — already decided, deleted, or out of scope. Not an error. */
  skippedCount: number;
  failedCount: number;
  outcomes: { leaveId: number; outcome: string }[];
  error?: string | null;
}

export interface LeaveDecisionWorkflowResponse {
  workflowId: string;
  status: string; // 'pending_approval' | 'rejected' | 'applied' | 'partially_applied' | 'failed' | 'no_actionable_requests'
  draftSummary: string;
  /** What happens to the leaves if approved — distinct from the batch's own approval status. */
  decision: 'APPROVED' | 'REJECTED';
  className?: string | null;
  leaveCount: number;
  actionableCount: number;
  leaveRequests: LeaveRequestSummary[];
  applyResult?: LeaveApplyResult | null;
  error?: string | null;
}

/**
 * Plain request/response calls — start/approve/reject/status are never streamed
 * (unlike ai-copilot.service.ts's chat endpoints), so no observe:'events' needed here.
 */
@Injectable({ providedIn: 'root' })
export class AiWorkflowService {
  private readonly feeBase = `${environment.apiUrl}/ai/workflows/fee-reminders`;
  private readonly attendanceBase = `${environment.apiUrl}/ai/workflows/attendance-reminders`;
  private readonly teacherAttendanceBase = `${environment.apiUrl}/ai/workflows/teacher-attendance-reminders`;
  private readonly leaveBase = `${environment.apiUrl}/ai/workflows/leave-decisions`;

  constructor(private http: HttpClient) {}

  startFeeReminderWorkflow(session: string, className?: string): Observable<FeeReminderWorkflowResponse> {
    return this.http.post<FeeReminderWorkflowResponse>(this.feeBase, { session, className });
  }

  approve(workflowId: string): Observable<FeeReminderWorkflowResponse> {
    return this.http.post<FeeReminderWorkflowResponse>(`${this.feeBase}/${workflowId}/approve`, {});
  }

  reject(workflowId: string): Observable<FeeReminderWorkflowResponse> {
    return this.http.post<FeeReminderWorkflowResponse>(`${this.feeBase}/${workflowId}/reject`, {});
  }

  getStatus(workflowId: string): Observable<FeeReminderWorkflowResponse> {
    return this.http.get<FeeReminderWorkflowResponse>(`${this.feeBase}/${workflowId}`);
  }

  startAttendanceReminderWorkflow(session: string, className?: string, threshold = 75): Observable<AttendanceReminderWorkflowResponse> {
    return this.http.post<AttendanceReminderWorkflowResponse>(this.attendanceBase, { session, className, threshold });
  }

  approveAttendance(workflowId: string): Observable<AttendanceReminderWorkflowResponse> {
    return this.http.post<AttendanceReminderWorkflowResponse>(`${this.attendanceBase}/${workflowId}/approve`, {});
  }

  rejectAttendance(workflowId: string): Observable<AttendanceReminderWorkflowResponse> {
    return this.http.post<AttendanceReminderWorkflowResponse>(`${this.attendanceBase}/${workflowId}/reject`, {});
  }

  getAttendanceStatus(workflowId: string): Observable<AttendanceReminderWorkflowResponse> {
    return this.http.get<AttendanceReminderWorkflowResponse>(`${this.attendanceBase}/${workflowId}`);
  }

  /** className is never sent — the backend resolves it from the teacher's own classTeacher field. */
  startTeacherAttendanceReminderWorkflow(
    session: string,
    threshold = 75,
    criterion: AttendanceCriterion = 'BELOW_THRESHOLD',
    minConsecutiveDays?: number,
  ): Observable<TeacherAttendanceReminderWorkflowResponse> {
    return this.http.post<TeacherAttendanceReminderWorkflowResponse>(
      this.teacherAttendanceBase, { session, threshold, criterion, minConsecutiveDays });
  }

  approveTeacherAttendance(workflowId: string): Observable<TeacherAttendanceReminderWorkflowResponse> {
    return this.http.post<TeacherAttendanceReminderWorkflowResponse>(`${this.teacherAttendanceBase}/${workflowId}/approve`, {});
  }

  rejectTeacherAttendance(workflowId: string): Observable<TeacherAttendanceReminderWorkflowResponse> {
    return this.http.post<TeacherAttendanceReminderWorkflowResponse>(`${this.teacherAttendanceBase}/${workflowId}/reject`, {});
  }

  startLeaveDecisionWorkflow(decision: 'APPROVED' | 'REJECTED', leaveIds: number[]): Observable<LeaveDecisionWorkflowResponse> {
    return this.http.post<LeaveDecisionWorkflowResponse>(this.leaveBase, { decision, leaveIds });
  }

  approveLeaveDecision(workflowId: string): Observable<LeaveDecisionWorkflowResponse> {
    return this.http.post<LeaveDecisionWorkflowResponse>(`${this.leaveBase}/${workflowId}/approve`, {});
  }

  rejectLeaveDecision(workflowId: string): Observable<LeaveDecisionWorkflowResponse> {
    return this.http.post<LeaveDecisionWorkflowResponse>(`${this.leaveBase}/${workflowId}/reject`, {});
  }

  getLeaveDecisionStatus(workflowId: string): Observable<LeaveDecisionWorkflowResponse> {
    return this.http.get<LeaveDecisionWorkflowResponse>(`${this.leaveBase}/${workflowId}`);
  }

  getTeacherAttendanceStatus(workflowId: string): Observable<TeacherAttendanceReminderWorkflowResponse> {
    return this.http.get<TeacherAttendanceReminderWorkflowResponse>(`${this.teacherAttendanceBase}/${workflowId}`);
  }
}
