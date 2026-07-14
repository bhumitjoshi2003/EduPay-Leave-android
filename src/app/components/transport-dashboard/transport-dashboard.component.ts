import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, interval, takeUntil, catchError, of } from 'rxjs';
import { TransportService, FleetSummaryResponse, ActiveBusSummary } from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-dashboard.component.html',
  styleUrl: './transport-dashboard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  fleet: FleetSummaryResponse | null = null;
  lastUpdated = new Date();
  searchQuery = '';

  constructor(
    private transportService: TransportService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
    interval(30_000).pipe(takeUntil(this.destroy$)).subscribe(() => this.load(false));
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(showLoading = true): void {
    if (showLoading) { this.loading = true; this.cdr.markForCheck(); }
    this.transportService.getFleetSummary().pipe(
      catchError(() => { this.toast.error('Failed to load fleet summary'); return of(null); }),
      takeUntil(this.destroy$),
    ).subscribe(data => {
      this.fleet = data;
      this.loading = false;
      this.lastUpdated = new Date();
      this.cdr.markForCheck();
    });
  }

  get filteredBuses(): ActiveBusSummary[] {
    const q = this.searchQuery.toLowerCase();
    const buses = this.fleet?.activeBuses ?? [];
    if (!q) return buses;
    return buses.filter(b =>
      b.busDisplayName.toLowerCase().includes(q) ||
      b.busNumber.toLowerCase().includes(q) ||
      b.driverName.toLowerCase().includes(q)
    );
  }

  boardingPct(bus: ActiveBusSummary): number {
    if (!bus.expectedCount) return 0;
    return Math.round(((bus.boardedCount ?? 0) / bus.expectedCount) * 100);
  }

  viewOnMap(): void { this.router.navigate(['/dashboard/transport-map']); }
  viewTrips(): void { this.router.navigate(['/dashboard/transport-trips']); }
}
