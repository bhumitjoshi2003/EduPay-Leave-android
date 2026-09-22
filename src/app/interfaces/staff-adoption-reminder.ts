export type StaffAdoptionReminderType = 'NOT_STARTED' | 'OUTDATED_APP' | 'ONBOARDING_INCOMPLETE';

export interface StaffAdoptionReminderTeacherSummary {
  teacherId: string;
  name: string;
}

export interface StaffAdoptionReminderPreview {
  count: number;
  teachers: StaffAdoptionReminderTeacherSummary[];
}

export interface StaffAdoptionReminderSendResult {
  type: StaffAdoptionReminderType;
  eligibleCount: number;
  sentCount: number;
  skippedRecentCount: number;
}
