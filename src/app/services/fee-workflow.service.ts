import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BulkDiscountRequest, FeeAssignmentRequest, FeeAssignmentRow, FeeAssignmentStatus, FeeAssignmentSummary, FeeConfigType, FeeDiscountHistoryRow, FeeGenerationBatchRow, FeeGenerationResult, FeeLifecycleHistory, FeeReconciliationSummary, FeeStudentPreview, FeeTransportHistoryRow, FeeWorkflowChangeResult, FeeWorkflowSettings, LegacyFeeAdoptionResult, LegacyFeeCandidate } from '../interfaces/fee-workflow';

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
  getGenerationBatches(session: string): Observable<FeeGenerationBatchRow[]> { return this.http.get<FeeGenerationBatchRow[]>(`${this.url}/generation-batches`, { params: { session } }); }
  retryGenerationBatch(id: number): Observable<FeeGenerationResult[]> { return this.http.post<FeeGenerationResult[]>(`${this.url}/generation-batches/${id}/retry`, {}); }
  getReconciliation(session: string): Observable<FeeReconciliationSummary> { return this.http.get<FeeReconciliationSummary>(`${this.url}/reconciliation`, { params: { session } }); }
  getLegacyCandidates(session: string): Observable<LegacyFeeCandidate[]> { return this.http.get<LegacyFeeCandidate[]>(`${this.url}/legacy-candidates`, { params: { session } }); }
  adoptLegacyFees(session: string, studentIds: string[], reason: string): Observable<LegacyFeeAdoptionResult> { return this.http.post<LegacyFeeAdoptionResult>(`${this.url}/legacy-adoptions`, { academicSession: session, studentIds, reason }); }
  changeTransport(value: { studentIds: string[]; academicSession: string; enabled: boolean; distance: number | null; effectiveFrom: string; reason: string }): Observable<FeeWorkflowChangeResult> {
    return this.http.post<FeeWorkflowChangeResult>(`${this.url}/transport`, value);
  }
  applyBulkDiscount(value: BulkDiscountRequest): Observable<FeeWorkflowChangeResult> { return this.http.post<FeeWorkflowChangeResult>(`${this.url}/discounts`, value); }
  getHistory(studentId: string, session: string): Observable<FeeLifecycleHistory> { return this.http.get<FeeLifecycleHistory>(`${this.url}/history/${encodeURIComponent(studentId)}`, { params: { session } }); }
  updateFutureDiscount(id: number, value: { configType: FeeConfigType; value: number | null; validFrom: string; validUntil?: string; reason: string }): Observable<FeeDiscountHistoryRow> { return this.http.put<FeeDiscountHistoryRow>(`${this.url}/discounts/${id}/future`, value); }
  expireDiscount(id: number, effectiveFrom: string, reason: string): Observable<FeeWorkflowChangeResult> { return this.http.post<FeeWorkflowChangeResult>(`${this.url}/discounts/${id}/expire`, { effectiveFrom, reason }); }
  revokeFutureDiscount(id: number, reason: string): Observable<FeeDiscountHistoryRow> { return this.http.post<FeeDiscountHistoryRow>(`${this.url}/discounts/${id}/revoke-future`, { reason }); }
  correctFutureTransport(id: number, enabled: boolean, distance: number | null, reason: string): Observable<FeeTransportHistoryRow> { return this.http.put<FeeTransportHistoryRow>(`${this.url}/transport/${id}/future`, { enabled, distance, reason }); }
}
