import { FeeLineItem } from './month-fee-breakdown';

/**
 * Backend-authoritative fee-head breakdown for a single payment — mirrors
 * PaymentLineItemBreakdownDto on the Spring Boot side. lineItems is only ever populated
 * when EVERY month this payment covered has real StudentFeesLineItem data; otherwise it's
 * empty and totalSchoolFeeDue (or nothing, if even that is unknown) is the fallback — the
 * frontend must show "detailed breakdown unavailable" rather than falling back to the
 * deprecated fixed buckets (tuitionFee/annualCharges/labCharges/etc.) on PaymentHistoryDetails.
 */
export interface PaymentLineItemBreakdown {
  paymentId: string;
  lineItems: FeeLineItem[];
  lineItemBreakdownAvailable: boolean;
  totalSchoolFeeDue: number | null;
}
