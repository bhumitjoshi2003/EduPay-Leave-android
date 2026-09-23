import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { UncoveredPeriod } from '../../interfaces/teacher-substitution';
import { AuthStateService } from '../../auth/auth-state.service';
import { LoggerService } from '../../services/logger.service';
import { TeacherSubstitutionService } from '../../services/teacher-substitution.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-teacher-substitution',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, RouterLink],
  templateUrl: './teacher-substitution.component.html',
  styleUrl: './teacher-substitution.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherSubstitutionComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  selectedDate = this.localDate(new Date());
  periods: UncoveredPeriod[] = [];
  selections: Record<number, string> = {};
  loading = true;
  failed = false;
  busyEntryId: number | null = null;
  /** The one period currently showing its teacher selector to pick a replacement
   *  substitute — everything else with an existing assignment stays collapsed to just
   *  "Substitute: <name>" plus Change/Remove, per the polished admin UI. */
  changingEntryId: number | null = null;

  constructor(
    private substitutions: TeacherSubstitutionService,
    private toast: ToastService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private authState: AuthStateService,
  ) {}

  /** Backend independently enforces the TIMETABLE_EDIT permission for SUB_ADMIN on
   *  assign/change/cancel (ADMIN always has it) — this getter is a UX guard only, so an
   *  under-permissioned SUB_ADMIN sees why the controls are disabled instead of clicking
   *  Assign and getting a confusing 403. Same convention as auth-state.service.ts's
   *  hasPermission() and ai-copilot.component.ts's isAdmin getter. */
  get canManage(): boolean {
    return this.authState.getUser()?.role === 'ADMIN' || this.authState.hasPermission('TIMETABLE_EDIT');
  }

  ngOnInit(): void { this.load(); }

  get needsAttentionCount(): number {
    return this.periods.filter(period => !period.assignment).length;
  }

  get attentionSummary(): string {
    const count = this.needsAttentionCount;
    if (count === 0) return 'All uncovered periods are covered.';
    return count === 1 ? '1 period needs attention' : `${count} periods need attention`;
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.substitutions.getUncovered(this.selectedDate).pipe(takeUntil(this.destroy$)).subscribe({
      next: periods => {
        this.periods = periods;
        this.selections = {};
        for (const period of periods) {
          this.selections[period.timetableEntryId] = period.assignment?.substituteTeacherId ?? '';
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.logger.error('Substitution periods load failed:', error);
        this.loading = false;
        this.failed = true;
        this.cdr.markForCheck();
      },
    });
  }

  save(period: UncoveredPeriod): void {
    const teacherId = this.selections[period.timetableEntryId];
    if (!teacherId) {
      this.toast.warning('Select a teacher', 'Choose an eligible free teacher first.');
      return;
    }
    this.busyEntryId = period.timetableEntryId;
    const request = period.assignment
      ? this.substitutions.change(period.assignment.id, teacherId)
      : this.substitutions.assign(period.timetableEntryId, this.selectedDate, teacherId);
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(period.assignment ? 'Substitute changed' : 'Substitute assigned');
        this.busyEntryId = null;
        this.changingEntryId = null;
        this.load();
      },
      error: error => {
        this.busyEntryId = null;
        this.toast.error('Unable to save substitution', this.errorMessage(error));
        this.cdr.markForCheck();
      },
    });
  }

  async remove(period: UncoveredPeriod): Promise<void> {
    if (!period.assignment) return;
    const confirmed = await this.toast.confirm({
      title: 'Remove substitute?',
      message: `${period.assignment.substituteTeacherName} will be notified that this cover period was cancelled.`,
      confirmText: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    this.busyEntryId = period.timetableEntryId;
    this.substitutions.cancel(period.assignment.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Substitution removed');
        this.busyEntryId = null;
        this.changingEntryId = null;
        this.load();
      },
      error: error => {
        this.busyEntryId = null;
        this.toast.error('Unable to remove substitution', this.errorMessage(error));
        this.cdr.markForCheck();
      },
    });
  }

  classLabel(period: UncoveredPeriod): string {
    return period.sectionName ? `Class ${period.className} · ${period.sectionName}` : `Class ${period.className}`;
  }

  startChange(period: UncoveredPeriod): void {
    this.changingEntryId = period.timetableEntryId;
    this.selections[period.timetableEntryId] = '';
    this.cdr.markForCheck();
  }

  cancelChange(period: UncoveredPeriod): void {
    this.changingEntryId = null;
    this.selections[period.timetableEntryId] = period.assignment?.substituteTeacherId ?? '';
    this.cdr.markForCheck();
  }

  private errorMessage(error: any): string {
    return error?.error?.detail || error?.error?.message || (typeof error?.error === 'string' ? error.error : '')
      || 'Please refresh and try again.';
  }

  private localDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

