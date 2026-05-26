export interface PaymentAllocation {
  invoiceId: number;
  invoiceNumber?: string;
  billingMonth?: number;
  amountAllocated: number;
}

export interface FeePayment {
  id: number;
  studentId: string;
  studentName?: string;
  className?: string;
  amount: number;
  paymentMode: 'RAZORPAY' | 'MANUAL_CASH' | 'MANUAL_CHEQUE' | 'BANK_TRANSFER' | 'UPI';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  referenceNumber?: string;
  notes?: string;
  receivedBy?: string;
  paymentDate: string;
  allocations?: PaymentAllocation[];
}

export interface RecordPaymentRequest {
  studentId: string;
  amount: number;
  paymentMode: string;
  invoiceAllocations: { invoiceId: number; amount: number }[];
  referenceNumber?: string;
  notes?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}

export interface StudentFeeConfig {
  id?: number;
  studentId: string;
  feeHeadId: number;
  feeHeadName?: string;
  academicSessionId: number;
  configType: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'WAIVER' | 'CUSTOM_AMOUNT' | 'OPT_OUT';
  value?: number;
  reason?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface CreditNote {
  id?: number;
  studentId: string;
  studentName?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  creditType: 'REFUND' | 'ADJUSTMENT' | 'WRITE_OFF' | 'FEE_WAIVER';
  amount: number;
  reason: string;
  status?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt?: string;
}
