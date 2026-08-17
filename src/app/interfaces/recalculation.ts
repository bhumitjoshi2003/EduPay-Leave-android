/**
 * One month's result from either the recalculation preview or apply endpoint — mirrors
 * RecalculationEntryDto on the Spring Boot side. For preview, ok means "eligible to
 * recalculate" and nothing has been written yet. For apply, ok means "successfully
 * recalculated and persisted." message carries the ineligibility/rejection reason when ok
 * is false. new* fields are null whenever ok is false — never fabricated for a rejected row.
 */
export interface RecalculationEntry {
  month: number;
  ok: boolean;
  message: string | null;

  oldBaseAmountDue: number | null;
  oldBusFeeDue: number | null;
  oldDiscountAmount: number | null;
  oldTotalDue: number | null;

  newBaseAmountDue: number | null;
  newBusFeeDue: number | null;
  newDiscountAmount: number | null;
  newTotalDue: number | null;
}
