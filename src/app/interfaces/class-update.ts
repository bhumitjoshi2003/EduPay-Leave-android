export interface ClassUpdateAttachment {
  fileName: string;
  contentType: string;
  fileSize: number;
  type: 'IMAGE' | 'PDF';
  /** Short-lived presigned download URL. */
  url: string;
  /** Only returned to the update's own teacher (needed to keep the attachment on edit). */
  objectKey: string | null;
}

/** An attachment sent with a create/update: the uploaded object's key plus a display name. */
export interface ClassUpdateAttachmentRef {
  objectKey: string;
  fileName: string;
}

/** A class/section (and subject) the teacher teaches this session, from their own timetable. */
export interface ClassUpdateContext {
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  subjectName: string | null;
}

export interface ClassUpdate {
  id: number;
  classId: number;
  className: string;
  sectionId: number | null;
  sectionName: string | null;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
  title: string;
  message: string;
  attachment: ClassUpdateAttachment | null;
  /** ISO instant, or null for no expiry. */
  expiresAt: string | null;
  expired: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface CreateClassUpdateRequest {
  classId: number;
  sectionId: number | null;
  subjectName: string | null;
  title: string;
  message: string;
  attachment: ClassUpdateAttachmentRef | null;
  expiresAt: string | null;
}

/** Content only — the class of an update cannot be changed. attachment null removes it. */
export interface UpdateClassUpdateRequest {
  title: string;
  message: string;
  attachment: ClassUpdateAttachmentRef | null;
  expiresAt: string | null;
}

export const CLASS_UPDATE_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const CLASS_UPDATE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CLASS_UPDATE_TITLE_MAX = 150;
export const CLASS_UPDATE_MESSAGE_MAX = 5000;

/** "Class 8 – A · Science" (subject omitted for a class-wide update). */
export function classUpdateContextLabel(item: Pick<ClassUpdateContext, 'className' | 'sectionName' | 'subjectName'>): string {
  const cls = item.sectionName ? `Class ${item.className} – ${item.sectionName}` : `Class ${item.className}`;
  return item.subjectName ? `${cls} · ${item.subjectName}` : cls;
}

/** Stable key for a context (used as a select value). */
export function classUpdateContextKey(context: ClassUpdateContext): string {
  return `${context.classId}:${context.sectionId ?? ''}:${context.subjectName ?? ''}`;
}

/** ISO instant → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
export function toLocalDateTimeInput(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
