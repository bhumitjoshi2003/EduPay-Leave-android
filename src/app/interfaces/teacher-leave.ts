export interface TeacherLeave {
  id: number;
  teacherId: string;
  teacherName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  appliedDate: string;
  days: number;
}

export interface TeacherLeaveApplyRequest {
  startDate: string;
  endDate: string;
  reason: string;
}
