import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeeStructure, FeeStructureService } from '../../services/fee-structure.service';
import { Subject, takeUntil } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fee-structure.component.html',
  styleUrls: ['./fee-structure.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeeStructureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  sessions: string[] = [];
  currentSession: string = '';
  isEditing = false;
  isLoading = true;
  isNewSessionStarted = false;
  newSessionYear: string = '';
  feeStructures: FeeStructure[] = [];
  originalFeeStructure: FeeStructure[] = [];

  constructor(
    private feeStructureService: FeeStructureService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private toast: ToastService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.fetchSessions();
  }

  fetchSessions(): void {
    this.feeStructureService.getAcademicYears().pipe(takeUntil(this.destroy$)).subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        if (this.sessions.length > 0) {
          this.currentSession = this.sessions[this.sessions.length - 1];
          this.fetchFeeStructures();
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

  fetchFeeStructures(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.feeStructureService.getFeeStructures(this.currentSession).pipe(takeUntil(this.destroy$)).subscribe({
      next: (feeStructures) => {
        this.feeStructures = feeStructures;
        this.originalFeeStructure = JSON.parse(JSON.stringify(this.feeStructures));
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to load fee structure.');
      }
    });
  }

  changeSession(session: string): void {
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
          this.isNewSessionStarted = false;
          this.fetchFeeStructures();
        }
      });
    } else {
      this.currentSession = session;
      this.isEditing = false;
      this.isNewSessionStarted = false;
      this.fetchFeeStructures();
    }
  }

  startNewAcademicYear(): void {
    const nextSession = this.getNextAvailableSession();
    this.toast.confirm({
      title: 'Start New Academic Year?',
      message: `Are you sure to start a new academic year: ${nextSession}?`,
      confirmText: 'Yes, start!',
      cancelText: 'No, cancel',
    }).then((confirmed) => {
      if (confirmed) {
        this.isNewSessionStarted = true;
        this.newSessionYear = nextSession;
        // Copy previous year's fee rows into the new session (className stays, fees are editable)
        this.feeStructures = this.feeStructures.map(fee => ({ ...fee, id: undefined, academicYear: nextSession }));
        this.sessions.push(nextSession);
        this.currentSession = nextSession;
        this.isEditing = true;
        this.cdr.markForCheck();
      }
    });
  }

  getNextAvailableSession(): string {
    if (this.sessions.length === 0) {
      const y = new Date().getFullYear();
      return `${y}-${y + 1}`;
    }

    let [startYear, endYear] = this.sessions[this.sessions.length - 1].split('-').map(Number);

    while (this.sessions.includes(`${startYear + 1}-${endYear + 1}`)) {
      startYear++;
      endYear++;
    }

    return `${startYear + 1}-${endYear + 1}`;
  }

  edit(): void {
    this.toast.confirm({
      title: 'Enable Edit Mode?',
      message: 'Do you want to enable editing of the fee structure?',
      confirmText: 'Yes, enable!',
      cancelText: 'No, cancel',
    }).then((confirmed) => {
      if (confirmed) {
        this.isEditing = true;
        this.cdr.markForCheck();
        //  Swal.fire('Edit Mode Enabled!', '', 'success');
      }
    });
  }

  save(): void {
    this.toast.confirm({
      title: 'Save Changes?',
      message: 'Do you want to save the changes you have made?',
      confirmText: 'Save',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (confirmed) {
        const wasNewSession = this.isNewSessionStarted;
        this.isEditing = false;
        this.isNewSessionStarted = false;
        this.cdr.markForCheck();

        // Always use PUT — updateFeeStructures handles new sessions correctly
        // (delete-first is a no-op when no existing records; then inserts new rows).
        this.feeStructureService.updateFeeStructures(this.currentSession, this.feeStructures)
          .pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
              this.originalFeeStructure = JSON.parse(JSON.stringify(this.feeStructures));
              this.toast.success('Saved!', `Fee structure for ${this.currentSession} saved successfully.`);
            },
            error: (error) => {
              // Restore editing state so the user can retry without losing their work.
              this.isEditing = true;
              this.isNewSessionStarted = wasNewSession;
              this.cdr.markForCheck();
              this.toast.error('Error!', 'Failed to save. Please check your connection and try again.');
              this.logger.error('Error saving fee structure:', error);
            }
          });
      }
    });
  }

  cancel(): void {
    const title = this.isNewSessionStarted ? 'Discard New Session?' : 'Cancel Editing?';
    const text = this.isNewSessionStarted
      ? `Are you sure you want to discard the new academic year (${this.newSessionYear}) setup?`
      : 'Are you sure you want to cancel editing?';
    const confirmButtonText = 'Yes, discard!';
    const cancelButtonText = 'No, continue editing!';

    this.toast.confirm({
      title: title,
      message: text,
      confirmText: confirmButtonText,
      cancelText: cancelButtonText,
      danger: true,
    }).then((confirmed) => {
      if (confirmed) {
        this.isEditing = false;
        const wasNewSessionStarted = this.isNewSessionStarted; // Store the value
        this.isNewSessionStarted = false;

        if (wasNewSessionStarted) {
          const index = this.sessions.indexOf(this.newSessionYear);
          if (index >= 0) {
            this.sessions.splice(index, 1);
            this.cdr.markForCheck();
            if (this.sessions.length > 0) {
              this.currentSession = this.sessions[this.sessions.length - 1];
            } else {
              this.currentSession = ''; // Or a default value
              this.feeStructures = [];
            }
            this.fetchFeeStructures();
          }
        } else {
          this.feeStructures = JSON.parse(JSON.stringify(this.originalFeeStructure));
          this.cdr.markForCheck();
        }
        this.toast.info('Cancelled!', 'Your changes have been discarded.');
      }
    });
  }

  addRow(): void {
    if (this.isEditing) {
      const prev = this.feeStructures.length > 0
        ? this.feeStructures[this.feeStructures.length - 1]
        : null;
      this.feeStructures.push({
        academicYear: this.currentSession,
        className: '',
        tuitionFee: prev?.tuitionFee ?? 0,
        admissionFee: prev?.admissionFee ?? 0,
        annualCharges: prev?.annualCharges ?? 0,
        ecaProject: prev?.ecaProject ?? 0,
        examinationFee: prev?.examinationFee ?? 0,
        labCharges: prev?.labCharges ?? 0,
      });
      this.cdr.markForCheck();
    }
  }

  removeRow(): void {
    if (this.isEditing && this.feeStructures.length > 0) {
      this.feeStructures.pop();
      this.cdr.markForCheck();
    }
  }

  trackBySession(index: number, session: string): string { return session; }
  trackByIndex(index: number): number { return index; }

  canEdit(): boolean {
    return this.authStateService.getUserRole() === 'ADMIN';
  }
}