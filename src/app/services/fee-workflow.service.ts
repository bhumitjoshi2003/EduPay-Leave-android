import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BulkDiscountRequest, FeeAssignmentRequest, FeeAssignmentRow, FeeAssignmentStatus, FeeAssignmentSummary, FeeGenerationResult, FeeStudentPreview, FeeWorkflowChangeResult, FeeWorkflowSettings } from '../interfaces/fee-workflow';

@Injectable({ providedIn: 'root' })
export class FeeWorkflowService {
  private readonly url = `${environment.apiUrl}/fee-workflow`;
  constructor(private http: HttpClient) {}
  getSettings(): Observable<FeeWorkflowSettings> { return this.http.get<FeeWorkflowSettings>(`${this.url}/settings`); }
  updateSettings(value: FeeWorkflowSettings): Observable<FeeWorkflowSettings> { return this.http.put<FeeWorkflowSettings>(`${this.url}/settings`, value); }
  getAssignments(session: string, className?: string, status?: FeeAssignmentStatus): Observable<FeeAssignmentRow[]> {
    let params = new HttpParams().set('session', session);
    if (className) params = params.set('className', className);
    if (status) params = params.set('status', status);
    return this.http.get<FeeAssignmentRow[]>(`${this.url}/assignments`, { params });
  }
  getSummary(session: string): Observable<FeeAssignmentSummary> { return this.http.get<FeeAssignmentSummary>(`${this.url}/assignments/summary`, { params: { session } }); }
  assign(value: FeeAssignmentRequest): Observable<unknown> { return this.http.post(`${this.url}/assignments/assign`, value); }
  exclude(value: FeeAssignmentRequest): Observable<unknown> { return this.http.post(`${this.url}/assignments/exclude`, value); }
  preview(value: FeeAssignmentRequest): Observable<FeeStudentPreview[]> { return this.http.post<FeeStudentPreview[]>(`${this.url}/preview`, value); }
  generate(value: FeeAssignmentRequest): Observable<FeeGenerationResult[]> { return this.http.post<FeeGenerationResult[]>(`${this.url}/generate`, value); }
  changeTransport(value: { studentIds: string[]; academicSession: string; enabled: boolean; distance: number | null; effectiveFrom: string; reason: string }): Observable<FeeWorkflowChangeResult> {
    return this.http.post<FeeWorkflowChangeResult>(`${this.url}/transport`, value);
  }
  applyBulkDiscount(value: BulkDiscountRequest): Observable<FeeWorkflowChangeResult> { return this.http.post<FeeWorkflowChangeResult>(`${this.url}/discounts`, value); }
}
