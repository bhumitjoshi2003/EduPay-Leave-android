export interface PaymentHistoryDetails {
  id: number;
  studentId: string;
  studentName: string;
  className: string;
  session: string;
  month: string;
  /** In paise (Payment.amount on the backend, matching Razorpay's own convention) — divide
   * by 100 before formatting as currency. Every other field below (including amountPaid)
   * is a plain rupee int; only amount/amountPaid are paise on this entity. */
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
  /** Paise — see `amount` above. */
  amountPaid: number;
  additionalCharges: number;
  lateFees: number;
  platformFee: number;
  schoolName: string;
}