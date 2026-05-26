import { Injectable } from '@angular/core';
import { PaymentData } from '../interfaces/payment-data';
import { MonthViewModel } from '../components/fees/fees.component';

const PLATFORM_FEE_PERCENTAGE = 0.015;
const LATE_FEE_PER_DAY = [12, 15, 18, 21];

export interface RecalculateResult {
  subTotal: number;
  platformFeeAmount: number;
  totalAmountToPay: number;
}

export interface PaymentContext {
  studentId: string;
  studentName: string;
  className: string;
  session: string;
  paidManually: boolean;
  amountPaid: number;
  totalAmountToPay: number;
  totalUnappliedLeaveCharge: number;
  platformFeeAmount: number;
}

@Injectable({
  providedIn: 'root'
})
export class FeesCalculationService {

  /** First calendar month of the academic year (1=Jan, 4=Apr, 7=Jul, etc.). Set once per session load. */
  private startMonth = 4;

  setStartMonth(month: number): void {
    if (month >= 1 && month <= 12) {
      this.startMonth = month;
    }
  }

  getAcademicMonth(calendarMonth: number): number {
    return ((calendarMonth - this.startMonth + 12) % 12) + 1;
  }

  getAcademicYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return month >= this.startMonth ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  getSessionStartYear(session: string): number {
    return parseInt(session.substring(0, 4));
  }

  getMonthName(academicMonth: number): string {
    const calendarMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const calendarIndex = (this.startMonth - 1 + academicMonth - 1) % 12;
    return calendarMonths[calendarIndex];
  }

  calculateLateFees(academicFeeMonth: number, session: string, currentAcademicYear: string): number {
    if (session !== currentAcademicYear) return 0;

    const today = new Date();
    const academicCurrentMonth = this.getAcademicMonth(today.getMonth() + 1);
    const monthDifference = academicCurrentMonth - academicFeeMonth;

    if (monthDifference <= 0) return 0;

    if (monthDifference >= 9) return 30 * LATE_FEE_PER_DAY[3];
    if (monthDifference >= 6) return 30 * LATE_FEE_PER_DAY[2];
    if (monthDifference >= 3) return 30 * LATE_FEE_PER_DAY[1];
    return 30 * LATE_FEE_PER_DAY[0];
  }

  recalculateTotals(
    selectedMonthsByYear: { [year: number]: number[] },
    months: MonthViewModel[],
    selectedYear: number,
    totalUnappliedLeaveCharge: number
  ): RecalculateResult {
    let subTotal = 0;

    Object.keys(selectedMonthsByYear).forEach(yearKey => {
      const year = parseInt(yearKey, 10);
      selectedMonthsByYear[year].forEach(monthNumber => {
        const month = months.find(m => m.month === monthNumber);
        if (month) {
          subTotal += month.fee + (month.busFee || 0) + month.lateFee;
        }
      });
    });

    if (selectedMonthsByYear[selectedYear]?.length > 0 && totalUnappliedLeaveCharge > 0) {
      subTotal += totalUnappliedLeaveCharge;
    }

    const platformFeeAmount = Math.ceil(subTotal * PLATFORM_FEE_PERCENTAGE);
    const totalAmountToPay = subTotal + platformFeeAmount;

    return { subTotal, platformFeeAmount, totalAmountToPay };
  }

  createEmptyPaymentData(): PaymentData {
    return {
      totalAmount: 0,
      monthSelectionString: '000000000000',
      totalTuitionFee: 0,
      totalAnnualCharges: 0,
      totalLabCharges: 0,
      totalEcaProject: 0,
      totalBusFee: 0,
      totalExaminationFee: 0,
      studentId: '',
      studentName: '',
      className: '',
      session: '',
      paidManually: false,
      amountPaid: 0,
      additionalCharges: 0,
      lateFees: 0,
      platformFee: 0,
    };
  }

  applyMonthToPaymentData(paymentData: PaymentData, month: MonthViewModel, add: boolean, ctx: PaymentContext): PaymentData {
    const ms = paymentData.monthSelectionString;
    return {
      ...paymentData,
      monthSelectionString: ms.substring(0, month.monthNumber - 1) + (add ? '1' : '0') + ms.substring(month.monthNumber),
      totalAmount: ctx.totalAmountToPay,
      totalTuitionFee: paymentData.totalTuitionFee + (add ? month.tuitionFee : -month.tuitionFee),
      totalAnnualCharges: paymentData.totalAnnualCharges + (add ? month.annualCharges : -month.annualCharges),
      totalBusFee: paymentData.totalBusFee + (add ? month.busFee : -month.busFee),
      totalEcaProject: paymentData.totalEcaProject + (add ? month.ecaProject : -month.ecaProject),
      totalLabCharges: paymentData.totalLabCharges + (add ? month.labCharges : -month.labCharges),
      totalExaminationFee: paymentData.totalExaminationFee + (add ? month.examinationFee : -month.examinationFee),
      lateFees: paymentData.lateFees + (add ? month.lateFee : -month.lateFee),
      studentId: ctx.studentId,
      studentName: ctx.studentName,
      className: ctx.className,
      session: ctx.session,
      paidManually: ctx.paidManually,
      amountPaid: ctx.paidManually ? ctx.amountPaid : ctx.totalAmountToPay,
      additionalCharges: ctx.totalUnappliedLeaveCharge,
      platformFee: ctx.platformFeeAmount,
    };
  }
}
