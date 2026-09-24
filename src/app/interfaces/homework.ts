export interface HomeworkAttachment {
  id: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  type: 'IMAGE' | 'PDF';
  /** Short-lived presigned download URL. */
  url: string;
  /** Only returned to the post's own teacher (needed to keep the attachment on edit). */
  objectKey: string | null;
}

/** An attachment sent with a create/update: the uploaded object's key plus a display name. */
export interface HomeworkAttachmentRef {
  objectKey: string;
  fileName: string;
}

export interface HomeworkClasswork {
  id: number;
  workDate: string;
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  subjectName: string;
  teacherId: string;
  teacherName: string | null;
  timetableEntryId: number | null;
  classwork: string | null;
  homework: string | null;
  dueDate: string | null;
  attachments: HomeworkAttachment[];
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface CreateHomeworkRequest {
  timetableEntryId: number;
  workDate?: string | null;
  classwork: string | null;
  homework: string | null;
  dueDate: string | null;
  attachments: HomeworkAttachmentRef[];
}

/** attachments replaces the post's whole attachment list, in order. */
export interface UpdateHomeworkRequest {
  classwork: string | null;
  homework: string | null;
  dueDate: string | null;
  attachments: HomeworkAttachmentRef[];
}

/** A period the teacher can post for today (their own entry or a covered one). */
export interface HomeworkPeriod {
  timetableEntryId: number;
  className: string;
  sectionName: string | null;
  subjectName: string;
  periodNumber: number;
  startTime: string | null;
  endTime: string | null;
  isSubstitution: boolean;
}

export const HOMEWORK_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const HOMEWORK_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const HOMEWORK_MAX_ATTACHMENTS = 5;

/** "1.2 MB" / "340 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

export function homeworkClassLabel(className: string, sectionName?: string | null): string {
  return sectionName ? `Class ${className} – ${sectionName}` : `Class ${className}`;
}

/** "Classwork", "Homework" or "Classwork & Homework". */
export function homeworkKind(work: Pick<HomeworkClasswork, 'classwork' | 'homework'>): string {
  if (work.classwork && work.homework) return 'Classwork & Homework';
  return work.homework ? 'Homework' : 'Classwork';
}

/** Local YYYY-MM-DD (never UTC-shifted). */
export function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Due today" / "Due tomorrow" / "Due 28 Sep" / "Overdue", relative to today. */
export function dueLabel(dueDate: string | null, today: Date = new Date()): string | null {
  if (!dueDate) return null;
  const todayKey = localDateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dueDate === todayKey) return 'Due today';
  if (dueDate === localDateKey(tomorrow)) return 'Due tomorrow';
  if (dueDate < todayKey) return 'Was due ' + formatShortDate(dueDate);
  return 'Due ' + formatShortDate(dueDate);
}

export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
