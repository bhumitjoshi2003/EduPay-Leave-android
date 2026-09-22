import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { StaffAdoptionService } from '../../services/staff-adoption.service';
import { ToastService } from '../../services/toast.service';
import { StaffAdoptionResponse, StaffAdoptionTeacherRow } from '../../interfaces/staff-adoption';
import { StaffAdoptionReminderType } from '../../interfaces/staff-adoption-reminder';

interface ReminderOption { type: StaffAdoptionReminderType; label: string; description: string; }
const REMINDER_OPTIONS: ReminderOption[] = [
  { type: 'NOT_STARTED', label: 'Not started', description: 'Nudge teachers who have not yet signed in.' },
  { type: 'OUTDATED_APP', label: 'Outdated app', description: 'Ask teachers to update the Edunexify app.' },
  { type: 'ONBOARDING_INCOMPLETE', label: 'Onboarding incomplete', description: 'Remind teachers to finish Getting Started.' },
];

@Component({ selector: 'app-staff-adoption', standalone: true, imports: [CommonModule, FormsModule, MatIconModule, RouterLink], templateUrl: './staff-adoption.component.html', styleUrl: './staff-adoption.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class StaffAdoptionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>(); loading = true; error = false; data: StaffAdoptionResponse | null = null;
  searchTerm = ''; filter: 'ALL'|'STARTED'|'NOT_STARTED'|'USED'|'NOT_USED' = 'ALL';

  readonly reminderOptions = REMINDER_OPTIONS;
  reminderPanelOpen = false;
  selectedReminderType: StaffAdoptionReminderType = 'NOT_STARTED';
  reminderPreviewLoading = false;
  reminderSendLoading = false;
  reminderError: string | null = null;

  constructor(private service: StaffAdoptionService, private toast: ToastService, private cdr: ChangeDetectorRef) {}
  ngOnInit(): void { this.load(); }
  load(): void { this.loading = true; this.error = false; this.service.getStaffAdoption().pipe(takeUntil(this.destroy$)).subscribe({ next: data => { this.data = data; this.loading = false; this.cdr.markForCheck(); }, error: () => { this.loading = false; this.error = true; this.cdr.markForCheck(); } }); }
  get rows(): StaffAdoptionTeacherRow[] { const q = this.searchTerm.trim().toLowerCase(); return (this.data?.teachers ?? []).filter(t => (!q || t.name.toLowerCase().includes(q) || t.teacherId.toLowerCase().includes(q)) && (this.filter === 'ALL' || this.filter === 'STARTED' && t.accountStatus === 'STARTED' || this.filter === 'NOT_STARTED' && t.accountStatus !== 'STARTED' || this.filter === 'USED' && t.hasUsedAttendance || this.filter === 'NOT_USED' && !t.hasUsedAttendance)); }
  status(t: StaffAdoptionTeacherRow): string { return t.accountStatus === 'ACCOUNT_PENDING' ? 'Account pending' : t.accountStatus === 'NOT_STARTED' ? 'Not started' : t.accountStatus.charAt(0) + t.accountStatus.slice(1).toLowerCase(); }
  relative(value: string | null): string { if (!value) return 'Never'; const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`; }
  app(t: StaffAdoptionTeacherRow): string { return t.appVersionStatus === 'UP_TO_DATE' ? 'Up to date' : t.appVersionStatus === 'UPDATE_AVAILABLE' ? 'Update available' : t.appVersionStatus === 'UPDATE_REQUIRED' ? 'Update required' : 'No version reported'; }

  // ── Reminders (admin-triggered, never automatic) ────────────────

  toggleReminderPanel(): void { this.reminderPanelOpen = !this.reminderPanelOpen; this.reminderError = null; this.cdr.markForCheck(); }

  /** Preview → confirm → send. The backend re-resolves recipients itself from `type` alone;
   *  this only ever asks it to preview, then to send — it never submits a recipient list. */
  previewAndSendReminder(): void {
    if (this.reminderPreviewLoading || this.reminderSendLoading) return;
    const type = this.selectedReminderType;
    this.reminderPreviewLoading = true; this.reminderError = null; this.cdr.markForCheck();
    this.service.previewReminder(type).pipe(takeUntil(this.destroy$)).subscribe({
      next: preview => {
        this.reminderPreviewLoading = false; this.cdr.markForCheck();
        if (preview.count === 0) { this.toast.info('No recipients', 'No teachers currently match this reminder.'); return; }
        this.confirmAndSend(type, preview.count, preview.teachers.map(t => t.name));
      },
      error: () => { this.reminderPreviewLoading = false; this.reminderError = 'Could not load recipients. Please try again.'; this.cdr.markForCheck(); }
    });
  }

  private confirmAndSend(type: StaffAdoptionReminderType, count: number, names: string[]): void {
    const shown = names.slice(0, 8);
    const more = names.length > shown.length ? `<p>&hellip; and ${names.length - shown.length} more</p>` : '';
    this.toast.confirm({
      title: `Send reminder to ${count} teacher${count > 1 ? 's' : ''}?`,
      html: `<p>${shown.join(', ')}</p>${more}`,
      icon: 'question', confirmText: 'Send reminder', cancelText: 'Cancel',
    }).then(confirmed => { if (confirmed) this.sendReminder(type); });
  }

  private sendReminder(type: StaffAdoptionReminderType): void {
    this.reminderSendLoading = true; this.cdr.markForCheck();
    this.service.sendReminder(type).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.reminderSendLoading = false; this.reminderPanelOpen = false; this.cdr.markForCheck();
        this.toastForSendResult(result.sentCount, result.skippedRecentCount);
      },
      error: () => {
        this.reminderSendLoading = false; this.reminderError = 'Could not send the reminder. Please try again.'; this.cdr.markForCheck();
        this.toast.error('Error', 'Failed to send reminder. Please try again.');
      }
    });
  }

  /** Truthful wording: "sent" here means accepted for delivery, never a claim that email/push
   *  was actually received. */
  private toastForSendResult(sentCount: number, skippedRecentCount: number): void {
    if (sentCount === 0 && skippedRecentCount > 0) {
      this.toast.info('Already reminded', `All ${skippedRecentCount} teacher${skippedRecentCount > 1 ? 's were' : ' was'} reminded recently.`);
      return;
    }
    let message = `Reminder sent to ${sentCount} teacher${sentCount === 1 ? '' : 's'}.`;
    if (skippedRecentCount > 0) message += ` ${skippedRecentCount} skipped because they were reminded recently.`;
    this.toast.success('Reminder sent', message);
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }
}
