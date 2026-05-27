export interface PaymentData {
  totalAmount: number;
  monthSelectionString: string;
  totalTuitionFee: number;
  totalAnnualCharges: number;
  totalLabCharges: number;
  totalEcaProject: number;
  totalBusFee: number;
  totalExaminationFee: number;
  studentId: string;
  studentName: string;
  className: string;
  classId?: number;
  session: string;
  paidManually: boolean;
  amountPaid: number;
  additionalCharges: number;
  lateFees: number;
  platformFee: number;
}