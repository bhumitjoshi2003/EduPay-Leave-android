import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentComponent } from "../payment/payment.component";
import { ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { FeesService } from '../../services/fees.service';
import { StudentService } from '../../services/student.service';
import { ToastService } from '../../services/toast.service';
import { PaymentData } from '../../interfaces/payment-data';
import { StudentFee } from '../../interfaces/student-fee';
import { CheckoutQuote } from '../../interfaces/checkout-quote';
import { MonthFeeBreakdown } from '../../interfaces/month-fee-breakdown';
import { ManualPaymentRequest } from '../../interfaces/manual-payment-request';
import { AuthStateService } from '../../auth/auth-state.service';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AttendanceService } from '../../services/attendance.service';
import { ComingSoonComponent } from '../coming-soon/coming-soon.component';
import { MODULE_MESSAGES } from '../../config/module-messages.config';
import { FeesCalculationService } from '../../services/fees-calculation.service';
import { FeeBreakdownComponent } from './fee-breakdown.component';
import { LoggerService } from '../../services/logger.service';
import { SchoolService } from '../../services/school.service';
import { take } from 'rxjs/operators';

export interface FeeLineItem {
  name: string;
  amount: number;
}

export interface MonthViewModel extends StudentFee {
  monthNumber: number;
  name: string;
  /** Backend-computed school fee for this month (baseAmountDue, net of any discount). */
  fee: number;
  /** Backend-computed bus fee for this month (busFeeDue). */
  busFee: number;
  selected: boolean;
  /** True when baseAmountDue is null or snapshotStatus isn't COMPUTED — the amount shown is
   * NOT confidently known. Never treated as ₹0; selection is disabled for such months. */
  amountUnavailable: boolean;
}

export interface MonthBreakdownDetails {
  studentId: string;
  studentClass: string;
  studentName: string;
  monthName: string;
  additionalCharges: number;
  /** Aggregate late fee across the current selection — the checkout-quote endpoint only
   * returns a total, not a per-month breakdown, so this reflects the whole selection's
   * late fee even when this receipt panel is showing one particular month's other details. */
  lateFee: number;
  /** Built from the backend's authoritative StudentFeesLineItem breakdown (fee-head name +
   * gross, and a following discount row when that fee head had one) — bus fee arrives as
   * its own entry here too, never shown as a separate hardcoded row. Never computed from
   * baseAmountDue/discountAmount in Angular. */
  feeLineItems: FeeLineItem[];
  /** True when the backend has no per-fee-head breakdown for this month (a historical row
   * generated before line items existed) — the receipt must show "breakdown unavailable"
   * rather than inventing components. feeLineItems may still carry a single trusted-total
   * row in this case; see populateMonthDetails. */
  breakdownUnavailable: boolean;
}

