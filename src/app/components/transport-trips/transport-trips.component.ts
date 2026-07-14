import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { TransportService, TripResponse, PassengerResponse } from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-trips',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-trips.component.html',
  styleUrl: './transport-trips.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportTripsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  activeTab: 'active' | 'history' = 'active';
  loading = true;
  activeTrips: TripResponse[] = [];
  historyTrips: TripResponse[] = [];
  fromDate = '';
  toDate = '';

  showCancelModal = false;
  cancelTripId: number | null = null;
  cancelReason = '';
  cancelling = false;

  showDetailModal = false;
  detailTrip: TripResponse | null = null;
  passengers: PassengerResponse[] = [];
  loadingPassengers = false;

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    this.fromDate = weekAgo;
    this.toDate = today;
    this.loadActive();
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadActive(): void {
    this.loading = true; this.cdr.markForCheck();
    this.transport.getActiveTrips().pipe(
      catchError(() => { this.toast.error('Failed to load active trips'); return of([]); }),
      takeUntil(this.destroy$),
    ).subscribe(trips => {
      this.activeTrips = trips;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  loadHistory(): void {
    this.loading = true; this.cdr.markForCheck();
    this.transport.getTripHistory(this.fromDate, this.toDate).pipe(
      catchError(() => { this.toast.error('Failed to load trip history'); return of([]); }),
      takeUntil(this.destroy$),
    ).subscribe(trips => {
      this.historyTrips = trips;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  switchTab(tab: 'active' | 'history'): void {
    this.activeTab = tab;
    if (tab === 'active') this.loadActive();
    else this.loadHistory();
  }

  openDetail(trip: TripResponse): void {
    this.detailTrip = trip;
    this.showDetailModal = true;
    this.loadingPassengers = true;
    this.cdr.markForCheck();
    this.transport.getTripPassengers(trip.id).pipe(
      catchError(() => of([])),
      takeUntil(this.destroy$),
    ).subscribe(p => {
      this.passengers = p;
      this.loadingPassengers = false;
      this.cdr.markForCheck();
    });
  }

  openCancel(tripId: number): void {
    this.cancelTripId = tripId;
    this.cancelReason = '';
    this.showCancelModal = true;
    this.cdr.markForCheck();
  }

  confirmCancel(): void {
    if (!this.cancelTripId || !this.cancelReason.trim()) {
      this.toast.warning('Please enter a cancellation reason');
      return;
    }
    this.cancelling = true; this.cdr.markForCheck();
    this.transport.cancelTrip(this.cancelTripId, this.cancelReason).pipe(
      takeUntil(this.destroy$),
    ).subscribe({
      next: () => {
        this.toast.success('Trip cancelled');
        this.showCancelModal = false;
        this.cancelling = false;
        this.loadActive();
      },
      error: () => {
        this.toast.error('Failed to cancel trip');
        this.cancelling = false;
        this.cdr.markForCheck();
      },
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'ACTIVE': return 'tt-badge--active';
      case 'COMPLETED': return 'tt-badge--completed';
      case 'CANCELLED': return 'tt-badge--cancelled';
      default: return '';
    }
  }

  passengerStatusClass(status: string): string {
    switch (status) {
      case 'BOARDED': return 'tt-ps--boarded';
      case 'DROPPED': return 'tt-ps--dropped';
      case 'ABSENT_DRIVER_MARKED': case 'PRE_MARKED_ABSENT': return 'tt-ps--absent';
      default: return 'tt-ps--expected';
    }
  }
}
