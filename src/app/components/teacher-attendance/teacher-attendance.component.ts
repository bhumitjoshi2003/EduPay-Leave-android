import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { LoggerService } from '../../services/logger.service';
import { LeaveService } from '../../services/leave.service';
import { StudentService } from '../../services/student.service';
import { FormsModule } from '@angular/forms';
import { CommonModule, formatDate } from '@angular/common';
import { SchoolService } from '../../services/school.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { ToastService } from '../../services/toast.service';
import { AttendanceData } from '../../interfaces/atendance-data';
import { AttendanceService } from '../../services/attendance.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { TeacherService } from '../../services/teacher.service';
import { Subject, takeUntil } from 'rxjs';

interface Student {
  studentId: string;
  name: string;
  absent: boolean;
  chargePaid: boolean;
}

@Component({
  selector: 'app-teacher-attendance',
  imports: [
    FormsModule,
    CommonModule,
    MatDatepickerModule,
    MatInputModule,
    MatNativeDateModule,
  ],
  templateUrl: './teacher-attendance.component.html',
  styleUrl: './teacher-attendance.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherAttendanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  students: Student[] = [];
  attendanceDate: Date = new Date();
  selectedClass: string = '';
  absentStudents: string[] = [];

  teacherId: string = '';
  disableDeleteButton: boolean = false;
  loggedInUserRole: string = '';
  hasStudents: boolean = false;

  classList: string[] = [];


  constructor(
    private leaveService: LeaveService,
    private studentService: StudentService,
    private attendanceService: AttendanceService,
    private teacherService: TeacherService,
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
    this.attendanceDate = this.getTodayDateWithoutTime();
    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe(classes => {
      this.classList = classes;
      this.cdr.markForCheck();
    });
    this.getUserRoleAndLoadData();
  }

  getTodayDateWithoutTime(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  getUserRoleAndLoadData(): void {
    const user = this.authStateService.getUser();

    if (user) {
      this.loggedInUserRole = user.role;
      this.teacherId = user.userId;

      if (this.loggedInUserRole === 'ADMIN') {
        this.selectedClass = localStorage.getItem('lastSelectedClass') || '';
        this.loadStudentsAndApplyAttendance();
      } else {
        this.getTeacherClassAndLoadStudents();
      }
    }
  }


  getTeacherClassAndLoadStudents(): void {
    this.teacherService.getTeacher(this.teacherId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (teacher: any) => {
        this.selectedClass = teacher.classTeacher;
        this.loadStudentsAndApplyAttendance();
      },
      error: () => {
        this.toast.error('Error', 'Failed to fetch teacher details.');
      },
    });
  }

  onClassSelect(selectedClass: string): void {
    this.selectedClass = selectedClass;
    localStorage.setItem('lastSelectedClass', selectedClass);
    this.loadStudentsAndApplyAttendance();
  }

  loadStudentsAndApplyAttendance(): void {
    if (this.isSunday(this.attendanceDate)) {
      this.students = [];
      this.cdr.markForCheck();
      return;
    }

    const classAtRequest = this.selectedClass;
    const dateAtRequest = this.attendanceDate;

    this.studentService.getActiveStudentsByClass(classAtRequest).pipe(takeUntil(this.destroy$)).subscribe({
      next: (studentLeaveDTOs) => {
        if (this.selectedClass !== classAtRequest || this.attendanceDate !== dateAtRequest) return;
        this.students = studentLeaveDTOs.map((dto) => ({
          studentId: dto.studentId,
          name: dto.name,
          absent: false,
          chargePaid: true,
        }));
        this.hasStudents = this.students.length > 0;
        this.cdr.markForCheck();
        this.applyAttendanceAndLeavesToStudents();
      },
      error: (error) => {
        this.logger.error('Error loading students:', error);
        this.toast.error('Error', 'Failed to load students.');
      },
    });
  }

  applyAttendanceAndLeavesToStudents(): void {
    const formattedDate = formatDate(this.attendanceDate, 'yyyy-MM-dd', 'en');
    const classAtRequest = this.selectedClass;
    const dateAtRequest = this.attendanceDate;

    this.attendanceService.getAttendanceByDateAndClass(formattedDate, classAtRequest).pipe(takeUntil(this.destroy$)).subscribe({
      next: (attendanceData) => {
        if (this.selectedClass !== classAtRequest || this.attendanceDate !== dateAtRequest) return;
        if (attendanceData && attendanceData.length === 0) {
          this.disableDeleteButton = true;
        }
        if (attendanceData && attendanceData.length > 0) {
          this.disableDeleteButton = false;
          const attendanceMap = new Map<string, AttendanceData>();
          attendanceData.forEach((attendance) => {
            attendanceMap.set(attendance.studentId, attendance);
          });

          this.students.forEach((student) => {
            const attendance = attendanceMap.get(student.studentId);
            if (attendance) {
              student.absent = true;
              student.chargePaid = attendance.chargePaid;
            } else {
              student.absent = false;
              student.chargePaid = true;
            }
          });
          this.cdr.markForCheck();
        } else {
          this.leaveService.getLeavesByDateAndClass(formattedDate, classAtRequest).subscribe({
            next: (leaves) => {
              if (this.selectedClass !== classAtRequest || this.attendanceDate !== dateAtRequest) return;
              this.absentStudents = leaves;
              this.students.forEach((student) => {
                if (this.absentStudents.includes(student.studentId)) {
                  student.absent = true;
                  student.chargePaid = true;
                } else {
                  student.absent = false;
                  student.chargePaid = true;
                }
              });
              this.cdr.markForCheck();
            },
            error: (error) => {
              this.logger.error('No leaves found or error fetching leaves:', error);
            },
          });
        }
      },
      error: (error) => {
        this.logger.error('Error loading attendance data:', error);
        this.leaveService.getLeavesByDateAndClass(formattedDate, classAtRequest).subscribe({
          next: (leaves) => {
            if (this.selectedClass !== classAtRequest || this.attendanceDate !== dateAtRequest) return;
            this.absentStudents = leaves;
            this.students.forEach((student) => {
              if (this.absentStudents.includes(student.studentId)) {
                student.absent = true;
                student.chargePaid = true;
              } else {
                student.absent = false;
                student.chargePaid = true;
              }
            });
            this.cdr.markForCheck();
          },
          error: (leavesError) => {
            this.logger.error('Error loading leaves after attendance failed:', leavesError);
            this.toast.error('Error', 'Failed to load attendance or leave data.');
          },
        });
      },
    });
  }

  markAbsent(studentId: string): void {
    const student = this.students.find((s) => s.studentId === studentId);
    if (student) {
      student.absent = true;
      student.chargePaid = this.absentStudents.includes(student.studentId);
    }
  }

  markPresent(studentId: string): void {
    const student = this.students.find((s) => s.studentId === studentId);
    if (student) {
      student.absent = false;
      student.chargePaid = true;
    }
  }

  onDateChange(event: any): void {
    const selectedDate = event.value;
    if (selectedDate) {
      const offset = selectedDate.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(selectedDate.getTime() - offset);
      adjustedDate.setHours(0, 0, 0, 0);
      this.attendanceDate = adjustedDate;

      this.loadStudentsAndApplyAttendance();
    }
  }

  saveAttendance(): void {
    this.toast.confirm({
      title: 'Confirm Save',
      message: 'Are you sure you want to save the attendance?',
      confirmText: 'Yes, save it!',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (confirmed) {
        const attendanceData: AttendanceData[] = this.students
          .filter((student) => student.absent)
          .map((student) => ({
            studentId: student.studentId,
            chargePaid: student.chargePaid,
            date: formatDate(this.attendanceDate, 'yyyy-MM-dd', 'en'),
            className: this.selectedClass,
          }));

        attendanceData.push({
          studentId: 'X',
          chargePaid: true,
          date: formatDate(this.attendanceDate, 'yyyy-MM-dd', 'en'),
          className: this.selectedClass,
        });

        this.attendanceService.saveAttendance(attendanceData).subscribe({
          next: () => {
            this.toast.success('Attendance Saved!', 'Attendance data saved successfully.');
            this.applyAttendanceAndLeavesToStudents();
          },
          error: (error) => {
            this.logger.error('Error saving attendance:', error);
            this.toast.error('Error!', error.error || 'Failed to save attendance. Please try again.');
          },
        });
      }
    });
  }

  isDateWithinAllowedRange(): boolean {
    if (this.loggedInUserRole === 'ADMIN') { return true; }

    const today = this.getTodayDateWithoutTime();
    const selected = new Date(this.attendanceDate);
    selected.setHours(0, 0, 0, 0);

    const pastLimit = new Date(today);
    pastLimit.setDate(today.getDate() - 3);

    return selected >= pastLimit && selected <= today;
  }

  getRelativeDate(offset: number): string {
    const date = this.getTodayDateWithoutTime();
    date.setDate(date.getDate() + offset);
    return formatDate(date, 'yyyy-MM-dd', 'en');
  }

  trackByStudentId(index: number, student: Student): string { return student.studentId; }
  trackByClass(index: number, className: string): string { return className; }

  isSunday(date: Date | null): boolean {
    return date ? new Date(date).getDay() === 0 : false;
  }

  deleteAttendance(): void {
    if (!this.isDateWithinAllowedRange()) {
      this.toast.warning('Not Allowed', 'You can only delete attendance for today or yesterday.');
      return;
    }

    if (this.isSunday(this.attendanceDate)) {
      this.toast.info('Invalid Date', 'Cannot delete attendance for Sundays.');
      return;
    }

    this.toast.confirm({
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete the attendance for this date?',
      confirmText: 'Yes, delete it!',
      cancelText: 'Cancel',
      danger: true,
    }).then((confirmed) => {
      if (confirmed) {
        const formattedDate = formatDate(this.attendanceDate, 'yyyy-MM-dd', 'en');
        this.attendanceService.deleteAttendanceByDateAndClass(formattedDate, this.selectedClass).subscribe({
          next: () => {
            this.toast.success('Deleted!', 'Attendance has been deleted.');
            this.loadStudentsAndApplyAttendance(); // refresh the student list
          },
          error: (error) => {
            this.logger.error('Error deleting attendance:', error);
            this.toast.error('Error', error.error || 'Failed to delete attendance.');
          },
        });
      }
    });
  }

}