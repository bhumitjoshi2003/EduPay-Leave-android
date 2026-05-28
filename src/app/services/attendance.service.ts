import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AttendanceData } from '../interfaces/atendance-data';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StudentAttendanceSummary, ClassAttendanceSummary, DailyDetail } from '../interfaces/attendance-summary';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl = `${environment.apiUrl}/attendance`;

  constructor(private http: HttpClient) { }

  saveAttendance(attendanceData: AttendanceData[]): Observable<string> {
    return this.http.post(this.apiUrl, attendanceData, { responseType: 'text' });
  }

  getAttendanceByDateAndClass(absentDate: string, className: string): Observable<AttendanceData[]> {
    return this.http.get<AttendanceData[]>(`${this.apiUrl}/date/${absentDate}/class/${className}`);
  }

  getAttendanceCounts(studentId: string, year: number, month: number): Observable<{ studentAbsent: number; totalAbsent: number }> {
    return this.http.get<{ studentAbsent: number; totalAbsent: number }>(`${this.apiUrl}/counts/${studentId}/${year}/${month}`);
  }

  getTotalUnappliedLeaveCount(studentId: string, session: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/unapplied-leave-count/${studentId}/session/${session}`);
  }

  deleteAttendanceByDateAndClass(absentDate: string, className: string): Observable<string> {
    return this.http.delete<string>(`${this.apiUrl}/date/${absentDate}/class/${className}`, { responseType: 'text' as 'json' }
    );
  }

  getMonthlyAttendance(studentId: string, className: string, year: number, month: number): Observable<AttendanceData[]> {
    return this.http.get<AttendanceData[]>(
      `${this.apiUrl}/student/${studentId}/month/${month}/year/${year}`,
      { params: { className } }
    );
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

  getStudentDailyDetail(studentId: string, month: number, year: number): Observable<DailyDetail> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http.get<DailyDetail>(`${this.apiUrl}/summary/student/${studentId}/daily`, { params });
  }
}