import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Teacher, TeacherExitRequest } from '../interfaces/teacher';
import { UploadRequestResponse, UploadCompleteResponse } from '../interfaces/upload';
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

  /** @deprecated kept as the rollback path only — see uploadTeacherPhotoDirect for the current
   * direct-to-object-storage flow. Still fully functional server-side. */
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

  /**
   * Direct-to-object-storage upload: ask the backend for a short-lived presigned URL, PUT the
   * file bytes straight to object storage (never through this backend), then tell the backend
   * the upload finished so it can verify and attach the reference.
   */
  uploadTeacherPhotoDirect(teacherId: string, file: File): Observable<UploadCompleteResponse> {
    const uploadRequestUrl = `${environment.apiUrl}/files/upload-request`;
    const completeUrl = `${environment.apiUrl}/files/complete`;

    return this.http
      .post<UploadRequestResponse>(uploadRequestUrl, {
        purpose: 'TEACHER_PROFILE_PHOTO',
        entityId: teacherId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      })
      .pipe(
        switchMap((uploadRequest) => {
          const headers = new HttpHeaders(uploadRequest.requiredHeaders);
          return this.http.put(uploadRequest.uploadUrl, file, { headers }).pipe(
            switchMap(() =>
              this.http.post<UploadCompleteResponse>(completeUrl, {
                objectKey: uploadRequest.objectKey,
                purpose: 'TEACHER_PROFILE_PHOTO',
                entityId: teacherId,
              }),
            ),
          );
        }),
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
