export interface FeeStructureRule {
  id?: number;
  feeHeadId: number;
  feeHeadName?: string;
  feeHeadCode?: string;
  academicSessionId: number;
  className: string;
  classId?: number;
  amount: number; // in paise
  effectiveFrom: string;
  effectiveUntil?: string;
}
