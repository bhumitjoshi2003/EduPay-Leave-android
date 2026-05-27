export interface LeaveRequest {
  studentId: string;
  studentName: string;
  className: string;
  classId?: number;
  leaveDate: string;
  reason: string;
}