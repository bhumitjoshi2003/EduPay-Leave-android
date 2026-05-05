export interface PaymentHistoryDetails {
  id: number;
  studentId: string;
  studentName: string;
  className: string;
  session: string;
  month: string;
  amount: number;
  paymentId: string;
  orderId: string;
  paymentDate: string;
  status: string;
  busFee: number;
  tuitionFee: number;
  annualCharges: number;
  labCharges: number;
  ecaProject: number;
  examinationFee: number;
  amountPaid: number;
  additionalCharges: number;
  lateFees: number;
  platformFee: number;
  schoolName: string;
}