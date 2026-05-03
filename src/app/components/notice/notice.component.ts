import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { Notification } from '../../interfaces/notification';
import { UserNotification } from '../../interfaces/user-notification';
import { LoggerService } from '../../services/logger.service';
import { ToastService } from '../../services/toast.service';

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
  noticesTotalElements = 0;
  noticesPage = 0;
  noticesLast = true;
  loadingMoreNotices = false;

  // Student / Teacher: personal notifications
  userNotifications: UserNotification[] = [];
  userTotalElements = 0;
  userPage = 0;
  userLast = true;
  loadingMoreUser = false;

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
    private logger: LoggerService,
    private toast: ToastService
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
      this.noticesPage = 0;
      this.notificationService.getAllNotifications(0)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.allNotices = res.content;
            this.noticesTotalElements = res.totalElements;
            this.noticesLast = res.last;
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: (e) => { this.logger.error('Error loading notices:', e); this.loading = false; this.cdr.markForCheck(); },
        });
    } else {
      this.userPage = 0;
      this.notificationService.getUserNotifications(0)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.userNotifications = res.content;
            this.userTotalElements = res.totalElements;
            this.userLast = res.last;
            this.loading = false;
            this.cdr.markForCheck();
          },
          error: (e) => { this.logger.error('Error loading notifications:', e); this.loading = false; this.cdr.markForCheck(); },
        });
    }
  }

  loadMoreNotices(): void {
    if (this.noticesLast || this.loadingMoreNotices) return;
    this.loadingMoreNotices = true;
    this.cdr.markForCheck();
    this.notificationService.getAllNotifications(this.noticesPage + 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.allNotices = [...this.allNotices, ...res.content];
          this.noticesPage = res.pageable.pageNumber;
          this.noticesLast = res.last;
          this.loadingMoreNotices = false;
          this.cdr.markForCheck();
        },
        error: (e) => { this.logger.error('Error loading more notices:', e); this.loadingMoreNotices = false; this.cdr.markForCheck(); },
      });
  }

  loadMoreUserNotifications(): void {
    if (this.userLast || this.loadingMoreUser) return;
    this.loadingMoreUser = true;
    this.cdr.markForCheck();
    this.notificationService.getUserNotifications(this.userPage + 1)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.userNotifications = [...this.userNotifications, ...res.content];
          this.userPage = res.pageable.pageNumber;
          this.userLast = res.last;
          this.loadingMoreUser = false;
          this.cdr.markForCheck();
        },
        error: (e) => { this.logger.error('Error loading more notifications:', e); this.loadingMoreUser = false; this.cdr.markForCheck(); },
      });
  }

  // ── Admin: post notice ───────────────────────────────────────────────

  postNotice(): void {
    if (!this.form.title.trim() || !this.form.body.trim() || !this.form.targetAudience) {
      this.toast.warning('Incomplete', 'Please fill in all required fields.');
      return;
    }
    if (this.requiresSubject && !this.form.subject.trim()) {
      this.toast.warning('Incomplete', 'Subject is required for email delivery.');
      return;
    }

    this.toast.confirm({
      title: 'Post this notice?',
      confirmText: 'Yes, post it',
      cancelText: 'Cancel',
    }).then((confirmed) => {
      if (!confirmed) return;
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
            this.toast.success('Notice Posted!', 'The notice has been sent successfully.');
            this.loadData();
          },
          error: (e) => {
            this.submitting = false;
            this.logger.error('Error posting notice:', e);
            this.toast.error('Error', 'Failed to post the notice. Please try again.');
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
      this.toast.warning('Incomplete', 'Title and message are required.');
      return;
    }
    this.notificationService.updateNotification(this.editingId!, this.editForm as Notification)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.editingId = null;
          this.toast.success('Updated');
          this.loadData();
        },
        error: (e) => {
          this.logger.error('Error updating notice:', e);
          this.toast.error('Error', 'Failed to update the notice.');
        },
      });
  }

  // ── Admin: delete notice ─────────────────────────────────────────────

  deleteNotice(id: number): void {
    this.toast.confirm({
      title: 'Delete this notice?',
      message: 'This action cannot be undone.',
      confirmText: 'Yes, delete',
      cancelText: 'Cancel',
      danger: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      this.notificationService.deleteNotification(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.allNotices = this.allNotices.filter(n => n.id !== id);
            this.toast.success('Deleted');
            this.cdr.markForCheck();
          },
          error: (e) => {
            this.logger.error('Error deleting notice:', e);
            this.toast.error('Error', 'Failed to delete the notice.');
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
        error: (e) => {
          this.logger.error('Error marking notifications as read:', e);
          this.toast.error('Error', 'Failed to mark notifications as read.');
        },
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
