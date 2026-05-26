import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AttendanceService } from '../../services/attendance.service';
import { StudentService } from '../../services/student.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { Capacitor } from '@capacitor/core';
import { ToastService } from '../../services/toast.service';
import { SchoolService } from '../../services/school.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import {
  StudentAttendanceSummary, ClassAttendanceSummary, MonthlyBreakdown,
  DailyDetail, CalendarCell, CellStatus
} from '../../interfaces/attendance-summary';

@Component({
  selector: 'app-attendance-summary',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance-summary.component.html',
  styleUrl: './attendance-summary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceSummaryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  role = '';
  userId = '';
  userClassName = '';

  viewMode: 'student' | 'class' = 'student';
  periodType: 'month' | 'year' = 'month';
  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();
  selectedSession: string = '';
  selectedClass: string = '';
  selectedStudentId: string = '';

  studentList: { studentId: string; name: string }[] = [];
  studentSummary: StudentAttendanceSummary | null = null;
  classSummary: ClassAttendanceSummary[] = [];

  isLoading = false;
  error: string | null = null;

  // ── Calendar state ──────────────────────────────────────────────
  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** Month view: single calendar toggle */
  calendarExpanded = false;
  calendarLoading = false;
  currentCalendarWeeks: CalendarCell[][] = [];

  /** Year view: per-row expand state */
  expandedRowKeys = new Set<string>();
  rowCalendarWeeks = new Map<string, CalendarCell[][]>();
  rowCalendarLoading = new Set<string>();
  expandAllActive = false;

  /** Shared cache so we don't re-fetch on re-expand */
  private dailyDetailCache = new Map<string, DailyDetail>();

  classList: string[] = [];
  readonly months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];
  sessions: string[] = [];
  years: number[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private attendanceService: AttendanceService,
    private studentService: StudentService,
    private authStateService: AuthStateService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
    private schoolService: SchoolService,
    private academicSessionService: AcademicSessionService
  ) {}

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.userId = user?.userId ?? '';
    this.userClassName = user?.className ?? '';

    this.schoolService.getClasses().pipe(takeUntil(this.destroy$)).subscribe({
      next: classes => { this.classList = classes; this.cdr.markForCheck(); },
      error: () => {}
    });

    this.academicSessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: sessions => {
        this.sessions = sessions.map(s => s.label);
        const current = sessions.find(s => s.current);
        this.selectedSession = current ? current.label : (this.sessions[0] ?? '');
        this.initYears();
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.logger.error('Failed to load sessions', e);
        this.initYears();
        this.cdr.markForCheck();
      }
    });

    if (this.role === 'STUDENT') {
      this.selectedStudentId = this.userId;
      this.loadReport();
      return;
    }

    if (this.role === 'TEACHER' && this.userClassName) {
      this.selectedClass = this.userClassName;
      this.loadStudentList();
    }

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['studentId']) {
        this.selectedStudentId = params['studentId'];
        if (params['className']) {
          this.selectedClass = params['className'];
          this.loadStudentList();
        }
        this.loadReport();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initYears(): void {
    const current = new Date().getFullYear();
    for (let y = current; y >= current - 3; y--) this.years.push(y);
  }

  setViewMode(mode: 'student' | 'class'): void {
    this.viewMode = mode;
    this.studentSummary = null;
    this.classSummary = [];
    this.error = null;
    this.resetCalendarState();
    this.cdr.markForCheck();
  }

  setPeriodType(type: 'month' | 'year'): void {
    this.periodType = type;
    this.studentSummary = null;
    this.classSummary = [];
    this.error = null;
    this.resetCalendarState();
    this.cdr.markForCheck();
  }

  onClassChange(): void {
    this.selectedStudentId = '';
    this.studentSummary = null;
    this.classSummary = [];
    this.studentList = [];
    this.resetCalendarState();
    if (this.viewMode === 'student' && this.selectedClass) this.loadStudentList();
    this.cdr.markForCheck();
  }

  private resetCalendarState(): void {
    this.calendarExpanded = false;
    this.calendarLoading = false;
    this.currentCalendarWeeks = [];
    this.expandedRowKeys.clear();
    this.rowCalendarWeeks.clear();
    this.rowCalendarLoading.clear();
    this.expandAllActive = false;
    this.dailyDetailCache.clear();
  }

  loadStudentList(): void {
    if (!this.selectedClass) return;
    this.studentService.getActiveStudentsByClass(this.selectedClass).pipe(takeUntil(this.destroy$)).subscribe({
      next: (students) => {
        this.studentList = students;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.logger.error('Failed to load students:', err);
        this.toast.error('Error', 'Failed to load student list. Please try again.');
      }
    });
  }

  loadReport(): void {
    this.error = null;
    this.resetCalendarState();
    if (this.viewMode === 'student') {
      if (!this.selectedStudentId) { this.error = 'Please select a student.'; this.cdr.markForCheck(); return; }
      this.loadStudentSummary();
    } else {
      if (!this.selectedClass) { this.error = 'Please select a class.'; this.cdr.markForCheck(); return; }
      this.loadClassSummary();
    }
  }

  private buildParams(): Record<string, string | number> {
    if (this.periodType === 'month') return { type: 'month', month: this.selectedMonth, year: this.selectedYear };
    return { type: 'year', session: this.selectedSession };
  }

  private loadStudentSummary(): void {
    this.isLoading = true;
    this.studentSummary = null;
    this.cdr.markForCheck();

    this.attendanceService.getStudentSummary(this.selectedStudentId, this.buildParams())
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.studentSummary = data; this.isLoading = false; this.cdr.markForCheck(); },
        error: (err) => {
          this.logger.error('Failed to load student summary:', err);
          this.error = 'Failed to load attendance summary. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private loadClassSummary(): void {
    this.isLoading = true;
    this.classSummary = [];
    this.cdr.markForCheck();

    this.attendanceService.getClassSummary(this.selectedClass, this.buildParams())
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (data) => { this.classSummary = data; this.isLoading = false; this.cdr.markForCheck(); },
        error: (err) => {
          this.logger.error('Failed to load class summary:', err);
          this.error = 'Failed to load class attendance summary. Please try again.';
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // ── Calendar: Month View ─────────────────────────────────────────

  toggleMonthCalendar(): void {
    this.calendarExpanded = !this.calendarExpanded;
    if (!this.calendarExpanded) {
      this.cdr.markForCheck();
      return;
    }
    const key = `${this.selectedMonth}-${this.selectedYear}`;
    if (this.dailyDetailCache.has(key)) {
      this.currentCalendarWeeks = this.buildCalendarCells(this.selectedYear, this.selectedMonth, this.dailyDetailCache.get(key)!);
      this.cdr.markForCheck();
    } else {
      this.calendarLoading = true;
      this.currentCalendarWeeks = [];
      this.cdr.markForCheck();
      this.attendanceService.getStudentDailyDetail(this.selectedStudentId, this.selectedMonth, this.selectedYear)
        .pipe(takeUntil(this.destroy$)).subscribe({
          next: (detail) => {
            this.dailyDetailCache.set(key, detail);
            this.currentCalendarWeeks = this.buildCalendarCells(this.selectedYear, this.selectedMonth, detail);
            this.calendarLoading = false;
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.logger.error('Failed to load daily detail:', err);
            this.calendarLoading = false;
            this.cdr.markForCheck();
          }
        });
    }
  }

  // ── Calendar: Year View rows ─────────────────────────────────────

  getRowKey(row: MonthlyBreakdown): string {
    return `${row.month}-${row.year}`;
  }

  isRowExpanded(row: MonthlyBreakdown): boolean {
    return this.expandedRowKeys.has(this.getRowKey(row));
  }

  isRowLoading(row: MonthlyBreakdown): boolean {
    return this.rowCalendarLoading.has(this.getRowKey(row));
  }

  getRowCalendar(row: MonthlyBreakdown): CalendarCell[][] {
    return this.rowCalendarWeeks.get(this.getRowKey(row)) ?? [];
  }

  toggleRowCalendar(row: MonthlyBreakdown): void {
    const key = this.getRowKey(row);
    if (this.expandedRowKeys.has(key)) {
      this.expandedRowKeys.delete(key);
      if (this.expandedRowKeys.size === 0) this.expandAllActive = false;
      this.cdr.markForCheck();
      return;
    }
    this.expandedRowKeys.add(key);
    this.loadRowDetailIfNeeded(row, key);
    this.cdr.markForCheck();
  }

  private loadRowDetailIfNeeded(row: MonthlyBreakdown, key: string): void {
    if (this.dailyDetailCache.has(key)) {
      const detail = this.dailyDetailCache.get(key)!;
      const monthNum = this.getMonthNumber(row.month);
      this.rowCalendarWeeks.set(key, this.buildCalendarCells(row.year, monthNum, detail));
      this.cdr.markForCheck();
      return;
    }
    const monthNum = this.getMonthNumber(row.month);
    this.rowCalendarLoading.add(key);
    this.cdr.markForCheck();
    this.attendanceService.getStudentDailyDetail(this.selectedStudentId, monthNum, row.year)
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (detail) => {
          this.dailyDetailCache.set(key, detail);
          this.rowCalendarWeeks.set(key, this.buildCalendarCells(row.year, monthNum, detail));
          this.rowCalendarLoading.delete(key);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load daily detail for row:', err);
          this.rowCalendarLoading.delete(key);
          this.cdr.markForCheck();
        }
      });
  }

  expandAll(): void {
    this.expandAllActive = true;
    const breakdown = this.studentSummary?.monthlyBreakdown ?? [];
    breakdown.forEach(row => {
      const key = this.getRowKey(row);
      this.expandedRowKeys.add(key);
      this.loadRowDetailIfNeeded(row, key);
    });
    this.cdr.markForCheck();
  }

  collapseAll(): void {
    this.expandAllActive = false;
    this.expandedRowKeys.clear();
    this.cdr.markForCheck();
  }

  // ── Calendar builder ─────────────────────────────────────────────

  private buildCalendarCells(year: number, month: number, detail: DailyDetail): CalendarCell[][] {
    const schoolDaySet = new Set(detail.schoolDays);
    const absentDaySet = new Set(detail.absentDays);
    const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: CalendarCell[] = [];

    for (let i = 0; i < firstDow; i++) {
      cells.push({ date: null, day: null, status: 'empty' });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let status: CellStatus;
      if (schoolDaySet.has(dateStr)) {
        status = absentDaySet.has(dateStr) ? 'absent' : 'present';
      } else {
        status = 'closed';
      }
      cells.push({ date: dateStr, day: d, status });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  getMonthNumber(monthName: string): number {
    return this.months.find(m => m.label === monthName)?.value ?? 1;
  }

  getAttendanceClass(pct: number): string {
    if (pct >= 80) return 'status-green';
    if (pct >= 60) return 'status-yellow';
    return 'status-red';
  }

  getAttendanceLabel(pct: number): string {
    if (pct >= 80) return 'Good';
    if (pct >= 60) return 'Low';
    return 'Critical';
  }

  getPeriodLabel(): string {
    if (this.periodType === 'month') {
      return `${this.months.find(m => m.value === +this.selectedMonth)?.label} ${this.selectedYear}`;
    }
    return `Academic Year ${this.selectedSession}`;
  }

  canShowViewToggle(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUB_ADMIN' || this.role === 'SUPER_ADMIN' || this.role === 'TEACHER';
  }

  canChangeClass(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUB_ADMIN' || this.role === 'SUPER_ADMIN';
  }

  printReport(): void {
    if (Capacitor.isNativePlatform()) {
      this.toast.info('Not Available', 'Printing is not supported on the mobile app. Please use the web version.');
      return;
    }
    window.print();
  }

  goBack(): void {
    this.router.navigate(['/dashboard/student-list']);
  }

  trackByMonth(_: number, row: MonthlyBreakdown): string { return `${row.month}-${row.year}`; }
  trackByStudentId(_: number, row: ClassAttendanceSummary): string { return row.studentId; }
  trackByIndex(i: number): number { return i; }
}
