import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherService } from '../../services/teacher.service';
import { TeacherAttendanceRecord, TeacherAttendanceSummary } from '../../interfaces/teacher-checkin';
import { Teacher } from '../../interfaces/teacher';
import { TenantService } from '../../services/tenant.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-staff-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-attendance.component.html',
  styleUrl: './staff-attendance.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffAttendanceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  selectedDate: string;
  records: TeacherAttendanceRecord[] = [];
  allTeachers: Teacher[] = [];
  isLoading = false;

  // Summary view
  viewMode: 'daily' | 'monthly' = 'daily';
  summaryMonth: number;
  summaryYear: number;
  monthlySummary: TeacherAttendanceSummary | null = null;
  loadingSummary = false;

  // Admin mark dialog
  showMarkDialog = false;
  markForm = { teacherId: '', date: '', status: 'ON_TIME' };
  isMarking = false;

  readonly statusOptions = [
    { value: 'ON_TIME', label: 'On Time' },
    { value: 'LATE', label: 'Late' },
    { value: 'ABSENT', label: 'Absent' },
    { value: 'HALF_DAY', label: 'Half Day' },
    { value: 'ON_LEAVE', label: 'On Leave' },
  ];

  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(
    private checkinService: TeacherCheckinService,
    private teacherService: TeacherService,
    public tenantService: TenantService,
    private logger: LoggerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    const now = new Date();
    this.selectedDate = now.toISOString().slice(0, 10);
    this.summaryMonth = now.getMonth() + 1;
    this.summaryYear = now.getFullYear();
  }

  ngOnInit(): void {
    this.loadDailyRecords();
    this.loadTeachers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDailyRecords(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.checkinService.getByDate(this.selectedDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (records) => {
          this.records = records;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load attendance records', err);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadTeachers(): void {
    this.teacherService.getAllTeachers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (teachers) => {
          this.allTeachers = teachers;
          this.cdr.markForCheck();
        },
        error: (err) => this.logger.error('Failed to load teachers', err)
      });
  }

  loadMonthlySummary(): void {
    this.loadingSummary = true;
    this.cdr.markForCheck();
    this.checkinService.getSummary(this.summaryMonth, this.summaryYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.monthlySummary = summary;
          this.loadingSummary = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load monthly summary', err);
          this.loadingSummary = false;
          this.cdr.markForCheck();
        }
      });
  }

  onDateChange(): void {
    this.loadDailyRecords();
  }

  switchToMonthly(): void {
    this.viewMode = 'monthly';
    this.loadMonthlySummary();
  }

  switchToDaily(): void {
    this.viewMode = 'daily';
    this.loadDailyRecords();
  }

  goToPreviousMonth(): void {
    if (this.summaryMonth === 1) {
      this.summaryMonth = 12;
      this.summaryYear--;
    } else {
      this.summaryMonth--;
    }
    this.loadMonthlySummary();
  }

  goToNextMonth(): void {
    const now = new Date();
    if (this.summaryYear === now.getFullYear() && this.summaryMonth === now.getMonth() + 1) return;
    if (this.summaryMonth === 12) {
      this.summaryMonth = 1;
      this.summaryYear++;
    } else {
      this.summaryMonth++;
    }
    this.loadMonthlySummary();
  }

  openMarkDialog(): void {
    this.markForm = { teacherId: '', date: this.selectedDate, status: 'ON_TIME' };
    this.showMarkDialog = true;
  }

  closeMarkDialog(): void {
    this.showMarkDialog = false;
  }

  submitAdminMark(): void {
    if (!this.markForm.teacherId || !this.markForm.date || !this.markForm.status) {
      this.toast.warning('Validation', 'Please fill all fields.');
      return;
    }
    this.isMarking = true;
    this.cdr.markForCheck();
    this.checkinService.adminMark(this.markForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Marked', 'Teacher attendance marked successfully.');
          this.isMarking = false;
          this.showMarkDialog = false;
          this.loadDailyRecords();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isMarking = false;
          const msg = typeof err?.error === 'string' ? err.error : 'Failed to mark attendance.';
          this.toast.error('Error', msg);
          this.cdr.markForCheck();
        }
      });
  }

  // ── Helpers ──

  get presentCount(): number { return this.records.filter(r => r.status === 'ON_TIME' || r.status === 'LATE').length; }
  get lateCount(): number { return this.records.filter(r => r.status === 'LATE').length; }
  get absentCount(): number { return this.records.filter(r => r.status === 'ABSENT').length; }
  get halfDayCount(): number { return this.records.filter(r => r.status === 'HALF_DAY').length; }
  get onLeaveCount(): number { return this.records.filter(r => r.status === 'ON_LEAVE').length; }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ON_TIME': return 'sa-badge-ontime';
      case 'LATE': return 'sa-badge-late';
      case 'ABSENT': return 'sa-badge-absent';
      case 'ON_LEAVE': return 'sa-badge-leave';
      case 'HALF_DAY': return 'sa-badge-halfday';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'ON_TIME': return 'On Time';
      case 'LATE': return 'Late';
      case 'ABSENT': return 'Absent';
      case 'ON_LEAVE': return 'On Leave';
      case 'HALF_DAY': return 'Half Day';
      default: return status;
    }
  }

  formatTime(isoTime: string | null): string {
    if (!isoTime) return '—';
    const d = new Date(isoTime);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  getPhotoUrl(record: TeacherAttendanceRecord): string | null {
    const teacher = this.allTeachers.find(t => t.teacherId === record.teacherId);
    return teacher?.photoUrl ? this.tenantService.getLogoUrl(teacher.photoUrl!) : null;
  }

  getTeacherInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  formatDistance(meters: number | null | undefined): string {
    if (meters == null) return '—';
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return meters.toFixed(0) + ' m';
  }
}
