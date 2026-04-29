import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentHistoryService } from '../../services/payment-history.service';
import { PaymentHistoryDetails } from '../../interfaces/payment-response';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { Share } from '@capacitor/share';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-payment-details',
  templateUrl: './payment-details.component.html',
  imports: [CommonModule],
  styleUrls: ['./payment-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  paymentId: string = '';
  paymentDetails: PaymentHistoryDetails | null = null;
  loading: boolean = true;
  error: string = '';
  months: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentHistoryService: PaymentHistoryService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.paymentId = params['paymentId'];
      this.fetchPaymentDetails();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchPaymentDetails(): void {
    this.loading = true;
    this.error = '';
    this.paymentHistoryService.getPaymentHistoryDetails(this.paymentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.paymentDetails = data;
        this.loading = false;
        this.buildMonths();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Failed to fetch payment details.';
        this.logger.error('Error fetching payment details:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  buildMonths(): void {
    const allMonths = ['April','May','June','July','August','September','October','November','December','January','February','March'];
    this.months = [];
    if (this.paymentDetails?.month) {
      for (let i = 0; i < this.paymentDetails.month.length; i++) {
        if (this.paymentDetails.month[i] === '1') {
          this.months.push(allMonths[i]);
        }
      }
    }
  }

  goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  feeLines(): { label: string; amount: number }[] {
    if (!this.paymentDetails) return [];
    const d = this.paymentDetails;
    return [
      { label: 'Tuition Fee',              amount: d.tuitionFee },
      { label: 'Bus Fee',                  amount: d.busFee },
      { label: 'Annual Charges',           amount: d.annualCharges },
      { label: 'Lab Charges',              amount: d.labCharges },
      { label: 'ECA / Project',            amount: d.ecaProject },
      { label: 'Examination Fee',          amount: d.examinationFee },
      { label: 'Unapplied Leave Charges',  amount: d.additionalCharges },
      { label: 'Late Fee',                 amount: d.lateFees },
      { label: 'Platform Fee',             amount: d.platformFee },
    ].filter(l => l.amount > 0);
  }

  async shareReceipt(): Promise<void> {
    if (!this.paymentDetails) return;
    const d = this.paymentDetails;
    const lines = this.feeLines().map(l => `  ${l.label}: ₹${l.amount.toFixed(2)}`).join('\n');
    const text = `🏫 Indra Academy — Fee Receipt\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Student : ${d.studentName} (${d.studentId})\n` +
      `Class   : ${d.className}\n` +
      `Session : ${d.session}\n` +
      `Months  : ${this.months.join(', ') || '—'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total Paid : ₹${d.amountPaid.toFixed(2)}\n` +
      `Date       : ${new Date(d.paymentDate).toLocaleString('en-IN')}\n` +
      `Payment ID : ${d.paymentId}\n` +
      `Status     : ${d.status.toUpperCase()}`;

    try {
      await Share.share({ title: 'Fee Receipt', text, dialogTitle: 'Share Fee Receipt' });
    } catch (e: any) {
      if (e?.message !== 'Share canceled') {
        Swal.fire('Error', 'Could not open share sheet.', 'error');
      }
    }
  }
}
