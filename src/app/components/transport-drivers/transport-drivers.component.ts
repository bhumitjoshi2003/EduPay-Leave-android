import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { TransportService, DriverResponse, DriverRequest } from '../../services/transport.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-transport-drivers',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './transport-drivers.component.html',
  styleUrl: './transport-drivers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransportDriversComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = true;
  drivers: DriverResponse[] = [];
  search = '';
  showForm = false;
  editingId: string | null = null;
  saving = false;
  unbinding: string | null = null;

  form: DriverRequest = {
    driverId: '', name: '', email: '', phoneNumber: '',
    dob: '', gender: '', licenseNumber: '', password: '',
  };

  constructor(
    private transport: TransportService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  load(): void {
    this.loading = true; this.cdr.markForCheck();
    this.transport.getDrivers().pipe(
      catchError(() => { this.toast.error('Failed to load drivers'); return of([]); }),
      takeUntil(this.destroy$),
    ).subscribe(d => { this.drivers = d; this.loading = false; this.cdr.markForCheck(); });
  }

  get filtered(): DriverResponse[] {
    const q = this.search.toLowerCase();
    return !q ? this.drivers : this.drivers.filter(d =>
      d.name.toLowerCase().includes(q) || d.driverId.toLowerCase().includes(q) ||
      d.phoneNumber?.toLowerCase().includes(q)
    );
  }

  openAdd(): void {
    this.editingId = null;
    this.form = { driverId: '', name: '', email: '', phoneNumber: '', dob: '', gender: '', licenseNumber: '', password: '' };
    this.showForm = true; this.cdr.markForCheck();
  }

  openEdit(d: DriverResponse): void {
    this.editingId = d.driverId;
    this.form = {
      driverId: d.driverId, name: d.name, email: d.email,
      phoneNumber: d.phoneNumber ?? '', dob: d.dob?.toString() ?? '',
      gender: d.gender ?? '', licenseNumber: d.licenseNumber ?? '', password: '',
    };
    this.showForm = true; this.cdr.markForCheck();
  }

  save(): void {
    if (!this.form.driverId || !this.form.name || !this.form.email || !this.form.phoneNumber) {
      this.toast.warning('Driver ID, name, email and phone are required'); return;
    }
    if (!this.editingId && !this.form.password) {
      this.toast.warning('Password is required for new drivers'); return;
    }
    this.saving = true; this.cdr.markForCheck();
    const call = this.editingId
      ? this.transport.updateDriver(this.editingId, this.form)
      : this.transport.createDriver(this.form);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success(this.editingId ? 'Driver updated' : 'Driver registered'); this.showForm = false; this.saving = false; this.load(); },
      error: (err) => { this.toast.error(err?.error?.message ?? 'Failed to save driver'); this.saving = false; this.cdr.markForCheck(); },
    });
  }

  async deactivate(d: DriverResponse): Promise<void> {
    const ok = await this.toast.confirm({ title: 'Deactivate Driver', message: `Deactivate "${d.name}"?`, confirmText: 'Deactivate', danger: true });
    if (!ok) return;
    this.transport.deactivateDriver(d.driverId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Driver deactivated'); this.load(); },
      error: () => this.toast.error('Failed to deactivate driver'),
    });
  }

  async unbindDevice(d: DriverResponse): Promise<void> {
    const ok = await this.toast.confirm({ title: 'Unbind Device', message: `Remove device binding for "${d.name}"?`, confirmText: 'Unbind', danger: true });
    if (!ok) return;
    this.unbinding = d.driverId; this.cdr.markForCheck();
    this.transport.unbindDevice(d.driverId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Device unbound'); this.unbinding = null; this.load(); },
      error: () => { this.toast.error('Failed to unbind device'); this.unbinding = null; this.cdr.markForCheck(); },
    });
  }
}
