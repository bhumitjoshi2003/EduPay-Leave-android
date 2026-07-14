import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

import {
  TransportService,
  DriverAssignmentResponse,
  DriverAssignmentRequest,
  DriverResponse,
  BusResponse,
  RouteResponse,
  DailyOverrideRequest,
  DailyOverrideResponse,
} from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-driver-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-driver-assignments.component.html',
  styleUrls: ['./transport-driver-assignments.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportDriverAssignmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  assignments: DriverAssignmentResponse[] = [];
  drivers: DriverResponse[] = [];
  buses: BusResponse[] = [];
  routes: RouteResponse[] = [];

  loading = true;
  saving = false;
  panelOpen = false;
  searchQuery = '';

  // Tab state
  activeTab: 'assignments' | 'overrides' = 'assignments';

  // Overrides state
  overrides: DailyOverrideResponse[] = [];
  overridesLoading = false;
  overrideDate: string = new Date().toISOString().split('T')[0];
  overridePanelOpen = false;
  savingOverride = false;
  overrideForm: DailyOverrideRequest = {
    overrideDate: '',
    originalDriverId: '',
    substituteDriverId: '',
    busId: 0,
    routeId: 0,
    tripType: 'MORNING',
    isCancelled: false,
    cancelReason: '',
  };

  form: DriverAssignmentRequest = {
    driverId: '',
    busId: 0,
    morningRouteId: null,
    afternoonRouteId: null,
  };

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.loadOverrides();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      assignments: this.transport.getDriverAssignments().pipe(catchError(() => of([]))),
      drivers: this.transport.getDrivers().pipe(catchError(() => of([]))),
      buses: this.transport.getBuses().pipe(catchError(() => of([]))),
      routes: this.transport.getRoutes().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ assignments, drivers, buses, routes }) => {
        this.assignments = assignments as DriverAssignmentResponse[];
        this.drivers = (drivers as DriverResponse[]).filter(d => d.isActive);
        this.buses = (buses as BusResponse[]).filter(b => b.active);
        this.routes = routes as RouteResponse[];
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  get filteredAssignments(): DriverAssignmentResponse[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.assignments;
    return this.assignments.filter(a =>
      a.driverName.toLowerCase().includes(q) ||
      a.busDisplayName.toLowerCase().includes(q) ||
      a.busNumber.toLowerCase().includes(q) ||
      (a.morningRouteName ?? '').toLowerCase().includes(q) ||
      (a.afternoonRouteName ?? '').toLowerCase().includes(q)
    );
  }

  get morningRoutes(): RouteResponse[] {
    return this.routes.filter(r => r.routeType === 'MORNING' || r.routeType === 'CUSTOM');
  }

  get afternoonRoutes(): RouteResponse[] {
    return this.routes.filter(r => r.routeType === 'AFTERNOON' || r.routeType === 'CUSTOM');
  }

  openPanel(): void {
    this.form = { driverId: '', busId: 0, morningRouteId: null, afternoonRouteId: null };
    this.panelOpen = true;
  }

  closePanel(): void {
    this.panelOpen = false;
  }

  editAssignment(a: DriverAssignmentResponse): void {
    this.form = {
      driverId: a.driverId,
      busId: a.busId,
      morningRouteId: a.morningRouteId ?? null,
      afternoonRouteId: a.afternoonRouteId ?? null,
    };
    this.panelOpen = true;
  }

  isFormValid(): boolean {
    return !!this.form.driverId && !!this.form.busId;
  }

  save(): void {
    if (!this.isFormValid() || this.saving) return;
    this.saving = true;
    this.transport
      .setDriverAssignment(this.form)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Assignment saved', 'Driver-bus assignment has been updated.');
          this.saving = false;
          this.panelOpen = false;
          this.loadAll();
        },
        error: (err) => {
          this.toast.error('Save failed', err?.error?.message ?? 'Could not save assignment.');
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  onDateChange(): void {
    this.loadOverrides();
  }

  loadOverrides(): void {
    if (!this.overrideDate) return;
    this.overridesLoading = true;
    this.transport.getOverrides(this.overrideDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.overrides = data;
          this.overridesLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.overrides = [];
          this.overridesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  openOverridePanel(): void {
    this.overrideForm = {
      overrideDate: this.overrideDate,
      originalDriverId: '',
      substituteDriverId: '',
      busId: 0,
      routeId: 0,
      tripType: 'MORNING',
      isCancelled: false,
      cancelReason: '',
    };
    this.overridePanelOpen = true;
  }

  closeOverridePanel(): void {
    this.overridePanelOpen = false;
  }

  isOverrideFormValid(): boolean {
    const f = this.overrideForm;
    if (!f.busId || !f.routeId || !f.tripType || !f.overrideDate) return false;
    if (f.isCancelled) return !!f.cancelReason?.trim();
    return !!f.substituteDriverId;
  }

  saveOverride(): void {
    if (!this.isOverrideFormValid() || this.savingOverride) return;
    this.savingOverride = true;
    this.transport.createOverride(this.overrideForm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Override saved', 'Daily override has been created.');
          this.savingOverride = false;
          this.overridePanelOpen = false;
          this.loadOverrides();
        },
        error: (err) => {
          this.toast.error('Failed', err?.error?.message ?? 'Could not save override.');
          this.savingOverride = false;
          this.cdr.markForCheck();
        }
      });
  }

  initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }
}
