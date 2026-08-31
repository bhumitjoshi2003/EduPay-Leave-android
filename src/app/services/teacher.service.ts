import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Teacher, TeacherExitRequest } from '../interfaces/teacher';
import { BulkImportResult } from './student.service';

export interface TeacherAttendanceSchedule {
  id: number;
  scheduleType: 'SCHOOL' | 'CUSTOM';
  workingDays: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface TeacherAttendanceScheduleRequest {
  scheduleType: 'SCHOOL' | 'CUSTOM';
  workingDays: string | null;
  effectiveFrom: string;
}

@Injectable({
  providedIn: 'root',
})
export class TeacherService {
  private baseUrl = `${environment.apiUrl}/teachers`;

  constructor(private http: HttpClient) {}

  getTeacher(teacherId: string): Observable<Teacher> {
    return this.http.get<Teacher>(`${this.baseUrl}/${teacherId}`);
  }

  getAllTeachers(): Observable<Teacher[]> {
    return this.http.get<Teacher[]>(`${this.baseUrl}`);
  }

  updateTeacher(
    teacherId: string,
    updatedTeacher: Partial<Teacher>
  ): Observable<Teacher> {
    return this.http.put<Teacher>(
      `${this.baseUrl}/${teacherId}`,
      updatedTeacher
    );
  }

  /** teacherId is never supplied by the caller — Edunexify generates it. */
  addTeacher(teacherData: Omit<Teacher, 'teacherId'>): Observable<Teacher> {
    return this.http.post<Teacher>(this.baseUrl, teacherData);
  }

  downloadBulkTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/bulk/template`, {
      responseType: 'blob',
    });
  }

  bulkImport(file: File): Observable<BulkImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BulkImportResult>(`${this.baseUrl}/bulk`, formData);
  }

  uploadTeacherPhoto(
    teacherId: string,
    file: File
  ): Observable<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoUrl: string }>(
      `${this.baseUrl}/${teacherId}/photo`,
      formData
    );
  }

  getAttendanceSchedules(
    teacherId: string
  ): Observable<TeacherAttendanceSchedule[]> {
    return this.http.get<TeacherAttendanceSchedule[]>(
      `${this.baseUrl}/${teacherId}/attendance-schedules`
    );
  }

  changeAttendanceSchedule(
    teacherId: string,
    request: TeacherAttendanceScheduleRequest
  ): Observable<TeacherAttendanceSchedule> {
    return this.http.post<TeacherAttendanceSchedule>(
      `${this.baseUrl}/${teacherId}/attendance-schedules`,
      request
    );
  }

  exitTeacher(teacherId: string, request: TeacherExitRequest): Observable<Teacher> {
    return this.http.post<Teacher>(`${this.baseUrl}/${teacherId}/exit`, request);
  }

  reactivateTeacher(teacherId: string): Observable<Teacher> {
    return this.http.post<Teacher>(`${this.baseUrl}/${teacherId}/reactivate`, {});
  }
}
