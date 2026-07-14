import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { TransportService, RouteResponse, RouteRequest, StopResponse, StopRequest } from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-routes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-routes.component.html',
  styleUrl: './transport-routes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportRoutesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loadingRoutes = true;
  routes: RouteResponse[] = [];
  selectedRoute: RouteResponse | null = null;
  stops: StopResponse[] = [];
  loadingStops = false;

  showRouteForm = false;
  editingRouteId: number | null = null;
  savingRoute = false;
  routeForm: RouteRequest = { routeName: '', routeType: 'MORNING' };

  showStopForm = false;
  editingStopId: number | null = null;
  savingStop = false;
  stopForm: StopRequest = { stopName: '', sequence: 1, latitude: 0, longitude: 0, geofenceRadius: 200 };

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadRoutes(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  loadRoutes(): void {
    this.loadingRoutes = true; this.cdr.markForCheck();
    this.transport.getRoutes().pipe(
      catchError(() => { this.toast.error('Failed to load routes'); return of([]); }),
      takeUntil(this.destroy$),
    ).subscribe(r => { this.routes = r; this.loadingRoutes = false; this.cdr.markForCheck(); });
  }

  selectRoute(route: RouteResponse): void {
    this.selectedRoute = route;
    this.stops = [];
    this.loadingStops = true;
    this.cdr.markForCheck();
    this.transport.getRouteStops(route.id).pipe(
      catchError(() => { this.toast.error('Failed to load stops'); return of([]); }),
      takeUntil(this.destroy$),
    ).subscribe(s => {
      this.stops = s.sort((a, b) => a.sequence - b.sequence);
      this.loadingStops = false;
      this.cdr.markForCheck();
    });
  }

  openAddRoute(): void {
    this.editingRouteId = null;
    this.routeForm = { routeName: '', routeType: 'MORNING' };
    this.showRouteForm = true; this.cdr.markForCheck();
  }

  openEditRoute(r: RouteResponse): void {
    this.editingRouteId = r.id;
    this.routeForm = { routeName: r.routeName, routeType: r.routeType as any };
    this.showRouteForm = true; this.cdr.markForCheck();
  }

  saveRoute(): void {
    if (!this.routeForm.routeName) { this.toast.warning('Route name is required'); return; }
    this.savingRoute = true; this.cdr.markForCheck();
    const call = this.editingRouteId
      ? this.transport.updateRoute(this.editingRouteId, this.routeForm)
      : this.transport.createRoute(this.routeForm);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success(this.editingRouteId ? 'Route updated' : 'Route created'); this.showRouteForm = false; this.savingRoute = false; this.loadRoutes(); },
      error: (err) => { this.toast.error(err?.error?.message ?? 'Failed to save route'); this.savingRoute = false; this.cdr.markForCheck(); },
    });
  }

  async deleteRoute(r: RouteResponse): Promise<void> {
    const ok = await this.toast.confirm({ title: 'Delete Route', message: `Delete route "${r.routeName}"?`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    this.transport.deactivateRoute(r.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Route deleted'); if (this.selectedRoute?.id === r.id) { this.selectedRoute = null; this.stops = []; } this.loadRoutes(); },
      error: () => this.toast.error('Failed to delete route'),
    });
  }

  openAddStop(): void {
    if (!this.selectedRoute) return;
    this.editingStopId = null;
    this.stopForm = { stopName: '', sequence: this.stops.length + 1, latitude: 0, longitude: 0, geofenceRadius: 200 };
    this.showStopForm = true; this.cdr.markForCheck();
  }

  openEditStop(s: StopResponse): void {
    this.editingStopId = s.id;
    this.stopForm = { stopName: s.stopName, sequence: s.sequence, latitude: s.latitude, longitude: s.longitude, geofenceRadius: s.geofenceRadius ?? 200 };
    this.showStopForm = true; this.cdr.markForCheck();
  }

  saveStop(): void {
    if (!this.stopForm.stopName || !this.stopForm.latitude || !this.stopForm.longitude) {
      this.toast.warning('Stop name, latitude and longitude are required'); return;
    }
    if (!this.selectedRoute) return;
    this.savingStop = true; this.cdr.markForCheck();
    const call = this.editingStopId
      ? this.transport.updateStop(this.editingStopId, this.stopForm)
      : this.transport.addStop(this.selectedRoute.id, this.stopForm);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success(this.editingStopId ? 'Stop updated' : 'Stop added'); this.showStopForm = false; this.savingStop = false; this.selectRoute(this.selectedRoute!); },
      error: (err) => { this.toast.error(err?.error?.message ?? 'Failed to save stop'); this.savingStop = false; this.cdr.markForCheck(); },
    });
  }

  async deleteStop(s: StopResponse): Promise<void> {
    const ok = await this.toast.confirm({ title: 'Delete Stop', message: `Delete stop "${s.stopName}"?`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    this.transport.deleteStop(s.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Stop deleted'); this.selectRoute(this.selectedRoute!); },
      error: () => this.toast.error('Failed to delete stop'),
    });
  }

  moveStop(index: number, direction: 'up' | 'down'): void {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.stops.length) return;
    const arr = [...this.stops];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    // Update sequence numbers
    arr.forEach((s, i) => s.sequence = i + 1);
    this.stops = arr;
    const ids = arr.map(s => s.id);
    this.transport.reorderStops(this.selectedRoute!.id, ids).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => { this.stops = updated.sort((a, b) => a.sequence - b.sequence); this.cdr.markForCheck(); },
      error: () => { this.toast.error('Failed to reorder stops'); this.selectRoute(this.selectedRoute!); },
    });
    this.cdr.markForCheck();
  }

  routeTypeLabel(type: string): string {
    return type === 'MORNING' ? '🌅 Morning' : type === 'AFTERNOON' ? '🌇 Afternoon' : '🔄 Custom';
  }
}
