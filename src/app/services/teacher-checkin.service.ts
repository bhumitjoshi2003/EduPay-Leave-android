import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  TeacherCheckinRequest,
  AdminMarkRequest,
  TeacherAttendanceRecord,
  TeacherAttendanceSummary
} from '../interfaces/teacher-checkin';

@Injectable({ providedIn: 'root' })
export class TeacherCheckinService {

  private baseUrl = `${environment.apiUrl}/teacher-checkin`;

  constructor(private http: HttpClient) {}

  checkIn(req: TeacherCheckinRequest): Observable<TeacherAttendanceRecord> {
    return this.http.post<TeacherAttendanceRecord>(`${this.baseUrl}/check-in`, req);
  }

  checkOut(req: TeacherCheckinRequest): Observable<TeacherAttendanceRecord> {
    return this.http.post<TeacherAttendanceRecord>(`${this.baseUrl}/check-out`, req);
  }

  adminMark(req: AdminMarkRequest): Observable<TeacherAttendanceRecord> {
    return this.http.post<TeacherAttendanceRecord>(`${this.baseUrl}/admin-mark`, req);
  }

  getByDate(date: string): Observable<TeacherAttendanceRecord[]> {
    return this.http.get<TeacherAttendanceRecord[]>(`${this.baseUrl}/date/${date}`);
  }

  getMyAttendance(month: number, year: number): Observable<TeacherAttendanceSummary> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http.get<TeacherAttendanceSummary>(`${this.baseUrl}/my-attendance`, { params });
  }

  getSummary(month: number, year: number): Observable<TeacherAttendanceSummary> {
    const params = new HttpParams().set('month', month).set('year', year);
    return this.http.get<TeacherAttendanceSummary>(`${this.baseUrl}/summary`, { params });
  }
}
