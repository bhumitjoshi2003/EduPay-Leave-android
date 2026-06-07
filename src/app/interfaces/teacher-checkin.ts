export interface TeacherCheckinRequest {
  latitude: number;
  longitude: number;
}

export interface AdminMarkRequest {
  teacherId: string;
  date: string;       // yyyy-MM-dd
  status: string;
}

export interface TeacherAttendanceRecord {
  id: number;
  teacherId: string;
  teacherName: string;
  schoolId: number;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  distanceFromSchool: number | null;
  method: string;
  markedByAdmin: boolean;
}

export interface TeacherAttendanceSummary {
  totalWorkingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  halfDayDays: number;
  onLeaveDays: number;
  onTimePercentage: number;
  records: TeacherAttendanceRecord[];
}
