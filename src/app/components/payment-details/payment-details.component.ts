import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentHistoryService } from '../../services/payment-history.service';
import { PaymentHistoryDetails } from '../../interfaces/payment-response';
import { CommonModule } from '@angular/common';
import { Subject, take, takeUntil, catchError, of, firstValueFrom } from 'rxjs';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { FeesCalculationService } from '../../services/fees-calculation.service';
import { ParentChildContextComponent } from '../parent-child-context/parent-child-context.component';
import { ChildAccess } from '../../interfaces/parent-portal';

export interface ReceiptFeeLine {
  name: string;
  amount: number;
}

@Component({
  selector: 'app-payment-details',
  templateUrl: './payment-details.component.html',
  imports: [CommonModule, ParentChildContextComponent],
  styleUrls: ['./payment-details.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentDetailsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  paymentId: string = '';
  paymentDetails: PaymentHistoryDetails | null = null;
  loading: boolean = true;
  isGeneratingPdf: boolean = false;
  error: string = '';
  months: string[] = [];
  /** Built from the backend's authoritative per-fee-head payment breakdown — never from the
   * deprecated fixed buckets (tuitionFee/annualCharges/labCharges/ecaProject/examinationFee)
   * on PaymentHistoryDetails, which are display-legacy only now. */
  feeLineItems: ReceiptFeeLine[] = [];
  breakdownUnavailable: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentHistoryService: PaymentHistoryService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private feesCalc: FeesCalculationService,
  ) {}

  ngOnInit(): void {
    // Settings and payment details load independently — re-run getMonths() from both
    // completions (it's a no-op if paymentDetails isn't loaded yet) so month names are
    // correct regardless of which finishes first.
    this.schoolService.getSettings().pipe(take(1), takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.feesCalc.setStartMonth(settings.academicYearStartMonth ?? 4);
        this.getMonths();
        this.cdr.markForCheck();
      },
      error: (e) => this.logger.error('Failed to load school settings; month names may default to an April-start school.', e),
    });
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
        this.getMonths();
        this.cdr.markForCheck();
        this.fetchFeeBreakdown();
      },
      error: (err) => {
        this.error = 'Failed to fetch payment details.';
        this.logger.error('Error fetching payment details:', err);
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Builds feeLineItems from the backend's authoritative per-fee-head payment breakdown.
   * Never fabricates a breakdown: falls back to a single trusted-total row when line items
   * aren't available for every covered month, or to nothing (breakdownUnavailable=true, no
   * invented rows) when even the total can't be resolved. */
  private fetchFeeBreakdown(): void {
    this.paymentHistoryService.getPaymentReceiptBreakdown(this.paymentId)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.logger.error('Error fetching payment fee breakdown:', error);
          return of(null);
        })
      )
      .subscribe((breakdown) => {
        if (breakdown?.lineItemBreakdownAvailable) {
          const lines: ReceiptFeeLine[] = [];
          for (const li of breakdown.lineItems) {
            lines.push({ name: li.feeHeadName, amount: li.grossAmount });
            if (li.discountAmount) {
              lines.push({ name: `${li.feeHeadName} Discount`, amount: -li.discountAmount });
            }
          }
          this.feeLineItems = lines;
          this.breakdownUnavailable = false;
        } else if (breakdown?.totalSchoolFeeDue != null) {
          this.feeLineItems = [{ name: 'School Fee (breakdown unavailable)', amount: breakdown.totalSchoolFeeDue }];
          this.breakdownUnavailable = true;
        } else {
          this.feeLineItems = [];
          this.breakdownUnavailable = true;
        }
        this.cdr.markForCheck();
      });
  }

  /** monthString bit position i corresponds to academic month i+1 (1 = the school's own
   * start month) — resolved via FeesCalculationService.getMonthName using the school's real
   * academicYearStartMonth, never a hardcoded April-first array. */
  getMonths(): void {
    if (this.paymentDetails && this.paymentDetails.month) {
      const monthString = this.paymentDetails.month;
      this.months = [];
      for (let i = 0; i < monthString.length; i++) {
        if (monthString[i] === '1') {
          this.months.push(this.feesCalc.getMonthName(i + 1));
        }
      }
    } else {
      this.months = [];
    }
  }

  goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  /** ₹, from the backend's authoritative per-fee-head breakdown (feeLineItems) plus the two
   * remaining live-computed charges (late fee, platform fee) — never the deprecated fixed
   * buckets (tuitionFee/busFee/annualCharges/labCharges/ecaProject/examinationFee) on
   * PaymentHistoryDetails, which no longer reflect the real fee-head composition. */
  feeLines(): { label: string; amount: number }[] {
    if (!this.paymentDetails) return [];
    const d = this.paymentDetails;
    const lines: { label: string; amount: number }[] = this.feeLineItems.map(li => ({ label: li.name, amount: li.amount }));
    if (d.additionalCharges > 0) lines.push({ label: 'Unapplied Leave Charges', amount: d.additionalCharges });
    if (d.lateFees > 0) lines.push({ label: 'Late Fee', amount: d.lateFees });
    if (d.platformFee > 0) lines.push({ label: 'Platform Fee', amount: d.platformFee });
    return lines;
  }

  /** Payment.amount/amountPaid are paise-native on the backend (matching Razorpay's own
   * convention) — see PaymentHistoryDetails' own doc comment. Every other field on the
   * receipt (feeLineItems, lateFees, platformFee, additionalCharges) is already a plain
   * rupee figure and must not be divided again. */
  totalChargedRupees(): number {
    return this.paymentDetails ? this.paymentDetails.amount / 100 : 0;
  }

  amountPaidRupees(): number {
    return this.paymentDetails ? this.paymentDetails.amountPaid / 100 : 0;
  }

  /** Fetches the backend's own canonical receipt PDF (the same document web downloads —
   * includes the school logo and payment-mode label, unlike the earlier client-built PDF
   * here) and hands it to the platform: native share sheet on Android, direct download on
   * web/PWA. Never re-renders the receipt client-side, so this can never drift from what
   * the school office considers the official record. */
  async downloadReceipt(): Promise<void> {
    if (!this.paymentDetails || this.isGeneratingPdf) return;
    this.isGeneratingPdf = true;
    this.cdr.markForCheck();

    try {
      const blob = await firstValueFrom(this.paymentHistoryService.downloadPaymentReceipt(this.paymentId));
      const fileName = `receipt-${this.paymentDetails.paymentId}.pdf`;

      if (Capacitor.isNativePlatform()) {
        // Android: write to cache dir then share so the native PDF viewer opens it
        const base64 = await this.blobToBase64(blob);
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: 'Fee Receipt', files: [uri], dialogTitle: 'Open or share your receipt' });
      } else {
        // Web: direct download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e?.message !== 'Share canceled') {
        this.toast.error('Error', 'Could not download the receipt PDF.');
        this.logger.error('Receipt download error:', e);
      }
    } finally {
      this.isGeneratingPdf = false;
      this.cdr.markForCheck();
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async shareReceipt(): Promise<void> {
    if (!this.paymentDetails) return;
    const d = this.paymentDetails;
    const lines = this.feeLines().map(l => `  ${l.label}: ₹${l.amount.toFixed(2)}`).join('\n')
      || (this.breakdownUnavailable ? '  Detailed breakdown unavailable' : '');
    const text = `🏫 ${d.schoolName || 'School'} — Fee Receipt\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Student : ${d.studentName} (${d.studentId})\n` +
      `Class   : ${d.className}\n` +
      `Session : ${d.session}\n` +
      `Months  : ${this.months.join(', ') || '—'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Total Paid : ₹${this.amountPaidRupees().toFixed(2)}\n` +
      `Date       : ${new Date(d.paymentDate).toLocaleString('en-IN')}\n` +
      `Payment ID : ${d.paymentId}\n` +
      `Status     : ${d.status.toUpperCase()}`;

    try {
      await Share.share({ title: 'Fee Receipt', text, dialogTitle: 'Share Fee Receipt' });
    } catch (e: any) {
      if (e?.message !== 'Share canceled') {
        this.toast.error('Error', 'Could not open share sheet.');
      }
    }
  }

  /** This page shows one specific payment record — there's nothing to "switch" it to for a
   *  different child, so picking another child here takes the parent to that child's payment
   *  history list instead, which is the sensible destination. */
  onChildTabSelected(child: ChildAccess): void {
    this.router.navigate(['/dashboard/payment-history', child.studentId]);
  }
}
