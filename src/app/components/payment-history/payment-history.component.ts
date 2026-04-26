import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PaymentHistory } from '../../interfaces/payment-history';
import { PaginatedResponse, PaymentHistoryService } from '../../services/payment-history.service'; // Import PaginatedResponse
import { AuthStateService } from '../../auth/auth-state.service';
import { saveAs } from 'file-saver';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { ComingSoonComponent } from '../coming-soon/coming-soon.component';
import { MODULE_MESSAGES } from '../../config/module-messages.config';
import { Subject, takeUntil } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-payment-history',
  templateUrl: './payment-history.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ComingSoonComponent,
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule
  ],
  styleUrls: ['./payment-history.component.css'],
})
export class PaymentHistoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  comingSoonConfig = MODULE_MESSAGES.paymentHistory;
  showFeesModule: boolean = false;
  paymentHistory: PaymentHistory[] = [];
  loading: boolean = true;
  error: string = '';
  role: string = '';
  studentId: string = '';

  currentPage: number = 0;
  pageSize: number = 10;
  totalPages: number = 0;
  totalElements: number = 0;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router,
    private paymentHistoryService: PaymentHistoryService,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    if (user) {
      this.role = user.role;

      if (this.role === 'STUDENT') {
        this.studentId = user.userId;
        this.fetchPaymentHistory();
      } else {
        this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
          const routeStudentId = params['studentId'];
          if (routeStudentId) {
            this.studentId = routeStudentId;
            this.fetchPaymentHistory();
          } else {
            this.error = 'Student ID not provided to view payment history.';
            this.loading = false;
          }
        });
      }
    } else {
      this.error = 'Authentication token not found. Please log in.';
      this.loading = false;
      this.router.navigate(['/login']);
    }
  }

  fetchPaymentHistory(): void {
    if (!this.studentId) {
      this.error = 'Student ID is required to fetch payment history.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = '';

    this.paymentHistoryService.getPaymentHistoryForStudent(
      this.studentId,
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (response: PaginatedResponse<PaymentHistory>) => {
        this.paymentHistory = response.content;
        this.totalElements = response.totalElements;
        this.totalPages = response.totalPages;
        this.currentPage = response.number;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Failed to fetch payment history. Please try again.';
        this.logger.error('Error fetching payment history:', err);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.fetchPaymentHistory();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.fetchPaymentHistory();
    }
  }

  previousPage(): void {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.fetchPaymentHistory();
    }
  }

  viewPaymentDetails(paymentId: string): void {
    this.router.navigate(['dashboard/payment-history-details', paymentId]);
  }

  trackByPaymentId(index: number, payment: PaymentHistory): string { return payment.paymentId; }

  downloadPaymentReceipt(paymentId: string): void {
    if (Capacitor.isNativePlatform()) {
      Swal.fire({ icon: 'info', title: 'Not Available', text: 'Downloading receipts is not supported on the mobile app. Please use the web version.' });
      return;
    }
    this.loading = true;
    this.error = '';
    this.paymentHistoryService.downloadPaymentReceipt(paymentId).subscribe({
      next: (data: Blob) => {
        let filename = `receipt_${paymentId}.pdf`;
        saveAs(data, filename);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Failed to download payment receipt.';
        this.logger.error('Error downloading payment receipt:', err);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}