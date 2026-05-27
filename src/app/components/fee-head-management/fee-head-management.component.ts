import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FeeHeadService } from '../../services/fee-head.service';
import { FeeHead } from '../../interfaces/fee-head';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-fee-head-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fee-head-management.component.html',
  styleUrl: './fee-head-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeHeadManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  feeHeads: FeeHead[] = [];
  isLoading = false;
  saving = false;
  showForm = false;
  editingId: number | null = null;

  form: FeeHead = this.emptyForm();

  frequencyOptions = [
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
    { value: 'SEMI_ANNUAL', label: 'Semi-Annual' },
    { value: 'ANNUAL', label: 'Annual' },
    { value: 'ONE_TIME', label: 'One-Time' },
  ];

  allMonths = [
    { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
  ];

  selectedMonths: Set<number> = new Set();

  constructor(
    private feeHeadService: FeeHeadService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadFeeHeads();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFeeHeads(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.feeHeadService.getAllFeeHeads().pipe(takeUntil(this.destroy$)).subscribe({
      next: (list) => {
        this.feeHeads = list;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load fee heads', e);
        this.toast.error('Error', 'Failed to load fee heads.');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  openAdd(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.selectedMonths = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);
    this.showForm = true;
    this.cdr.markForCheck();
  }

  openEdit(fh: FeeHead): void {
    this.editingId = fh.id!;
    this.form = { ...fh };
    try {
      this.selectedMonths = new Set(JSON.parse(fh.dueMonths || '[]'));
    } catch {
      this.selectedMonths = new Set();
    }
    this.showForm = true;
    this.cdr.markForCheck();
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.cdr.markForCheck();
  }

  toggleMonth(month: number): void {
    if (this.selectedMonths.has(month)) {
      this.selectedMonths.delete(month);
    } else {
      this.selectedMonths.add(month);
    }
    this.cdr.markForCheck();
  }

  isMonthSelected(month: number): boolean {
    return this.selectedMonths.has(month);
  }

  save(): void {
    if (!this.form.name?.trim() || !this.form.code?.trim()) {
      this.toast.warning('Validation', 'Name and code are required.');
      return;
    }
    this.form.dueMonths = JSON.stringify(Array.from(this.selectedMonths).sort((a,b) => a - b));
    this.saving = true;
    this.cdr.markForCheck();

    const obs = this.editingId
      ? this.feeHeadService.updateFeeHead(this.editingId, this.form)
      : this.feeHeadService.createFeeHead(this.form);

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: (saved) => {
        if (this.editingId) {
          this.feeHeads = this.feeHeads.map(f => f.id === saved.id ? saved : f);
        } else {
          this.feeHeads = [...this.feeHeads, saved];
        }
        this.showForm = false;
        this.editingId = null;
        this.saving = false;
        this.toast.success('Saved', `Fee head "${saved.name}" saved.`);
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to save fee head', e);
        this.toast.error('Error', e?.error?.message || 'Could not save fee head.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  getFrequencyLabel(freq: string): string {
    return this.frequencyOptions.find(f => f.value === freq)?.label ?? freq;
  }

  parseDueMonths(json: string): string {
    try {
      const months: number[] = JSON.parse(json || '[]');
      return months.map(m => this.allMonths[m - 1]?.label).filter(Boolean).join(', ');
    } catch {
      return '';
    }
  }

  private emptyForm(): FeeHead {
    return {
      name: '', code: '', frequency: 'MONTHLY', dueMonths: '[1,2,3,4,5,6,7,8,9,10,11,12]',
      optional: false, refundable: false, siblingDiscountPct: 0, displayOrder: 0, active: true,
    };
  }
}
