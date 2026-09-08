import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Student, StudentExitRequest, PendingDuesInfo } from '../interfaces/student';

interface StudentDTO {
  studentId: string;
  name: string;
  sectionId?: number | null;
}

/** E2 year-end decision actions — mirrors backend StudentYearEndDecision.Action exactly. */
export type PromotionAction = 'PROMOTE' | 'DETAIN' | 'PASS_OUT';

/** Whether a proposed target enrollment would be effective immediately or only once its
 *  academic session actually starts. Mirrors backend StudentEnrollmentStatus (the only two
 *  values a year-end preview/decision can ever propose). */
export type PromotionTargetStatus = 'ACTIVE' | 'PLANNED';

/** Machine-readable outcome code for one submitted decision. The first three are successful
 *  mutations; the rest mean nothing was changed for that student. */
export type PromotionOutcomeCode =
  | 'PROMOTED' | 'DETAINED' | 'PASSED_OUT'
  | 'ALREADY_APPLIED' | 'CONFLICT' | 'INVALID_SOURCE' | 'VALIDATION_ERROR';

export interface PromotionIssue {
  code: string;
  message: string;
}

/** One student's authoritative, backend-computed preview row for a source/target session
 *  pair. Every ID here is real and must be sent back verbatim in the matching decision —
 *  never re-derived from displayed names or from the student's live projection. */
export interface PromotionCandidate {
  studentId: string;
  studentName: string | null;
  sourceEnrollmentId: number;
  sourceSessionId: number;
  sourceClassId: number | null;
  sourceClassName: string | null;
  sourceSectionId: number | null;
  sourceSectionName: string | null;
  availableDecisions: PromotionAction[];
  recommendedDecision: PromotionAction;
  promoteTargetClassId: number | null;
  promoteTargetClassName: string | null;
  detainTargetClassId: number | null;
  detainTargetClassName: string | null;
  promoteTargetSectionRequired: boolean;
  proposedPromoteTargetSectionId: number | null;
  proposedDetainTargetSectionId: number | null;
  proposedTargetStatus: PromotionTargetStatus;
  errors: PromotionIssue[];
  warnings: PromotionIssue[];
  /** 'NOT_APPLIED' (ready for a decision), 'CONFLICT', or 'ALREADY_APPLIED:<ACTION>'. */
  appliedDecisionState: string;
}

export interface PromotionUncoveredStudent {
  studentId: string;
  studentName: string | null;
  code: string;
  message: string;
}

export interface PromotionPreviewDTO {
  sourceSessionId: number;
  targetSessionId: number;
  valid: boolean;
  errors: PromotionIssue[];
  candidates: PromotionCandidate[];
  uncoveredStudents: PromotionUncoveredStudent[];
}

export interface PromotionDecisionPayload {
  studentId: string;
  action: PromotionAction;
  expectedSourceEnrollmentId: number;
  expectedSourceClassId: number;
  targetClassId?: number | null;
  targetSectionId?: number | null;
}

export interface PromotionExecuteRequest {
  sourceSessionId: number;
  targetSessionId: number;
  decisions: PromotionDecisionPayload[];
}

export interface PromotionStudentOutcome {
  studentId: string;
  code: PromotionOutcomeCode;
  message: string;
  sourceEnrollmentId: number | null;
  targetEnrollmentId: number | null;
  targetEnrollmentStatus: PromotionTargetStatus | null;
  lifecycleFinalizationPending: boolean;
}

export interface PromotionResultDTO {
  submitted: number;
  summary: Record<string, number>;
  outcomes: PromotionStudentOutcome[];
}

export interface BulkImportError {
  row: number;
  studentId: string;
  reason: string;
}

/** One successfully created account — reports the Edunexify-generated ID, since the
 *  import request no longer supplies (or honors) one. */
export interface BulkImportSuccess {
  row: number;
  name: string;
  generatedId: string;
}

