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
}
