export type StaffAdoptionAccountStatus = 'STARTED' | 'NOT_STARTED' | 'DISABLED' | 'ACCOUNT_PENDING';
export type AppVersionStatus = 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'UPDATE_REQUIRED' | 'UNKNOWN';
export interface StaffAdoptionSummary { totalTeachers: number; startedTeachers: number; notStartedTeachers: number; attendanceUsedTeachers: number; disabledTeachers: number; onboardingCompletedTeachers?: number; appUpToDateTeachers?: number; }
export interface StaffAdoptionTeacherRow { teacherId: string; name: string; accountStatus: StaffAdoptionAccountStatus; lastActiveAt: string | null; hasUsedAttendance: boolean; lastAttendanceAt: string | null; onboardingStatus?: 'COMPLETED' | 'UNKNOWN'; onboardingCompletedAt?: string | null; clientPlatform?: string | null; appVersionName?: string | null; appVersionCode?: number | null; appVersionStatus?: AppVersionStatus; }
export interface StaffAdoptionResponse { summary: StaffAdoptionSummary; teachers: StaffAdoptionTeacherRow[]; }
