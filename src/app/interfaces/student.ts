export interface Student {
  studentId: string;
  name: string;
  className: string;
  classId?: number;
  sectionId?: number | null;
  sectionName?: string;
  phoneNumber?: string;
  email?: string;
  gender?: string;
  dob?: string;
  fatherName?: string;
  motherName?: string;
  takesBus?: boolean;
  distance?: number | null;
  joiningDate?: string;
  leavingDate?: string;
  status?: string;
  photoUrl?: string;
  reasonForLeaving?: string;
  conductAtLeaving?: string;
  exitRemarks?: string;
}

export interface StudentExitRequest {
  exitType: 'GRADUATED' | 'TRANSFERRED' | 'WITHDRAWN';
  reasonForLeaving: string;
  conductAtLeaving?: string;
  leavingDate: string;
  exitRemarks?: string;
}

export interface PendingDuesInfo {
  hasPendingDues: boolean;
  unpaidMonths: number;
}
