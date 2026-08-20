export type FeeOperationalStatus = 'DISABLED' | 'DRAFT' | 'ACTIVE' | 'PAUSED';
export type FeeAssignmentStatus = 'NOT_ASSIGNED' | 'PENDING_CONFIGURATION' | 'READY' | 'GENERATING' | 'GENERATED' | 'PARTIALLY_GENERATED' | 'EXCLUDED' | 'GENERATION_FAILED';

export interface FeeWorkflowSettings {
  id?: number; schoolId?: number; operationalStatus: FeeOperationalStatus; activationDate?: string;
  midSessionPolicy: 'FROM_EFFECTIVE_MONTH' | 'NEXT_MONTH' | 'PRORATE_JOINING_MONTH';
  allowRetroactiveGeneration: boolean; automaticAnnualGeneration: boolean;
}
export interface FeeAssignmentRow {
  studentId: string; studentName: string; className: string; sectionName?: string; joiningDate?: string;
  status: FeeAssignmentStatus; effectiveDate?: string; selectedMonths: number[]; generatedMonths: number; message?: string;
}
export interface FeeAssignmentSummary { totalStudents: number; notAssigned: number; ready: number; generated: number; partial: number; excluded: number; failed: number; }
export interface FeeMonthPreview { month: number; existing: boolean; eligible: boolean; baseAmount: number; discountAmount: number; busFee: number; totalAmount: number; billingEffectiveDate?: string; prorationFactor?: number; message?: string; }
export interface FeeStudentPreview { studentId: string; studentName: string; eligible: boolean; totalAmount: number; months: FeeMonthPreview[]; message?: string; }
export interface FeeGenerationResult { studentId: string; generated: number; skipped: number; successful: boolean; message: string; }
export interface FeeAssignmentRequest { studentIds: string[]; academicSession: string; effectiveDate: string; months: number[]; reason?: string; }
export type FeeConfigType = 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'WAIVER' | 'CUSTOM_AMOUNT' | 'OPT_OUT';
export interface BulkDiscountRequest {
  studentIds: string[]; academicSessionId: number; feeHeadId: number; configType: FeeConfigType;
  value: number | null; validFrom: string; validUntil?: string; reason: string;
}
export interface FeeRecalculationEntry {
  month: number; ok: boolean; message?: string;
  oldBaseAmountDue?: number; oldBusFeeDue?: number; oldDiscountAmount?: number; oldTotalDue?: number;
  newBaseAmountDue?: number; newBusFeeDue?: number; newDiscountAmount?: number; newTotalDue?: number;
}
export interface FeeStudentRecalculationResult { studentId: string; changeSaved: boolean; months: FeeRecalculationEntry[]; message?: string; }
export interface FeeWorkflowChangeResult {
  requestedStudents: number; savedStudents: number; recalculatedMonths: number; skippedMonths: number;
  students: FeeStudentRecalculationResult[];
}
export interface FeeDiscountHistoryRow { id: number; studentId: string; feeHeadId: number; feeHeadName: string; configType: FeeConfigType; value?: number; validFrom: string; validUntil?: string; reason?: string; approvedBy?: string; createdAt?: string; revokedAt?: string; revokedBy?: string; revokeReason?: string; }
export interface FeeTransportHistoryRow { id: number; studentId: string; enabled: boolean; distance?: number; effectiveFrom: string; effectiveTo?: string; reason?: string; changedBy?: string; createdAt?: string; }
export interface FeeLifecycleHistory { studentId: string; academicSession: string; discounts: FeeDiscountHistoryRow[]; transport: FeeTransportHistoryRow[]; }
export interface FeeGenerationBatchRow { id: number; academicSession: string; effectiveDate: string; selectedMonths: number[]; requestedStudents: number; successfulStudents: number; failedStudents: number; generatedMonths: number; skippedMonths: number; status: 'RUNNING'|'COMPLETED'|'PARTIAL'|'FAILED'; initiatedBy: string; retryOfBatchId?: number; startedAt: string; completedAt?: string; failedStudentIds: string[]; }
export interface FeeReconciliationRow { studentId: string; studentName: string; className: string; status: FeeAssignmentStatus; assignedMonths: number[]; generatedMonths: number[]; missingMonths: number[]; message?: string; }
export interface FeeReconciliationSummary { totalStudents: number; fullyGenerated: number; partiallyGenerated: number; notAssigned: number; failed: number; missingMonthCount: number; students: FeeReconciliationRow[]; }
export interface LegacyFeeCandidate { studentId: string; studentName: string; className: string; existingMonths: number[]; earliestBillingDate?: string; }
export interface LegacyFeeAdoptionResult { requestedStudents: number; adoptedStudents: number; skippedStudentIds: string[]; }
export interface FeeReadinessIssue { severity: 'BLOCKER'|'WARNING'; code: string; message: string; className?: string; affectedStudents?: number; }
export interface FeeReadinessReport { academicSession: string; readyToGenerate: boolean; blockerCount: number; warningCount: number; configuredClasses: number; missingConfigurationClasses: number; unassignedStudents: number; failedStudents: number; legacyStudents: number; issues: FeeReadinessIssue[]; }
