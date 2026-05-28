import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ToastService } from '../../services/toast.service';
import { ExamConfigService, ExamConfig, ExamSubjectEntry } from '../../services/exam-config.service';
import { MarksService, MarkEntryStudent, StudentExamSubject, MarkEntryRequest } from '../../services/marks.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { StudentService } from '../../services/student.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { LoggerService } from '../../services/logger.service';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';

@Component({
  selector: 'app-mark-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mark-entry.component.html',
  styleUrl: './mark-entry.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkEntryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  mode: 'subject' | 'student' = 'subject';
  role = '';
  classOptions: string[] = [];
  sessions: string[] = [];

  selectedSession = '';
  selectedClass = '';
  exams: ExamConfig[] = [];
  selectedExamId: number | null = null;

  // Mode A — by subject
  examSubjects: ExamSubjectEntry[] = [];
  selectedSubjectEntryId: number | null = null;
  subjectStudents: MarkEntryStudent[] = [];
  marksInputA: Record<string, number | null> = {};
  originalMarksA: Record<string, number | null> = {};

  // Mode B — by student
  students: { studentId: string; name: string }[] = [];
  selectedStudentId = '';
  studentSubjects: StudentExamSubject[] = [];
  marksInputB: Record<number, number | null> = {};
  originalMarksB: Record<number, number | null> = {};

  saving = false;
  managedClasses: SchoolClass[] = [];
  sections: Section[] = [];
  selectedSectionId: number | null = null;

  constructor(
    private examService: ExamConfigService,
    private marksService: MarksService,
    private authState: AuthStateService,
    private teacherService: TeacherService,
    private studentService: StudentService,
    private academicSessionService: AcademicSessionService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService,
    private schoolService: SchoolService,
    private sectionService: SectionService
  ) { }

  ngOnInit(): void {
    const user = this.authState.getUser();
    this.role = user?.role ?? '';

    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => { this.classOptions = classes; this.cdr.markForCheck(); },
      error: () => {}
    });
    this.schoolService.getManagedClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => { this.managedClasses = classes; },
      error: () => {}
    });

    this.academicSessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: sessions => {
        this.sessions = sessions.map(s => s.label);
        const current = sessions.find(s => s.current);
        this.selectedSession = current ? current.label : (this.sessions[0] ?? '');
        this.cdr.markForCheck();
        this.initAfterSettings(user);
      },
      error: (e) => {
        this.logger.error('Failed to load sessions', e);
        this.initAfterSettings(user);
      }
    });
  }

  private initAfterSettings(user: any): void {
    if (this.role === 'TEACHER') {
      const teacherId = user!.userId;
      this.teacherService.getTeacher(teacherId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (t) => {
          this.selectedClass = t.classTeacher ?? '';
          this.cdr.markForCheck();
          if (this.selectedClass) {
            this.loadSectionsForClass(this.selectedClass);
            this.loadExams();
          }
        },
        error: (e) => this.logger.error('Error fetching teacher:', e),
      });
    } else {
      this.selectedClass = this.classOptions.length > 0 ? this.classOptions[0] : '1';
      this.loadSectionsForClass(this.selectedClass);
      this.loadExams();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setMode(m: 'subject' | 'student'): void {
    if (this.mode === m) return;
    this.mode = m;
    this.resetSubjectSelection();
    this.resetStudentSelection();
    // If an exam is already selected, trigger the appropriate data load for the new mode
    if (this.selectedExamId) {
      this.onExamChange();
    }
  }

  onClassChange(): void {
    this.selectedSectionId = null;
    this.sections = [];
    this.loadSectionsForClass(this.selectedClass);
    this.loadExams();
  }

  loadSectionsForClass(className: string): void {
    const cls = this.managedClasses.find(c => c.name === className);
    if (!cls) return;
    this.sectionService.getSectionsForClass(cls.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: sections => { this.sections = sections; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  onSectionSelect(sectionId: number | null): void {
    this.selectedSectionId = sectionId;
    if (this.selectedExamId && this.mode === 'student') {
      this.onExamChange();
    }
  }

  loadExams(): void {
    this.resetSelections();
    this.examService.getExams(this.selectedSession, this.selectedClass)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.exams = data; this.cdr.markForCheck(); },
        error: (e) => { this.logger.error('Error loading exams:', e); this.toast.error('Error', 'Failed to load exams.'); },
      });
  }

  onExamChange(): void {
    this.resetSubjectSelection();
    this.resetStudentSelection();
    if (!this.selectedExamId) return;

    if (this.mode === 'subject') {
      this.loadExamSubjects();
    } else {
      const secId = this.selectedSectionId ?? undefined;
      forkJoin([
        this.examService.getExamSubjects(this.selectedExamId),
        this.studentService.getActiveStudentsByClass(this.selectedClass, secId),
      ]).pipe(takeUntil(this.destroy$)).subscribe({
        next: ([subjects, studentList]) => {
          this.examSubjects = subjects;
          this.students = studentList.map((s: any) => ({ studentId: s.studentId, name: s.name }));
          this.cdr.markForCheck();
        },
        error: (e) => { this.logger.error('Error loading exam data:', e); this.toast.error('Error', 'Failed to load exam data.'); },
      });
    }
  }

  loadExamSubjects(): void {
    if (!this.selectedExamId) return;
    this.examService.getExamSubjects(this.selectedExamId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.examSubjects = data; this.cdr.markForCheck(); },
        error: (e) => { this.logger.error('Error loading exam subjects:', e); this.toast.error('Error', 'Failed to load exam subjects.'); },
      });
  }

  // Mode A — load students for a subject
  onSubjectChange(): void {
    this.subjectStudents = [];
    this.marksInputA = {};
    if (!this.selectedSubjectEntryId) return;

    this.marksService.getStudentsForSubject(this.selectedSubjectEntryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.subjectStudents = data;
          this.marksInputA = {};
          this.originalMarksA = {};
          data.forEach(s => {
            this.marksInputA[s.studentId] = s.marksObtained;
            this.originalMarksA[s.studentId] = s.marksObtained;
          });
          this.cdr.markForCheck();
        },
        error: (e) => { this.logger.error('Error loading students for subject:', e); this.toast.error('Error', 'Failed to load students for this subject.'); },
      });
  }

  // Mode B — load subjects for a student
  onStudentChange(): void {
    this.studentSubjects = [];
    this.marksInputB = {};
    if (!this.selectedStudentId || !this.selectedExamId) return;

    this.marksService.getSubjectsForStudent(this.selectedStudentId, this.selectedExamId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.studentSubjects = data;
          this.marksInputB = {};
          this.originalMarksB = {};
          data.forEach(s => {
            this.marksInputB[s.examSubjectEntryId] = s.marksObtained;
            this.originalMarksB[s.examSubjectEntryId] = s.marksObtained;
          });
          this.cdr.markForCheck();
        },
        error: (e) => { this.logger.error('Error loading subjects for student:', e); this.toast.error('Error', 'Failed to load subjects for this student.'); },
      });
  }

  saveMarksA(): void {
    if (!this.selectedSubjectEntryId) return;

    // Only send entries where the mark has actually changed from the loaded value
    const entries: MarkEntryRequest[] = this.subjectStudents
      .filter(s => {
        const current = this.marksInputA[s.studentId];
        const original = this.originalMarksA[s.studentId];
        return current !== null && current !== undefined && current !== original;
      })
      .map(s => ({
        studentId: s.studentId,
        examSubjectEntryId: this.selectedSubjectEntryId!,
        marksObtained: this.marksInputA[s.studentId]!,
      }));

    if (entries.length === 0) {
      this.toast.info('No Changes', 'No marks were modified.');
      return;
    }

    this.saving = true;
    this.marksService.saveBulkMarks(entries).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.saving = false;
        // Sync snapshot so a second save won't re-send the same changes
        entries.forEach(e => { this.originalMarksA[e.studentId] = e.marksObtained; });
        this.cdr.markForCheck();
        const msg = `Saved: ${result.saved}, Updated: ${result.updated}` +
          (result.errors.length ? `, Errors: ${result.errors.length}` : '');
        result.errors.length ? this.toast.warning('Marks Saved', msg) : this.toast.success('Marks Saved', msg);
      },
      error: (e) => {
        this.saving = false;
        this.logger.error('Error saving marks:', e);
        this.toast.error('Error', 'Failed to save marks.');
        this.cdr.markForCheck();
      },
    });
  }

  saveMarksB(): void {
    if (!this.selectedStudentId) return;

    // Only send subjects where the mark has actually changed from the loaded value
    const entries: MarkEntryRequest[] = this.studentSubjects
      .filter(s => {
        const current = this.marksInputB[s.examSubjectEntryId];
        const original = this.originalMarksB[s.examSubjectEntryId];
        return current !== null && current !== undefined && current !== original;
      })
      .map(s => ({
        studentId: this.selectedStudentId,
        examSubjectEntryId: s.examSubjectEntryId,
        marksObtained: this.marksInputB[s.examSubjectEntryId]!,
      }));

    if (entries.length === 0) {
      this.toast.info('No Changes', 'No marks were modified.');
      return;
    }

    this.saving = true;
    this.marksService.saveBulkMarks(entries).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.saving = false;
        // Sync snapshot so a second save won't re-send the same changes
        entries.forEach(e => { this.originalMarksB[e.examSubjectEntryId] = e.marksObtained; });
        this.cdr.markForCheck();
        this.toast.success('Marks Saved', `Saved: ${result.saved}, Updated: ${result.updated}`);
      },
      error: (e) => {
        this.saving = false;
        this.logger.error('Error saving marks:', e);
        this.toast.error('Error', 'Failed to save marks.');
        this.cdr.markForCheck();
      },
    });
  }

  getSelectedSubject(): ExamSubjectEntry | undefined {
    return this.examSubjects.find(s => s.id === this.selectedSubjectEntryId);
  }

  get selectedStudentName(): string {
    return this.students.find(s => s.studentId === this.selectedStudentId)?.name ?? '';
  }

  private resetSelections(): void {
    this.selectedExamId = null;
    this.exams = [];
    this.resetSubjectSelection();
    this.resetStudentSelection();
  }

  private resetSubjectSelection(): void {
    this.examSubjects = [];
    this.selectedSubjectEntryId = null;
    this.subjectStudents = [];
    this.marksInputA = {};
    this.originalMarksA = {};
  }

  private resetStudentSelection(): void {
    this.students = [];
    this.selectedStudentId = '';
    this.studentSubjects = [];
    this.marksInputB = {};
    this.originalMarksB = {};
  }

  trackById(index: number, item: { id: number }): number { return item.id; }
  trackByEntryId(index: number, s: StudentExamSubject): number { return s.examSubjectEntryId; }
  trackByStudentId(index: number, s: { studentId: string }): string { return s.studentId; }
  trackByIndex(index: number): number { return index; }
}
