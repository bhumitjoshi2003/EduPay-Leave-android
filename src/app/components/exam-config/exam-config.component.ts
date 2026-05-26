import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { ExamConfigService, ExamConfig, ExamSubjectEntry } from '../../services/exam-config.service';
import { LoggerService } from '../../services/logger.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { SchoolService } from '../../services/school.service';

@Component({
  selector: 'app-exam-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exam-config.component.html',
  styleUrl: './exam-config.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamConfigComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  classOptions: string[] = [];
  selectedClass = '';
  selectedSession = '';
  sessions: string[] = [];

  exams: ExamConfig[] = [];
  isLoadingExams = false;
  expandedExamId: number | null = null;
  examSubjects: Record<number, ExamSubjectEntry[]> = {};

  newExamName = '';

  newSubject: Record<number, { subjectName: string; maxMarks: number | null; examDate: string }> = {};

  editingEntry: ExamSubjectEntry | null = null;
  editMaxMarks: number | null = null;
  editExamDate = '';

  constructor(
    private examService: ExamConfigService,
    private academicSessionService: AcademicSessionService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService,
    private schoolService: SchoolService
  ) { }

  ngOnInit(): void {
    this.academicSessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: sessions => {
        this.sessions = sessions.map(s => s.label);
        const current = sessions.find(s => s.current);
        this.selectedSession = current ? current.label : (this.sessions[0] ?? '');
        this.cdr.markForCheck();
        if (this.selectedClass) this.loadExams();
      },
      error: (e) => this.logger.error('Failed to load sessions', e)
    });
    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => {
        this.classOptions = classes;
        if (!this.selectedClass && classes.length > 0) {
          this.selectedClass = classes[0];
        }
        this.cdr.markForCheck();
        if (this.selectedSession) this.loadExams();
      },
      error: e => this.logger.error('Failed to load classes', e),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadExams(): void {
    this.exams = [];
    this.expandedExamId = null;
    this.examSubjects = {};
    this.isLoadingExams = true;
    this.cdr.markForCheck();
    this.examService.getExams(this.selectedSession, this.selectedClass)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.exams = data;
          this.isLoadingExams = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error loading exams:', e);
          this.isLoadingExams = false;
          this.cdr.markForCheck();
          this.toast.error('Error', 'Failed to load exams.');
        },
      });
  }

  toggleExam(exam: ExamConfig): void {
    if (this.expandedExamId === exam.id) {
      this.expandedExamId = null;
      return;
    }
    this.expandedExamId = exam.id;
    if (!this.examSubjects[exam.id]) {
      this.loadExamSubjects(exam.id);
    }
  }

  loadExamSubjects(examId: number): void {
    this.examService.getExamSubjects(examId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.examSubjects = { ...this.examSubjects, [examId]: data };
        this.cdr.markForCheck();
      },
      error: (e) => this.logger.error('Error loading exam subjects:', e),
    });
  }

  addExam(): void {
    const name = this.newExamName.trim();
    if (!name) return;
    this.examService.addExam(this.selectedSession, this.selectedClass, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exam) => {
          this.exams = [...this.exams, exam];
          this.examSubjects[exam.id] = [];
          this.newExamName = '';
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error adding exam:', e);
          this.toast.error('Error', 'Could not add exam. It may already exist.');
        },
      });
  }

  deleteExam(id: number): void {
    this.toast.confirm({
      title: 'Delete exam?',
      message: 'All subject entries and marks for this exam will be deleted.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteExam(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.exams = this.exams.filter(e => e.id !== id);
          delete this.examSubjects[id];
          if (this.expandedExamId === id) this.expandedExamId = null;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting exam:', e);
          this.toast.error('Error', 'Could not delete exam.');
        },
      });
    });
  }

  initNewSubject(examId: number): void {
    if (!this.newSubject[examId]) {
      this.newSubject[examId] = { subjectName: '', maxMarks: null, examDate: '' };
    }
  }

  addExamSubject(examId: number): void {
    const s = this.newSubject[examId];
    if (!s?.subjectName.trim() || !s.maxMarks || !s.examDate) {
      this.toast.warning('Incomplete', 'Please fill in subject name, max marks, and exam date.');
      return;
    }
    this.examService.addExamSubject(examId, s.subjectName.trim(), s.maxMarks, s.examDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entry) => {
          this.examSubjects[examId] = [...(this.examSubjects[examId] || []), entry];
          this.newSubject[examId] = { subjectName: '', maxMarks: null, examDate: '' };
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error adding exam subject:', e);
          this.toast.error('Error', 'Could not add subject. It may already exist for this exam.');
        },
      });
  }

  startEdit(entry: ExamSubjectEntry): void {
    this.editingEntry = entry;
    this.editMaxMarks = entry.maxMarks;
    this.editExamDate = entry.examDate;
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingEntry = null;
    this.cdr.markForCheck();
  }

  saveEdit(examId: number): void {
    if (!this.editingEntry || !this.editMaxMarks || !this.editExamDate) return;
    this.examService.updateExamSubject(this.editingEntry.id, this.editMaxMarks, this.editExamDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.examSubjects[examId] = this.examSubjects[examId].map(e => e.id === updated.id ? updated : e);
          this.editingEntry = null;
          this.cdr.markForCheck();
        },
        error: (e) => this.logger.error('Error updating exam subject:', e),
      });
  }

  deleteExamSubject(examId: number, entryId: number): void {
    this.toast.confirm({
      title: 'Remove subject?',
      message: 'This will delete the subject entry and all marks recorded for it.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      this.examService.deleteExamSubject(entryId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.examSubjects[examId] = this.examSubjects[examId].filter(e => e.id !== entryId);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting exam subject:', e);
          this.toast.error('Error', 'Could not delete subject entry.');
        },
      });
    });
  }

  trackById(index: number, item: { id: number }): number { return item.id; }
  trackByIndex(index: number): number { return index; }
}
