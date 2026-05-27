import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { FeeHeadService } from '../../services/fee-head.service';
import { FeeRuleService } from '../../services/fee-rule.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { SchoolService } from '../../services/school.service';
import { FeeHead } from '../../interfaces/fee-head';
import { FeeStructureRule } from '../../interfaces/fee-rule';
import { AcademicSession } from '../../interfaces/academic-session';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-fee-rule-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fee-rule-config.component.html',
  styleUrl: './fee-rule-config.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeRuleConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  sessions: AcademicSession[] = [];
  classes: string[] = [];
  feeHeads: FeeHead[] = [];
  selectedSessionId: number | null = null;
  selectedClass = '';
  rules: FeeStructureRule[] = [];

  isLoading = false;
  rulesLoading = false;
  saving = false;
  editing = false;

  constructor(
    private feeHeadService: FeeHeadService,
    private feeRuleService: FeeRuleService,
    private sessionService: AcademicSessionService,
    private schoolService: SchoolService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
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
        if (current) this.selectedSessionId = current.id;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load config data', e);
        this.toast.error('Error', 'Failed to load data.');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChange(): void {
    if (this.selectedSessionId && this.selectedClass) {
      this.loadRules();
    }
  }

  loadRules(): void {
    if (!this.selectedSessionId || !this.selectedClass) return;
    this.rulesLoading = true;
    this.editing = false;
    this.cdr.markForCheck();
    this.feeRuleService.getRulesBySessionAndClass(this.selectedSessionId, this.selectedClass)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (rules) => {
          // Ensure one rule per fee head
          this.rules = this.feeHeads.map(fh => {
            const existing = rules.find(r => r.feeHeadId === fh.id);
            return existing ?? {
              feeHeadId: fh.id!,
              feeHeadName: fh.name,
              feeHeadCode: fh.code,
              academicSessionId: this.selectedSessionId!,
              className: this.selectedClass,
              amount: 0,
              effectiveFrom: new Date().toISOString().split('T')[0],
            };
          });
          this.rulesLoading = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Failed to load rules', e);
          this.toast.error('Error', 'Failed to load fee rules.');
          this.rulesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  startEditing(): void {
    this.editing = true;
    this.cdr.markForCheck();
  }

  cancelEditing(): void {
    this.editing = false;
    this.loadRules();
  }

  saveRules(): void {
    if (!this.selectedSessionId || !this.selectedClass) return;
    this.saving = true;
    this.cdr.markForCheck();
    this.feeRuleService.saveRulesForClass(this.selectedSessionId, this.selectedClass, this.rules)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (saved) => {
          this.rules = saved;
          this.editing = false;
          this.saving = false;
          this.toast.success('Saved', 'Fee rules saved.');
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Failed to save rules', e);
          this.toast.error('Error', 'Could not save fee rules.');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  formatAmount(paise: number): string {
    return (paise / 100).toFixed(2);
  }

  getFeeHeadName(feeHeadId: number): string {
    return this.feeHeads.find(f => f.id === feeHeadId)?.name ?? '';
  }

  totalForClass(): number {
    return this.rules.reduce((sum, r) => sum + (r.amount || 0), 0);
  }
}
