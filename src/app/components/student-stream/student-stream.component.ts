import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { StudentStreamService, StudentStreamOverview } from '../../services/student-stream.service';
import { SubjectConfigService, AcademicStream, OptionalSubjectGroup } from '../../services/subject-config.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-student-stream',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-stream.component.html',
  styleUrl: './student-stream.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentStreamComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  classOptions = ['11', '12'];
  selectedClass = '11';

  students: StudentStreamOverview[] = [];
  streams: AcademicStream[] = [];
  optionalGroups: OptionalSubjectGroup[] = [];
  loading = false;

  editingStudentId: string | null = null;
  editStreamId: number | null = null;
  editOptionalSubjectId: number | null = null;

  constructor(
    private streamService: StudentStreamService,
    private subjectService: SubjectConfigService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    forkJoin([
      this.subjectService.getStreams(),
      this.subjectService.getOptionalGroups(),
    ]).pipe(takeUntil(this.destroy$)).subscribe({
      next: ([streams, groups]) => {
        this.streams = streams;
        this.optionalGroups = groups;
        this.cdr.markForCheck();
        this.loadStudents();
      },
      error: (e) => this.logger.error('Error loading config:', e),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStudents(): void {
    this.loading = true;
    this.students = [];
    this.streamService.getClassStreamOverview(this.selectedClass)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.students = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error loading students:', e);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  startEdit(studentId: string, current: StudentStreamOverview): void {
    this.editingStudentId = studentId;
    this.editStreamId = this.streams.find(s => s.streamName === current.streamName)?.id ?? null;
    this.editOptionalSubjectId = this.allOptionalSubjects.find(s => s.subjectName === current.optionalSubjectName)?.id ?? null;
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingStudentId = null;
    this.editStreamId = null;
    this.editOptionalSubjectId = null;
    this.cdr.markForCheck();
  }

  saveAssignment(student: StudentStreamOverview): void {
    if (!this.editStreamId || !this.editOptionalSubjectId) {
      this.toast.warning('Incomplete', 'Please select both a stream and an optional subject.');
      return;
    }

    const isNew = !student.streamName;
    const op = isNew
      ? this.streamService.assignStream(student.studentId, this.editStreamId, this.editOptionalSubjectId)
      : this.streamService.updateStream(student.studentId, this.editStreamId, this.editOptionalSubjectId);

    // Capture display values from local data before cancelEdit() clears the selections
    const savedStreamName = this.streams.find(s => s.id === this.editStreamId)?.streamName ?? null;
    const savedOptionalName = this.allOptionalSubjects.find(s => s.id === this.editOptionalSubjectId)?.subjectName ?? null;

    op.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.students = this.students.map(st =>
          st.studentId === student.studentId
            ? { ...st, streamName: savedStreamName, optionalSubjectName: savedOptionalName }
            : st
        );
        this.cancelEdit();
        this.cdr.markForCheck();
        this.toast.success('Saved');
      },
      error: (e) => {
        this.logger.error('Error saving stream:', e);
        this.toast.error('Error', 'Could not save assignment.');
      },
    });
  }

  removeAssignment(studentId: string): void {
    this.toast.confirm({
      title: 'Remove stream assignment?',
      confirmText: 'Remove',
      danger: true
    }).then((confirmed) => {
      if (!confirmed) return;
      this.streamService.deleteStream(studentId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          // Immutable update so OnPush detects the change
          this.students = this.students.map(st =>
            st.studentId === studentId
              ? { ...st, streamName: null, optionalSubjectName: null }
              : st
          );
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error removing stream:', e);
          this.toast.error('Error', 'Could not remove assignment.');
        },
      });
    });
  }

  get allOptionalSubjects() {
    return this.optionalGroups.flatMap(g => g.subjects);
  }

  trackByStudentId(index: number, s: StudentStreamOverview): string { return s.studentId; }
  trackById(index: number, item: { id: number }): number { return item.id; }
  trackByIndex(index: number): number { return index; }
}
