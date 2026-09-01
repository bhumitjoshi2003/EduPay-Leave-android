export interface Teacher {
  teacherId: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  dob?: string;
  gender?: string;
  classTeacher?: string | null;
  /**
   * Section/group this teacher is class teacher of. Required by the backend when the
   * class named in `classTeacher` has active sections configured, and must be null
   * when it has none.
   */
  classTeacherSectionId?: number | null;
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
