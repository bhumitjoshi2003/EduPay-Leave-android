export interface MonthlyBreakdown {
  month: string;
  year: number;
  workingDays: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  className: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  attendancePercentage: number;
  monthlyBreakdown: MonthlyBreakdown[] | null;
}

export interface ClassAttendanceSummary {
  studentId: string;
  studentName: string;
  totalWorkingDays: number;
  daysPresent: number;
  daysAbsent: number;
  attendancePercentage: number;
}

export interface DailyDetail {
  schoolDays: string[];
  absentDays: string[];
}

export type CellStatus = 'present' | 'absent' | 'closed' | 'holiday' | 'empty' | 'future' | 'unmarked';

export interface CalendarCell {
  date: string | null;
  day: number | null;
  status: CellStatus;
  holidayName?: string;
}
