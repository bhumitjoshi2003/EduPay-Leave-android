import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { InvoiceService } from '../../services/invoice.service';
import { Invoice, StudentFeeOverview } from '../../interfaces/invoice';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-student-fee-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './student-fee-overview.component.html',
  styleUrl: './student-fee-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentFeeOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  overview: StudentFeeOverview | null = null;
  isLoading = false;
  studentId = '';
  isAdmin = false;

  constructor(
    private route: ActivatedRoute,
    private invoiceService: InvoiceService,
    private authState: AuthStateService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const role = this.authState.getUserRole();
    this.isAdmin = role === 'ADMIN';
    this.studentId = this.route.snapshot.paramMap.get('studentId') || this.authState.getUserId();
    this.loadOverview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOverview(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.invoiceService.getStudentFeeOverview(this.studentId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.overview = data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load fee overview', e);
        this.toast.error('Error', 'Failed to load fee overview.');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'sfo-paid';
      case 'ISSUED': return 'sfo-issued';
      case 'OVERDUE': return 'sfo-overdue';
      case 'PARTIALLY_PAID': return 'sfo-partial';
      default: return 'sfo-draft';
    }
  }
}
