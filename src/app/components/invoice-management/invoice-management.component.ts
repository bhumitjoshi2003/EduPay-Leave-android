import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { InvoiceService } from '../../services/invoice.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { SchoolService } from '../../services/school.service';
import { Invoice, InvoiceGenerationRequest } from '../../interfaces/invoice';
import { AcademicSession } from '../../interfaces/academic-session';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-invoice-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './invoice-management.component.html',
  styleUrl: './invoice-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  sessions: AcademicSession[] = [];
  classes: string[] = [];
  invoices: Invoice[] = [];

  selectedSessionId: number | null = null;
  filterStatus = '';
  filterStudentId = '';

  isLoading = false;
  invoicesLoading = false;
  page = 0;
  totalPages = 0;
  totalElements = 0;
  pageSize = 20;

  // Generate form
  showGenerate = false;
  genSessionId: number | null = null;
  genMonth: number | null = null;
  genClass = '';
  generating = false;
  issuing = false;

  months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
  ];

  statusOptions = ['', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

  constructor(
    private invoiceService: InvoiceService,
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
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ sessions, classes }) => {
        this.sessions = sessions;
        this.classes = classes;
        const current = sessions.find(s => s.current);
        if (current) {
          this.selectedSessionId = current.id;
          this.genSessionId = current.id;
        }
        this.isLoading = false;
        this.loadInvoices();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('Error', 'Failed to load data.');
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(): void {
    if (!this.selectedSessionId) return;
    this.invoicesLoading = true;
    this.cdr.markForCheck();
    this.invoiceService.getInvoices(this.page, this.pageSize, this.filterStudentId || undefined, this.selectedSessionId, this.filterStatus || undefined)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res: any) => {
          this.invoices = res.content ?? [];
          this.totalPages = res.totalPages ?? 0;
          this.totalElements = res.totalElements ?? 0;
          this.invoicesLoading = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Failed to load invoices', e);
          this.invoicesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onFilterChange(): void {
    this.page = 0;
    this.loadInvoices();
  }

  nextPage(): void {
    if (this.page < this.totalPages - 1) { this.page++; this.loadInvoices(); }
  }

  prevPage(): void {
    if (this.page > 0) { this.page--; this.loadInvoices(); }
  }

  toggleGenerate(): void {
    this.showGenerate = !this.showGenerate;
    this.cdr.markForCheck();
  }

  generate(): void {
    if (!this.genSessionId || !this.genMonth) {
      this.toast.warning('Required', 'Select session and month.');
      return;
    }
    this.generating = true;
    this.cdr.markForCheck();
    const req: InvoiceGenerationRequest = {
      academicSessionId: this.genSessionId,
      billingMonth: this.genMonth,
      className: this.genClass || undefined,
    };
    this.invoiceService.generateInvoices(req).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.toast.success('Generated', `${res.generated} invoice(s) generated as DRAFT.`);
        this.generating = false;
        this.showGenerate = false;
        this.loadInvoices();
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to generate invoices', e);
        this.toast.error('Error', e?.error?.message || 'Could not generate invoices.');
        this.generating = false;
        this.cdr.markForCheck();
      }
    });
  }

  issueAll(): void {
    if (!this.selectedSessionId) return;
    this.toast.confirm({
      title: 'Issue all DRAFT invoices?',
      message: 'This will move all DRAFT invoices to ISSUED status. Students will be able to see and pay them.',
      icon: 'info',
      confirmText: 'Issue All',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
      this.issuing = true;
      this.cdr.markForCheck();
      this.invoiceService.issueInvoices(this.selectedSessionId!).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.toast.success('Issued', `${res.issued} invoice(s) issued.`);
          this.issuing = false;
          this.loadInvoices();
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Failed to issue invoices', e);
          this.toast.error('Error', 'Could not issue invoices.');
          this.issuing = false;
          this.cdr.markForCheck();
        }
      });
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID': return 'inv-status-paid';
      case 'ISSUED': return 'inv-status-issued';
      case 'DRAFT': return 'inv-status-draft';
      case 'OVERDUE': return 'inv-status-overdue';
      case 'PARTIALLY_PAID': return 'inv-status-partial';
      default: return '';
    }
  }

  getMonthLabel(month: number): string {
    return this.months.find(m => m.value === month)?.label ?? '';
  }
}
