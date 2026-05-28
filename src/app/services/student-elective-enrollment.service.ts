import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ElectiveEnrollment {
  id: number;
  studentId: string;
  studentName: string;
  className: string;
  optionalGroup: string;
  subjectName: string;
}

@Injectable({ providedIn: 'root' })
export class StudentElectiveEnrollmentService {
  private base = `${environment.apiUrl}/elective-enrollment`;

  constructor(private http: HttpClient) { }

  getEnrollmentsForClass(className: string): Observable<ElectiveEnrollment[]> {
    return this.http.get<ElectiveEnrollment[]>(`${this.base}/class/${className}`);
  }

  enroll(studentId: string, className: string, optionalGroup: string, subjectName: string): Observable<ElectiveEnrollment> {
    return this.http.post<ElectiveEnrollment>(this.base, { studentId, className, optionalGroup, subjectName });
  }

  unenroll(studentId: string, className: string, optionalGroup: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${studentId}/${className}/${optionalGroup}`);
  }

  bulkEnroll(studentIds: string[], className: string, optionalGroup: string, subjectName: string): Observable<{ enrolled: number }> {
    return this.http.post<{ enrolled: number }>(`${this.base}/bulk`, { studentIds, className, optionalGroup, subjectName });
  }
}
