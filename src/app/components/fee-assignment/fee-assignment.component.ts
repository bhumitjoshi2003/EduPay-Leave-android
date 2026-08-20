import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { AcademicSession } from '../../interfaces/academic-session';
import { FeeAssignmentRequest, FeeAssignmentRow, FeeAssignmentStatus, FeeAssignmentSummary, FeeConfigType, FeeDiscountHistoryRow, FeeGenerationBatchRow, FeeGenerationResult, FeeLifecycleHistory, FeeReconciliationSummary, FeeStudentPreview, FeeTransportHistoryRow, FeeWorkflowChangeResult, FeeWorkflowSettings, LegacyFeeCandidate } from '../../interfaces/fee-workflow';
import { FeeHead } from '../../interfaces/fee-head';
import { AcademicSessionService } from '../../services/academic-session.service';
import { FeeWorkflowService } from '../../services/fee-workflow.service';
import { FeeHeadService } from '../../services/fee-head.service';
import { ToastService } from '../../services/toast.service';

@Component({ selector: 'app-fee-assignment', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './fee-assignment.component.html', styleUrls: ['./fee-assignment.component.css', './fee-assignment-phase2.component.css'] })
export class FeeAssignmentComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  sessions: AcademicSession[] = []; session = ''; classFilter = ''; statusFilter: FeeAssignmentStatus | '' = '';
  settings?: FeeWorkflowSettings; rows: FeeAssignmentRow[] = []; summary?: FeeAssignmentSummary;
  selected = new Set<string>(); months = Array.from({ length: 12 }, (_, i) => i + 1); selectedMonths = new Set<number>();
  effectiveDate = new Date().toISOString().slice(0, 10); reason = ''; loading = true; working = false;
  previewRows: FeeStudentPreview[] = []; results: FeeGenerationResult[] = [];
  changeResult?: FeeWorkflowChangeResult;
  transportEnabled = false; transportDistance: number | null = null;
  feeHeads: FeeHead[] = []; discountFeeHeadId: number | null = null; discountType: FeeConfigType = 'DISCOUNT_PERCENT';
  discountValue: number | null = null; discountUntil = '';
  history?: FeeLifecycleHistory; editingDiscountId: number | null = null; editingTransportId: number | null = null;
  generationBatches: FeeGenerationBatchRow[] = []; reconciliation?: FeeReconciliationSummary; showOnlyMissing = true;
  legacyCandidates: LegacyFeeCandidate[] = []; selectedLegacy = new Set<string>();
  readonly statuses: FeeAssignmentStatus[] = ['NOT_ASSIGNED','READY','GENERATED','PARTIALLY_GENERATED','EXCLUDED','GENERATION_FAILED'];

  constructor(private workflow: FeeWorkflowService, private sessionsApi: AcademicSessionService, private feeHeadsApi: FeeHeadService, private toast: ToastService) {}
  ngOnInit(): void {
    forkJoin({ settings: this.workflow.getSettings(), sessions: this.sessionsApi.getAllSessions(), feeHeads: this.feeHeadsApi.getActiveFeeHeads() }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ settings, sessions, feeHeads }) => { this.settings = settings; this.sessions = sessions; this.feeHeads = feeHeads; this.session = sessions.find(s => s.current)?.label || sessions[0]?.label || ''; this.selectRemainingMonths(); this.reload(); },
      error: () => { this.loading = false; this.toast.error('Unable to load', 'Fee workflow settings could not be loaded.'); }
    });
  }
  reload(): void {
    if (!this.session) { this.loading = false; return; } this.loading = true; this.selected.clear(); this.previewRows = [];
    forkJoin({ rows: this.workflow.getAssignments(this.session, this.classFilter || undefined, this.statusFilter || undefined), summary: this.workflow.getSummary(this.session), batches: this.workflow.getGenerationBatches(this.session), reconciliation: this.workflow.getReconciliation(this.session), legacy: this.workflow.getLegacyCandidates(this.session) })
      .pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.rows = x.rows; this.summary = x.summary; this.generationBatches = x.batches; this.reconciliation = x.reconciliation; this.legacyCandidates = x.legacy; this.selectedLegacy.clear(); this.loading = false; }, error: () => { this.loading = false; this.toast.error('Unable to load', 'Student fee assignments and operational status could not be loaded.'); } });
  }
  saveSettings(): void { if (!this.settings) return; this.working = true; this.workflow.updateSettings(this.settings).pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.settings = x; this.working = false; this.toast.success('Fee settings saved'); }, error: e => { this.working = false; this.toast.error('Could not save', e.error?.error || 'Please check the settings.'); } }); }
  toggleStudent(id: string): void { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); this.clearLifecycleSelection(); }
  toggleAll(): void { this.selected.size === this.rows.length ? this.selected.clear() : this.rows.forEach(r => this.selected.add(r.studentId)); this.clearLifecycleSelection(); }
  toggleMonth(month: number): void { this.selectedMonths.has(month) ? this.selectedMonths.delete(month) : this.selectedMonths.add(month); }
  selectRemainingMonths(): void { const selectedSession = this.sessions.find(value => value.label === this.session); const startMonth = selectedSession ? new Date(`${selectedSession.startDate}T00:00:00`).getMonth() + 1 : 4; const now = new Date(); const academic = ((now.getMonth() + 1 - startMonth + 12) % 12) + 1; this.selectedMonths = new Set(this.months.filter(m => m >= academic)); }
  private request(): FeeAssignmentRequest | null {
    if (!this.selected.size || !this.selectedMonths.size || !this.effectiveDate) { this.toast.warning('Selection required', 'Select students, months and an effective date.'); return null; }
    return { studentIds: [...this.selected], academicSession: this.session, effectiveDate: this.effectiveDate, months: [...this.selectedMonths].sort((a,b) => a-b), reason: this.reason };
  }
  assign(): void { const req = this.request(); if (!req) return; this.run(() => this.workflow.assign(req), 'Students assigned for fees.'); }
  exclude(): void { const req = this.request(); if (!req || !this.reason.trim()) { this.toast.warning('Reason required', 'Enter a reason before excluding students.'); return; } this.run(() => this.workflow.exclude(req), 'Students excluded from fees.'); }
  preview(): void { const req = this.request(); if (!req) return; this.working = true; this.workflow.preview(req).pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.previewRows = x; this.working = false; }, error: e => { this.working = false; this.toast.error('Preview failed', e.error?.error || 'Unable to calculate fees.'); } }); }
  suggestEligibleMonths(): void {
    if (!this.selected.size || !this.effectiveDate) { this.toast.warning('Selection required', 'Select students and an effective date first.'); return; }
    const request: FeeAssignmentRequest = { studentIds: [...this.selected], academicSession: this.session, effectiveDate: this.effectiveDate, months: [...this.months], reason: this.reason };
    this.working = true;
    this.workflow.preview(request).pipe(takeUntil(this.destroy$)).subscribe({
      next: rows => { this.previewRows = rows; this.selectedMonths = new Set(rows.flatMap(row => row.months).filter(month => month.eligible && !month.existing).map(month => month.month)); this.working = false; this.toast.info('Eligible months suggested', `${this.selectedMonths.size} academic month(s) selected using the school policy and student joining dates.`); },
      error: e => { this.working = false; this.toast.error('Suggestion failed', e.error?.error || 'Unable to determine eligible months.'); }
    });
  }
  async generate(): Promise<void> { const req = this.request(); if (!req) return; const ok = await this.toast.confirm({ title: 'Generate fee charges?', message: `Create ${req.months.length} month(s) for ${req.studentIds.length} selected student(s)? Existing months will be skipped.`, icon: 'warning', confirmText: 'Generate', cancelText: 'Cancel' }); if (!ok) return; this.working = true; this.workflow.generate(req).pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.results = x; this.working = false; this.toast.success('Generation completed', `${x.filter(r => r.successful).length} student(s) processed successfully.`); this.reload(); }, error: e => { this.working = false; this.toast.error('Generation failed', e.error?.error || 'No charges were generated.'); } }); }
  async retryBatch(batch: FeeGenerationBatchRow): Promise<void> { if (!batch.failedStudents) return; const ok = await this.toast.confirm({ title: 'Retry failed students?', message: `Retry ${batch.failedStudents} failed student(s) from batch #${batch.id}. Already-generated months will be skipped safely.`, icon: 'warning', confirmText: 'Retry failed', cancelText: 'Cancel' }); if (!ok) return; this.working = true; this.workflow.retryGenerationBatch(batch.id).pipe(takeUntil(this.destroy$)).subscribe({ next: value => { this.results = value; this.working = false; this.toast.success('Retry completed', `${value.filter(row => row.successful).length} student(s) processed successfully.`); this.reload(); }, error: e => { this.working = false; this.toast.error('Retry failed', e.error?.error || 'Unable to retry this batch.'); } }); }
  visibleReconciliationRows() { const rows = this.reconciliation?.students || []; return this.showOnlyMissing ? rows.filter(row => row.missingMonths.length || row.status === 'NOT_ASSIGNED' || row.status === 'GENERATION_FAILED') : rows; }
  toggleLegacy(id: string): void { this.selectedLegacy.has(id) ? this.selectedLegacy.delete(id) : this.selectedLegacy.add(id); }
  toggleAllLegacy(): void { this.selectedLegacy.size === this.legacyCandidates.length ? this.selectedLegacy.clear() : this.legacyCandidates.forEach(row => this.selectedLegacy.add(row.studentId)); }
  async adoptLegacy(): Promise<void> { if (!this.selectedLegacy.size) { this.toast.warning('Selection required', 'Select legacy students to adopt.'); return; } if (!this.reason.trim()) { this.toast.warning('Reason required', 'Enter a reason or migration reference in the main Reason / note field.'); return; } const ok = await this.toast.confirm({ title: 'Adopt existing fee records?', message: `Create workflow assignments for ${this.selectedLegacy.size} student(s)? Existing financial rows and amounts will not be modified.`, icon: 'warning', confirmText: 'Adopt records', cancelText: 'Cancel' }); if (!ok) return; this.working = true; this.workflow.adoptLegacyFees(this.session, [...this.selectedLegacy], this.reason).pipe(takeUntil(this.destroy$)).subscribe({ next: value => { this.working = false; this.toast.success('Legacy records adopted', `${value.adoptedStudents} student(s) linked to the new workflow; no fee amounts were changed.`); this.reload(); }, error: e => { this.working = false; this.toast.error('Adoption failed', e.error?.error || 'Unable to adopt legacy fee records.'); } }); }
  updateTransport(): void { if (!this.reason.trim()) { this.toast.warning('Reason required', 'Enter a reason for the transport change.'); return; } if (this.transportEnabled && (!this.transportDistance || this.transportDistance <= 0)) { this.toast.warning('Distance required', 'Enter a positive transport distance.'); return; } if (this.editingTransportId !== null) { this.working = true; this.workflow.correctFutureTransport(this.editingTransportId, this.transportEnabled, this.transportEnabled ? this.transportDistance : null, this.reason).pipe(takeUntil(this.destroy$)).subscribe({ next: () => { this.working = false; this.editingTransportId = null; this.toast.success('Future transport corrected'); this.loadHistory(); }, error: e => { this.working = false; this.toast.error('Correction failed', e.error?.error || 'Unable to correct transport.'); } }); return; } const req = this.request(); if (!req) return; this.runChange(() => this.workflow.changeTransport({ studentIds: req.studentIds, academicSession: req.academicSession, enabled: this.transportEnabled, distance: this.transportEnabled ? this.transportDistance : null, effectiveFrom: req.effectiveDate, reason: this.reason }), 'Transport assignment updated.'); }
  applyDiscount(): void {
    const selectedSession = this.sessions.find(value => value.label === this.session);
    if (!this.selected.size || !selectedSession || !this.discountFeeHeadId || !this.effectiveDate || !this.reason.trim()) { this.toast.warning('Discount details required', 'Select students, a fee head, start date and enter a reason.'); return; }
    const needsValue = this.discountType === 'DISCOUNT_PERCENT' || this.discountType === 'DISCOUNT_FIXED' || this.discountType === 'CUSTOM_AMOUNT';
    if (needsValue && (this.discountValue === null || this.discountValue < 0)) { this.toast.warning('Value required', 'Enter a valid discount or custom amount.'); return; }
    const storedValue = needsValue && this.discountValue !== null
      ? (this.discountType === 'DISCOUNT_PERCENT' ? this.discountValue : Math.round(this.discountValue * 100))
      : null;
    if (this.editingDiscountId !== null) { this.working = true; this.workflow.updateFutureDiscount(this.editingDiscountId, { configType: this.discountType, value: storedValue, validFrom: this.effectiveDate, validUntil: this.discountUntil || undefined, reason: this.reason }).pipe(takeUntil(this.destroy$)).subscribe({ next: () => { this.working = false; this.editingDiscountId = null; this.toast.success('Future discount updated'); this.loadHistory(); }, error: e => { this.working = false; this.toast.error('Update failed', e.error?.error || 'Unable to update discount.'); } }); return; }
    this.runChange(() => this.workflow.applyBulkDiscount({ studentIds: [...this.selected], academicSessionId: selectedSession.id, feeHeadId: this.discountFeeHeadId!, configType: this.discountType, value: storedValue, validFrom: this.effectiveDate, validUntil: this.discountUntil || undefined, reason: this.reason }), 'Discount configuration applied.');
  }
  loadHistory(): void { if (this.selected.size !== 1) { this.toast.warning('Select one student', 'History is available for one selected student at a time.'); return; } this.working = true; this.workflow.getHistory([...this.selected][0], this.session).pipe(takeUntil(this.destroy$)).subscribe({ next: value => { this.history = value; this.working = false; }, error: e => { this.working = false; this.toast.error('History unavailable', e.error?.error || 'Unable to load fee history.'); } }); }
  editDiscount(row: FeeDiscountHistoryRow): void { this.editingDiscountId = row.id; this.discountFeeHeadId = row.feeHeadId; this.discountType = row.configType; this.discountValue = row.value == null ? null : (row.configType === 'DISCOUNT_PERCENT' ? row.value : row.value / 100); this.effectiveDate = row.validFrom; this.discountUntil = row.validUntil || ''; this.reason = row.reason || ''; }
  editTransport(row: FeeTransportHistoryRow): void { this.editingTransportId = row.id; this.transportEnabled = row.enabled; this.transportDistance = row.distance ?? null; this.reason = row.reason || ''; }
  async expireDiscount(row: FeeDiscountHistoryRow): Promise<void> { if (!this.effectiveDate || !this.reason.trim()) { this.toast.warning('Effective date and reason required'); return; } const ok = await this.toast.confirm({ title: 'Expire this discount?', message: `The discount will stop from the month containing ${this.effectiveDate}. Eligible unpaid months will be recalculated; protected months will not change.`, icon: 'warning', confirmText: 'Expire', cancelText: 'Cancel' }); if (!ok) return; this.runChange(() => this.workflow.expireDiscount(row.id, this.effectiveDate, this.reason), 'Discount expired.'); }
  async revokeFutureDiscount(row: FeeDiscountHistoryRow): Promise<void> { if (!this.reason.trim()) { this.toast.warning('Reason required'); return; } const ok = await this.toast.confirm({ title: 'Remove future discount?', message: 'The record will remain in audit history but will never become active.', icon: 'warning', confirmText: 'Remove future rule', cancelText: 'Cancel' }); if (!ok) return; this.working = true; this.workflow.revokeFutureDiscount(row.id, this.reason).pipe(takeUntil(this.destroy$)).subscribe({ next: () => { this.working = false; this.toast.success('Future discount removed'); this.loadHistory(); }, error: e => { this.working = false; this.toast.error('Removal failed', e.error?.error || 'Unable to remove discount.'); } }); }
  isFuture(date?: string): boolean { return !!date && date > new Date().toISOString().slice(0, 10); }
  discountValueText(row: FeeDiscountHistoryRow): string { if (row.configType === 'WAIVER') return 'Full waiver'; if (row.configType === 'OPT_OUT') return 'Opt out'; if (row.value == null) return '—'; return row.configType === 'DISCOUNT_PERCENT' ? `${row.value}%` : `₹${(row.value / 100).toFixed(2)}`; }
  private runChange(action: () => import('rxjs').Observable<FeeWorkflowChangeResult>, message: string): void {
    this.working = true; this.changeResult = undefined;
    action().pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { this.working = false; this.changeResult = result; this.toast.success('Completed', `${message} ${result.recalculatedMonths} month(s) recalculated; ${result.skippedMonths} protected/skipped.`); if (this.history && this.selected.size === 1) this.loadHistory(); },
      error: e => { this.working = false; this.toast.error('Action failed', e.error?.error || 'Please review the selection.'); }
    });
  }
  private clearLifecycleSelection(): void { this.history = undefined; this.editingDiscountId = null; this.editingTransportId = null; }
  private run(action: () => any, message: string): void { this.working = true; action().pipe(takeUntil(this.destroy$)).subscribe({ next: () => { this.working = false; this.toast.success('Completed', message); this.reload(); }, error: (e: any) => { this.working = false; this.toast.error('Action failed', e.error?.error || 'Please review the selection.'); } }); }
  trackByStudent(_: number, row: FeeAssignmentRow): string { return row.studentId; }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
