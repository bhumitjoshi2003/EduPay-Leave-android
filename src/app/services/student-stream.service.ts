import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StudentStreamSelection {
  studentId: string;
  streamId: number;
  streamName: string;
  optionalSubjectId: number;
  optionalSubjectName: string;
}

export interface StudentStreamOverview {
  studentId: string;
  studentName: string;
  className: string | null;
  streamName: string | null;
  optionalSubjectName: string | null;
}

export interface EligibleStudentsResponse {
  eligibleClassCount: number;
  students: StudentStreamOverview[];
}

@Injectable({ providedIn: 'root' })
export class StudentStreamService {
  private base = `${environment.apiUrl}/student-stream`;

  constructor(private http: HttpClient) { }

  getStudentStream(studentId: string): Observable<StudentStreamSelection> {
    return this.http.get<StudentStreamSelection>(`${this.base}/${studentId}`);
  }

  assignStream(studentId: string, streamId: number, optionalSubjectId: number | null): Observable<StudentStreamSelection> {
    return this.http.post<StudentStreamSelection>(this.base, { studentId, streamId, optionalSubjectId });
  }

  updateStream(studentId: string, streamId: number, optionalSubjectId: number | null): Observable<StudentStreamSelection> {
    return this.http.put<StudentStreamSelection>(`${this.base}/${studentId}`, { studentId, streamId, optionalSubjectId });
  }

  deleteStream(studentId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${studentId}`);
  }

  getClassStreamOverview(className: string): Observable<StudentStreamOverview[]> {
    return this.http.get<StudentStreamOverview[]>(`${this.base}/class/${className}`);
  }

  getEligibleStudents(): Observable<EligibleStudentsResponse> {
    return this.http.get<EligibleStudentsResponse>(`${this.base}/eligible-students`);
  }
}
