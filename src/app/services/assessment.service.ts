import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { UploadCompleteResponse, UploadRequestResponse } from '../interfaces/upload';
import {
  Assessment,
  AssessmentContextClass,
  CreateAssessmentRequest,
  UpdateAssessmentRequest,
} from '../interfaces/assessment';

@Injectable({ providedIn: 'root' })
export class AssessmentService {
  private readonly baseUrl = `${environment.apiUrl}/assessments`;
  private readonly fileUploadApiUrl = `${environment.apiUrl}/files`;

  constructor(private http: HttpClient) {}

  /**
   * Same direct-to-object-storage contract as the other uploads: the assessment doesn't exist
   * yet, so entityId is the shared "new" sentinel and the returned objectKey is sent with it.
   */
  uploadAttachmentDirect(file: File): Observable<UploadCompleteResponse> {
    const purpose = 'ASSESSMENT_ATTACHMENT';
    const entityId = 'new';
    return this.http
      .post<UploadRequestResponse>(`${this.fileUploadApiUrl}/upload-request`, {
        purpose, entityId, fileName: file.name, contentType: file.type, size: file.size,
      })
      .pipe(
        switchMap(uploadRequest => {
          const headers = new HttpHeaders(uploadRequest.requiredHeaders);
          return this.http.put(uploadRequest.uploadUrl, file, { headers }).pipe(
            switchMap(() => this.http.post<UploadCompleteResponse>(`${this.fileUploadApiUrl}/complete`, {
              objectKey: uploadRequest.objectKey, purpose, entityId,
            })),
          );
        }),
      );
  }

  // Teacher / school admin
  contexts(): Observable<AssessmentContextClass[]> {
    return this.http.get<AssessmentContextClass[]>(`${this.baseUrl}/contexts`);
  }

  manage(scope: 'upcoming' | 'past'): Observable<Assessment[]> {
    return this.http.get<Assessment[]>(`${this.baseUrl}/manage`, { params: new HttpParams().set('scope', scope) });
  }

  create(request: CreateAssessmentRequest): Observable<Assessment> {
    return this.http.post<Assessment>(this.baseUrl, request);
  }

  update(id: number, request: UpdateAssessmentRequest): Observable<Assessment> {
    return this.http.put<Assessment>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // Student
  studentUpcoming(limit?: number): Observable<Assessment[]> {
    const params = limit ? new HttpParams().set('limit', limit) : undefined;
    return this.http.get<Assessment[]>(`${this.baseUrl}/student/upcoming`, { params });
  }

  /** month = YYYY-MM (default: the school's current month). */
  studentMonth(month?: string): Observable<Assessment[]> {
    const params = month ? new HttpParams().set('month', month) : undefined;
    return this.http.get<Assessment[]>(`${this.baseUrl}/student/month`, { params });
  }

  studentPast(): Observable<Assessment[]> {
    return this.http.get<Assessment[]>(`${this.baseUrl}/student/past`);
  }
}
