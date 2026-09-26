/** Read-only Attendance Insights (Phase 1). % = PRESENT / submitted days; approved leave is still absent. */
export interface AttendanceMonthTrend {
  year: number;
  month: number;
  label: string;
  submittedDays: number;
  present: number;
  absent: number;
  approvedLeave: number;
  percentage: number;
}

export interface AttendanceRecentDay {
  date: string;
  status: 'PRESENT' | 'ABSENT';
  approvedLeave: boolean;
}

export interface StudentAttendanceInsights {
  studentId: string;
  studentName: string;
  className: string | null;
  sessionLabel: string | null;
  from: string | null;
  to: string | null;
  submittedDays: number;
  present: number;
  absent: number;
  approvedLeave: number;
  percentage: number;
  lowAttendanceThreshold: number;
  lowAttendance: boolean;
  currentAbsenceStreak: number;
  monthlyTrend: AttendanceMonthTrend[];
  recent: AttendanceRecentDay[];
}

export interface ClassInsightStudent {
  studentId: string;
  studentName: string;
  sectionName: string | null;
  submittedDays: number;
  present: number;
  absent: number;
  approvedLeave: number;
  percentage: number;
  lowAttendance: boolean;
  currentAbsenceStreak: number;
  streakApprovedLeaveDays: number;
}

export interface ClassAttendanceInsights {
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  sessionLabel: string | null;
  from: string | null;
  to: string | null;
  lowAttendanceThreshold: number;
  streakThreshold: number;
  totalStudents: number;
  submittedRecords: number;
  classPercentage: number;
  belowThresholdCount: number;
  consecutiveAbsenceCount: number;
  students: ClassInsightStudent[];
}
