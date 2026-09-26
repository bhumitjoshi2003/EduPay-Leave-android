import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StudentAttendanceSummary, ClassAttendanceSummary, DailyDetail } from '../interfaces/attendance-summary';
import { AttendanceSheet, AttendanceSubmission } from '../interfaces/attendance-sheet';
import { ClassAttendanceInsights, StudentAttendanceInsights } from '../interfaces/attendance-insights';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl = `${environment.apiUrl}/attendance`;

  constructor(private http: HttpClient) { }

  getCalendarConfig(): Observable<{ workingDays: string; timezone: string }> {
    return this.http.get<{ workingDays: string; timezone: string }>(`${this.apiUrl}/calendar-config`);
  }

  /** Roster + saved statuses for a class (section) day. A teacher omits classId/sectionId — the server uses their own class. */
  getSheet(date: string | null, classId?: number | null, sectionId?: number | null): Observable<AttendanceSheet> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    if (classId != null) params = params.set('classId', classId);
    if (sectionId != null) params = params.set('sectionId', sectionId);
    return this.http.get<AttendanceSheet>(`${this.apiUrl}/sheet`, { params });
  }

  /** Saves an explicit status for every rostered student; re-submitting the same day updates it. */
  submitSheet(submission: AttendanceSubmission): Observable<AttendanceSheet> {
    return this.http.put<AttendanceSheet>(`${this.apiUrl}/sheet`, submission);
  }

  deleteSheet(date: string, classId?: number | null, sectionId?: number | null): Observable<void> {
    let params = new HttpParams().set('date', date);
    if (classId != null) params = params.set('classId', classId);
    if (sectionId != null) params = params.set('sectionId', sectionId);
    return this.http.delete<void>(`${this.apiUrl}/sheet`, { params });
  }

  /** Chargeable absences (ABSENT without approved leave, not yet paid) for the fee screens. */
  getTotalUnappliedLeaveCount(studentId: string, session: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/unapplied-leave-count/${studentId}/session/${session}`);
  }

  getStudentSummary(studentId: string, params: Record<string, string | number>): Observable<StudentAttendanceSummary> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, String(v)));
    return this.http.get<StudentAttendanceSummary>(`${this.apiUrl}/summary/student/${studentId}`, { params: httpParams });
  }

  getClassSummary(className: string, params: Record<string, string | number>, sectionId?: number | null): Observable<ClassAttendanceSummary[]> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, String(v)));
    if (sectionId != null) httpParams = httpParams.set('sectionId', String(sectionId));
    return this.http.get<ClassAttendanceSummary[]>(`${this.apiUrl}/summary/class/${className}`, { params: httpParams });
  }

  /** The signed-in student's current-session insights. */
  getMyInsights(): Observable<StudentAttendanceInsights> {
    return this.http.get<StudentAttendanceInsights>(`${this.apiUrl}/insights/me`);
  }

  /** One student's insights (parent: a linked child; teacher/admin: within their scope). */
  getStudentInsights(studentId: string): Observable<StudentAttendanceInsights> {
    return this.http.get<StudentAttendanceInsights>(`${this.apiUrl}/insights/student/${encodeURIComponent(studentId)}`);
  }

  /** A teacher's own class/section — the server decides which. */
  getMyClassInsights(): Observable<ClassAttendanceInsights> {
    return this.http.get<ClassAttendanceInsights>(`${this.apiUrl}/insights/class`);
  }

  /** Admin: one class (sectionId omitted = the whole class). */
  getClassInsights(classId: number, sectionId?: number | null): Observable<ClassAttendanceInsights> {
    const params = sectionId != null ? new HttpParams().set('sectionId', sectionId) : undefined;
    return this.http.get<ClassAttendanceInsights>(`${this.apiUrl}/insights/class/${classId}`, { params });
  }

  getStudentDailyDetail(studentId: string, month: number, year: number): Observable<DailyDetail> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http.get<DailyDetail>(`${this.apiUrl}/summary/student/${studentId}/daily`, { params });
  }
}
