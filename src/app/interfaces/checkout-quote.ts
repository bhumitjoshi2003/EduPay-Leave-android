/**
 * Backend-authoritative checkout quote — mirrors CheckoutQuoteDto on the Spring Boot side.
 * schoolFeeDue/lateFee/platformFee/totalAmount are all computed server-side; Angular must
 * only display them, never recompute. A non-empty unresolvedMonths means the quote is
 * partial (one or more selected months' fee couldn't be confidently determined) — the
 * caller must not treat totalAmount as covering those months.
 */
export interface CheckoutQuote {
  studentId: string;
  session: string;
  months: number[];
  schoolFeeDue: number;
  lateFee: number;
  platformFee: number;
  totalAmount: number;
  unresolvedMonths: number[];
}
