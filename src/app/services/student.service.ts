import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Student } from '../interfaces/student';

interface StudentDTO {
  studentId: string;
  name: string;
}

export type PromotionAction = 'PROMOTE' | 'DETAIN' | 'PASS_OUT';

export interface PromotionPreviewGroup {
  className: string;
  students: { studentId: string; name: string; }[];
}

export interface PromotionResult {
  promoted: number;
  detained: number;
  passedOut: number;
  errors: { studentId: string; reason: string; }[];
}

export interface BulkImportError {
  row: number;
  studentId: string;
  reason: string;
}

export interface BulkImportResult {
  totalRows: number;
  successful: number;
  failed: number;
  errors: BulkImportError[];
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

  getActiveStudentsByClass(selectedClass: string): Observable<StudentDTO[]> {
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/active/class/${selectedClass}`);
  }

  updateStudent(studentId: string, payload: { studentDetails: Partial<Student>; effectiveFromMonth: number | null }): Observable<Student> {
    return this.http.put<Student>(`${this.baseUrl}/${studentId}`, payload);
  }

  addStudent(studentData: Omit<Student, 'studentId'>): Observable<Student> {
    return this.http.post<Student>(this.baseUrl, studentData);
  }

  getNewStudentsByClass(selectedClass: string): Observable<StudentDTO[]> {
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/new/class/${selectedClass}`);
  }

  getInactiveStudentsByClass(selectedClass: string): Observable<StudentDTO[]> {
    return this.http.get<StudentDTO[]>(`${this.baseUrl}/inactive/class/${selectedClass}`);
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

  getPromotionPreview(): Observable<PromotionPreviewGroup[]> {
    return this.http.get<PromotionPreviewGroup[]>(`${this.baseUrl}/promotion/preview`);
  }

  executePromotion(decisions: { studentId: string; action: PromotionAction }[]): Observable<PromotionResult> {
    return this.http.post<PromotionResult>(`${this.baseUrl}/promotion/execute`, { decisions });
  }

}