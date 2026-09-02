/** An admin-issued, one-time authorization letting a teacher self-serve timetable periods for
 *  a class/section they don't yet have any other connection to (no logged periods there, not
 *  their class-teacher assignment). */
export interface TeacherClassGrant {
  id: number;
  teacherId: string;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  grantedBy?: string;
  createdAt?: string;
}

export interface TeacherClassGrantRequest {
  teacherId: string;
  className: string;
  sectionId: number | null;
}
