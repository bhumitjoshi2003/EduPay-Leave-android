/**
 * Backend-authoritative per-fee-head breakdown for a single StudentFees month — mirrors
 * MonthFeeBreakdownDto/FeeLineItemDto on the Spring Boot side. lineItems is only ever
 * populated from real, persisted StudentFeesLineItem rows; a historical row generated
 * before line items existed returns an empty list with lineItemBreakdownAvailable=false —
 * the frontend must show "breakdown unavailable" rather than inventing per-fee-head
 * components. schoolFeeDue is the trusted total (same figure the checkout quote uses) and
 * is null only when the total itself is genuinely unknown, never conflated with zero owed.
 */
export interface FeeLineItem {
  lineItemType: 'FEE_HEAD' | 'BUS';
  feeHeadCode: string | null;
  feeHeadName: string;
  discountConfigType: string | null;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
}

export interface MonthFeeBreakdown {
  studentId: string;
  session: string;
  month: number;
  lineItems: FeeLineItem[];
  lineItemBreakdownAvailable: boolean;
  schoolFeeDue: number | null;
}
