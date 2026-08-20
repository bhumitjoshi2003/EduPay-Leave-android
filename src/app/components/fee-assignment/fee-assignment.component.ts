import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { AcademicSession } from '../../interfaces/academic-session';
import { FeeAssignmentRequest, FeeAssignmentRow, FeeAssignmentStatus, FeeAssignmentSummary, FeeConfigType, FeeGenerationResult, FeeStudentPreview, FeeWorkflowChangeResult, FeeWorkflowSettings } from '../../interfaces/fee-workflow';
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
  readonly statuses: FeeAssignmentStatus[] = ['NOT_ASSIGNED','READY','GENERATED','PARTIALLY_GENERATED','EXCLUDED','GENERATION_FAILED'];

  constructor(private workflow: FeeWorkflowService, private sessionsApi: AcademicSessionService, private feeHeadsApi: FeeHeadService, private toast: ToastService) {}
  ngOnInit(): void {
    forkJoin({ settings: this.workflow.getSettings(), sessions: this.sessionsApi.getAllSessions(), feeHeads: this.feeHeadsApi.getActiveFeeHeads() }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ settings, sessions, feeHeads }) => { this.settings = settings; this.sessions = sessions; this.feeHeads = feeHeads; this.session = sessions.find(s => s.current)?.label || sessions[0]?.label || ''; this.selectRemainingMonths(); this.reload(); },
      error: () => { this.loading = false; this.toast.error('Unable to load', 'Fee workflow settings could not be loaded.'); }
    });
  }
  reload(): void {
    if (!this.session) { this.loading = false; return; } this.loading = true; this.selected.clear(); this.previewRows = []; this.results = [];
    forkJoin({ rows: this.workflow.getAssignments(this.session, this.classFilter || undefined, this.statusFilter || undefined), summary: this.workflow.getSummary(this.session) })
      .pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.rows = x.rows; this.summary = x.summary; this.loading = false; }, error: () => { this.loading = false; this.toast.error('Unable to load', 'Student fee assignments could not be loaded.'); } });
  }
  saveSettings(): void { if (!this.settings) return; this.working = true; this.workflow.updateSettings(this.settings).pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.settings = x; this.working = false; this.toast.success('Fee settings saved'); }, error: e => { this.working = false; this.toast.error('Could not save', e.error?.error || 'Please check the settings.'); } }); }
  toggleStudent(id: string): void { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); }
  toggleAll(): void { this.selected.size === this.rows.length ? this.selected.clear() : this.rows.forEach(r => this.selected.add(r.studentId)); }
  toggleMonth(month: number): void { this.selectedMonths.has(month) ? this.selectedMonths.delete(month) : this.selectedMonths.add(month); }
  selectRemainingMonths(): void { const selectedSession = this.sessions.find(value => value.label === this.session); const startMonth = selectedSession ? new Date(`${selectedSession.startDate}T00:00:00`).getMonth() + 1 : 4; const now = new Date(); const academic = ((now.getMonth() + 1 - startMonth + 12) % 12) + 1; this.selectedMonths = new Set(this.months.filter(m => m >= academic)); }
  private request(): FeeAssignmentRequest | null {
    if (!this.selected.size || !this.selectedMonths.size || !this.effectiveDate) { this.toast.warning('Selection required', 'Select students, months and an effective date.'); return null; }
    return { studentIds: [...this.selected], academicSession: this.session, effectiveDate: this.effectiveDate, months: [...this.selectedMonths].sort((a,b) => a-b), reason: this.reason };
  }
  assign(): void { const req = this.request(); if (!req) return; this.run(() => this.workflow.assign(req), 'Students assigned for fees.'); }
  exclude(): void { const req = this.request(); if (!req || !this.reason.trim()) { this.toast.warning('Reason required', 'Enter a reason before excluding students.'); return; } this.run(() => this.workflow.exclude(req), 'Students excluded from fees.'); }
  preview(): void { const req = this.request(); if (!req) return; this.working = true; this.workflow.preview(req).pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.previewRows = x; this.working = false; }, error: e => { this.working = false; this.toast.error('Preview failed', e.error?.error || 'Unable to calculate fees.'); } }); }
  async generate(): Promise<void> { const req = this.request(); if (!req) return; const ok = await this.toast.confirm({ title: 'Generate fee charges?', message: `Create ${req.months.length} month(s) for ${req.studentIds.length} selected student(s)? Existing months will be skipped.`, icon: 'warning', confirmText: 'Generate', cancelText: 'Cancel' }); if (!ok) return; this.working = true; this.workflow.generate(req).pipe(takeUntil(this.destroy$)).subscribe({ next: x => { this.results = x; this.working = false; this.toast.success('Generation completed', `${x.filter(r => r.successful).length} student(s) processed successfully.`); this.reload(); }, error: e => { this.working = false; this.toast.error('Generation failed', e.error?.error || 'No charges were generated.'); } }); }
  updateTransport(): void { const req = this.request(); if (!req || !this.reason.trim()) { this.toast.warning('Reason required', 'Enter a reason for the transport change.'); return; } if (this.transportEnabled && (!this.transportDistance || this.transportDistance <= 0)) { this.toast.warning('Distance required', 'Enter a positive transport distance.'); return; } this.runChange(() => this.workflow.changeTransport({ studentIds: req.studentIds, academicSession: req.academicSession, enabled: this.transportEnabled, distance: this.transportEnabled ? this.transportDistance : null, effectiveFrom: req.effectiveDate, reason: this.reason }), 'Transport assignment updated.'); }
  applyDiscount(): void {
    const selectedSession = this.sessions.find(value => value.label === this.session);
    if (!this.selected.size || !selectedSession || !this.discountFeeHeadId || !this.effectiveDate || !this.reason.trim()) { this.toast.warning('Discount details required', 'Select students, a fee head, start date and enter a reason.'); return; }
    const needsValue = this.discountType === 'DISCOUNT_PERCENT' || this.discountType === 'DISCOUNT_FIXED' || this.discountType === 'CUSTOM_AMOUNT';
    if (needsValue && (this.discountValue === null || this.discountValue < 0)) { this.toast.warning('Value required', 'Enter a valid discount or custom amount.'); return; }
    const storedValue = needsValue && this.discountValue !== null
      ? (this.discountType === 'DISCOUNT_PERCENT' ? this.discountValue : Math.round(this.discountValue * 100))
      : null;
    this.runChange(() => this.workflow.applyBulkDiscount({ studentIds: [...this.selected], academicSessionId: selectedSession.id, feeHeadId: this.discountFeeHeadId!, configType: this.discountType, value: storedValue, validFrom: this.effectiveDate, validUntil: this.discountUntil || undefined, reason: this.reason }), 'Discount configuration applied.');
  }
  private runChange(action: () => import('rxjs').Observable<FeeWorkflowChangeResult>, message: string): void {
    this.working = true; this.changeResult = undefined;
    action().pipe(takeUntil(this.destroy$)).subscribe({
      next: result => { this.working = false; this.changeResult = result; this.toast.success('Completed', `${message} ${result.recalculatedMonths} month(s) recalculated; ${result.skippedMonths} protected/skipped.`); },
      error: e => { this.working = false; this.toast.error('Action failed', e.error?.error || 'Please review the selection.'); }
    });
  }
  private run(action: () => any, message: string): void { this.working = true; action().pipe(takeUntil(this.destroy$)).subscribe({ next: () => { this.working = false; this.toast.success('Completed', message); this.reload(); }, error: (e: any) => { this.working = false; this.toast.error('Action failed', e.error?.error || 'Please review the selection.'); } }); }
  trackByStudent(_: number, row: FeeAssignmentRow): string { return row.studentId; }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
