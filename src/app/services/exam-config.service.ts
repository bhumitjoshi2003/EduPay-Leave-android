import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ExamConfig {
  id: number;
  session: string;
  className: string;
  examName: string;
}

export interface ExamSubjectEntry {
  id: number;
  examConfigId: number;
  subjectName: string;
  maxMarks: number;
  examDate: string;
}

@Injectable({ providedIn: 'root' })
export class ExamConfigService {
  private base = `${environment.apiUrl}/exams`;

  constructor(private http: HttpClient) { }

  getExams(session: string, className: string): Observable<ExamConfig[]> {
    const params = new HttpParams().set('session', session).set('className', className);
    return this.http.get<ExamConfig[]>(this.base, { params });
  }

  addExam(session: string, className: string, examName: string): Observable<ExamConfig> {
    return this.http.post<ExamConfig>(this.base, { session, className, examName });
  }

  deleteExam(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getExamSubjects(examId: number): Observable<ExamSubjectEntry[]> {
    return this.http.get<ExamSubjectEntry[]>(`${this.base}/${examId}/subjects`);
  }

  addExamSubject(examId: number, subjectName: string, maxMarks: number, examDate: string): Observable<ExamSubjectEntry> {
    return this.http.post<ExamSubjectEntry>(`${this.base}/${examId}/subjects`, { subjectName, maxMarks, examDate });
  }

  updateExamSubject(entryId: number, maxMarks: number, examDate: string): Observable<ExamSubjectEntry> {
    return this.http.put<ExamSubjectEntry>(`${this.base}/subjects/${entryId}`, { maxMarks, examDate });
  }

  deleteExamSubject(entryId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/subjects/${entryId}`);
  }

  bulkSyncExamSubjects(examId: number, subjects: { subjectName: string; maxMarks: number; examDate: string }[]): Observable<ExamSubjectEntry[]> {
    return this.http.put<ExamSubjectEntry[]>(`${this.base}/${examId}/subjects/bulk`, subjects);
  }
}
