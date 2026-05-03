import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PaymentComponent } from "../payment/payment.component";
import { ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { FeesService } from '../../services/fees.service';
import { FeeStructureService } from '../../services/fee-structure.service';
import { StudentService } from '../../services/student.service';
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
    private feeStructureService: FeeStructureService,
    private studentService: StudentService,
    private busFeesService: BusFeesService,
    private authService: AuthService,
    private attendanceService: AttendanceService,
    private authStateService: AuthStateService,
    private feesCalc: FeesCalculationService,
    private logger: LoggerService,
    private toast: ToastService
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

  currentMonth = new Date().getMonth() + 1;
  academicCurrentMonth: number = 0;
  currentAcademicYear: string = '';
  paymentData!: PaymentData;

  ngOnInit() {
    this.paymentData = this.feesCalc.createEmptyPaymentData();
    this.academicCurrentMonth = this.feesCalc.getAcademicMonth(this.currentMonth);
    this.role = this.authService.getUserRole();
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const studentIdFromParams = params['studentId'];
      if (studentIdFromParams) {
        this.studentId = studentIdFromParams;
      }
    });
    if (this.role === 'STUDENT') this.getStudentId();
    const today = new Date();
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
        .pipe(catchError(() => of(0)))
    ]).pipe(
      takeUntil(this.destroy$),
      switchMap(([fees, totalUnappliedLeaves]) => {
        this.className = fees[0].className;
        this.totalUnappliedLeaves = totalUnappliedLeaves;
        this.totalUnappliedLeaveCharge = totalUnappliedLeaves * 25;
        return this.feeStructureService.getFeeStructure(this.session, this.className).pipe(
          map(feeStructure => ({ fees, feeStructure }))
        );
      })
    ).subscribe({
      next: ({ fees, feeStructure }) => {
        if (feeStructure) {
          this.months = fees.map(fee => this.buildMonthViewModel(fee, feeStructure));
        } else {
          this.logger.error('Fee structure not found.');
          this.months = fees.map(fee => this.buildEmptyMonthViewModel(fee));
          this.totalAmountToPay = 0;
        }
        this.fetchBusFees();
        this.checkAndDisplayFeeWarnings();
      },
      error: (error) => {
        this.logger.error('Error fetching fees:', error);
      }
    });
  }

  private buildMonthViewModel(fee: StudentFee, feeStructure: any): MonthViewModel {
    const isApril = fee.month === 1;
    return {
      ...fee,
      monthNumber: fee.month,
      name: this.feesCalc.getMonthName(fee.month),
      selected: this.isMonthSelected(fee.month, this.selectedYear),
      fee: feeStructure.tuitionFee + (isApril ? feeStructure.annualCharges + feeStructure.ecaProject + feeStructure.examinationFee + feeStructure.labCharges : 0),
      tuitionFee: feeStructure.tuitionFee,
      annualCharges: isApril ? feeStructure.annualCharges : 0,
      ecaProject: isApril ? feeStructure.ecaProject : 0,
      examinationFee: isApril ? feeStructure.examinationFee : 0,
      labCharges: isApril ? feeStructure.labCharges : 0,
      busFee: 0,
      unappliedLeaveCharge: 0,
      lateFee: this.feesCalc.calculateLateFees(fee.month, this.session, this.currentAcademicYear),
    };
  }

  private buildEmptyMonthViewModel(fee: StudentFee): MonthViewModel {
    return {
      ...fee,
      monthNumber: fee.month,
      name: this.feesCalc.getMonthName(fee.month),
      selected: this.isMonthSelected(fee.month, this.selectedYear),
      fee: 0,
      tuitionFee: 0,
      annualCharges: 0,
      ecaProject: 0,
      examinationFee: 0,
      labCharges: 0,
      busFee: 0,
      unappliedLeaveCharge: 0,
      lateFee: 0,
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
      forkJoin([
        this.studentService.getStudent(this.studentId),
        this.feeStructureService.getFeeStructure(this.session, this.className)
      ]).pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ([student, feeStructure]) => {
            this.studentName = student.name;
            if (feeStructure) {
              this.selectedMonthDetails = {
                studentId: this.studentId,
                studentClass: student.className,
                studentName: this.studentName,
                tuitionFee: feeStructure.tuitionFee,
                annualCharges: (month.month === 1) ? feeStructure.annualCharges : 0,
                labCharges: (month.month === 1) ? feeStructure.labCharges : 0,
                ecaProject: (month.month === 1) ? feeStructure.ecaProject : 0,
                examinationFee: (month.month === 1) ? feeStructure.examinationFee : 0,
                busFee: month.busFee,
                monthName: month.name,
                additionalCharges: this.totalUnappliedLeaveCharge,
                lateFee: month.lateFee,
              };
            } else {
              this.logger.error('Fee structure not found.');
              this.selectedMonthDetails = null;
            }
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
