import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { StudentService } from '../../services/student.service';
import { TeacherService } from '../../services/teacher.service';
import { Router } from '@angular/router';
import { AuthStateService } from '../../auth/auth-state.service';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { LoggerService } from '../../services/logger.service';
import Swal from 'sweetalert2';

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
  activeStudents: Student[] = [];
  newStudents: Student[] = [];
  inactiveStudents: Student[] = [];
  isLoading: boolean = true;
  teacherId: string = '';
  loggedInUserRole: string = '';
  selectedClass: string = '';
  classList: string[] = [
    'Play group', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  ];

  constructor(
    private studentService: StudentService,
    private teacherService: TeacherService,
    private router: Router,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.getUserRoleAndLoadData();
  }

  getUserRoleAndLoadData(): void {
    const user = this.authStateService.getUser();
    if (user) {
      this.loggedInUserRole = user.role;
      this.teacherId = user.userId;

      if (this.loggedInUserRole === 'ADMIN') {
        this.selectedClass = localStorage.getItem('lastSelectedClass') || this.classList[0];
        this.loadStudents();
      } else if (this.loggedInUserRole === 'TEACHER') {
        this.getTeacherClassAndLoadStudents();
      }
    } else {
    }
  }

  getTeacherClassAndLoadStudents(): void {
    this.teacherService.getTeacher(this.teacherId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (teacher: any) => {
        this.selectedClass = teacher.classTeacher;
        this.loadStudents();
      },
      error: (error: any) => {
        this.logger.error('Error fetching teacher details:', error);
        this.isLoading = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'Failed to load teacher details. Please try again.', 'error');
      }
    });
  }

  loadStudents(): void {
    const classAtRequest = this.selectedClass;
    localStorage.setItem('lastSelectedClass', classAtRequest);
    this.isLoading = true;
    this.cdr.markForCheck();

    this.studentService.getActiveStudentsByClass(classAtRequest).pipe(takeUntil(this.destroy$)).subscribe({
      next: (students) => {
        if (this.selectedClass !== classAtRequest) return;
        this.activeStudents = students;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.logger.error('Error loading active students:', err);
        this.isLoading = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'Failed to load students. Please try again.', 'error');
      }
    });

    if (this.loggedInUserRole === 'ADMIN') {
      this.studentService.getNewStudentsByClass(classAtRequest).pipe(takeUntil(this.destroy$)).subscribe({
        next: (students) => {
          if (this.selectedClass !== classAtRequest) return;
          this.newStudents = students;
          this.cdr.markForCheck();
        },
        error: (err) => this.logger.error('Error loading new students:', err)
      });
      this.studentService.getInactiveStudentsByClass(classAtRequest).pipe(takeUntil(this.destroy$)).subscribe({
        next: (students) => {
          if (this.selectedClass !== classAtRequest) return;
          this.inactiveStudents = students;
          this.cdr.markForCheck();
        },
        error: (err) => this.logger.error('Error loading inactive students:', err)
      });
    }
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