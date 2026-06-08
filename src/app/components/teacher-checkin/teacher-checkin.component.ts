import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, interval, takeUntil } from 'rxjs';
import { TeacherCheckinService } from '../../services/teacher-checkin.service';
import { TeacherAttendanceRecord, TeacherAttendanceSummary } from '../../interfaces/teacher-checkin';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

interface CalendarDay {
  date: number | null;
  status: string;
  fullDate: string;
}

@Component({
  selector: 'app-teacher-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-checkin.component.html',
  styleUrl: './teacher-checkin.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherCheckinComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  userName = '';
  currentTime = '';
  todayRecord: TeacherAttendanceRecord | null = null;
  monthlyData: TeacherAttendanceSummary | null = null;
  calendarDays: CalendarDay[] = [];

  selectedMonth: number;
  selectedYear: number;

  isLoading = false;
  isCheckingIn = false;
  isCheckingOut = false;
  gpsError: string | null = null;

  readonly monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(
    private checkinService: TeacherCheckinService,
    private authState: AuthStateService,
    private logger: LoggerService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
  }

  ngOnInit(): void {
    const user = this.authState.getUser();
    this.userName = user?.name ?? 'Teacher';
    this.updateTime();
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => this.updateTime());
    this.loadMonthlyData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateTime(): void {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    this.cdr.markForCheck();
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  get todayDateStr(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  get hasCheckedIn(): boolean {
    return !!this.todayRecord?.checkInTime;
  }

  get hasCheckedOut(): boolean {
    return !!this.todayRecord?.checkOutTime;
  }

  loadMonthlyData(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.checkinService.getMyAttendance(this.selectedMonth, this.selectedYear)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.monthlyData = data;
          this.findTodayRecord(data);
          this.buildCalendar(data);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.logger.error('Failed to load attendance data', err);
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private findTodayRecord(data: TeacherAttendanceSummary): void {
    const todayStr = new Date().toISOString().slice(0, 10);
    const now = new Date();
    if (this.selectedMonth === now.getMonth() + 1 && this.selectedYear === now.getFullYear()) {
      this.todayRecord = data.records.find(r => r.date === todayStr) ?? null;
    }
  }

  private buildCalendar(data: TeacherAttendanceSummary): void {
    const recordMap = new Map<string, string>();
    data.records.forEach(r => recordMap.set(r.date, r.status));

    const year = this.selectedYear;
    const month = this.selectedMonth - 1;
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Monday=0 start
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: CalendarDay[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push({ date: null, status: '', fullDate: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const status = recordMap.get(dateStr) ?? '';
      days.push({ date: d, status, fullDate: dateStr });
    }
    this.calendarDays = days;
  }

  async checkIn(): Promise<void> {
    this.isCheckingIn = true;
    this.gpsError = null;
    this.cdr.markForCheck();
    try {
      const pos = await this.getPosition();
      this.checkinService.checkIn({ latitude: pos.latitude, longitude: pos.longitude })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (record) => {
            this.todayRecord = record;
            this.isCheckingIn = false;
            if (record.status === 'ON_TIME') {
              this.toast.success('Checked In', 'You are on time! Have a great day.');
            } else {
              this.toast.warning('Checked In — Late', `You were marked as LATE. Distance: ${this.formatDistance(record.distanceFromSchool)}`);
            }
            this.loadMonthlyData();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isCheckingIn = false;
            const msg = typeof err?.error === 'string' ? err.error : 'Check-in failed. Please try again.';
            this.toast.error('Check-in Failed', msg);
            this.cdr.markForCheck();
          }
        });
    } catch (err: any) {
      this.isCheckingIn = false;
      this.gpsError = err?.message || 'Could not get your location.';
      this.toast.error('GPS Error', this.gpsError!);
      this.cdr.markForCheck();
    }
  }

  async checkOut(): Promise<void> {
    this.isCheckingOut = true;
    this.gpsError = null;
    this.cdr.markForCheck();
    try {
      const pos = await this.getPosition();
      this.checkinService.checkOut({ latitude: pos.latitude, longitude: pos.longitude })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (record) => {
            this.todayRecord = record;
            this.isCheckingOut = false;
            this.toast.success('Checked Out', 'Have a nice evening!');
            this.loadMonthlyData();
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isCheckingOut = false;
            const msg = typeof err?.error === 'string' ? err.error : 'Check-out failed. Please try again.';
            this.toast.error('Check-out Failed', msg);
            this.cdr.markForCheck();
          }
        });
    } catch (err: any) {
      this.isCheckingOut = false;
      this.gpsError = err?.message || 'Could not get your location.';
      this.toast.error('GPS Error', this.gpsError!);
      this.cdr.markForCheck();
    }
  }

  private async getPosition(): Promise<{ latitude: number; longitude: number }> {
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(new Error(this.getGpsErrorMessage(err))),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  private getGpsErrorMessage(err: GeolocationPositionError): string {
    switch (err.code) {
      case err.PERMISSION_DENIED: return 'Location permission denied. Please enable GPS.';
      case err.POSITION_UNAVAILABLE: return 'Location unavailable. Please try again.';
      case err.TIMEOUT: return 'Location request timed out. Please try again.';
      default: return 'Could not get your location.';
    }
  }

  goToPreviousMonth(): void {
    if (this.selectedMonth === 1) {
      this.selectedMonth = 12;
      this.selectedYear--;
    } else {
      this.selectedMonth--;
    }
    this.loadMonthlyData();
  }

  goToNextMonth(): void {
    const now = new Date();
    if (this.selectedYear === now.getFullYear() && this.selectedMonth === now.getMonth() + 1) return;
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    this.loadMonthlyData();
  }

  formatCheckInTime(isoTime: string | null): string {
    if (!isoTime) return '—';
    const d = new Date(isoTime);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'ON_TIME': return 'status-ontime';
      case 'LATE': return 'status-late';
      case 'ABSENT': return 'status-absent';
      case 'ON_LEAVE': return 'status-leave';
      case 'HALF_DAY': return 'status-halfday';
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

  getCellClass(day: CalendarDay): string {
    if (!day.date) return 'cal-empty';
    if (!day.status) return 'cal-nodata';
    return 'cal-' + day.status.toLowerCase().replace('_', '');
  }

  isToday(day: CalendarDay): boolean {
    if (!day.fullDate) return false;
    return day.fullDate === new Date().toISOString().slice(0, 10);
  }

  formatDistance(meters: number | null | undefined): string {
    if (meters == null) return '—';
    if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
    return meters.toFixed(0) + ' m';
  }
}
