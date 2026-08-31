import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ParentImportConfirmResponse,
  ParentImportPreviewResponse,
  ParentImportResolutions,
} from '../interfaces/parent-bulk-import';

@Injectable({ providedIn: 'root' })
export class ParentBulkImportService {
  private readonly baseUrl = `${environment.apiUrl}/parents/bulk-import`;

  constructor(private http: HttpClient) {}

  preview(file: File): Observable<ParentImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ParentImportPreviewResponse>(`${this.baseUrl}/preview`, formData);
  }

  /** Re-validates the same file from scratch server-side (never trusts the client-held
   *  preview) — `resolutions` carries the admin's explicit decision for any row that was
   *  ambiguous at preview time, sent as a second JSON part alongside the file. */
  confirm(file: File, resolutions: ParentImportResolutions): Observable<ParentImportConfirmResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resolutions', new Blob([JSON.stringify(resolutions)], { type: 'application/json' }));
    return this.http.post<ParentImportConfirmResponse>(`${this.baseUrl}/confirm`, formData);
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/template`, { responseType: 'blob' });
  }

  /** Starter CSV pre-filled from Student.fatherName/motherName only — see the backend's
   *  ParentBulkImportService.buildPrefillCsv for exactly what is and isn't copied
   *  (never Student.email/phoneNumber, which are the student's own contact info). */
  downloadPrefill(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/prefill`, { responseType: 'blob' });
  }
}
