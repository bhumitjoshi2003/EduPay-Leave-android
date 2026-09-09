export interface TimetableEntry {
  id?: number;
  academicSessionId?: number;
  className: string;
  classId?: number;
  sectionId?: number | null;
  sectionName?: string | null;
  day: string;           // 'MONDAY' | 'TUESDAY' | ... | 'SATURDAY'
  periodNumber: number;  // 1–8
  startTime: string;     // 'HH:mm'
  endTime: string;       // 'HH:mm'
  subjectName: string;
  teacherId: string;
  teacherName?: string;
  /** Null/undefined = a normal, single-occupant period. A shared, admin-defined value (e.g.
   *  "MATH_BIO") tags this entry as one of several legitimate simultaneous/elective subject
   *  assignments occupying the same class+section+day+period. */
  simultaneousGroup?: string | null;
}

/** Exact create/update body; display names and simultaneous tags are response-only. */
export interface TimetableEntryRequest {
  academicSessionId?: number;
  classId: number;
  sectionId: number | null;
  day: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherId: string;
}

export interface TimetableCorrection {
  id: number;
  timetableEntryId: number | null;
  academicSessionId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requestedTeacherName: string;
  expectedTeacherName: string;
  entry: TimetableEntry | null;
}
