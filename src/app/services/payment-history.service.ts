import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PaymentHistory } from '../interfaces/payment-history';
import { PaymentHistoryDetails } from '../interfaces/payment-response';
import { PaymentLineItemBreakdown } from '../interfaces/payment-line-item-breakdown';
import { environment } from '../../environments/environment';

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentHistoryService {

  private baseUrl = `${environment.apiUrl}/payments/history`;

  constructor(private http: HttpClient) { }

  getFilteredPaymentHistory(
    className?: string,
    studentId?: string,
    date?: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'paymentDate',
    sortDir: string = 'desc'
  ): Observable<PaginatedResponse<PaymentHistory>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', `${sortBy},${sortDir}`);

    if (className) {
      params = params.set('className', className);
    }
    if (studentId) {
      params = params.set('studentId', studentId);
    }
    if (date) {
      params = params.set('paymentDate', date);
    }

    return this.http.get<PaginatedResponse<PaymentHistory>>(`${this.baseUrl}/students`, { params });
  }

  getPaymentHistoryForStudent(
    studentId: string,
    page: number = 0,
    size: number = 10,
    sortBy: string = 'paymentDate',
    sortDir: string = 'desc'
  ): Observable<PaginatedResponse<PaymentHistory>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', `${sortBy},${sortDir}`);

    return this.http.get<PaginatedResponse<PaymentHistory>>(`${this.baseUrl}/student/${studentId}`, { params });
  }

  getPaymentHistory(studentId: string): Observable<PaymentHistory[]> {
    return this.http.get<PaymentHistory[]>(`${this.baseUrl}/${studentId}`);
  }

  getPaymentHistoryDetails(paymentId: string): Observable<PaymentHistoryDetails> {
    return this.http.get<PaymentHistoryDetails>(`${this.baseUrl}/details/${paymentId}`);
  }

  /** Backend-authoritative per-fee-head breakdown for a payment — the same data the PDF
   * receipt renders from. Never computed in Angular; see PaymentLineItemBreakdown's javadoc
   * for the never-fabricate fallback contract. */
  getPaymentReceiptBreakdown(paymentId: string): Observable<PaymentLineItemBreakdown> {
    return this.http.get<PaymentLineItemBreakdown>(`${this.baseUrl}/receipt-breakdown/${paymentId}`);
  }

  downloadPaymentReceipt(paymentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/receipt/${paymentId}`, {
      responseType: 'blob',
    });
  }
}

