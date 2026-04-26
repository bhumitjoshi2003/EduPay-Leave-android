import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TimetableService } from '../../services/timetable.service';
import { TeacherService } from '../../services/teacher.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { TimetableEntry } from '../../interfaces/timetable';
import { Teacher } from '../../interfaces/teacher';
import Swal from 'sweetalert2';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './timetable.component.html',
  styleUrl: './timetable.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimetableComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly PERIODS_KEY = 'tt_maxPeriods';

  role = '';
  userId = '';
  userClassName = '';

  readonly days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  readonly dayLabels: Record<string, string> = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday'
  };
  readonly periodOptions = [4, 5, 6, 7, 8, 9, 10];
  readonly classList = [
    'Play group', 'Nursery', 'LKG', 'UKG',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
  ];

  maxPeriods: number = parseInt(localStorage.getItem(this.PERIODS_KEY) ?? '8', 10);

  get allPeriods(): number[] {
    return Array.from({ length: this.maxPeriods }, (_, i) => i + 1);
  }

  /** Students only see rows that have at least one entry. Admin sees all rows. */
  get visiblePeriods(): number[] {
    if (this.isAdmin()) return this.allPeriods;
    const populated = new Set(this.entries.map(e => e.periodNumber));
    return this.allPeriods.filter(p => populated.has(p));
  }

  // Class view — one entry per cell
  selectedClass = '';
  entries: TimetableEntry[] = [];
  grid: Record<string, Record<number, TimetableEntry>> = {};

  // Teacher view grouped by day
  teacherEntries: TimetableEntry[] = [];
  teacherGrid: Record<string, TimetableEntry[]> = {};

  isLoading = false;
  error: string | null = null;

  teachers: Teacher[] = [];

  // Modal state
  showModal = false;
  isEditMode = false;
  modalForm: TimetableEntry = this.emptyForm();
  modalError: string | null = null;
  modalSaving = false;

  constructor(
    private timetableService: TimetableService,
    private teacherService: TeacherService,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.userId = user?.userId ?? '';
    this.userClassName = user?.className ?? '';

    if (this.isStudent()) {
      this.selectedClass = this.userClassName;
      this.loadClassTimetable();
    }
    if (this.isTeacher()) this.loadTeacherTimetable();
    if (this.isAdmin()) this.loadTeachers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isStudent(): boolean { return this.role === 'STUDENT'; }
  isTeacher(): boolean { return this.role === 'TEACHER'; }
  isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUB_ADMIN' || this.role === 'SUPER_ADMIN';
  }

  onMaxPeriodsChange(): void {
    localStorage.setItem(this.PERIODS_KEY, String(this.maxPeriods));
    this.cdr.markForCheck();
  }

  // ── Data loading ─────────────────────────────────────────────────

  loadClassTimetable(): void {
    if (!this.selectedClass) return;
    this.isLoading = true;
    this.error = null;
    this.entries = [];
    this.grid = {};
    this.cdr.markForCheck();

    this.timetableService.getClassTimetable(this.selectedClass)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          this.entries = data;
          this.buildGrid(data);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load timetable:', err);
          this.error = 'Failed to load timetable. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadTeacherTimetable(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.timetableService.getTeacherTimetable(this.userId)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => {
          this.teacherEntries = data;
          this.buildTeacherGrid(data);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load teacher timetable:', err);
          this.error = 'Failed to load your schedule. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadTeachers(): void {
    this.teacherService.getAllTeachers()
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (list) => { this.teachers = list; this.cdr.markForCheck(); },
        error: (err) => this.logger.error('Failed to load teachers:', err)
      });
  }

  private buildGrid(data: TimetableEntry[]): void {
    this.grid = {};
    for (const day of this.days) this.grid[day] = {};
    for (const entry of data) {
      if (!this.grid[entry.day]) this.grid[entry.day] = {};
      this.grid[entry.day][entry.periodNumber] = entry;
    }
  }

  private buildTeacherGrid(data: TimetableEntry[]): void {
    this.teacherGrid = {};
    for (const day of this.days) {
      this.teacherGrid[day] = data
        .filter(e => e.day === day)
        .sort((a, b) => a.periodNumber - b.periodNumber);
    }
  }

  getCell(day: string, period: number): TimetableEntry | null {
    return this.grid[day]?.[period] ?? null;
  }

  hasAnyEntry(): boolean { return this.entries.length > 0; }
  hasTeacherEntries(day: string): boolean { return (this.teacherGrid[day]?.length ?? 0) > 0; }
  hasAnyTeacherEntry(): boolean { return this.teacherEntries.length > 0; }

  // ── Modal ────────────────────────────────────────────────────────

  openCreate(day: string, period: number): void {
    if (!this.isAdmin()) return;
    this.isEditMode = false;
    this.modalForm = this.emptyForm();
    this.modalForm.className = this.selectedClass;
    this.modalForm.day = day;
    this.modalForm.periodNumber = period;
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  openEdit(entry: TimetableEntry): void {
    if (!this.isAdmin()) return;
    this.isEditMode = true;
    this.modalForm = { ...entry };
    this.modalError = null;
    this.showModal = true;
    this.cdr.markForCheck();
  }

  closeModal(): void {
    this.showModal = false;
    this.cdr.markForCheck();
  }

  onTeacherSelect(): void {
    const teacher = this.teachers.find(t => t.teacherId === this.modalForm.teacherId);
    this.modalForm.teacherName = teacher?.name ?? '';
  }

  saveEntry(): void {
    this.modalError = null;

    if (!this.modalForm.subjectName?.trim()) {
      this.modalError = 'Subject name is required.'; return;
    }
    if (!this.modalForm.teacherId) {
      this.modalError = 'Please select a teacher.'; return;
    }
    if (!this.modalForm.startTime || !this.modalForm.endTime) {
      this.modalError = 'Start and end time are required.'; return;
    }
    if (this.modalForm.startTime >= this.modalForm.endTime) {
      this.modalError = 'End time must be after start time.'; return;
    }

    this.modalSaving = true;
    this.cdr.markForCheck();

    const save$ = this.isEditMode && this.modalForm.id != null
      ? this.timetableService.updateEntry(this.modalForm.id, this.modalForm)
      : this.timetableService.createEntry(this.modalForm);

    save$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.modalSaving = false;
        this.showModal = false;
        this.loadClassTimetable();
        Swal.fire({ icon: 'success', title: 'Saved!', timer: 1200, showConfirmButton: false });
      },
      error: (err) => {
        this.modalSaving = false;
        this.logger.error('Failed to save timetable entry:', err);
        this.modalError = err.status === 409
          ? 'A subject is already scheduled for this period. Edit the existing one instead.'
          : 'Failed to save. Please try again.';
        this.cdr.markForCheck();
      }
    });
  }

  deleteEntry(): void {
    if (!this.modalForm.id) return;
    Swal.fire({
      title: 'Delete this period?',
      text: `${this.modalForm.subjectName} — ${this.dayLabels[this.modalForm.day]} Period ${this.modalForm.periodNumber}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.timetableService.deleteEntry(this.modalForm.id!)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.showModal = false;
            this.loadClassTimetable();
            Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
          },
          error: (err) => {
            this.logger.error('Failed to delete entry:', err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete. Please try again.' });
          }
        });
    });
  }

  printTimetable(): void {
    if (Capacitor.isNativePlatform()) {
      Swal.fire({ icon: 'info', title: 'Not Available', text: 'Printing is not supported on the mobile app. Please use the web version.' });
      return;
    }
    window.print();
  }

  private emptyForm(): TimetableEntry {
    return {
      className: '', day: 'MONDAY', periodNumber: 1,
      startTime: '', endTime: '', subjectName: '', teacherId: ''
    };
  }

  trackByDay(_: number, day: string): string { return day; }
  trackByPeriod(_: number, p: number): number { return p; }
  trackByEntry(_: number, e: TimetableEntry): string {
    return `${e.id ?? e.day + e.periodNumber}`;
  }
}
