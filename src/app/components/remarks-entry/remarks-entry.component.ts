import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  ReportCardTemplateService,
  ReportCardTemplate,
  StudentRemarksData,
  ActivityGrade,
} from '../../services/report-card-template.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { SchoolService } from '../../services/school.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { AcademicSession } from '../../interfaces/academic-session';

interface StudentRow extends StudentRemarksData {
  teacherRemarkDraft: string;
  principalRemarkDraft: string;
  coGrades: { [activity: string]: string };
  dirty: boolean;
}

@Component({
  selector: 'app-remarks-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './remarks-entry.component.html',
  styleUrl: './remarks-entry.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemarksEntryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  sessions: AcademicSession[] = [];
  classes: string[] = [];
  templates: ReportCardTemplate[] = [];

  selectedSession = '';
  selectedClass = '';
  selectedTemplateId: number | null = null;

  role = '';
  loading = false;
  saving = false;
  loaded = false;

  students: StudentRow[] = [];

  /** Activities derived from the selected template's CO_SCHOLASTIC configJson */
  activities: string[] = [];
  /** Grade scale from the template's CO_SCHOLASTIC configJson */
  gradeScale: string[] = [];
  coScholasticEnabled = false;
  teacherRemarksEnabled = false;
  principalRemarksEnabled = false;

  constructor(
    private rcService: ReportCardTemplateService,
    private sessionService: AcademicSessionService,
    private schoolService: SchoolService,
    private authState: AuthStateService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.role = this.authState.getUserRole() ?? '';

    this.sessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        const current = sessions.find(s => s.current);
        this.selectedSession = current?.label ?? sessions[0]?.label ?? '';
        this.loadTemplates();
        this.cdr.markForCheck();
      }
    });

    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (classes) => { this.classes = classes; this.cdr.markForCheck(); }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load templates ────────────────────────────────────────────────

  private loadTemplates(): void {
    this.rcService.getTemplates().pipe(takeUntil(this.destroy$)).subscribe({
      next: (templates) => {
        this.templates = templates;
        const def = templates.find(t => t.isDefault) ?? templates[0];
        this.selectedTemplateId = def?.id ?? null;
        if (this.selectedTemplateId) this.parseTemplateSections();
        this.cdr.markForCheck();
      }
    });
  }

  onTemplateChange(): void {
    this.parseTemplateSections();
    this.students = [];
    this.loaded = false;
    this.cdr.markForCheck();
  }

  private parseTemplateSections(): void {
    const tpl = this.templates.find(t => t.id === this.selectedTemplateId);
    if (!tpl) return;

    this.coScholasticEnabled = tpl.sections.some(s => s.sectionType === 'CO_SCHOLASTIC' && s.enabled);
    this.teacherRemarksEnabled = tpl.sections.some(s => s.sectionType === 'TEACHER_REMARKS' && s.enabled);
    this.principalRemarksEnabled = tpl.sections.some(s => s.sectionType === 'PRINCIPAL_REMARKS' && s.enabled);

    if (this.coScholasticEnabled) {
      const coSec = tpl.sections.find(s => s.sectionType === 'CO_SCHOLASTIC');
      let cfg: any = {};
      try { cfg = JSON.parse(coSec?.configJson ?? '{}'); } catch { cfg = {}; }
      this.activities = cfg.activities ?? ['Discipline', 'Sports', 'Co-Curricular'];
      this.gradeScale = cfg.gradeScale ?? ['A', 'B', 'C', 'D'];
    } else {
      this.activities = [];
      this.gradeScale = [];
    }
  }

  // ── Load students ─────────────────────────────────────────────────

  loadStudents(): void {
    if (!this.selectedSession || !this.selectedClass || !this.selectedTemplateId) {
      this.toast.error('Required', 'Please select session, class, and template.');
      return;
    }
    this.loading = true;
    this.loaded = false;

    this.rcService.getClassRemarks(
      this.selectedTemplateId, this.selectedSession, this.selectedClass
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.students = data.students.map(s => this.toRow(s));
        this.loading = false;
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.toast.error('Error', e.error?.message ?? 'Failed to load students.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private toRow(s: StudentRemarksData): StudentRow {
    const coGrades: { [activity: string]: string } = {};
    for (const act of this.activities) {
      const found = s.coScholasticEntries?.find(e => e.activity === act);
      coGrades[act] = found?.grade ?? '';
    }
    return {
      ...s,
      teacherRemarkDraft: s.teacherRemark ?? '',
      principalRemarkDraft: s.principalRemark ?? '',
      coGrades,
      dirty: false,
    };
  }

  markDirty(row: StudentRow): void {
    row.dirty = true;
  }

  // ── Save ──────────────────────────────────────────────────────────

  async saveAll(): Promise<void> {
    const dirty = this.students.filter(s => s.dirty);
    if (dirty.length === 0) {
      this.toast.info('Nothing to save', 'No changes detected.');
      return;
    }

    this.saving = true;
    const saves: Promise<void>[] = [];

    // Save remarks
    if (this.teacherRemarksEnabled || this.principalRemarksEnabled) {
      saves.push(new Promise((res, rej) => {
        this.rcService.saveRemarks({
          templateId: this.selectedTemplateId!,
          session: this.selectedSession,
          studentRemarks: dirty.map(s => ({
            studentId: s.studentId,
            teacherRemark: s.teacherRemarkDraft,
            principalRemark: s.principalRemarkDraft,
          }))
        }).pipe(takeUntil(this.destroy$)).subscribe({ next: () => res(), error: rej });
      }));
    }

    // Save co-scholastic
    if (this.coScholasticEnabled) {
      saves.push(new Promise((res, rej) => {
        this.rcService.saveCoScholastic({
          templateId: this.selectedTemplateId!,
          session: this.selectedSession,
          studentEntries: dirty.map(s => ({
            studentId: s.studentId,
            entries: this.activities.map(act => ({
              activity: act,
              grade: s.coGrades[act] ?? '',
            })).filter(e => e.grade !== ''),
          }))
        }).pipe(takeUntil(this.destroy$)).subscribe({ next: () => res(), error: rej });
      }));
    }

    try {
      await Promise.all(saves);
      dirty.forEach(s => s.dirty = false);
      this.toast.success('Saved', `${dirty.length} student(s) updated.`);
    } catch {
      this.toast.error('Error', 'Some changes failed to save. Please retry.');
    } finally {
      this.saving = false;
      this.cdr.markForCheck();
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────

  get dirtyCount(): number { return this.students.filter(s => s.dirty).length; }
  get canLoad(): boolean { return !!(this.selectedSession && this.selectedClass && this.selectedTemplateId); }

  trackById(_i: number, s: StudentRow): string { return s.studentId; }
  trackByAct(_i: number, act: string): string { return act; }
}
