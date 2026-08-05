import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentComponent } from "../payment/payment.component";
import { ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { FeesService } from '../../services/fees.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { FeeRuleService } from '../../services/fee-rule.service';
import { FeeHeadService } from '../../services/fee-head.service';
import { FeeStructureRule } from '../../interfaces/fee-rule';
import { FeeHead } from '../../interfaces/fee-head';
import { AcademicSession } from '../../interfaces/academic-session';
import { StudentService } from '../../services/student.service';
import { Student } from '../../interfaces/student';
import { BusFeesService } from '../../services/bus-fees.service';
import { ToastService } from '../../services/toast.service';
import { PaymentData } from '../../interfaces/payment-data';
import { StudentFee } from '../../interfaces/student-fee';
import { AuthStateService } from '../../auth/auth-state.service';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../auth/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AttendanceService } from '../../services/attendance.service';
import { ComingSoonComponent } from '../coming-soon/coming-soon.component';
import { MODULE_MESSAGES } from '../../config/module-messages.config';
import { FeesCalculationService, PaymentContext } from '../../services/fees-calculation.service';
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
  fee: number;
  tuitionFee: number;
  annualCharges: number;
  ecaProject: number;
  examinationFee: number;
  labCharges: number;
  busFee: number;
  unappliedLeaveCharge: number;
  lateFee: number;
  selected: boolean;
  feeLineItems: FeeLineItem[];
}

export interface MonthBreakdownDetails {
  studentId: string;
  studentClass: string;
  studentName: string;
  tuitionFee: number;
  annualCharges: number;
  labCharges: number;
  ecaProject: number;
  examinationFee: number;
  busFee: number;
  monthName: string;
  additionalCharges: number;
  lateFee: number;
  feeLineItems: FeeLineItem[];
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
    private academicSessionService: AcademicSessionService,
    private feeRuleService: FeeRuleService,
    private feeHeadService: FeeHeadService,
    private studentService: StudentService,
    private busFeesService: BusFeesService,
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
  paidManually: boolean = false;
  amountPaid: number = 0;
  totalUnappliedLeaves: number = 0;
  totalUnappliedLeaveCharge: number = 0;
  lateFees: number = 0;
  isLoadingPayment: boolean = false;
  platformFeeAmount: number = 0;
  private cachedFeeRules: FeeStructureRule[] = [];
  private cachedFeeHeads: FeeHead[] = [];

  currentMonth = new Date().getMonth() + 1;
  academicCurrentMonth: number = 0;
  currentAcademicYear: string = '';
  paymentData!: PaymentData;

