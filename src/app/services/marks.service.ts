import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MarkEntryStudent {
  studentId: string;
  studentName: string;
  marksObtained: number | null;
}

export interface StudentExamSubject {
  examSubjectEntryId: number;
  subjectName: string;
  maxMarks: number;
  examDate: string;
  marksObtained: number | null;
}

export interface SubjectResult {
  subjectName: string;
  maxMarks: number;
  examDate: string;
  marksObtained: number | null;
  classAverage: number | null;
  rank: number | null;
}

export interface ExamResult {
  examId: number;
  examName: string;
  className: string;
  session: string;
  studentName: string;
  subjects: SubjectResult[];
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  overallRank: number;
}

export interface MarkEntryRequest {
  studentId: string;
  examSubjectEntryId: number;
  marksObtained: number;
}

export interface MarkBulkResult {
  saved: number;
  updated: number;
  errors: Array<{ studentId: string; reason: string }>;
}

export interface ClassStudentSubject {
  subjectName: string;
  maxMarks: number;
  examDate: string;
  marksObtained: number | null;
}

export interface ClassStudentResult {
  studentId: string;
  studentName: string;
  subjects: ClassStudentSubject[];
  totalMarksObtained: number;
  totalMaxMarks: number;
  percentage: number;
  rank: number;
}

@Injectable({ providedIn: 'root' })
export class MarksService {
  private base = `${environment.apiUrl}/marks`;

  constructor(private http: HttpClient) { }

  // Mark entry — Mode A: by subject
  getStudentsForSubject(examSubjectEntryId: number, sectionId?: number | null): Observable<MarkEntryStudent[]> {
    const params = sectionId != null ? { params: { sectionId: String(sectionId) } } : {};
    return this.http.get<MarkEntryStudent[]>(`${this.base}/exam/${examSubjectEntryId}/students`, params);
  }

  // Mark entry — Mode B: by student
  getSubjectsForStudent(studentId: string, examConfigId: number): Observable<StudentExamSubject[]> {
    return this.http.get<StudentExamSubject[]>(`${this.base}/student/${studentId}/exam/${examConfigId}`);
  }

  // Bulk save / update
  saveBulkMarks(entries: MarkEntryRequest[]): Observable<MarkBulkResult> {
    return this.http.post<MarkBulkResult>(`${this.base}/bulk`, entries);
  }

  // Student results view
  getStudentResults(studentId: string, session: string): Observable<ExamResult[]> {
    const params = new HttpParams().set('session', session);
    return this.http.get<ExamResult[]>(`${this.base}/student/${studentId}/results`, { params });
  }

  // Class-wide results view (teacher / admin)
  getClassResults(className: string, examConfigId: number, sectionId?: number | null): Observable<ClassStudentResult[]> {
    const params = sectionId != null ? { params: { sectionId: String(sectionId) } } : {};
    return this.http.get<ClassStudentResult[]>(`${this.base}/class/${className}/exam/${examConfigId}`, params);
  }
}
