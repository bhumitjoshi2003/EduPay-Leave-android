import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Teacher } from '../interfaces/teacher';
import { BulkImportResult } from './student.service';

@Injectable({
  providedIn: 'root'
})
export class TeacherService {

  private baseUrl = `${environment.apiUrl}/teachers`;

  constructor(private http: HttpClient) { }

  getTeacher(teacherId: string): Observable<Teacher> {
    return this.http.get<Teacher>(`${this.baseUrl}/${teacherId}`);
  }

  getAllTeachers(): Observable<Teacher[]> {
    return this.http.get<Teacher[]>(`${this.baseUrl}`);
  }

  updateTeacher(teacherId: string, updatedTeacher: Partial<Teacher>): Observable<Teacher> {
    return this.http.put<Teacher>(`${this.baseUrl}/${teacherId}`, updatedTeacher);
  }

  addTeacher(teacherData: Teacher): Observable<Teacher> {
    return this.http.post<Teacher>(this.baseUrl, teacherData);
  }

  downloadBulkTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/bulk/template`, { responseType: 'blob' });
  }

  bulkImport(file: File): Observable<BulkImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BulkImportResult>(`${this.baseUrl}/bulk`, formData);
  }

  uploadTeacherPhoto(teacherId: string, file: File): Observable<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoUrl: string }>(`${this.baseUrl}/${teacherId}/photo`, formData);
  }
}
