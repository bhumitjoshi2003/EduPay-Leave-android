import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusFeesService, BusFee } from '../../services/bus-fees.service';
import { AcademicSessionService } from '../../services/academic-session.service';
import { AcademicSession } from '../../interfaces/academic-session';
import { Subject, takeUntil } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-bus-fees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bus-fees.component.html',
  styleUrls: ['./bus-fees.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusFeesComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  sessions: AcademicSession[] = [];
  currentSession: AcademicSession | null = null;
  busFeeStructures: BusFee[] = [];
  isEditing = false;
  isLoading = true;
  originalBusFees: BusFee[] = [];

  constructor(
    private busFeesService: BusFeesService,
    private sessionService: AcademicSessionService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.sessionService.getAllSessions().pipe(takeUntil(this.destroy$)).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        const current = sessions.find(s => s.current);
        if (current) {
          this.currentSession = current;
          this.fetchBusFees();
        } else if (sessions.length > 0) {
          this.currentSession = sessions[0];
          this.fetchBusFees();
        } else {
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load academic sessions.');
      }
    });
  }

  fetchBusFees(): void {
    if (!this.currentSession) return;
    this.isLoading = true;
    this.cdr.markForCheck();
    this.busFeesService.getBusFees(this.currentSession.label).pipe(takeUntil(this.destroy$)).subscribe({
      next: (fees) => {
        this.busFeeStructures = fees;
        this.originalBusFees = JSON.parse(JSON.stringify(this.busFeeStructures));
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load bus fee structure.');
      }
    });
  }

  changeSession(session: AcademicSession): void {
    if (this.isEditing) {
      this.toast.confirm({
        title: 'Confirm Navigation',
        message: 'Unsaved changes will be lost. Do you want to continue?',
        confirmText: 'Yes, continue!',
        cancelText: 'No, stay here',
      }).then((confirmed) => {
        if (confirmed) {
          this.currentSession = session;
          this.isEditing = false;
          this.fetchBusFees();
        }
      });
    } else {
      this.currentSession = session;
      this.isEditing = false;
      this.fetchBusFees();
    }
  }

  addRow(): void {
    if (this.isEditing && this.currentSession) {
      this.busFeeStructures.push({
        academicYear: this.currentSession.label,
        minDistance: 0,
        maxDistance: null,
        fees: 0,
      });
      this.cdr.markForCheck();
    }
  }

  removeRow(): void {
    if (this.isEditing && this.busFeeStructures.length > 0) {
      this.busFeeStructures.pop();
      this.cdr.markForCheck();
    }
  }

  edit(): void {
    this.toast.confirm({
      title: 'Enable Edit Mode?',
      message: 'Do you want to enable editing of the bus fee structure?',
      confirmText: 'Yes, enable!',
      cancelText: 'No, cancel',
    }).then((confirmed) => {
      if (confirmed) {
        this.isEditing = true;
        this.cdr.markForCheck();
      }
    });
  }

  save(): void {
    if (!this.currentSession) return;
    this.toast.confirm({
      title: 'Save Changes?',
      message: 'Do you want to save the changes you have made to the bus fees?',
      confirmText: 'Save',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (confirmed) {
        // Issue #24: Validate distance and fee values
        for (const slab of this.busFeeStructures) {
          if (slab.minDistance < 0) {
            this.toast.error('Validation', 'Distance values cannot be negative.');
            return;
          }
          if (slab.fees < 0) {
            this.toast.error('Validation', 'Fee amounts cannot be negative.');
            return;
          }
          if (slab.maxDistance !== null && slab.maxDistance !== undefined && slab.minDistance > slab.maxDistance) {
            this.toast.error('Validation', 'Minimum distance cannot exceed maximum distance.');
            return;
          }
        }

        // Issue #25: Detect overlapping distance ranges
        const sorted = [...this.busFeeStructures].sort((a, b) => a.minDistance - b.minDistance);
        for (let i = 0; i < sorted.length - 1; i++) {
          const curr = sorted[i];
          const next = sorted[i + 1];
          if (curr.maxDistance !== null && curr.maxDistance !== undefined && curr.maxDistance >= next.minDistance) {
            this.toast.error('Overlapping Ranges', `Distance ranges overlap between slabs ${i + 1} and ${i + 2}.`);
            return;
          }
        }

        this.isEditing = false;
        this.cdr.markForCheck();
        this.busFeesService.updateBusFees(this.currentSession!.label, this.busFeeStructures).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.originalBusFees = JSON.parse(JSON.stringify(this.busFeeStructures));
            this.toast.success('Saved!', `Bus fees for ${this.currentSession!.label} saved successfully.`);
          },
          error: () => {
            this.isEditing = true;
            this.cdr.markForCheck();
            this.toast.error('Error!', 'Failed to save. Please check your connection and try again.');
          }
        });
      }
    });
  }

  cancel(): void {
    this.toast.confirm({
      title: 'Cancel Editing?',
      message: 'Are you sure you want to discard your changes?',
      confirmText: 'Yes, discard!',
      cancelText: 'No, continue editing!',
      danger: true,
    }).then((confirmed) => {
      if (confirmed) {
        this.isEditing = false;
        this.busFeeStructures = JSON.parse(JSON.stringify(this.originalBusFees));
        this.cdr.markForCheck();
        this.toast.info('Cancelled!', 'Bus fee changes have been discarded.');
      }
    });
  }

  canEdit(): boolean {
    return this.authStateService.getUserRole() === 'ADMIN';
  }

  trackByIndex(index: number): number { return index; }
  trackBySession(_index: number, session: AcademicSession): number { return session.id; }
}