import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Observable, of, Subject, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthStateService } from '../../auth/auth-state.service';
import {
  HOMEWORK_ATTACHMENT_MAX_BYTES,
  HOMEWORK_ATTACHMENT_TYPES,
  HOMEWORK_MAX_ATTACHMENTS,
  HomeworkAttachmentRef,
  HomeworkClasswork,
  HomeworkPeriod,
  dueLabel,
  formatFileSize,
  homeworkClassLabel,
  homeworkKind,
  localDateKey,
} from '../../interfaces/homework';
import { HomeworkService } from '../../services/homework.service';
import { TimetableService } from '../../services/timetable.service';
import { TeacherSubstitutionService } from '../../services/teacher-substitution.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';
import { todayDayCode } from '../../utils/teacher-timetable-today.util';

/** One entry in the form's attachment list: already on the post, or newly picked. */
export interface FormAttachment {
  id: string;
  kind: 'existing' | 'new';
  fileName: string;
  isPdf: boolean;
  size: number;
  /** Existing: the stored object key. */
  objectKey?: string;
  /** New: the picked file (uploaded on save). */
  file?: File;
  /** Image thumbnail: the stored URL, or a local object URL for a new image. */
  previewUrl: string | null;
}

interface FormState {
  mode: 'create' | 'edit';
  period: HomeworkPeriod | null;
  work: HomeworkClasswork | null;
  classwork: string;
  homework: string;
  dueDate: string;
  attachments: FormAttachment[];
  saving: boolean;
}

