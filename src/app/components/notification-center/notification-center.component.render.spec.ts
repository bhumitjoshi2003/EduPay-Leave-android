import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, Subject, BehaviorSubject } from 'rxjs';
import { NotificationCenterComponent } from './notification-center.component';
import { NotificationService, PagedResponse } from '../../services/notification.service';
import { NotificationStateService } from '../../services/notification-state.service';
import { NotificationNavigationService } from '../../services/notification-navigation.service';
import { ToastService } from '../../services/toast.service';
import { UserNotification } from '../../interfaces/user-notification';

/** ResizeObserver fires on the next microtask/animation-frame turn, not synchronously
 *  within the current test tick — real browsers (Karma's ChromeHeadless included) need
 *  at least one macrotask yield before TruncationCheckDirective's callback has run. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Renders the REAL compiled template via TestBed, unlike notification-center.component.spec.ts
 * which constructs the class with `new NotificationCenterComponent(...)` and never touches
 * Angular's template compiler, change detection, or DOM. That gap let a real bug ship: the
 * component's own state (`notifications`) was always correct, but the template's
 * `*ngFor="...; trackBy: trackByInboxId"` crashed with "this.inboxId is not a function" the
 * moment the array had content, because Angular's IterableDiffer invokes a trackBy function
 * as a bare reference — a plain class method loses its `this` binding when called that way.
 * The bell popover (dashboard.component) has no trackBy at all, so it never hit this path,
 * which is why bell and center appeared to diverge despite hitting the same endpoint.
 */
describe('NotificationCenterComponent — real template rendering', () => {
  let fixture: ComponentFixture<NotificationCenterComponent>;
  let api: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const mk = (id: number, isRead: boolean, category = 'LEAVE', message = 'Body text'): UserNotification => ({
    inboxId: id, id, userId: 'par_1', title: `Notification ${id}`, message,
    type: 'LEAVE_SUBMITTED', isRead, createdAt: new Date().toISOString(), category
  });
  const page = (content: UserNotification[]): PagedResponse<UserNotification> => ({
    content, totalElements: content.length, totalPages: 1, last: true, first: true,
    numberOfElements: content.length, pageable: { pageNumber: 0, pageSize: 20 }
  });
  const longMessage = 'This is a very long notification message. '.repeat(40);

  beforeEach(async () => {
    api = jasmine.createSpyObj('NotificationService', [
      'getUserNotifications', 'getUnreadNotificationCount', 'markNotificationAsRead', 'markAllNotificationsAsRead'
    ]);
    api.getUnreadNotificationCount.and.returnValue(of(2));
    const state = {
      unreadCount$: new BehaviorSubject(2).asObservable(), changed$: new Subject<void>(),
      refreshUnread: () => {}, notificationRead: () => {}, allRead: () => {}
    };
    const navigation = jasmine.createSpyObj('NotificationNavigationService', ['navigate']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [NotificationCenterComponent],
      providers: [
        { provide: NotificationService, useValue: api },
        { provide: NotificationStateService, useValue: state },
        { provide: NotificationNavigationService, useValue: navigation },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['success', 'error']) },
        { provide: MatDialog, useValue: dialog },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationCenterComponent);
  });

  function rows(): NodeListOf<HTMLElement> {
    return fixture.nativeElement.querySelectorAll('.nc-row');
  }

  it('renders a card for every returned notification on initial load (regression: trackBy this-binding)', () => {
    api.getUserNotifications.and.returnValue(of(page([mk(1, false), mk(2, false), mk(3, true)])));

    fixture.detectChanges();
    fixture.detectChanges();

    expect(rows().length).toBe(3);
    expect(fixture.nativeElement.querySelector('.nc-empty')).toBeNull();
  });

  it('keeps rendering cards correctly after switching filters (trackBy exercised again on a changed array)', () => {
    api.getUserNotifications.and.returnValue(of(page([mk(1, false), mk(2, false)])));
    fixture.detectChanges();
    fixture.detectChanges();
    expect(rows().length).toBe(2);

    api.getUserNotifications.and.returnValue(of(page([mk(1, false)])));
    fixture.componentInstance.setFilter('UNREAD');
    fixture.detectChanges();
    fixture.detectChanges();

    expect(rows().length).toBe(1);
  });

  it('shows the genuine empty state only when the returned list is actually empty', () => {
    api.getUserNotifications.and.returnValue(of(page([])));

    fixture.detectChanges();
    fixture.detectChanges();

    expect(rows().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.nc-empty')).not.toBeNull();
  });

  it('re-renders correctly after marking one card read (identity must survive the trackBy diff)', async () => {
    const first = mk(1, true), second = mk(2, false);
    api.getUserNotifications.and.returnValue(of(page([first, second])));
    api.markNotificationAsRead.and.returnValue(of(void 0));
    fixture.detectChanges();
    fixture.detectChanges();
    expect(rows().length).toBe(2);

    await fixture.componentInstance.open(second);
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.nc-row.unread').length).toBe(0);
  });

  it('re-renders correctly after mark-all-read while ALL filter still shows the now-read rows', () => {
    api.getUserNotifications.and.returnValue(of(page([mk(1, false), mk(2, false)])));
    api.markAllNotificationsAsRead.and.returnValue(of(void 0));
    fixture.detectChanges();
    fixture.detectChanges();

    fixture.componentInstance.markAllRead();
    fixture.detectChanges();

    expect(rows().length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.nc-row.unread').length).toBe(0);
  });

  it('shows "Read more" only for a message that actually overflows the clamp, not a short one', async () => {
    api.getUserNotifications.and.returnValue(of(page([
      mk(1, false, 'LEAVE', 'Short message.'),
      mk(2, false, 'LEAVE', longMessage)
    ])));
    fixture.detectChanges();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const readMoreButtons = fixture.nativeElement.querySelectorAll('.nc-read-more');
    expect(readMoreButtons.length).toBe(1);
  });

  it('opens the detail dialog with the complete message and does not navigate away', async () => {
    api.getUserNotifications.and.returnValue(of(page([mk(1, false, 'LEAVE', longMessage)])));
    fixture.detectChanges();
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const readMore: HTMLButtonElement = fixture.nativeElement.querySelector('.nc-read-more');
    expect(readMore).not.toBeNull();
    readMore.click();

    expect(dialog.open).toHaveBeenCalledTimes(1);
    const config: any = dialog.open.calls.mostRecent().args[1];
    expect(config.data.message).toBe(longMessage);
  });
});
