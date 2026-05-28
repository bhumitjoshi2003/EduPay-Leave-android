import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin, Observable } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import { FeeHeadService } from '../../services/fee-head.service';
import { FeeRuleService } from '../../services/fee-rule.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { SchoolService } from '../../services/school.service';
import { FeeHead } from '../../interfaces/fee-head';
import { FeeStructureRule } from '../../interfaces/fee-rule';
import { AcademicSession } from '../../interfaces/academic-session';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fee-structure.component.html',
  styleUrls: ['./fee-structure.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeStructureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  sessions: AcademicSession[] = [];
  currentSession: AcademicSession | null = null;
  feeHeads: FeeHead[] = [];
  classes: string[] = [];

  // Grid: feeGrid[className][feeHeadId] = amount in rupees
  feeGrid: { [className: string]: { [feeHeadId: number]: number } } = {};
  originalGrid: { [className: string]: { [feeHeadId: number]: number } } = {};

  isEditing = false;
  isLoading = true;
  rulesLoading = false;

  // Fee head management
  showFeeHeadForm = false;
  newFeeHead: Partial<FeeHead> = this.defaultFeeHead();

  constructor(
    private feeHeadService: FeeHeadService,
    private feeRuleService: FeeRuleService,
    private sessionService: AcademicSessionService,
    private schoolService: SchoolService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.isLoading = true;
    forkJoin({
      sessions: this.sessionService.getAllSessions(),
      classes: this.schoolService.getClasses(),
      feeHeads: this.feeHeadService.getActiveFeeHeads(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ sessions, classes, feeHeads }) => {
        this.sessions = sessions;
        this.classes = classes;
        this.feeHeads = feeHeads;
        const current = sessions.find(s => s.current);
        if (current) {
          this.currentSession = current;
          this.loadRules();
        } else if (sessions.length > 0) {
          this.currentSession = sessions[0];
          this.loadRules();
        } else {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load data.');
      }
    });
  }

  loadRules(): void {
    if (!this.currentSession) return;
    this.rulesLoading = true;
    this.isLoading = false;
    this.cdr.markForCheck();

    this.feeRuleService.getRulesBySession(this.currentSession.id)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (rules) => {
          this.buildGrid(rules);
          this.originalGrid = JSON.parse(JSON.stringify(this.feeGrid));
          this.rulesLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.rulesLoading = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load fee rules.');
        }
      });
  }

  private buildGrid(rules: FeeStructureRule[]): void {
    this.feeGrid = {};
    for (const cls of this.classes) {
      this.feeGrid[cls] = {};
      for (const fh of this.feeHeads) {
        this.feeGrid[cls][fh.id!] = 0;
      }
    }
    // Fill in existing rule amounts (convert paise → rupees)
    for (const rule of rules) {
      if (this.feeGrid[rule.className]) {
        this.feeGrid[rule.className][rule.feeHeadId] = rule.amount / 100;
      }
    }
  }

  changeSession(session: AcademicSession): void {
    if (this.isEditing) {
      this.toast.confirm({
        title: 'Confirm Navigation',
        message: 'Unsaved changes will be lost. Do you want to continue?',
        confirmText: 'Yes, continue!',
        cancelText: 'No, stay here',
      }).then((confirmed) => {
        if (confirmed) {
          this.currentSession = session;
          this.isEditing = false;
          this.loadRules();
        }
      });
    } else {
      this.currentSession = session;
      this.isEditing = false;
      this.loadRules();
    }
  }

  edit(): void {
    this.isEditing = true;
    this.cdr.markForCheck();
  }

  save(): void {
    if (!this.currentSession) return;
    this.toast.confirm({
      title: 'Save Changes?',
      message: 'Do you want to save the fee structure changes?',
      confirmText: 'Save',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;

      this.isEditing = false;
      this.cdr.markForCheck();

      const sessionId = this.currentSession!.id;
      const today = new Date().toISOString().split('T')[0];

      // Build save calls per class
      const saveCalls: { [cls: string]: Observable<FeeStructureRule[]> } = {};
      for (const cls of this.classes) {
        const rules: FeeStructureRule[] = this.feeHeads
          .filter(fh => (this.feeGrid[cls]?.[fh.id!] ?? 0) > 0)
          .map(fh => ({
            feeHeadId: fh.id!,
            academicSessionId: sessionId,
            className: cls,
            amount: Math.round((this.feeGrid[cls][fh.id!] || 0) * 100), // rupees → paise
            effectiveFrom: today,
          }));
        if (rules.length > 0) {
          saveCalls[cls] = this.feeRuleService.saveRulesForClass(sessionId, cls, rules);
        }
      }

      if (Object.keys(saveCalls).length === 0) {
        this.originalGrid = JSON.parse(JSON.stringify(this.feeGrid));
        this.toast.success('Saved', 'Fee structure saved (no amounts set).');
        return;
      }

      forkJoin(saveCalls).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.originalGrid = JSON.parse(JSON.stringify(this.feeGrid));
          this.toast.success('Saved', `Fee structure for ${this.currentSession!.label} saved.`);
        },
        error: (err) => {
          this.isEditing = true;
          this.cdr.markForCheck();
          this.logger.error('Error saving fee structure:', err);
          this.toast.error('Error', 'Failed to save. Please try again.');
        }
      });
    });
  }

  cancel(): void {
    this.toast.confirm({
      title: 'Cancel Editing?',
      message: 'Are you sure you want to discard your changes?',
      confirmText: 'Yes, discard',
      cancelText: 'No, keep editing',
      danger: true,
    }).then((confirmed) => {
      if (confirmed) {
        this.isEditing = false;
        this.feeGrid = JSON.parse(JSON.stringify(this.originalGrid));
        this.cdr.markForCheck();
        this.toast.info('Cancelled', 'Changes discarded.');
      }
    });
  }

  // ── Fee Head Management ──────────────────────────────────────────
  editingFeeHeadId: number | null = null;
  editFeeHeadForm: Partial<FeeHead> = {};

  toggleFeeHeadForm(): void {
    this.showFeeHeadForm = !this.showFeeHeadForm;
    if (this.showFeeHeadForm) {
      this.newFeeHead = this.defaultFeeHead();
    }
    this.cdr.markForCheck();
  }

  addFeeHead(): void {
    const fh = this.newFeeHead as FeeHead;
    if (!fh.name?.trim() || !fh.code?.trim()) {
      this.toast.warning('Validation', 'Name and code are required.');
      return;
    }
    fh.code = fh.code.toUpperCase().replace(/\s+/g, '_');
    this.feeHeadService.createFeeHead(fh).pipe(takeUntil(this.destroy$)).subscribe({
      next: (created) => {
        this.feeHeads.push(created);
        for (const cls of this.classes) {
          if (this.feeGrid[cls]) this.feeGrid[cls][created.id!] = 0;
          if (this.originalGrid[cls]) this.originalGrid[cls][created.id!] = 0;
        }
        this.showFeeHeadForm = false;
        this.newFeeHead = this.defaultFeeHead();
        this.cdr.markForCheck();
        this.toast.success('Created', `Fee head "${created.name}" added.`);
      },
      error: (err) => {
        this.logger.error('Error creating fee head:', err);
        this.toast.error('Error', 'Failed to create fee head. Code may already exist.');
      }
    });
  }

  startEditFeeHead(fh: FeeHead): void {
    this.editingFeeHeadId = fh.id!;
    this.editFeeHeadForm = { ...fh };
    this.cdr.markForCheck();
  }

  cancelEditFeeHead(): void {
    this.editingFeeHeadId = null;
    this.editFeeHeadForm = {};
    this.cdr.markForCheck();
  }

  saveEditFeeHead(): void {
    const form = this.editFeeHeadForm as FeeHead;
    if (!form.name?.trim()) {
      this.toast.warning('Validation', 'Name is required.');
      return;
    }
    this.feeHeadService.updateFeeHead(this.editingFeeHeadId!, form)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (updated) => {
          const idx = this.feeHeads.findIndex(fh => fh.id === updated.id);
          if (idx >= 0) this.feeHeads[idx] = updated;
          this.editingFeeHeadId = null;
          this.editFeeHeadForm = {};
          this.cdr.markForCheck();
          this.toast.success('Updated', `Fee head "${updated.name}" updated.`);
        },
        error: (err) => {
          this.logger.error('Error updating fee head:', err);
          this.toast.error('Error', 'Failed to update fee head.');
        }
      });
  }

  async deleteFeeHead(fh: FeeHead): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: `Delete "${fh.name}"?`,
      message: 'This will remove the fee head. If it is referenced by existing fee rules, it will be deactivated instead of deleted.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
      icon: 'danger',
    });
    if (!confirmed) return;

    this.feeHeadService.deleteFeeHead(fh.id!).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.feeHeads = this.feeHeads.filter(h => h.id !== fh.id);
        this.cdr.markForCheck();
        this.toast.success('Deleted', `Fee head "${fh.name}" removed.`);
      },
      error: (err) => {
        this.logger.error('Error deleting fee head:', err);
        this.toast.error('Error', 'Failed to delete fee head.');
      }
    });
  }

  frequencyLabel(freq: string): string {
    const labels: Record<string, string> = {
      MONTHLY: 'Monthly', QUARTERLY: 'Quarterly',
      SEMI_ANNUAL: 'Semi-Annual', ANNUAL: 'Annual', ONE_TIME: 'One-Time',
    };
    return labels[freq] ?? freq;
  }

  dueMonthsForFrequency(frequency: string): string {
    switch (frequency) {
      case 'MONTHLY':     return '[1,2,3,4,5,6,7,8,9,10,11,12]';
      case 'QUARTERLY':   return '[1,4,7,10]';
      case 'SEMI_ANNUAL': return '[1,7]';
      case 'ANNUAL':      return '[1]';
      case 'ONE_TIME':    return '[1]';
      default:            return '[1,2,3,4,5,6,7,8,9,10,11,12]';
    }
  }

  onNewFeeHeadFrequencyChange(frequency: string): void {
    this.newFeeHead.frequency = frequency;
    this.newFeeHead.dueMonths = this.dueMonthsForFrequency(frequency);
  }

  onEditFeeHeadFrequencyChange(frequency: string): void {
    this.editFeeHeadForm.frequency = frequency;
    this.editFeeHeadForm.dueMonths = this.dueMonthsForFrequency(frequency);
  }

  private defaultFeeHead(): Partial<FeeHead> {
    return {
      name: '',
      code: '',
      frequency: 'MONTHLY',
      dueMonths: '[1,2,3,4,5,6,7,8,9,10,11,12]',
      optional: false,
      refundable: false,
      displayOrder: this.feeHeads?.length ?? 0,
      active: true,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────
  canEdit(): boolean {
    return this.authStateService.getUserRole() === 'ADMIN';
  }

  getGridValue(cls: string, feeHeadId: number): number {
    return this.feeGrid[cls]?.[feeHeadId] ?? 0;
  }

  hasData(): boolean {
    return this.sessions.length > 0 && this.currentSession !== null;
  }

  trackBySession(_index: number, session: AcademicSession): number { return session.id; }
  trackByIndex(index: number): number { return index; }
  trackByFeeHead(_index: number, fh: FeeHead): number { return fh.id!; }
}