@Component({
  selector: 'app-teacher-homework',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './teacher-homework.component.html',
  styleUrl: './teacher-homework.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherHomeworkComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  readonly classLabel = homeworkClassLabel;
  readonly kind = homeworkKind;
  readonly due = dueLabel;
  readonly fileSize = formatFileSize;
  readonly acceptTypes = HOMEWORK_ATTACHMENT_TYPES.join(',');
  readonly maxAttachments = HOMEWORK_MAX_ATTACHMENTS;

  readonly today = localDateKey(new Date());
  periods: HomeworkPeriod[] = [];
  todayPosts: HomeworkClasswork[] = [];
  recent: HomeworkClasswork[] = [];
  loading = true;
  failed = false;

  form: FormState | null = null;
  private pendingEntryId: number | null = null;
  private localPreviewUrls: string[] = [];
  private nextAttachmentId = 0;

  constructor(
    private homework: HomeworkService,
    private timetable: TimetableService,
    private substitutions: TeacherSubstitutionService,
    private authState: AuthStateService,
    private route: ActivatedRoute,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const entry = Number(this.route.snapshot.queryParamMap.get('entry'));
    this.pendingEntryId = Number.isFinite(entry) && entry > 0 ? entry : null;
    this.load();
  }

  load(): void {
    const teacherId = this.authState.getUser()?.userId;
    if (!teacherId) return;
    this.loading = true;
    this.failed = false;
    this.cdr.markForCheck();
    forkJoin({
      timetable: this.timetable.getTeacherTimetable(teacherId),
      covers: this.substitutions.getMine(this.today).pipe(catchError(error => {
        this.logger.error('Cover periods unavailable for homework page:', error);
        return of([]);
      })),
      todayPosts: this.homework.myPostsOn(this.today),
      recent: this.homework.myRecent(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ timetable, covers, todayPosts, recent }) => {
        const day = todayDayCode(new Date());
        const own: HomeworkPeriod[] = timetable
          .filter(e => e.day === day && e.id != null)
          .map(e => ({
            timetableEntryId: e.id!, className: e.className, sectionName: e.sectionName ?? null,
            subjectName: e.subjectName, periodNumber: e.periodNumber, startTime: e.startTime ?? null,
            endTime: e.endTime ?? null, isSubstitution: false,
          }));
        const covered: HomeworkPeriod[] = covers
          .filter(c => c.status === 'ACTIVE')
          .map(c => ({
            timetableEntryId: c.timetableEntryId, className: c.className, sectionName: c.sectionName ?? null,
            subjectName: c.subjectName, periodNumber: c.periodNumber, startTime: c.startTime ?? null,
            endTime: c.endTime ?? null, isSubstitution: true,
          }));
        this.periods = [...own, ...covered].sort((a, b) =>
          (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.periodNumber - b.periodNumber);
        this.todayPosts = todayPosts;
        this.recent = recent;
        this.loading = false;
        this.openPendingEntry();
        this.cdr.markForCheck();
      },
      error: error => {
        this.logger.error('Homework page load failed:', error);
        this.loading = false;
        this.failed = true;
        this.cdr.markForCheck();
      },
    });
  }

  get postedCount(): number {
    return this.periods.filter(p => this.postFor(p)).length;
  }

  postFor(period: HomeworkPeriod): HomeworkClasswork | undefined {
    return this.todayPosts.find(p => p.timetableEntryId === period.timetableEntryId);
  }

  openCreate(period: HomeworkPeriod): void {
    const existing = this.postFor(period);
    if (existing) { this.openEdit(existing, period); return; }
    this.form = { mode: 'create', period, work: null, classwork: '', homework: '', dueDate: '', attachments: [], saving: false };
  }

  openEdit(work: HomeworkClasswork, period: HomeworkPeriod | null = null): void {
    this.form = {
      mode: 'edit', period, work, classwork: work.classwork ?? '', homework: work.homework ?? '',
      dueDate: work.dueDate ?? '', saving: false,
      attachments: work.attachments.filter(a => a.objectKey).map(a => ({
        id: `a${this.nextAttachmentId++}`, kind: 'existing' as const, fileName: a.fileName, isPdf: a.type === 'PDF',
        size: a.fileSize, objectKey: a.objectKey!, previewUrl: a.type === 'IMAGE' ? a.url : null,
      })),
    };
  }

  closeForm(): void {
    this.form = null;
    this.releasePreviews();
  }

  onFilesSelected(event: Event): void {
    const form = this.form;
    if (!form) return;
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) {
      if (form.attachments.length >= HOMEWORK_MAX_ATTACHMENTS) {
        this.toast.warning('Attachment limit', `A post can have at most ${HOMEWORK_MAX_ATTACHMENTS} attachments.`);
        break;
      }
      if (!HOMEWORK_ATTACHMENT_TYPES.includes(file.type)) {
        this.toast.error('Unsupported file', `${file.name}: attach a JPG, PNG, WebP image or a PDF.`);
        continue;
      }
      if (file.size > HOMEWORK_ATTACHMENT_MAX_BYTES) {
        this.toast.error('File too large', `${file.name}: attachments must be 10 MB or smaller.`);
        continue;
      }
      const isPdf = file.type === 'application/pdf';
      form.attachments = [...form.attachments, {
        id: `a${this.nextAttachmentId++}`, kind: 'new', fileName: file.name, isPdf, size: file.size, file,
        previewUrl: isPdf ? null : this.localPreview(file),
      }];
    }
    this.cdr.markForCheck();
  }

  removeAttachment(attachment: FormAttachment): void {
    if (!this.form) return;
    this.form.attachments = this.form.attachments.filter(a => a.id !== attachment.id);
    if (attachment.kind === 'new' && attachment.previewUrl) this.revoke(attachment.previewUrl);
    this.cdr.markForCheck();
  }

  get canSave(): boolean {
    return !!this.form && !this.form.saving && (!!this.form.classwork.trim() || !!this.form.homework.trim());
  }

  save(): void {
    const form = this.form;
    if (!form) return;
    if (!form.classwork.trim() && !form.homework.trim()) {
      this.toast.warning('Nothing to post', 'Enter classwork, homework, or both.');
      return;
    }
    if (form.homework.trim() && form.dueDate && form.dueDate < (form.work?.workDate ?? this.today)) {
      this.toast.warning('Check the due date', 'The due date cannot be before the class date.');
      return;
    }
    form.saving = true;
    this.cdr.markForCheck();
    this.uploadedRefs(form.attachments).pipe(takeUntil(this.destroy$)).subscribe({
      next: refs => this.submit(form, refs),
      error: error => this.failSave(form, 'Unable to upload attachments', error),
    });
  }

  /** Uploads the new files (in parallel) and returns the full ordered attachment list. */
  private uploadedRefs(attachments: FormAttachment[]): Observable<HomeworkAttachmentRef[]> {
    if (!attachments.length) return of([]);
    return forkJoin(attachments.map(a => a.kind === 'existing'
      ? of({ objectKey: a.objectKey!, fileName: a.fileName })
      : this.homework.uploadAttachmentDirect(a.file!).pipe(map(uploaded => ({ objectKey: uploaded.objectKey, fileName: a.fileName })))));
  }

  private submit(form: FormState, attachments: HomeworkAttachmentRef[]): void {
    const classwork = form.classwork.trim() || null;
    const homework = form.homework.trim() || null;
    const dueDate = homework && form.dueDate ? form.dueDate : null;
    const request$ = form.mode === 'create'
      ? this.homework.create({ timetableEntryId: form.period!.timetableEntryId, classwork, homework, dueDate, attachments })
      : this.homework.update(form.work!.id, { classwork, homework, dueDate, attachments });
    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: saved => {
        this.upsert(saved);
        this.toast.success(form.mode === 'create' ? 'Posted' : 'Saved',
          form.mode === 'create' ? 'Students in this class have been notified.' : 'Your changes have been saved.');
        this.closeForm();
        this.cdr.markForCheck();
      },
      error: error => this.failSave(form, form.mode === 'create' ? 'Unable to post' : 'Unable to save', error),
    });
  }

  private failSave(form: FormState, title: string, error: any): void {
    this.logger.error(title, error);
    form.saving = false;
    this.toast.error(title, error?.error?.message || error?.error?.detail || 'Please try again in a moment.');
    this.cdr.markForCheck();
  }

  async remove(work: HomeworkClasswork): Promise<void> {
    const confirmed = await this.toast.confirm({
      title: 'Delete this post?',
      message: 'Students will no longer see it or its attachments. This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
      icon: 'danger',
    });
    if (!confirmed) return;
    this.homework.delete(work.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.todayPosts = this.todayPosts.filter(p => p.id !== work.id);
        this.recent = this.recent.filter(p => p.id !== work.id);
        this.toast.success('Deleted', 'The post has been removed.');
        this.cdr.markForCheck();
      },
      error: error => {
        this.logger.error('Homework delete failed:', error);
        this.toast.error('Unable to delete', error?.error?.message || 'Please try again in a moment.');
      },
    });
  }

  private upsert(saved: HomeworkClasswork): void {
    const replace = (list: HomeworkClasswork[]) => {
      const i = list.findIndex(p => p.id === saved.id);
      return i >= 0 ? list.map(p => (p.id === saved.id ? saved : p)) : [saved, ...list];
    };
    if (saved.workDate === this.today) this.todayPosts = replace(this.todayPosts);
    this.recent = replace(this.recent);
  }

  private openPendingEntry(): void {
    if (this.pendingEntryId == null) return;
    const period = this.periods.find(p => p.timetableEntryId === this.pendingEntryId);
    this.pendingEntryId = null;
    if (period) this.openCreate(period);
  }

  timeRange(period: HomeworkPeriod): string | null {
    return period.startTime && period.endTime ? `${period.startTime}–${period.endTime}` : null;
  }

  trackAttachment(_: number, attachment: FormAttachment): string {
    return attachment.id;
  }

  private localPreview(file: File): string | null {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const url = URL.createObjectURL(file);
    this.localPreviewUrls.push(url);
    return url;
  }

  private revoke(url: string): void {
    if (!this.localPreviewUrls.includes(url)) return;
    URL.revokeObjectURL(url);
    this.localPreviewUrls = this.localPreviewUrls.filter(u => u !== url);
  }

  private releasePreviews(): void {
    this.localPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    this.localPreviewUrls = [];
  }

  ngOnDestroy(): void {
    this.releasePreviews();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
