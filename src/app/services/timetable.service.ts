import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TimetableEntry, TimetableEntryRequest, TimetableCorrection } from '../interfaces/timetable';

export interface TimetableBulkImportError {
  row: number;
  label: string;
  reason: string;
}

export interface TimetableBulkImportSuccess {
  row: number;
  label: string;
  entryId: number;
}

export interface TimetableBulkImportResult {
  academicSessionId: number;
  totalRows: number;
  successful: number;
  failed: number;
  errors: TimetableBulkImportError[];
  created: TimetableBulkImportSuccess[];
}

@Injectable({ providedIn: 'root' })
export class TimetableService {
  private baseUrl = `${environment.apiUrl}/timetable`;

  constructor(private http: HttpClient) {}

  getClassTimetable(className: string, sectionId?: number | null, studentId?: string | null, academicSessionId?: number): Observable<TimetableEntry[]> {
    let params = new HttpParams();
    if (academicSessionId != null) params = params.set('academicSessionId', academicSessionId);
    if (sectionId != null) {
      params = params.set('sectionId', sectionId.toString());
    }
    if (studentId) {
      params = params.set('studentId', studentId);
    }
    return this.http.get<TimetableEntry[]>(
      `${this.baseUrl}/class/${encodeURIComponent(className)}`,
      { params }
    );
  }

  getTeacherTimetable(teacherId: string, academicSessionId?: number): Observable<TimetableEntry[]> {
    return this.http.get<TimetableEntry[]>(`${this.baseUrl}/teacher/${encodeURIComponent(teacherId)}`, { params: academicSessionId == null ? {} : { academicSessionId } });
  }

  getCorrections(): Observable<TimetableCorrection[]> {
    return this.http.get<TimetableCorrection[]>(`${this.baseUrl}/corrections`);
  }
  requestCorrection(timetableEntryId: number, reason?: string): Observable<TimetableCorrection> {
    return this.http.post<TimetableCorrection>(`${this.baseUrl}/corrections`, { timetableEntryId, reason });
  }
  reviewCorrection(id: number, decision: 'approve' | 'reject'): Observable<TimetableCorrection> {
    return this.http.post<TimetableCorrection>(`${this.baseUrl}/corrections/${id}/${decision}`, {});
  }

  createEntry(entry: TimetableEntryRequest): Observable<TimetableEntry> {
    return this.http.post<TimetableEntry>(this.baseUrl, entry);
  }

  updateEntry(id: number, entry: TimetableEntryRequest): Observable<TimetableEntry> {
    return this.http.put<TimetableEntry>(`${this.baseUrl}/${id}`, entry);
  }

  deleteEntry(id: number, academicSessionId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, { params: { academicSessionId } });
  }

  /** Adds a second subject to the same slot as entry `existingId` — the "+ Simultaneous"
   *  action. Class/section/day/period/time are inherited server-side from the existing entry,
   *  and the simultaneousGroup tag is generated/reused automatically — the caller only ever
   *  supplies the new subject and teacher, never a tag. */
  addSimultaneous(existingId: number, subjectName: string, teacherId: string, academicSessionId?: number): Observable<TimetableEntry> {
    return this.http.post<TimetableEntry>(`${this.baseUrl}/${existingId}/simultaneous`, { subjectName, teacherId, academicSessionId });
  }

  downloadBulkTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/bulk/template`, { responseType: 'blob' });
  }

  bulkImport(file: File, academicSessionId: number): Observable<TimetableBulkImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TimetableBulkImportResult>(`${this.baseUrl}/bulk`, formData, { params: { academicSessionId } });
  }
}
