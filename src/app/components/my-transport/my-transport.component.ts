import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, interval } from 'rxjs';
import { takeUntil, catchError, startWith } from 'rxjs/operators';
import { of } from 'rxjs';
import {
  TransportService,
  StudentBusAssignmentResponse,
  LiveBusLocationResponse,
  StudentAbsenceFlagResponse,
} from '../../services/transport.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-my-transport',
  templateUrl: './my-transport.component.html',
  styleUrls: ['./my-transport.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatIconModule],
})
export class MyTransportComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  assignment: StudentBusAssignmentResponse | null = null;
  liveStatus: LiveBusLocationResponse | null = null;

  loading = true;
  liveLoading = false;
  busNotActive = false;

  studentId = '';
  academicYear = '';

  today = new Date();
  todayStr = '';

  morningAbsenceId: number | null = null;
  afternoonAbsenceId: number | null = null;

  markingAbsence: 'MORNING' | 'AFTERNOON' | null = null;
  cancellingAbsence: 'MORNING' | 'AFTERNOON' | null = null;

  morningReason = '';
  afternoonReason = '';

  showMorningConfirm = false;
  showAfternoonConfirm = false;

  constructor(
    private readonly transportService: TransportService,
    private readonly authState: AuthStateService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.academicYear = this.computeAcademicYear();
    this.todayStr = new Date().toISOString().split('T')[0];
    this.studentId = this.authState.getUserId();
    this.loadAssignment();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private computeAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  private loadAssignment(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.transportService
      .getMyTransportAssignment(this.studentId, this.academicYear)
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((assignment) => {
        this.assignment = assignment;
        this.loading = false;
        this.cdr.markForCheck();

        if (assignment) {
          this.startLivePolling(assignment.busId);
        }
      });
  }

  private startLivePolling(busId: number): void {
    interval(30000)
      .pipe(startWith(0), takeUntil(this.destroy$))
      .subscribe(() => this.fetchLiveStatus(busId));
  }

  private fetchLiveStatus(busId: number): void {
    this.liveLoading = true;
    this.cdr.markForCheck();

    this.transportService
      .getLiveBusLocation(busId)
      .pipe(
        catchError(() => {
          // 404 = bus not on active trip, any other error also treated gracefully
          this.busNotActive = true;
          this.liveStatus = null;
          this.liveLoading = false;
          this.cdr.markForCheck();
          return of(null);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((live) => {
        if (live !== null) {
          this.liveStatus = live;
          this.busNotActive = false;
        }
        this.liveLoading = false;
        this.cdr.markForCheck();
      });
  }

  refreshLive(): void {
    if (!this.assignment) return;
    this.fetchLiveStatus(this.assignment.busId);
  }

  markAbsent(tripType: 'MORNING' | 'AFTERNOON'): void {
    if (!this.assignment || this.markingAbsence) return;

    this.markingAbsence = tripType;
    this.cdr.markForCheck();

    const reason =
      tripType === 'MORNING' ? this.morningReason : this.afternoonReason;

    this.transportService
      .markTransportAbsence({
        studentId: this.studentId,
        tripDate: this.todayStr,
        tripType,
        reason: reason.trim() || undefined,
      })
      .pipe(
        catchError((err) => {
          this.toast.error(
            'Failed to mark absence',
            err?.error?.message ?? 'Please try again.',
          );
          this.markingAbsence = null;
          this.cdr.markForCheck();
          return of(null);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((response: StudentAbsenceFlagResponse | null) => {
        if (response) {
          if (tripType === 'MORNING') {
            this.morningAbsenceId = response.id;
            this.showMorningConfirm = false;
            this.morningReason = '';
          } else {
            this.afternoonAbsenceId = response.id;
            this.showAfternoonConfirm = false;
            this.afternoonReason = '';
          }
          this.toast.success(
            `${tripType === 'MORNING' ? 'Morning' : 'Afternoon'} absence marked`,
            'The driver has been notified.',
          );
        }
        this.markingAbsence = null;
        this.cdr.markForCheck();
      });
  }

  cancelAbsence(tripType: 'MORNING' | 'AFTERNOON'): void {
    if (this.cancellingAbsence) return;

    this.cancellingAbsence = tripType;
    this.cdr.markForCheck();

    this.transportService
      .cancelTransportAbsence(this.studentId, this.todayStr, tripType)
      .pipe(
        catchError((err) => {
          this.toast.error(
            'Failed to cancel absence',
            err?.error?.message ?? 'Please try again.',
          );
          this.cancellingAbsence = null;
          this.cdr.markForCheck();
          return of(null);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        if (tripType === 'MORNING') {
          this.morningAbsenceId = null;
        } else {
          this.afternoonAbsenceId = null;
        }
        this.toast.success('Absence cancelled', 'You have been added back to the trip.');
        this.cancellingAbsence = null;
        this.cdr.markForCheck();
      });
  }

  getMinutesAgo(dateStr: string): number {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / 60000);
  }

  getTripStatusLabel(status: string): string {
    switch (status) {
      case 'IN_PROGRESS': return 'In Progress';
      case 'COMPLETED':   return 'Completed';
      case 'NOT_STARTED': return 'Not Started';
      default:            return status;
    }
  }

  getTripStatusClass(status: string): string {
    switch (status) {
      case 'IN_PROGRESS': return 'mt-badge--active';
      case 'COMPLETED':   return 'mt-badge--done';
      case 'NOT_STARTED': return 'mt-badge--idle';
      default:            return '';
    }
  }
}