  ngOnInit() {
    this.paymentData = this.feesCalc.createEmptyPaymentData();
    this.role = this.authService.getUserRole();

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

    if (this.role === 'STUDENT') {
      this.getStudentId();
      this.fetchSessions();
    } else {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        const studentIdFromParams = params['studentId'];
        if (studentIdFromParams && studentIdFromParams !== this.studentId) {
          this.studentId = studentIdFromParams;
          this.fetchSessions();
        }
      });
    }
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

  fetchBusFees(): void {
    this.months
      .filter(month => month.takesBus)
      .forEach(month => {
        this.busFeesService.getBusFeesOfDistance(month.distance!, this.session)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (busFee) => {
              month.busFee = busFee;
              this.cdr.markForCheck();
            },
            error: (error) => {
              this.logger.error('Error fetching bus fee:', error);
              month.busFee = 0;
              this.cdr.markForCheck();
            }
          });
      });
  }

  fetchFees(): void {
    this.onPaymentProcessCompleted();

    forkJoin([
      this.feesService.getStudentFees(this.studentId, this.session),
      this.attendanceService.getTotalUnappliedLeaveCount(this.studentId, this.session)
        .pipe(catchError(() => of(0))),
      this.academicSessionService.getAllSessions()
        .pipe(catchError(() => of([] as AcademicSession[])))
    ]).pipe(
      takeUntil(this.destroy$),
      switchMap(([fees, totalUnappliedLeaves, sessions]) => {
        this.className = fees.length > 0 ? fees[0].className : '';
        this.totalUnappliedLeaves = totalUnappliedLeaves;
        this.totalUnappliedLeaveCharge = totalUnappliedLeaves * 25;

        const sessionObj = sessions.find((s: AcademicSession) => s.label === this.session);
        const sessionId = sessionObj?.id;

        if (!sessionId || !this.className) {
          return of({ fees, feeRules: [] as FeeStructureRule[], feeHeads: [] as FeeHead[] });
        }

        return forkJoin([
          this.feeRuleService.getRulesBySessionAndClass(sessionId, this.className)
            .pipe(catchError(() => of([] as FeeStructureRule[]))),
          this.feeHeadService.getActiveFeeHeads()
            .pipe(catchError(() => of([] as FeeHead[])))
        ]).pipe(
          map(([feeRules, feeHeads]) => ({ fees, feeRules, feeHeads }))
        );
      })
    ).subscribe({
      next: ({ fees, feeRules, feeHeads }) => {
        this.cachedFeeRules = feeRules;
        this.cachedFeeHeads = feeHeads;
        this.months = fees.map(fee => this.buildDynamicMonthViewModel(fee, feeRules, feeHeads));
        this.fetchBusFees();
        this.checkAndDisplayFeeWarnings();
      },
      error: (error) => {
        this.logger.error('Error fetching fees:', error);
      }
    });
  }

  private buildDynamicMonthViewModel(fee: StudentFee, feeRules: FeeStructureRule[], feeHeads: FeeHead[]): MonthViewModel {
    const breakdown = this.calculateDynamicBreakdown(fee.month, feeRules, feeHeads);
    return {
      ...fee,
      monthNumber: fee.month,
      name: this.feesCalc.getMonthName(fee.month),
      selected: this.isMonthSelected(fee.month, this.selectedYear),
      fee: breakdown.total,
      tuitionFee: breakdown.tuitionFee,
      annualCharges: breakdown.annualCharges,
      ecaProject: breakdown.ecaProject,
      examinationFee: breakdown.examinationFee,
      labCharges: breakdown.labCharges,
      busFee: 0,
      unappliedLeaveCharge: 0,
      lateFee: this.feesCalc.calculateLateFees(fee.month, this.session, this.currentAcademicYear),
      feeLineItems: breakdown.lineItems,
    };
  }

  /**
   * Returns true if this fee head is due in the given academic month.
   *
   * When dueMonths contains all 12 months (the form default that admins often leave unchanged),
   * we derive the schedule from the frequency field instead of trusting the raw dueMonths data.
   * When dueMonths is a custom subset, we use it directly.
   */
  private feeAppliesThisMonth(academicMonth: number, head: FeeHead, dueMonths: number[]): boolean {
    if (dueMonths.length === 12) {
      switch (head.frequency) {
        case 'MONTHLY': return true;
        case 'QUARTERLY': return academicMonth % 3 === 1; // academic months 1, 4, 7, 10
        case 'SEMI_ANNUAL': return academicMonth === 1 || academicMonth === 7;
        case 'ANNUAL':
        case 'ONE_TIME': return academicMonth === 1;
        default: return false;
      }
    }
    return dueMonths.includes(academicMonth);
  }

  private calculateDynamicBreakdown(academicMonth: number, feeRules: FeeStructureRule[], feeHeads: FeeHead[]): {
    total: number; tuitionFee: number; annualCharges: number; ecaProject: number; examinationFee: number; labCharges: number;
    lineItems: FeeLineItem[];
  } {
    let tuitionFee = 0, annualCharges = 0, ecaProject = 0, examinationFee = 0, labCharges = 0;
    const lineItems: FeeLineItem[] = [];

    for (const rule of feeRules) {
      const head = feeHeads.find(h => h.id === rule.feeHeadId);
      if (!head) continue;

      let dueMonths: number[] = [];
      try {
        dueMonths = JSON.parse(head.dueMonths);
      } catch {
        continue;
      }

      if (!this.feeAppliesThisMonth(academicMonth, head, dueMonths)) continue;

      const amountInRupees = rule.amount / 100;
      lineItems.push({ name: rule.feeHeadName || head.name, amount: amountInRupees });

      const code = (rule.feeHeadCode || head.code || '').toUpperCase();
      if (code.includes('TUITION')) {
        tuitionFee += amountInRupees;
      } else if (code.includes('ANNUAL')) {
        annualCharges += amountInRupees;
      } else if (code.includes('ECA') || code.includes('EXTRA')) {
        ecaProject += amountInRupees;
      } else if (code.includes('EXAM')) {
        examinationFee += amountInRupees;
      } else if (code.includes('LAB')) {
        labCharges += amountInRupees;
      } else {
        tuitionFee += amountInRupees;
      }
    }

    return {
      total: tuitionFee + annualCharges + ecaProject + examinationFee + labCharges,
      tuitionFee, annualCharges, ecaProject, examinationFee, labCharges,
      lineItems,
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

      this.pastUnpaidMonthNames = this.months
        .filter(month => !month.paid && month.monthNumber < currentAcademicMonth && month.lateFee > 0)
        .map(m => this.feesCalc.getMonthName(m.monthNumber));
    }
    this.cdr.markForCheck();
  }

  isMonthSelected(monthNumber: number, year: number): boolean {
    return this.selectedMonthsByYear[year]?.includes(monthNumber) || false;
  }

  private recalculateTotals(): void {
    const result = this.feesCalc.recalculateTotals(
      this.selectedMonthsByYear,
      this.months,
      this.selectedYear,
      this.totalUnappliedLeaveCharge
    );
    this.platformFeeAmount = result.platformFeeAmount;
    this.totalAmountToPay = result.totalAmountToPay;
    this.paymentData.totalAmount = this.totalAmountToPay;
    this.paymentData.platformFee = this.platformFeeAmount;
  }

  toggleMonthSelection(month: MonthViewModel): void {
    if (month.paid || this.isLoadingPayment) return;

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
        .then(() => {
          this.recalculateTotals();
          this.updatePaymentData(month, true);
        })
        .catch((error) => {
          this.logger.error('Error during populateMonthDetails:', error);
        });
    } else {
      this.selectedMonthsByYear[year].splice(index, 1);
      this.cdr.markForCheck();
      this.updatePaymentData(month, false);
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

  populateMonthDetails(month: MonthViewModel): Promise<void> {
    return new Promise((resolve) => {
      this.studentService.getStudent(this.studentId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (student: Student) => {
            this.studentName = student.name;
            this.selectedMonthDetails = {
              studentId: this.studentId,
              studentClass: student.className,
              studentName: this.studentName,
              tuitionFee: month.tuitionFee,
              annualCharges: month.annualCharges,
              labCharges: month.labCharges,
              ecaProject: month.ecaProject,
              examinationFee: month.examinationFee,
              busFee: month.busFee,
              monthName: month.name,
              additionalCharges: this.totalUnappliedLeaveCharge,
              lateFee: month.lateFee,
              feeLineItems: month.feeLineItems,
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

  updatePaymentData(month: MonthViewModel, add: boolean): void {
    const ctx: PaymentContext = {
      studentId: this.studentId,
      studentName: this.studentName,
      className: this.className,
      session: this.session,
      paidManually: this.paidManually,
      amountPaid: this.amountPaid,
      totalAmountToPay: this.totalAmountToPay,
      totalUnappliedLeaveCharge: this.totalUnappliedLeaveCharge,
      platformFeeAmount: this.platformFeeAmount,
    };
    this.paymentData = this.feesCalc.applyMonthToPaymentData(this.paymentData, month, add, ctx);
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

  markAsManuallyPaid(): void {
    if (this.role !== 'ADMIN' || !this.manualPaymentAmount || !this.selectedMonthsByYear[this.selectedYear]?.length) {
      this.toast.warning('Warning', 'Please select months and enter the amount received.');
      return;
    }

    const selectedMonthNumbers = this.selectedMonthsByYear[this.selectedYear];
    const selectedMonthNames = this.months
      .filter(m => selectedMonthNumbers.includes(m.month))
      .map(m => m.name);
    const monthList = selectedMonthNames.map(n => `<li>${n}</li>`).join('');

    this.toast.confirm({
      title: 'Confirm Manual Payment',
      html: `
        <p style="margin-bottom:8px">Mark the following months as manually paid?</p>
        <ul style="text-align:left;display:inline-block;margin:0 0 12px;padding-left:20px;color:#374151">
          ${monthList}
        </ul>
        <p><strong>Amount Received: ₹${this.manualPaymentAmount}</strong></p>
        <p style="font-size:.82rem;color:#6b7280">Student: ${this.studentName || this.studentId} &nbsp;|&nbsp; Session: ${this.session}</p>
      `,
      confirmText: 'Yes, mark as paid!',
      cancelText: 'Cancel'
    }).then(confirmed => {
      if (confirmed) {
        this.feesService.processManualPayment(
          this.studentId,
          this.selectedMonthsByYear,
          this.manualPaymentAmount,
          this.paymentData
        ).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            const recordedAmount = this.manualPaymentAmount;
            const recordedMonths = selectedMonthNames.join(', ');
            this.initPaymentData();
            this.fetchFees();
            this.selectedMonthsByYear = {};
            this.totalAmountToPay = 0;
            this.manualPaymentAmount = 0;
            this.cdr.detectChanges();
            this.toast.confirm({
              title: 'Marked as Paid!',
              html: `
                <p style="color:#374151;margin-bottom:8px">Payment recorded successfully.</p>
                <table style="width:100%;font-size:.85rem;border-collapse:collapse;text-align:left">
                  <tr><td style="padding:4px 8px;color:#6b7280">Student</td><td style="padding:4px 8px;font-weight:600">${this.studentName || this.studentId}</td></tr>
                  <tr style="background:#f9fafb"><td style="padding:4px 8px;color:#6b7280">Months</td><td style="padding:4px 8px;font-weight:600">${recordedMonths}</td></tr>
                  <tr><td style="padding:4px 8px;color:#6b7280">Amount</td><td style="padding:4px 8px;font-weight:600;color:#16a34a">₹${recordedAmount}</td></tr>
                  <tr style="background:#f9fafb"><td style="padding:4px 8px;color:#6b7280">Session</td><td style="padding:4px 8px;font-weight:600">${this.session}</td></tr>
                </table>
              `,
              confirmText: 'Done'
            });
          },
          error: () => this.toast.error('Error!', 'Failed to record manual payment.')
        });
      }
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
}
