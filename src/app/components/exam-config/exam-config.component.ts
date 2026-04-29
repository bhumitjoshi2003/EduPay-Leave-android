import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { ExamConfigService, ExamConfig, ExamSubjectEntry } from '../../services/exam-config.service';
import { LoggerService } from '../../services/logger.service';
import { FeesCalculationService } from '../../services/fees-calculation.service';

const ALL_CLASSES = ['1','2','3','4','5','6','7','8','9','10','11','12'];

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

  classOptions = ALL_CLASSES;
  selectedClass = '1';
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
    private feesCalc: FeesCalculationService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService
  ) { }

  ngOnInit(): void {
    this.buildSessions();
    this.loadExams();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildSessions(): void {
    const today = new Date();
    const current = this.feesCalc.getAcademicYear(today);
    const [startStr] = current.split('-');
    const start = parseInt(startStr);
    this.sessions = [
      `${start - 1}-${start}`,
      current,
      `${start + 1}-${start + 2}`,
    ];
    this.selectedSession = current;
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
          Swal.fire('Error', 'Failed to load exams.', 'error');
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
          Swal.fire('Error', 'Could not add exam. It may already exist.', 'error');
        },
      });
  }

  deleteExam(id: number): void {
    Swal.fire({
      title: 'Delete exam?',
      text: 'All subject entries and marks for this exam will be deleted.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.examService.deleteExam(id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.exams = this.exams.filter(e => e.id !== id);
          delete this.examSubjects[id];
          if (this.expandedExamId === id) this.expandedExamId = null;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting exam:', e);
          Swal.fire('Error', 'Could not delete exam.', 'error');
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
      Swal.fire('Incomplete', 'Please fill in subject name, max marks, and exam date.', 'warning');
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
          Swal.fire('Error', 'Could not add subject. It may already exist for this exam.', 'error');
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
    Swal.fire({
      title: 'Remove subject?',
      text: 'This will delete the subject entry and all marks recorded for it.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.examService.deleteExamSubject(entryId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.examSubjects[examId] = this.examSubjects[examId].filter(e => e.id !== entryId);
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error deleting exam subject:', e);
          Swal.fire('Error', 'Could not delete subject entry.', 'error');
        },
      });
    });
  }

  trackById(index: number, item: { id: number }): number { return item.id; }
  trackByIndex(index: number): number { return index; }
}