@Component({
  selector: 'app-payment-tracker',
  standalone: true,
  imports: [ComingSoonComponent, FormsModule, CommonModule, PaymentComponent, MatFormFieldModule, MatInputModule, FeeBreakdownComponent],
  templateUrl: './fees.component.html',
  styleUrls: ['./fees.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTrackerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private feesService: FeesService,
    private studentService: StudentService,
    private authService: AuthService,
    private attendanceService: AttendanceService,
    private authStateService: AuthStateService,
    private feesCalc: FeesCalculationService,
    private logger: LoggerService,
    private toast: ToastService,
    private schoolService: SchoolService
  ) { }

  comingSoonConfig = MODULE_MESSAGES.fees;
  showFeesModule: boolean = true;
  unpaidCurrentMonthName: string = '';
  pastUnpaidMonthNames: string[] = [];
  selectedYear: number = new Date().getFullYear();
  months: MonthViewModel[] = [];
  totalAmountToPay: number = 0;
  selectedMonthsByYear: { [year: number]: number[] } = {};
  studentId: string = '';
  className: string = '';
  session: string = '';
  years: string[] = [];
  selectedMonthDetails: MonthBreakdownDetails | null = null;
  lastSelectedMonth: MonthViewModel | null = null;
  studentName: string = '';
  role: string = '';
  manualPaymentAmount: number = 0;
  manualPaymentMode: ManualPaymentRequest['paymentMode'] = 'CASH';
  manualPaymentReference: string = '';
  readonly manualPaymentModes: ManualPaymentRequest['paymentMode'][] = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'OTHER'];
  paidManually: boolean = false;
  amountPaid: number = 0;
  totalUnappliedLeaves: number = 0;
  totalUnappliedLeaveCharge: number = 0;
  lateFees: number = 0;
  isLoadingPayment: boolean = false;
  platformFeeAmount: number = 0;

  currentMonth = new Date().getMonth() + 1;
  academicCurrentMonth: number = 0;
  currentAcademicYear: string = '';
  paymentData!: PaymentData;

  ngOnInit() {
    this.paymentData = this.feesCalc.createEmptyPaymentData();
    this.role = this.authService.getUserRole();
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const studentIdFromParams = params['studentId'];
      if (studentIdFromParams) {
        this.studentId = studentIdFromParams;
      }
    });
    if (this.role === 'STUDENT') this.getStudentId();

    // Load school settings first so academic year calculations use the correct start month
    this.schoolService.getSettings().pipe(take(1), takeUntil(this.destroy$)).subscribe({
      next: (settings) => {
        this.feesCalc.setStartMonth(settings.academicYearStartMonth ?? 4);
        this.initCalendarState();
      },
      error: () => this.initCalendarState()
    });
  }

  private initCalendarState(): void {
    const today = new Date();
    this.academicCurrentMonth = this.feesCalc.getAcademicMonth(this.currentMonth);
    this.currentAcademicYear = this.feesCalc.getAcademicYear(today);
    this.fetchSessions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStudentId(): void {
    this.studentId = this.authStateService.getUserId();
  }

  fetchSessions(): void {
    this.feesService.getDistinctYearsByStudentId(this.studentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.years = sessions;
          if (this.years.length > 0) {
            this.session = this.years[this.years.length - 1];
            this.selectedYear = parseInt(this.session.split('-')[0]);
          }
          this.cdr.markForCheck();
          this.fetchFees();
        },
        error: (error) => {
          this.logger.error('Error fetching sessions:', error);
        }
      });
  }

  onYearChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedYear = parseInt(select.value);
    this.session = `${this.selectedYear}-${this.selectedYear + 1}`;
    this.fetchFees();
  }

  fetchFees(): void {
    this.onPaymentProcessCompleted();

    forkJoin([
      this.feesService.getStudentFees(this.studentId, this.session),
      this.attendanceService.getTotalUnappliedLeaveCount(this.studentId, this.session)
        .pipe(catchError(() => of(0)))
    ]).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: ([fees, totalUnappliedLeaves]) => {
        this.className = fees.length > 0 ? fees[0].className : '';
        this.totalUnappliedLeaves = totalUnappliedLeaves;
        this.totalUnappliedLeaveCharge = totalUnappliedLeaves * 25;
        this.months = fees.map(fee => this.buildMonthViewModel(fee));
        this.checkAndDisplayFeeWarnings();
      },
      error: (error) => {
        this.logger.error('Error fetching fees:', error);
      }
    });
  }

  /** Reads the backend-computed snapshot directly off the fetched StudentFee row — no
   * client-side fee-rule recomputation. A row with no trustworthy snapshot (baseAmountDue
   * null, or snapshotStatus isn't COMPUTED) is flagged amountUnavailable and never silently
   * shown/treated as ₹0. */
  private buildMonthViewModel(fee: StudentFee): MonthViewModel {
    const amountUnavailable = fee.baseAmountDue == null || fee.snapshotStatus !== 'COMPUTED';
    return {
      ...fee,
      monthNumber: fee.month,
      name: this.feesCalc.getMonthName(fee.month),
      selected: this.isMonthSelected(fee.month, this.selectedYear),
      fee: fee.baseAmountDue ?? 0,
      busFee: fee.busFeeDue ?? 0,
      amountUnavailable,
    };
  }

  checkAndDisplayFeeWarnings(): void {
    if (this.role === 'STUDENT') {
      const selectedYear = this.feesCalc.getSessionStartYear(this.session);
      const currentYear = this.feesCalc.getSessionStartYear(this.currentAcademicYear);

      if (selectedYear > currentYear) {
        this.pastUnpaidMonthNames = [];
        this.unpaidCurrentMonthName = '';
        return;
      }

      const currentAcademicMonth = this.feesCalc.getAcademicMonth(new Date().getMonth() + 1);
      const currentMonthFee = this.months.find(month => month.monthNumber === currentAcademicMonth);

      this.unpaidCurrentMonthName = (currentMonthFee && !currentMonthFee.paid)
        ? this.feesCalc.getMonthName(currentMonthFee.monthNumber)
        : '';

      // Any genuinely past unpaid month has a real, positive late fee under the backend's
      // tiering rule (see StudentFeesService.calculateLateFees) — the date check alone
      // already captures this, without needing a client-computed late-fee figure.
      this.pastUnpaidMonthNames = this.months
        .filter(month => !month.paid && month.monthNumber < currentAcademicMonth)
        .map(m => this.feesCalc.getMonthName(m.monthNumber));
    }
    this.cdr.markForCheck();
  }

  isMonthSelected(monthNumber: number, year: number): boolean {
    return this.selectedMonthsByYear[year]?.includes(monthNumber) || false;
  }

  /** Backend-authoritative recompute: whenever the selection changes, fetch the checkout
   * quote for every currently-selected month and use its totals as-is — school fee due,
   * late fee, and platform fee are never computed client-side. Resets to zero when nothing
   * is selected. */
  private recalculateTotals(): void {
    const selectedMonths = this.selectedMonthsByYear[this.selectedYear] || [];
    if (selectedMonths.length === 0) {
      this.totalAmountToPay = 0;
      this.platformFeeAmount = 0;
      this.lateFees = 0;
      this.paymentData.totalAmount = 0;
      this.paymentData.platformFee = 0;
      this.paymentData.lateFees = 0;
      this.cdr.markForCheck();
      return;
    }

    this.feesService.getCheckoutQuote(this.studentId, this.session, selectedMonths)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (quote) => this.applyCheckoutQuote(quote, selectedMonths),
        error: (error) => {
          this.logger.error('Error fetching checkout quote:', error);
          this.toast.error('Error', 'Could not calculate the payment amount. Please try again.');
        }
      });
  }

  private applyCheckoutQuote(quote: CheckoutQuote, selectedMonths: number[]): void {
    if (quote.unresolvedMonths?.length) {
      this.logger.error('Checkout quote has unresolved months:', quote.unresolvedMonths);
      this.toast.error('Error', 'The fee amount for one or more selected months could not be determined. Please contact the school office.');
    }

    this.totalAmountToPay = quote.totalAmount;
    this.platformFeeAmount = quote.platformFee;
    this.lateFees = quote.lateFee;

    let monthSelectionString = '000000000000';
    let totalBusFee = 0;
    selectedMonths.forEach(m => {
      monthSelectionString = monthSelectionString.substring(0, m - 1) + '1' + monthSelectionString.substring(m);
      const monthVm = this.months.find(mm => mm.month === m);
      if (monthVm) totalBusFee += monthVm.busFee || 0;
    });

    this.paymentData = {
      ...this.paymentData,
      monthSelectionString,
      totalAmount: quote.totalAmount,
      // Legacy per-fee-head buckets are display-only on the backend now (see
      // PaymentController.createOrder) — schoolFeeDue is the authoritative figure.
      totalTuitionFee: quote.schoolFeeDue,
      totalAnnualCharges: 0,
      totalLabCharges: 0,
      totalEcaProject: 0,
      totalExaminationFee: 0,
      totalBusFee,
      lateFees: quote.lateFee,
      platformFee: quote.platformFee,
      additionalCharges: this.totalUnappliedLeaveCharge,
      studentId: this.studentId,
      studentName: this.studentName,
      className: this.className,
      session: this.session,
      paidManually: this.paidManually,
      amountPaid: this.paidManually ? this.amountPaid : quote.totalAmount,
    };

    if (this.selectedMonthDetails) {
      this.selectedMonthDetails = { ...this.selectedMonthDetails, lateFee: quote.lateFee };
    }

    this.cdr.markForCheck();
  }

  toggleMonthSelection(month: MonthViewModel): void {
    if (month.paid || this.isLoadingPayment || month.amountUnavailable) return;

    const year = this.selectedYear;
    if (!this.selectedMonthsByYear[year]) {
      this.selectedMonthsByYear[year] = [];
    }

    const index = this.selectedMonthsByYear[year].indexOf(month.month);
    if (index === -1) {
      this.selectedMonthsByYear[year].push(month.month);
      this.cdr.markForCheck();
      this.lastSelectedMonth = month;

      this.populateMonthDetails(month)
        .then(() => this.recalculateTotals())
        .catch((error) => {
          this.logger.error('Error during populateMonthDetails:', error);
        });
    } else {
      this.selectedMonthsByYear[year].splice(index, 1);
      this.cdr.markForCheck();
      this.recalculateTotals();

      if (this.lastSelectedMonth === month) {
        const remaining = this.selectedMonthsByYear[year];
        if (remaining.length > 0) {
          const lastIndex = remaining[remaining.length - 1];
          const lastMonth = this.months.find(m => m.month === lastIndex);
          if (lastMonth) {
            this.populateMonthDetails(lastMonth).then(() => {
              this.lastSelectedMonth = lastMonth;
            });
          } else {
            this.selectedMonthDetails = null;
            this.lastSelectedMonth = null;
          }
        } else {
          this.selectedMonthDetails = null;
          this.lastSelectedMonth = null;
        }
      }
    }
    month.selected = !month.selected;
  }

  /** Builds the receipt-panel line items from the backend's authoritative per-fee-head
   * breakdown. Never fabricates a breakdown for a historical month with no
   * StudentFeesLineItem rows: falls back to the trusted total (schoolFeeDue) alone when
   * available, or to nothing at all when even the total is genuinely unknown — the caller
   * (fee-breakdown.component.html) renders a "breakdown unavailable" placeholder in both of
   * those cases via breakdownUnavailable. */
  private buildFeeLineItems(breakdown: MonthFeeBreakdown | null): { feeLineItems: FeeLineItem[]; breakdownUnavailable: boolean } {
    if (breakdown?.lineItemBreakdownAvailable) {
      const feeLineItems: FeeLineItem[] = [];
      for (const li of breakdown.lineItems) {
        feeLineItems.push({ name: li.feeHeadName, amount: li.grossAmount });
        if (li.discountAmount) {
          feeLineItems.push({ name: `${li.feeHeadName} Discount`, amount: -li.discountAmount });
        }
      }
      return { feeLineItems, breakdownUnavailable: false };
    }
    if (breakdown?.schoolFeeDue != null) {
      return {
        feeLineItems: [{ name: 'School Fee (breakdown unavailable)', amount: breakdown.schoolFeeDue }],
        breakdownUnavailable: true,
      };
    }
    return { feeLineItems: [], breakdownUnavailable: true };
  }

  populateMonthDetails(month: MonthViewModel): Promise<void> {
    return new Promise((resolve) => {
      forkJoin({
        student: this.studentService.getStudent(this.studentId),
        breakdown: this.feesService.getMonthFeeBreakdown(this.studentId, this.session, month.month).pipe(
          catchError((error) => {
            this.logger.error('Error fetching month fee breakdown:', error);
            return of(null);
          })
        ),
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ({ student, breakdown }) => {
            this.studentName = student.name;
            const { feeLineItems, breakdownUnavailable } = this.buildFeeLineItems(breakdown);
            this.selectedMonthDetails = {
              studentId: this.studentId,
              studentClass: student.className,
              studentName: this.studentName,
              monthName: month.name,
              additionalCharges: this.totalUnappliedLeaveCharge,
              // Updated to the real selection-wide aggregate once the checkout quote
              // resolves (applyCheckoutQuote) — this endpoint has no per-month breakdown.
              lateFee: this.lateFees,
              feeLineItems,
              breakdownUnavailable,
            };
            this.cdr.markForCheck();
            resolve();
          },
          error: (error) => {
            this.logger.error('Error populating month details:', error);
            this.selectedMonthDetails = null;
            this.cdr.markForCheck();
            resolve();
          }
        });
    });
  }

  onPaymentProcessingStarted(): void {
    this.ngZone.run(() => { });
  }

  onPaymentProcessCompleted(): void {
    this.ngZone.run(() => {
      this.isLoadingPayment = false;
      this.cdr.detectChanges();
    });
  }

  handleSuccessfulPayment(): void {
    this.ngZone.run(() => {
      this.initPaymentData();
      this.fetchFees();
      this.selectedMonthsByYear = {};
      this.totalAmountToPay = 0;
      this.cdr.detectChanges();

      this.toast.success('Payment Successful!', 'Your payment has been processed successfully.');
      this.onPaymentProcessCompleted();
    });
  }

  initPaymentData(): void {
    this.paymentData = this.feesCalc.createEmptyPaymentData();
    this.totalUnappliedLeaves = 0;
    this.totalUnappliedLeaveCharge = 0;
    this.platformFeeAmount = 0;
  }

  /** Submits only what the admin observed (student, months, amount received, mode,
   * reference) — Spring Boot recomputes the authoritative amount owed from each selected
   * month's StudentFees snapshot and validates amountReceived against it. The frontend never
   * splits the amount across months or decides which months get marked paid itself; a
   * rejection (unresolved month, amount short of the computed total, duplicate reference) is
   * surfaced as-is from the backend. */
  markAsManuallyPaid(): void {
    const selectedMonths = this.selectedMonthsByYear[this.selectedYear] || [];
    if (this.role !== 'ADMIN' || !this.manualPaymentAmount || !selectedMonths.length) {
      this.toast.warning('Warning', 'Please select months and enter the amount received.');
      return;
    }

    this.toast.confirm({
      title: 'Confirm Manual Payment',
      message: `Mark selected months as manually paid with a total amount of ₹${this.manualPaymentAmount}?`,
      icon: 'warning',
      confirmText: 'Yes, mark as paid!',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;

      let monthSelectionString = '000000000000';
      selectedMonths.forEach(m => {
        monthSelectionString = monthSelectionString.substring(0, m - 1) + '1' + monthSelectionString.substring(m);
      });

      const request: ManualPaymentRequest = {
        studentId: this.studentId,
        studentName: this.studentName,
        className: this.className,
        session: this.session,
        monthSelectionString,
        amountReceived: this.manualPaymentAmount,
        paymentMode: this.manualPaymentMode,
        referenceNumber: this.manualPaymentReference?.trim() || undefined,
      };

      this.feesService.recordManualPayment(request).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.initPaymentData();
          this.fetchFees();
          this.selectedMonthsByYear = {};
          this.totalAmountToPay = 0;
          this.manualPaymentAmount = 0;
          this.manualPaymentReference = '';
          this.cdr.detectChanges();
          this.toast.success('Marked as Paid!', 'The selected months have been marked as paid.');
        },
        error: (err) => {
          const message = err?.error?.error || 'Failed to record manual payment.';
          this.toast.error('Error!', message);
        }
      });
    });
  }

  isLate(month: MonthViewModel): boolean {
    const selectedYear = this.feesCalc.getSessionStartYear(this.session);
    const currentYear = this.feesCalc.getSessionStartYear(this.currentAcademicYear);

    if (selectedYear > currentYear) return false;
    if (selectedYear < currentYear) return !month.paid && !month.manuallyPaid;

    return !month.paid && !month.manuallyPaid && month.month <= this.academicCurrentMonth;
  }

  trackByMonth(index: number, month: MonthViewModel): number { return month.month; }
  trackByYear(index: number, year: string): string { return year; }
  trackByIndex(index: number): number { return index; }

  /** Maps the ledger-derived paymentProvenance value to a human-readable chip label. A paid
   * month with no provenance (e.g. a historical row predating the allocation ledger) falls
   * back to the generic "Paid" — never fabricates a specific mode it doesn't actually know. */
  private static readonly PROVENANCE_LABELS: Record<string, string> = {
    CASH: 'Cash',
    CHEQUE: 'Cheque',
    BANK_TRANSFER: 'Bank Transfer',
    UPI: 'UPI',
    OTHER: 'Other',
    RAZORPAY: 'Razorpay',
    MIXED: 'Mixed',
  };

  paymentProvenanceLabel(month: MonthViewModel): string {
    const provenance = month.paymentProvenance;
    if (!provenance) return 'Paid';
    return PaymentTrackerComponent.PROVENANCE_LABELS[provenance] ?? provenance;
  }

  /** The row's authoritative net amount paid, from the ledger-derived StudentFees.amountPaid
   * — the same figure the backend uses to decide `paid` (see StudentFeesService.markFeesAsPaid
   * / PaymentService.recomputeStudentFeesNetState). Never manualPaymentReceived, which is only
   * the manual-sourced slice of a row's funding and would understate a MIXED-funded row or a
   * row that still has net gateway money after a manual portion was refunded. Correctly
   * reflects a partial refund (reduced but still positive) and a full refund (0, at which
   * point the month card falls back to showing the amount due again — the correct "resulting
   * state" for money that's been returned). Never null/undefined for display purposes. */
  netAmountPaid(month: MonthViewModel): number {
    return month.amountPaid ?? 0;
  }
}
