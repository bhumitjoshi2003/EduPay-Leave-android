import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusFeesService, BusFee } from '../../services/bus-fees.service';
import { Subject, takeUntil } from 'rxjs';
import { AuthStateService } from '../../auth/auth-state.service';
import Swal from 'sweetalert2';

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
  academicYears: string[] = [];
  currentSession: string = '';
  isNewSession: boolean = false;
  busFeeStructures: BusFee[] = [];
  isEditing = false;
  isLoading = true;
  originalBusFees: BusFee[] = [];

  constructor(
    private busFeesService: BusFeesService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.fetchAcademicYears();
  }

  fetchAcademicYears(): void {
    this.busFeesService.getAcademicYears().pipe(takeUntil(this.destroy$)).subscribe(years => {
      this.academicYears = years;
      if (this.academicYears.length > 0) {
        this.currentSession = this.academicYears[this.academicYears.length - 1];
        this.cdr.markForCheck();
        this.fetchBusFees();
      }
    });
  }

  fetchBusFees(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.busFeesService.getBusFees(this.currentSession).pipe(takeUntil(this.destroy$)).subscribe({
      next: (fees) => {
        this.busFeeStructures = fees;
        this.originalBusFees = JSON.parse(JSON.stringify(this.busFeeStructures));
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
        Swal.fire('Error', 'Failed to load bus fee structure.', 'error');
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
          this.isNewSession = false;
          this.isEditing = false;
          this.fetchBusFees();
        }
      });
    } else {
      this.currentSession = session;
      this.isNewSession = false;
      this.isEditing = false;
      this.fetchBusFees();
    }
  }

  startNewAcademicYear(): void {
    const lastSession = this.academicYears[this.academicYears.length - 1];
    const [lastYearStr] = lastSession.split('-');
    const lastYear = parseInt(lastYearStr);
    const newYear = `${lastYear + 1}-${lastYear + 2}`; // Corrected newYear calculation

    Swal.fire({
      title: 'Start New Academic Year?',
      text: `Are you sure to start a new academic year: ${newYear}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, start!',
      cancelButtonText: 'No, cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        if (this.academicYears.includes(newYear)) {
          Swal.fire('Info', 'This academic year already exists.', 'info');
          return;
        }
        this.academicYears.push(newYear);
        this.cdr.markForCheck();
        this.fetchBusFees();
        this.currentSession = newYear;
        this.isEditing = true;
        this.isNewSession = true;
      }
    });
  }

  addRow(): void {
    if (this.isEditing) {
      this.busFeeStructures.push({
        academicYear: this.currentSession,
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
    Swal.fire({
      title: 'Enable Edit Mode?',
      text: 'Do you want to enable editing of the bus fee structure?',
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
      }
    });
  }

  save(): void {
    Swal.fire({
      title: 'Save Changes?',
      text: 'Do you want to save the changes you have made to the bus fees?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        this.isEditing = false;
        this.isNewSession = false;
        this.cdr.markForCheck();
        this.busFeesService.updateBusFees(this.currentSession, this.busFeeStructures).subscribe(() => {
          this.originalBusFees = JSON.parse(JSON.stringify(this.busFeeStructures));
          Swal.fire('Saved!', `Bus fees for ${this.currentSession} saved successfully.`, 'success');
        }, (error) => {
          Swal.fire('Error!', 'Failed to save the bus fees.', 'error');
        });
      }
    });
  }

  cancel(): void {
    const title = this.isNewSession ? 'Discard New Year?' : 'Cancel Editing?';
    const text = this.isNewSession
      ? `Are you sure you want to discard the new academic year (${this.currentSession}) setup for bus fees?`
      : 'Are you sure you want to cancel editing the bus fees?';
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
        const wasNewSession = this.isNewSession; // Store the value before resetting
        this.isNewSession = false;

        if (wasNewSession) {
          if (this.academicYears.length > 0) {
            this.academicYears.pop(); // Remove the newly added year
          }
          if (this.academicYears.length > 0) {
            this.currentSession = this.academicYears[this.academicYears.length - 1];
            this.cdr.markForCheck();
            this.fetchBusFees(); // Reload data for the previous session
          } else {
            this.currentSession = '';
            this.busFeeStructures = [];
            this.cdr.markForCheck();
          }
        } else {
          this.busFeeStructures = JSON.parse(JSON.stringify(this.originalBusFees));
          this.cdr.markForCheck();
        }
        Swal.fire('Cancelled!', 'Bus fee changes have been discarded.', 'info');
      }
    });
  }

  canEdit(): boolean {
    return this.authStateService.getUserRole() === 'SUPER_ADMIN';
  }

  trackByIndex(index: number): number { return index; }
  trackBySession(index: number, session: string): string { return session; }

  getFormattedSession(session: string): string {
    const parts = session.split('-');
    return `<span class="math-inline">\{parts\[0\]\}\-</span>{parts[1].slice(2)}`;
  }
}