export interface MonthlyBreakdown {
  month: string;
  year: number;
  workingDays: number;
  present: number;
  absent: number;
  /** ABSENT days covered by APPROVED leave — informational, still counted as absent. */
  approvedLeave: number;
  percentage: number;
}

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  className: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  /** ABSENT days covered by APPROVED leave — informational, still counted as absent. */
  approvedLeaveDays: number;
  attendancePercentage: number;
  monthlyBreakdown: MonthlyBreakdown[] | null;
}

export interface ClassAttendanceSummary {
  studentId: string;
  studentName: string;
  className?: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  approvedLeaveDays: number;
  attendancePercentage: number;
}

/** A student's month: schoolDays = dates with an attendance row; statuses maps each to PRESENT/ABSENT. */
export interface DailyDetail {
  schoolDays: string[];
  absentDays: string[];
  /** ABSENT dates covered by APPROVED leave. */
  approvedLeaveDays?: string[];
  nonWorkingDays?: string[];
  statuses?: Record<string, 'PRESENT' | 'ABSENT'>;
}

/** 'leave' = ABSENT on a day of APPROVED leave (still an absence). 'unmarked' = no attendance recorded. */
export type CellStatus = 'present' | 'absent' | 'leave' | 'closed' | 'holiday' | 'empty' | 'future' | 'unmarked';

export interface CalendarCell {
  date: string | null;
  day: number | null;
  status: CellStatus;
  holidayName?: string;
}
