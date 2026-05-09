import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { Teacher } from '../../interfaces/teacher';
import { Router } from '@angular/router';
import { AuthStateService } from '../../auth/auth-state.service';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, switchMap, forkJoin, of, EMPTY } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';

interface Student {
  studentId: string;
  name: string;
}

@Component({
  selector: 'app-student-list',
  imports: [CommonModule],
  templateUrl: './student-list.component.html',
  styleUrl: './student-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class StudentListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  /** Emits a class name whenever we want to load students for that class.
   *  switchMap auto-cancels the previous in-flight set of requests. */
  private loadClass$ = new Subject<string>();
  activeStudents: Student[] = [];
  newStudents: Student[] = [];
  inactiveStudents: Student[] = [];
  isLoading: boolean = true;
  teacherId: string = '';
  loggedInUserRole: string = '';
  selectedClass: string = '';
  classList: string[] = [];

  constructor(
    private studentService: StudentService,
    private teacherService: TeacherService,
    private router: Router,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    // switchMap cancels any previous in-flight batch when the class changes rapidly
    this.loadClass$.pipe(
      takeUntil(this.destroy$),
      switchMap(className => {
        this.isLoading = true;
        this.cdr.markForCheck();

        const active$ = this.studentService.getActiveStudentsByClass(className);
        const upcoming$ = this.loggedInUserRole === 'ADMIN'
          ? this.studentService.getNewStudentsByClass(className)
          : of([] as Student[]);
        const inactive$ = this.loggedInUserRole === 'ADMIN'
          ? this.studentService.getInactiveStudentsByClass(className)
          : of([] as Student[]);

        return forkJoin([active$, upcoming$, inactive$]).pipe(
          map(([active, upcoming, inactive]) => ({ active, upcoming, inactive })),
          catchError(err => {
            this.logger.error('Error loading students:', err);
            this.toast.error('Error', 'Failed to load students. Please try again.');
            this.isLoading = false;
            this.cdr.markForCheck();
            return EMPTY;
          })
        );
      })
    ).subscribe(({ active, upcoming, inactive }) => {
      this.activeStudents = active;
      this.newStudents = upcoming;
      this.inactiveStudents = inactive;
      this.isLoading = false;
      this.cdr.markForCheck();
    });

    this.getUserRoleAndLoadData();
  }

  getUserRoleAndLoadData(): void {
    const user = this.authStateService.getUser();
    if (user) {
      this.loggedInUserRole = user.role;
      this.teacherId = user.userId;

      if (this.loggedInUserRole === 'ADMIN') {
        this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
          next: (classes) => {
            this.classList = classes;
            this.selectedClass = localStorage.getItem('lastSelectedClass') || classes[0] || '';
            this.cdr.markForCheck();
            if (this.selectedClass) {
              this.loadStudents();
            } else {
              // No classes configured yet — stop the loader and show empty state
              this.isLoading = false;
              this.cdr.markForCheck();
            }
          },
          error: () => {
            this.isLoading = false;
            this.cdr.markForCheck();
          }
        });
      } else if (this.loggedInUserRole === 'TEACHER') {
        this.getTeacherClassAndLoadStudents();
      }
    } else {
    }
  }

  getTeacherClassAndLoadStudents(): void {
    this.teacherService.getTeacher(this.teacherId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (teacher: Teacher) => {
        this.selectedClass = teacher.classTeacher ?? '';
        this.loadStudents();
      },
      error: (error: unknown) => {
        this.logger.error('Error fetching teacher details:', error);
        this.isLoading = false;
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load teacher details. Please try again.');
      }
    });
  }

  loadStudents(): void {
    localStorage.setItem('lastSelectedClass', this.selectedClass);
    // Emitting triggers the switchMap pipeline in ngOnInit, which auto-cancels
    // any in-flight requests from the previous class selection
    this.loadClass$.next(this.selectedClass);
  }

  viewStudentDetails(studentId: string): void {
    this.router.navigate(['/dashboard/student-details', studentId]);
  }

  trackByStudentId(index: number, student: Student): string { return student.studentId; }
  trackByClass(index: number, className: string): string { return className; }

  onClassSelect(selectedClass: string): void {
    this.selectedClass = selectedClass;
    this.loadStudents();
  }

  navigateToBulkImport(): void {
    this.router.navigate(['/dashboard/student-bulk-import']);
  }
}