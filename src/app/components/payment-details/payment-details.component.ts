import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentHistoryService } from '../../services/payment-history.service';
import { PaymentHistoryDetails } from '../../interfaces/payment-response';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { jsPDF } from 'jspdf';
import { ToastService } from '../../services/toast.service';

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
  isGeneratingPdf: boolean = false;
  error: string = '';
  months: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paymentHistoryService: PaymentHistoryService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
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

  async downloadReceipt(): Promise<void> {
    if (!this.paymentDetails || this.isGeneratingPdf) return;
    this.isGeneratingPdf = true;
    this.cdr.markForCheck();

    try {
      const doc = this.buildPdf();
      const fileName = `receipt-${this.paymentDetails.paymentId}.pdf`;

      if (Capacitor.isNativePlatform()) {
        // Android: write to cache dir then share so the native PDF viewer opens it
        const base64 = doc.output('datauristring').split(',')[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: 'Fee Receipt', files: [uri], dialogTitle: 'Open or share your receipt' });
      } else {
        // Web: direct download
        doc.save(fileName);
      }
    } catch (e: any) {
      if (e?.message !== 'Share canceled') {
        this.toast.error('Error', 'Could not generate the receipt PDF.');
        this.logger.error('PDF generation error:', e);
      }
    } finally {
      this.isGeneratingPdf = false;
      this.cdr.markForCheck();
    }
  }

  private buildPdf(): jsPDF {
    const d = this.paymentDetails!;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 18;
    const col2 = W / 2 + 4;
    let y = 0;

    // ── Header ─────────────────────────────────────────────────────────
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FEE RECEIPT', W / 2, 14, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(d.schoolName || 'School', W / 2, 22, { align: 'center' });
    doc.text(new Date(d.paymentDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), W / 2, 29, { align: 'center' });

    // Status badge
    const statusText = d.status.toUpperCase();
    doc.setFillColor(d.status === 'success' ? 22 : 180, d.status === 'success' ? 101 : 50, d.status === 'success' ? 52 : 50);
    doc.roundedRect(W - margin - 28, 6, 28, 9, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(statusText, W - margin - 14, 12, { align: 'center' });

    y = 44;

    // ── Student Info ────────────────────────────────────────────────────
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('STUDENT DETAILS', margin, y);
    y += 4;
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.4);
    doc.line(margin, y, W - margin, y);
    y += 5;

    const infoRows: [string, string, string, string][] = [
      ['Student Name', d.studentName, 'Student ID', d.studentId],
      ['Class',        d.className,   'Session',    d.session],
      ['Months Paid',  this.months.join(', ') || '—', '', ''],
    ];

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    for (const [l1, v1, l2, v2] of infoRows) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(l1, margin, y);
      if (l2) doc.text(l2, col2, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(26, 26, 46);
      doc.setFontSize(9);
      doc.text(v1, margin, y);
      if (v2) doc.text(v2, col2, y);
      y += 6;
    }

    y += 2;

    // ── Fee Breakdown ───────────────────────────────────────────────────
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FEE BREAKDOWN', margin, y);
    y += 4;
    doc.setDrawColor(30, 58, 95);
    doc.line(margin, y, W - margin, y);
    y += 5;

    const lines = this.feeLines();
    for (let i = 0; i < lines.length; i++) {
      if (i % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 3.5, W - margin * 2, 7, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(lines[i].label, margin + 2, y + 0.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 46);
      doc.text(`Rs. ${lines[i].amount.toFixed(2)}`, W - margin - 2, y + 0.5, { align: 'right' });
      y += 7;
    }

    // Totals
    y += 2;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Charged', margin + 2, y);
    doc.text(`Rs. ${d.amount.toFixed(2)}`, W - margin - 2, y, { align: 'right' });
    y += 7;

    doc.setFillColor(30, 58, 95);
    doc.roundedRect(margin, y - 4, W - margin * 2, 9, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Amount Paid', margin + 4, y + 2);
    doc.text(`Rs. ${d.amountPaid.toFixed(2)}`, W - margin - 4, y + 2, { align: 'right' });
    y += 14;

    // ── Transaction Info ────────────────────────────────────────────────
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TRANSACTION INFO', margin, y);
    y += 4;
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.4);
    doc.line(margin, y, W - margin, y);
    y += 5;

    const txnRows: [string, string][] = [
      ['Payment ID', d.paymentId],
      ['Order ID',   d.orderId],
      ['Date & Time', new Date(d.paymentDate).toLocaleString('en-IN')],
    ];
    for (const [label, value] of txnRows) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(26, 26, 46);
      doc.text(value, W - margin - 2, y, { align: 'right' });
      y += 7;
    }

    // ── Footer ──────────────────────────────────────────────────────────
    y += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated receipt. No signature required.', W / 2, y, { align: 'center' });
    y += 4;
    doc.text('Generated by Edunexify', W / 2, y, { align: 'center' });

    return doc;
  }

  async shareReceipt(): Promise<void> {
    if (!this.paymentDetails) return;
    const d = this.paymentDetails;
    const lines = this.feeLines().map(l => `  ${l.label}: ₹${l.amount.toFixed(2)}`).join('\n');
    const text = `🏫 ${d.schoolName || 'School'} — Fee Receipt\n` +
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
        this.toast.error('Error', 'Could not open share sheet.');
      }
    }
  }
}
