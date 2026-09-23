import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { UploadCompleteResponse, UploadRequestResponse } from '../interfaces/upload';
import {
  CreateSupportTicketRequest,
  StatusUpdateRequest,
  SupportTicketCategory,
  SupportTicketDetail,
  SupportTicketPage,
  SupportTicketStatus,
  SupportTicketSummary,
} from '../interfaces/support-ticket';

@Injectable({ providedIn: 'root' })
export class SupportTicketService {
  private readonly baseUrl = `${environment.apiUrl}/support-tickets`;
  private readonly fileUploadApiUrl = `${environment.apiUrl}/files`;

  constructor(private http: HttpClient) {}

  /**
   * Same direct-to-object-storage contract as EventService.uploadEventImageDirect — the ticket
   * doesn't exist yet when a screenshot is picked, so entityId is always the shared "new"
   * sentinel; the resulting objectKey is included in the createTicket request body instead of
   * being attached server-side.
   */
  uploadScreenshotDirect(file: File): Observable<UploadCompleteResponse> {
    const purpose = 'SUPPORT_TICKET_SCREENSHOT';
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

  createTicket(request: CreateSupportTicketRequest): Observable<SupportTicketDetail> {
    return this.http.post<SupportTicketDetail>(this.baseUrl, request);
  }

  myTickets(page: number, size = 20): Observable<SupportTicketPage<SupportTicketSummary>> {
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'createdAt,desc');
    return this.http.get<SupportTicketPage<SupportTicketSummary>>(`${this.baseUrl}/mine`, { params });
  }

  myTicketDetail(id: number): Observable<SupportTicketDetail> {
    return this.http.get<SupportTicketDetail>(`${this.baseUrl}/mine/${id}`);
  }

  /** SUPER_ADMIN only — the global cross-school queue. */
  allTickets(
    page: number, size = 20,
    status?: SupportTicketStatus | null, category?: SupportTicketCategory | null, schoolId?: number | null,
  ): Observable<SupportTicketPage<SupportTicketSummary>> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', 'createdAt,desc');
    if (status) params = params.set('status', status);
    if (category) params = params.set('category', category);
    if (schoolId) params = params.set('schoolId', schoolId);
    return this.http.get<SupportTicketPage<SupportTicketSummary>>(this.baseUrl, { params });
  }

  adminTicketDetail(id: number): Observable<SupportTicketDetail> {
    return this.http.get<SupportTicketDetail>(`${this.baseUrl}/${id}`);
  }

  updateStatus(id: number, request: StatusUpdateRequest): Observable<SupportTicketDetail> {
    return this.http.put<SupportTicketDetail>(`${this.baseUrl}/${id}/status`, request);
  }
}