export interface BulkImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  errors: BulkImportError[];
  created: BulkImportSuccess[];
  /** Non-null only when the uploaded CSV still had a legacy ID column — accepted for
   *  backward compatibility but its values were never used. */
  notice: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private baseUrl = `${environment.apiUrl}/students`;

  constructor(private http: HttpClient) { }

  getStudent(studentId: string): Observable<Student> {
    return this.http.get<Student>(`${this.baseUrl}/${studentId}`);
  }

  getActiveStudentsByClass(selectedClass: string, sectionId?: number): Observable<StudentDTO[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/active/class/${selectedClass}`, { params });
  }

  updateStudent(studentId: string, payload: { studentDetails: Partial<Student>; effectiveFromMonth: number | null }): Observable<Student> {
    return this.http.put<Student>(`${this.baseUrl}/${studentId}`, payload);
  }

  addStudent(studentData: Omit<Student, 'studentId'>): Observable<Student> {
    return this.http.post<Student>(this.baseUrl, studentData);
  }

  getNewStudentsByClass(selectedClass: string, sectionId?: number): Observable<StudentDTO[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/new/class/${selectedClass}`, { params });
  }

  getInactiveStudentsByClass(selectedClass: string, sectionId?: number): Observable<StudentDTO[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/inactive/class/${selectedClass}`, { params });
  }

  downloadBulkTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/bulk/template`, { responseType: 'blob' });
  }

  bulkImport(file: File): Observable<BulkImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BulkImportResult>(`${this.baseUrl}/bulk`, formData);
  }

  uploadStudentPhoto(studentId: string, file: File): Observable<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoUrl: string }>(`${this.baseUrl}/${studentId}/photo`, formData);
  }

  /** E2 backend-authoritative preview for one explicit source/target academic session pair.
   *  classId/studentId are optional server-side filters (canonical IDs only). */
  getPromotionPreview(
    sourceSessionId: number, targetSessionId: number,
    classId?: number | null, studentId?: string | null
  ): Observable<PromotionPreviewDTO> {
    let params = new HttpParams()
      .set('sourceSessionId', sourceSessionId)
      .set('targetSessionId', targetSessionId);
    if (classId != null) params = params.set('classId', classId);
    if (studentId) params = params.set('studentId', studentId);
    return this.http.get<PromotionPreviewDTO>(`${this.baseUrl}/promotion/preview`, { params });
  }

  /** E2 batch execute — every field in each decision must come from the loaded preview
   *  (expectedSourceEnrollmentId/expectedSourceClassId prove the decision still matches
   *  authoritative history), never reconstructed from current Student state. */
  executePromotion(request: PromotionExecuteRequest): Observable<PromotionResultDTO> {
    return this.http.post<PromotionResultDTO>(`${this.baseUrl}/promotion/execute`, request);
  }

  /** Maintenance-only cleanup for section assignments left over from before section-aware
   *  promotion existed. Not part of the E2 preview/execute contract — safe to run any time. */
  fixOrphanedSections(): Observable<{ affected: number; message: string }> {
    return this.http.post<{ affected: number; message: string }>(
      `${this.baseUrl}/promotion/fix-orphaned-sections`, {}
    );
  }

  searchStudents(query: string): Observable<Student[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<Student[]>(`${this.baseUrl}/search`, { params });
  }

  getAlumniByClass(selectedClass: string, sectionId?: number): Observable<StudentDTO[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/alumni/class/${selectedClass}`, { params });
  }

  getLeftStudentsByClass(selectedClass: string, sectionId?: number): Observable<StudentDTO[]> {
    let params = new HttpParams();
    if (sectionId) params = params.set('sectionId', sectionId);
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/left/class/${selectedClass}`, { params });
  }

  checkPendingDues(studentId: string): Observable<PendingDuesInfo> {
    return this.http.get<PendingDuesInfo>(`${this.baseUrl}/${studentId}/pending-dues`);
  }

  exitStudent(studentId: string, request: StudentExitRequest): Observable<Student> {
    return this.http.post<Student>(`${this.baseUrl}/${studentId}/exit`, request);
  }

  readmitStudent(studentId: string): Observable<Student> {
    return this.http.post<Student>(`${this.baseUrl}/${studentId}/readmit`, {});
  }

}
