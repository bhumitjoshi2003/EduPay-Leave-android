import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { TransportService, BusResponse, BusRequest } from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-buses',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-buses.component.html',
  styleUrl: './transport-buses.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportBusesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  buses: BusResponse[] = [];
  assignedCounts = new Map<number, number>();
  search = '';
  showForm = false;
  editingId: number | null = null;
  saving = false;

  form: BusRequest = { busNumber: '', displayName: '', capacity: 40 };

  get academicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    return (now.getMonth() + 1) >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading = true; this.cdr.markForCheck();
    forkJoin({
      buses: this.transport.getBuses().pipe(catchError(() => of([]))),
      assignments: this.transport.getStudentAssignmentsByYear(this.academicYear).pipe(catchError(() => of([]))),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ buses, assignments }) => {
      this.buses = buses;
      const counts = new Map<number, number>();
      for (const a of assignments) {
        counts.set(a.busId, (counts.get(a.busId) ?? 0) + 1);
      }
      this.assignedCounts = counts;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  get filtered(): BusResponse[] {
    const q = this.search.toLowerCase();
    return !q ? this.buses : this.buses.filter(b =>
      b.busNumber.toLowerCase().includes(q) || b.displayName.toLowerCase().includes(q)
    );
  }

  openAdd(): void {
    this.editingId = null;
    this.form = { busNumber: '', displayName: '', capacity: 40 };
    this.showForm = true;
    this.cdr.markForCheck();
  }

  openEdit(bus: BusResponse): void {
    this.editingId = bus.id;
    this.form = { busNumber: bus.busNumber, displayName: bus.displayName, capacity: bus.capacity, make: bus.make, model: bus.model, registrationNumber: bus.registrationNumber };
    this.showForm = true;
    this.cdr.markForCheck();
  }

  save(): void {
    if (!this.form.busNumber || !this.form.displayName) { this.toast.warning('Bus number and display name are required'); return; }
    this.saving = true; this.cdr.markForCheck();
    const call = this.editingId ? this.transport.updateBus(this.editingId, this.form) : this.transport.createBus(this.form);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(this.editingId ? 'Bus updated' : 'Bus added');
        this.showForm = false; this.saving = false;
        this.load();
      },
      error: () => { this.toast.error('Failed to save bus'); this.saving = false; this.cdr.markForCheck(); },
    });
  }

  async deleteBus(bus: BusResponse): Promise<void> {
    const confirmed = await this.toast.confirm({ title: 'Delete Bus', message: `Delete "${bus.displayName}"?`, confirmText: 'Delete', danger: true });
    if (!confirmed) return;
    this.transport.deleteBus(bus.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Bus deleted'); this.load(); },
      error: () => this.toast.error('Failed to delete bus'),
    });
  }
}
