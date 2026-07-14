import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import {
  TransportService, StudentBusAssignmentResponse, StudentBusAssignmentRequest,
  BusResponse, RouteResponse, StopResponse
} from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-assignments.component.html',
  styleUrl: './transport-assignments.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportAssignmentsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  assignments: StudentBusAssignmentResponse[] = [];
  buses: BusResponse[] = [];
  routes: RouteResponse[] = [];
  stopsForRoute: StopResponse[] = [];

  academicYear = this.currentAcademicYear();
  search = '';
  showForm = false;
  saving = false;
  loadingStops = false;

  form: StudentBusAssignmentRequest = {
    studentId: '', busId: 0, routeId: 0, stopId: 0, academicYear: this.currentAcademicYear(),
  };

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.loadAll(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  currentAcademicYear(): string {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${(year + 1).toString().slice(2)}`;
  }

  loadAll(): void {
    this.loading = true; this.cdr.markForCheck();
    forkJoin({
      assignments: this.transport.getStudentAssignmentsByYear(this.academicYear).pipe(catchError(() => of([]))),
      buses: this.transport.getBuses().pipe(catchError(() => of([]))),
      routes: this.transport.getRoutes().pipe(catchError(() => of([]))),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ assignments, buses, routes }) => {
      this.assignments = assignments;
      this.buses = buses;
      this.routes = routes;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  get filtered(): StudentBusAssignmentResponse[] {
    const q = this.search.toLowerCase();
    return !q ? this.assignments : this.assignments.filter(a =>
      a.studentName?.toLowerCase().includes(q) ||
      a.studentId.toLowerCase().includes(q) ||
      a.busDisplayName?.toLowerCase().includes(q)
    );
  }

  openAdd(): void {
    this.form = { studentId: '', busId: 0, routeId: 0, stopId: 0, academicYear: this.academicYear };
    this.stopsForRoute = [];
    this.showForm = true; this.cdr.markForCheck();
  }

  onRouteChange(): void {
    this.form.stopId = 0;
    this.stopsForRoute = [];
    if (!this.form.routeId) return;
    this.loadingStops = true; this.cdr.markForCheck();
    this.transport.getRouteStops(this.form.routeId).pipe(
      catchError(() => of([])),
      takeUntil(this.destroy$),
    ).subscribe(stops => {
      this.stopsForRoute = stops.sort((a, b) => a.sequence - b.sequence);
      this.loadingStops = false;
      this.cdr.markForCheck();
    });
  }

  save(): void {
    if (!this.form.studentId || !this.form.busId || !this.form.routeId || !this.form.stopId) {
      this.toast.warning('All fields are required'); return;
    }
    this.saving = true; this.cdr.markForCheck();
    this.transport.createStudentAssignment(this.form).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Student assigned to bus'); this.showForm = false; this.saving = false; this.loadAll(); },
      error: (err) => { this.toast.error(err?.error?.message ?? 'Failed to assign student'); this.saving = false; this.cdr.markForCheck(); },
    });
  }

  async remove(a: StudentBusAssignmentResponse): Promise<void> {
    const ok = await this.toast.confirm({ title: 'Remove Assignment', message: `Remove bus assignment for ${a.studentName || a.studentId}?`, confirmText: 'Remove', danger: true });
    if (!ok) return;
    this.transport.removeAssignment(a.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Assignment removed'); this.loadAll(); },
      error: () => this.toast.error('Failed to remove assignment'),
    });
  }

  busName(id: number): string { return this.buses.find(b => b.id === id)?.displayName ?? ''; }
  routeName(id: number): string { return this.routes.find(r => r.id === id)?.routeName ?? ''; }
}
