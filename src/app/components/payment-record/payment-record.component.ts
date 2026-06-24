import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { InvoiceService } from '../../services/invoice.service';
import { FeePaymentService } from '../../services/fee-payment.service';
import { Invoice } from '../../interfaces/invoice';
import { RecordPaymentRequest } from '../../interfaces/fee-payment';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-payment-record',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-record.component.html',
  styleUrl: './payment-record.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentRecordComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  studentId = '';
  outstanding: Invoice[] = [];
  loadingInvoices = false;
  saving = false;

  paymentMode = 'MANUAL_CASH';
  referenceNumber = '';
  notes = '';
  allocations: { invoiceId: number; invoiceNumber: string; amount: number; maxAmount: number }[] = [];

  paymentModes = [
    { value: 'MANUAL_CASH', label: 'Cash' },
    { value: 'MANUAL_CHEQUE', label: 'Cheque' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'UPI', label: 'UPI' },
  ];

  constructor(
    private invoiceService: InvoiceService,
    private feePaymentService: FeePaymentService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchStudent(): void {
    if (!this.studentId.trim()) return;
    this.loadingInvoices = true;
    this.cdr.markForCheck();
    this.invoiceService.getOutstandingInvoices(this.studentId.trim()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (invoices) => {
        this.outstanding = invoices;
        this.allocations = invoices.map(inv => ({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.balanceDue,
          maxAmount: inv.balanceDue,
        }));
        this.loadingInvoices = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load outstanding invoices', e);
        this.toast.error('Error', 'Could not load outstanding invoices.');
        this.loadingInvoices = false;
        this.cdr.markForCheck();
      }
    });
  }

  get totalAmount(): number {
    return this.allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  }

  fillMaxAllocations(): void {
    this.allocations?.forEach((a: any) => a.amount = a.maxAmount);
    this.cdr.markForCheck();
  }

  recordPayment(): void {
    // Validate no allocation is negative
    if (this.allocations?.some((a: any) => a.amount < 0)) {
      this.toast.error('Invalid Amount', 'Allocation amounts cannot be negative.');
      return;
    }
    // Validate no allocation exceeds max
    const overAllocated = this.allocations?.filter((a: any) => a.amount > a.maxAmount);
    if (overAllocated && overAllocated.length > 0) {
      this.toast.error('Validation Error', 'One or more allocations exceed the outstanding balance.');
      return;
    }
    const filtered = this.allocations.filter(a => a.amount > 0);
    if (filtered.length === 0) {
      this.toast.warning('Required', 'Enter at least one allocation amount.');
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();

    const req: RecordPaymentRequest = {
      studentId: this.studentId.trim(),
      amount: this.totalAmount,
      paymentMode: this.paymentMode,
      invoiceAllocations: filtered.map(a => ({ invoiceId: a.invoiceId, amount: a.amount })),
      referenceNumber: this.referenceNumber || undefined,
      notes: this.notes || undefined,
    };

    this.feePaymentService.recordPayment(req).pipe(takeUntil(this.destroy$)).subscribe({
      next: (payment) => {
        this.toast.success('Recorded', `Payment of ${payment.amount} recorded.`);
        this.saving = false;
        this.searchStudent(); // Refresh outstanding
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to record payment', e);
        this.toast.error('Error', e?.error?.message || 'Could not record payment.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }
}
