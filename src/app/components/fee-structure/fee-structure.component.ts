import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusFeesComponent } from '../bus-fees/bus-fees.component';
import { FeeStructure, FeeStructureService } from '../../services/fee-structure.service';
import { Subject, takeUntil } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import Swal from 'sweetalert2';
import { LoggerService } from '../../services/logger.service';

@Component({
  selector: 'app-fee-structure',
  standalone: true,
  imports: [CommonModule, FormsModule, BusFeesComponent],
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
    private logger: LoggerService
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.fetchSessions();
  }

  fetchSessions(): void {
    this.feeStructureService.getAcademicYears().pipe(takeUntil(this.destroy$)).subscribe(sessions => {
      this.sessions = sessions;
      if (this.sessions.length > 0) {
        this.currentSession = this.sessions[this.sessions.length - 1];
        this.cdr.markForCheck();
        this.fetchFeeStructures();
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
        Swal.fire('Error', 'Failed to load fee structure.', 'error');
      }
    });
  }

  changeSession(session: string): void {
    if (this.isEditing) {
      Swal.fire({
        title: 'Confirm Navigation',
        text: 'Unsaved changes will be lost. Do you want to continue?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, continue!',
        cancelButtonText: 'No, stay here',
      }).then((result) => {
        if (result.isConfirmed) {
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
    Swal.fire({
      title: 'Start New Academic Year?',
      text: `Are you sure to start a new academic year: ${nextSession}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, start!',
      cancelButtonText: 'No, cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.isNewSessionStarted = true;
        this.newSessionYear = nextSession;

        const latestSession = this.sessions[this.sessions.length - 1];
        const newFeeStructures = this.feeStructures.map(fee => ({ ...fee, academicYear: nextSession }));

        this.sessions.push(nextSession);
        this.currentSession = nextSession;
        this.isEditing = true;
        this.cdr.markForCheck();
      }
    });
  }

  getNextAvailableSession(): string {
    let [startYear, endYear] = this.sessions[this.sessions.length - 1].split('-').map(Number);

    while (this.sessions.includes(`${startYear + 1}-${endYear + 1}`)) {
      startYear++;
      endYear++;
    }

    return `${startYear + 1}-${endYear + 1}`;
  }

  edit(): void {
    Swal.fire({
      title: 'Enable Edit Mode?',
      text: 'Do you want to enable editing of the fee structure?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, enable!',
      cancelButtonText: 'No, cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.isEditing = true;
        this.cdr.markForCheck();
        //  Swal.fire('Edit Mode Enabled!', '', 'success');
      }
    });
  }

  save(): void {
    Swal.fire({
      title: 'Save Changes?',
      text: 'Do you want to save the changes you have made?',
      icon: 'question',
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      showCancelButton: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.isEditing = false;
        this.isNewSessionStarted = false;
        this.cdr.markForCheck();
        this.feeStructureService.updateFeeStructures(this.currentSession, this.feeStructures).subscribe(() => {
          this.originalFeeStructure = JSON.parse(JSON.stringify(this.feeStructures));
          Swal.fire('Saved!', `Fee structure for ${this.currentSession} saved successfully.`, 'success');
        }, (error) => {
          Swal.fire('Error!', 'Failed to save the fee structure.', 'error');
          this.logger.error('Error saving fee structure:', error);
        });
      } else if (result.isDenied) {
        Swal.fire('Changes not saved', '', 'info');
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

    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: confirmButtonText,
      cancelButtonText: cancelButtonText,
    }).then((result) => {
      if (result.isConfirmed) {
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
        Swal.fire('Cancelled!', 'Your changes have been discarded.', 'info');
      }
    });
  }

  addRow(): void {
    if (this.isEditing) {
      this.feeStructures.push({
        academicYear: this.currentSession,
        className: 'New Class',
        tuitionFee: 0,
        admissionFee: 0,
        annualCharges: 0,
        ecaProject: 0,
        examinationFee: 0,
        labCharges: 0,
      });
      this.cdr.markForCheck();
    }
  }

  removeRow(): void {
    if (this.isEditing && this.feeStructures.length > 0) {
      this.feeStructures.pop();
    }
  }

  trackBySession(index: number, session: string): string { return session; }
  trackByClassName(index: number, fee: FeeStructure): string { return fee.className; }

  canEdit(): boolean {
    return this.authStateService.getUserRole() === 'SUPER_ADMIN';
  }
}