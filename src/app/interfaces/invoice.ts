export interface InvoiceLineItem {
  id?: number;
  feeHeadId: number;
  feeHeadCode: string;
  description: string;
  baseAmount: number;
  discountAmount: number;
  netAmount: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  studentId: string;
  studentName?: string;
  className?: string;
  academicSessionId: number;
  sessionLabel?: string;
  billingMonth: number;
  billingMonthName?: string;
  dueDate: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'WRITTEN_OFF';
  issuedAt?: string;
  createdAt?: string;
  lineItems?: InvoiceLineItem[];
}

export interface StudentFeeOverview {
  studentId: string;
  studentName: string;
  className: string;
  sessionLabel: string;
  totalFeeForYear: number;
  totalPaid: number;
  totalOutstanding: number;
  invoices: Invoice[];
}

export interface InvoiceGenerationRequest {
  academicSessionId: number;
  billingMonth: number;
  className?: string;
  studentId?: string;
}
