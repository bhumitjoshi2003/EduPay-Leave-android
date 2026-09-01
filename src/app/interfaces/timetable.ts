export interface TimetableEntry {
  id?: number;
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
