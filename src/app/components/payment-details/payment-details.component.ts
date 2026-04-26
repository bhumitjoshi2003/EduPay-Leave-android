import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { ActivatedRoute } from '@angular/router';
import { PaymentHistoryService } from '../../services/payment-history.service';
import { PaymentHistoryDetails } from '../../interfaces/payment-response';
import { CommonModule } from '@angular/common';
import saveAs from 'file-saver';
import { Subject, takeUntil } from 'rxjs';
import { Capacitor } from '@capacitor/core';
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

  constructor(private route: ActivatedRoute, private paymentHistoryService: PaymentHistoryService, private logger: LoggerService, private cdr: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.paymentId = params['paymentId'];
      this.fetchPaymentDetails();
    });
  }

  fetchPaymentDetails(): void {
    this.loading = true;
    this.error = '';

    this.paymentHistoryService.getPaymentHistoryDetails(this.paymentId).subscribe({
      next: (data) => {
        this.paymentDetails = data;
        this.loading = false;
        this.getMonths();
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

  getMonths(): void {
    if (this.paymentDetails && this.paymentDetails.month) {
      const monthString = this.paymentDetails.month;
      const allMonths = [
        'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 
      ];
      this.months = [];
      for (let i = 0; i < monthString.length; i++) {
        if (monthString[i] === '1') {
          this.months.push(allMonths[i]);
        }
      }
    } else {
      this.months = [];
    }
  }

  downloadReceipt(paymentId: string): void {
    if (Capacitor.isNativePlatform()) {
      Swal.fire({ icon: 'info', title: 'Not Available', text: 'Downloading receipts is not supported on the mobile app. Please use the web version.' });
      return;
    }
    this.loading = true;
    this.error = '';
    this.paymentHistoryService.downloadPaymentReceipt(paymentId).subscribe({
      next: (data: Blob) => {
        const filename = `receipt_${paymentId}.pdf`;
        saveAs(data, filename);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Failed to download receipt.';
        this.logger.error('Download error:', err);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}