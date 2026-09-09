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
}

/** Exact create/update body; display names are response-only. */
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
