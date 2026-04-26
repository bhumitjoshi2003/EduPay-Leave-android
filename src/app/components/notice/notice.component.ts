import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Notification } from '../../interfaces/notification';
import { UserNotification } from '../../interfaces/user-notification';
import { LoggerService } from '../../services/logger.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-notice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notice.component.html',
  styleUrl: './notice.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  role = '';

  // Admin: full list of posted notices
  allNotices: Notification[] = [];

  // Student / Teacher: personal notifications
  userNotifications: UserNotification[] = [];

  // Compose form (admin)
  form = {
    title: '',
    subject: '',
    body: '',
    targetAudience: '',
    deliveryMode: 'BOTH',
  };

  // Inline edit state (admin)
  editingId: number | null = null;
  editForm = { title: '', message: '', type: 'NOTICE', audience: '' };

  submitting = false;
  loading = false;

  classList: string[] = [
    'Play group', 'Nursery', 'LKG', 'UKG',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  ];

  constructor(
    private notificationService: NotificationService,
    private authStateService: AuthStateService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService
  ) { }

  ngOnInit(): void {
    const user = this.authStateService.getUser();
    this.role = user?.role ?? '';
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN' || this.role === 'SUPER_ADMIN';
  }

  get requiresSubject(): boolean {
    return this.form.deliveryMode === 'EMAIL' || this.form.deliveryMode === 'BOTH';
  }

  get unreadCount(): number {
    return this.userNotifications.filter(n => !n.isRead).length;
  }

  // ── Data loading ─────────────────────────────────────────────────────

  loadData(): void {
    this.loading = true;
    this.cdr.markForCheck();
    if (this.isAdmin) {
      this.notificationService.getAllNotifications()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (notices) => { this.allNotices = notices; this.loading = false; this.cdr.markForCheck(); },
          error: (e) => { this.logger.error('Error loading notices:', e); this.loading = false; this.cdr.markForCheck(); },
        });
    } else {
      this.notificationService.getUserNotifications()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (notifications) => { this.userNotifications = notifications; this.loading = false; this.cdr.markForCheck(); },
          error: (e) => { this.logger.error('Error loading notifications:', e); this.loading = false; this.cdr.markForCheck(); },
        });
    }
  }

  // ── Admin: post notice ───────────────────────────────────────────────

  postNotice(): void {
    if (!this.form.title.trim() || !this.form.body.trim() || !this.form.targetAudience) {
      Swal.fire('Incomplete', 'Please fill in all required fields.', 'warning');
      return;
    }
    if (this.requiresSubject && !this.form.subject.trim()) {
      Swal.fire('Incomplete', 'Subject is required for email delivery.', 'warning');
      return;
    }

    Swal.fire({
      title: 'Post this notice?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1f6f8b',
      confirmButtonText: 'Yes, post it',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.submitting = true;
      this.cdr.markForCheck();

      const payload = {
        title: this.form.title.trim(),
        subject: this.form.subject.trim(),
        body: this.form.body.trim(),
        targetClass: this.form.targetAudience,
        deliveryMode: this.form.deliveryMode,
      };

      this.notificationService.sendNotice(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.submitting = false;
            this.form = { title: '', subject: '', body: '', targetAudience: '', deliveryMode: 'BOTH' };
            Swal.fire({ icon: 'success', title: 'Notice Posted!', text: 'The notice has been sent successfully.', timer: 1800, showConfirmButton: false });
            this.loadData();
          },
          error: (e) => {
            this.submitting = false;
            this.logger.error('Error posting notice:', e);
            Swal.fire('Error', 'Failed to post the notice. Please try again.', 'error');
            this.cdr.markForCheck();
          },
        });
    });
  }

  // ── Admin: edit notice ───────────────────────────────────────────────

  startEdit(notice: Notification): void {
    this.editingId = notice.id!;
    this.editForm = {
      title: notice.title,
      message: notice.message,
      type: notice.type,
      audience: notice.audience ?? '',
    };
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveEdit(): void {
    if (!this.editForm.title.trim() || !this.editForm.message.trim()) {
      Swal.fire('Incomplete', 'Title and message are required.', 'warning');
      return;
    }
    this.notificationService.updateNotification(this.editingId!, this.editForm as Notification)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editingId = null;
          Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
          this.loadData();
        },
        error: (e) => {
          this.logger.error('Error updating notice:', e);
          Swal.fire('Error', 'Failed to update the notice.', 'error');
        },
      });
  }

  // ── Admin: delete notice ─────────────────────────────────────────────

  deleteNotice(id: number): void {
    Swal.fire({
      title: 'Delete this notice?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete',
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.notificationService.deleteNotification(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.allNotices = this.allNotices.filter(n => n.id !== id);
            Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false });
            this.cdr.markForCheck();
          },
          error: (e) => {
            this.logger.error('Error deleting notice:', e);
            Swal.fire('Error', 'Failed to delete the notice.', 'error');
          },
        });
    });
  }

  // ── Student/Teacher: mark all read ──────────────────────────────────

  markAllRead(): void {
    this.notificationService.markAllNotificationsAsRead()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.userNotifications = this.userNotifications.map(n => ({ ...n, isRead: true }));
          this.cdr.markForCheck();
        },
        error: (e) => this.logger.error('Error marking notifications as read:', e),
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  formatAudience(audience: string = ''): string {
    if (audience === 'ALL') return 'All Students';
    if (audience === 'TEACHERS') return 'All Teachers';
    if (audience.startsWith('CLASS_WITH_TEACHER:'))
      return `Class ${audience.replace('CLASS_WITH_TEACHER:', '')} + Class Teacher`;
    if (audience.startsWith('CLASS:'))
      return `Class ${audience.replace('CLASS:', '')} — Students`;
    return audience;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  trackById(_: number, item: { id?: number }): number { return item.id ?? 0; }

  getNoticeAccent(index: number): string {
    const palette = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0284c7'];
    return palette[index % palette.length];
  }

  getNoticeIcon(title: string): string {
    const t = (title ?? '').toLowerCase();
    if (t.includes('fee') || t.includes('payment') || t.includes('due')) return '💰';
    if (t.includes('exam') || t.includes('test') || t.includes('result') || t.includes('mark')) return '📝';
    if (t.includes('holiday') || t.includes('vacation') || t.includes('break') || t.includes('closed')) return '🎉';
    if (t.includes('leave')) return '🏖️';
    if (t.includes('meeting') || t.includes('parent')) return '👥';
    if (t.includes('sport') || t.includes('game') || t.includes('match')) return '🏆';
    if (t.includes('event') || t.includes('fest') || t.includes('cultural') || t.includes('function')) return '🎭';
    if (t.includes('schedule') || t.includes('timetable') || t.includes('class')) return '📅';
    if (t.includes('health') || t.includes('medical') || t.includes('clinic')) return '🏥';
    if (t.includes('trip') || t.includes('tour') || t.includes('excursion')) return '🚌';
    return '📌';
  }
}
