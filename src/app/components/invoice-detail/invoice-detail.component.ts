import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { InvoiceService } from '../../services/invoice.service';
import { Invoice } from '../../interfaces/invoice';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  invoice: Invoice | null = null;
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private invoiceService: InvoiceService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('invoiceId'));
    if (id) this.loadInvoice(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoice(id: number): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.invoiceService.getInvoice(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (inv) => {
        this.invoice = inv;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load invoice', e);
        this.toast.error('Error', 'Failed to load invoice.');
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'invd-status-paid';
      case 'ISSUED': return 'invd-status-issued';
      case 'DRAFT': return 'invd-status-draft';
      case 'OVERDUE': return 'invd-status-overdue';
      case 'PARTIALLY_PAID': return 'invd-status-partial';
      default: return '';
    }
  }
}
