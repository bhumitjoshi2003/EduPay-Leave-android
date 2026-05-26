import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FeePayment, RecordPaymentRequest, StudentFeeConfig, CreditNote } from '../interfaces/fee-payment';

@Injectable({
  providedIn: 'root'
})
export class FeePaymentService {
  private paymentUrl = `${environment.apiUrl}/fee-payments`;
  private configUrl = `${environment.apiUrl}/student-fee-configs`;
  private creditUrl = `${environment.apiUrl}/credit-notes`;

  constructor(private http: HttpClient) {}

  // --- Payments ---
  recordPayment(request: RecordPaymentRequest): Observable<FeePayment> {
    return this.http.post<FeePayment>(this.paymentUrl, request);
  }

  getPayment(paymentId: number): Observable<FeePayment> {
    return this.http.get<FeePayment>(`${this.paymentUrl}/${paymentId}`);
  }

  getPaymentHistory(page: number, size: number, studentId?: string, status?: string): Observable<any> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (studentId) params = params.set('studentId', studentId);
    if (status) params = params.set('status', status);
    return this.http.get(this.paymentUrl, { params });
  }

  getStudentPaymentHistory(studentId: string, page: number, size: number): Observable<any> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get(`${this.paymentUrl}/student/${studentId}`, { params });
  }

  // --- Student Fee Configs ---
  getStudentConfigs(studentId: string, sessionId: number): Observable<StudentFeeConfig[]> {
    return this.http.get<StudentFeeConfig[]>(`${this.configUrl}/${studentId}/session/${sessionId}`);
  }

  createConfig(config: StudentFeeConfig): Observable<StudentFeeConfig> {
    return this.http.post<StudentFeeConfig>(this.configUrl, config);
  }

  deleteConfig(configId: number): Observable<void> {
    return this.http.delete<void>(`${this.configUrl}/${configId}`);
  }

  // --- Credit Notes ---
  createCreditNote(creditNote: Partial<CreditNote>): Observable<CreditNote> {
    return this.http.post<CreditNote>(this.creditUrl, creditNote);
  }

  approveCreditNote(creditNoteId: number): Observable<CreditNote> {
    return this.http.post<CreditNote>(`${this.creditUrl}/${creditNoteId}/approve`, {});
  }

  getCreditNotes(page: number, size: number, status?: string): Observable<any> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get(this.creditUrl, { params });
  }
}
