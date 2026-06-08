import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Invoice, InvoiceGenerationRequest, StudentFeeOverview } from '../interfaces/invoice';
import { PaginatedResponse } from './leave.service';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private apiUrl = `${environment.apiUrl}/invoices`;

  constructor(private http: HttpClient) {}

  generateInvoices(request: InvoiceGenerationRequest): Observable<{ generated: number }> {
    return this.http.post<{ generated: number }>(`${this.apiUrl}/generate`, request);
  }

  issueInvoices(sessionId: number, billingMonth?: number): Observable<{ issued: number }> {
    let params = new HttpParams().set('sessionId', sessionId);
    if (billingMonth != null) {
      params = params.set('billingMonth', billingMonth);
    }
    return this.http.post<{ issued: number }>(`${this.apiUrl}/issue`, null, { params });
  }

  getInvoice(invoiceId: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.apiUrl}/${invoiceId}`);
  }

  getStudentFeeOverview(studentId: string, sessionId?: number): Observable<StudentFeeOverview> {
    let params = new HttpParams();
    if (sessionId != null) {
      params = params.set('sessionId', sessionId);
    }
    return this.http.get<StudentFeeOverview>(`${this.apiUrl}/student/${studentId}`, { params });
  }

  getOutstandingInvoices(studentId: string): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.apiUrl}/student/${studentId}/outstanding`);
  }

  getInvoices(
    page: number, size: number,
    studentId?: string, sessionId?: number, status?: string
  ): Observable<PaginatedResponse<Invoice>> {
    let params = new HttpParams()
      .set('page', page)
      .set('size', size);
    if (studentId) params = params.set('studentId', studentId);
    if (sessionId != null) params = params.set('sessionId', sessionId);
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedResponse<Invoice>>(this.apiUrl, { params });
  }
}
