export interface Teacher {
  teacherId: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  dob?: string;
  gender?: string;
  classTeacher?: string | null;
  joiningDate?: string;
  photoUrl?: string;
  status?: 'ACTIVE' | 'LEFT';
  leavingDate?: string;
  reasonForLeaving?: string;
  exitRemarks?: string;
}

export interface TeacherExitRequest {
  reasonForLeaving: string;
  leavingDate: string;
  exitRemarks?: string;
}
