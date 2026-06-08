import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MarksService, ClassStudentResult, ClassStudentSubject } from '../../services/marks.service';
import { ExamConfigService, ExamConfig, ExamSubjectEntry } from '../../services/exam-config.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { LoggerService } from '../../services/logger.service';
import { SchoolService, SchoolClass } from '../../services/school.service';
import { SectionService } from '../../services/section.service';
import { Section } from '../../interfaces/section';

@Component({
  selector: 'app-class-results',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './class-results.component.html',
  styleUrl: './class-results.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassResultsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  role = '';
  classOptions: string[] = [];
  sessions: string[] = [];
  managedClasses: SchoolClass[] = [];
  sections: Section[] = [];
  selectedSectionId: number | null = null;

  selectedSession = '';
  selectedClass = '';
  exams: ExamConfig[] = [];
  selectedExamId: number | null = null;
  examSubjects: ExamSubjectEntry[] = [];

  results: ClassStudentResult[] = [];
  loading = false;

  constructor(
    private marksService: MarksService,
    private examService: ExamConfigService,
    private authState: AuthStateService,
    private teacherService: TeacherService,
    private academicSessionService: AcademicSessionService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private schoolService: SchoolService,
    private sectionService: SectionService
  ) { }

  ngOnInit(): void {
    const user = this.authState.getUser();
    this.role = user?.role ?? '';

    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => { this.classOptions = classes; this.cdr.markForCheck(); },
      error: (err) => this.logger.error('Failed to load classes', err)
    });
    this.schoolService.getManagedClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => { this.managedClasses = classes; },
      error: (err) => this.logger.error('Failed to load managed classes', err)
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

  private initAfterSettings(user: { userId: string; role: string } | null): void {
    if (this.role === 'TEACHER') {
      this.teacherService.getTeacher(user!.userId).pipe(takeUntil(this.destroy$)).subscribe({
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

  loadSectionsForClass(className: string): void {
    const cls = this.managedClasses.find(c => c.name === className);
    if (!cls) return;
    this.sectionService.getSectionsForClass(cls.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: sections => { this.sections = sections; this.cdr.markForCheck(); },
      error: (err) => this.logger.error('Failed to load sections', err)
    });
  }

  onSectionSelect(sectionId: number | null): void {
    this.selectedSectionId = sectionId;
    this.results = [];
    if (this.selectedExamId) this.loadResults();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadExams(): void {
    this.exams = [];
    this.selectedExamId = null;
    this.results = [];
    this.examSubjects = [];
    this.selectedSectionId = null;
    this.sections = [];
    this.loadSectionsForClass(this.selectedClass);

    this.examService.getExams(this.selectedSession, this.selectedClass)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.exams = data; this.cdr.markForCheck(); },
        error: (e) => this.logger.error('Error loading exams:', e),
      });
  }

  onExamChange(): void {
    this.results = [];
    this.examSubjects = [];
    if (!this.selectedExamId) return;
    this.examService.getExamSubjects(this.selectedExamId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.examSubjects = data; this.cdr.markForCheck(); this.loadResults(); },
        error: (e) => this.logger.error('Error loading exam subjects:', e),
      });
  }

  loadResults(): void {
    if (!this.selectedExamId) return;
    this.loading = true;
    this.marksService.getClassResults(this.selectedClass, this.selectedExamId, this.selectedSectionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.results = data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e) => {
          this.logger.error('Error loading class results:', e);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  getMarks(student: ClassStudentResult, subjectName: string): number | null {
    return student.subjects.find(s => s.subjectName === subjectName)?.marksObtained ?? null;
  }

  isEnrolled(student: ClassStudentResult, subjectName: string): boolean {
    return student.subjects.some(s => s.subjectName === subjectName);
  }

  openReportCard(studentId: string, examId: number | null): void {
    const queryParams: Record<string, string> = {
      studentId,
      session: this.selectedSession,
    };
    if (examId !== null) queryParams['examId'] = String(examId);
    this.router.navigate(['/dashboard/report-card'], { queryParams });
  }

  trackById(index: number, item: { id: number }): number { return item.id; }
  trackByStudentId(index: number, s: ClassStudentResult): string { return s.studentId; }
  trackByIndex(index: number): number { return index; }
}
