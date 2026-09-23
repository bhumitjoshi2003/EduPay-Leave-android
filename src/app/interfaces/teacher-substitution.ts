export interface FreeSubstituteTeacher {
  teacherId: string;
  name: string;
}

export interface TeacherSubstitution {
  id: number;
  revision: number;
  date: string;
  timetableEntryId: number;
  originalTeacherId: string;
  originalTeacherName: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
  className: string;
  sectionName?: string | null;
  subjectName: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  status: 'ACTIVE' | 'CANCELLED';
  assignedBy: string;
  assignedAt: string;
  updatedAt: string;
}

export interface UncoveredPeriod {
  timetableEntryId: number;
  originalTeacherId: string;
  originalTeacherName: string;
  className: string;
  sectionName?: string | null;
  subjectName: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  assignment?: TeacherSubstitution | null;
  freeTeachers: FreeSubstituteTeacher[];
}

