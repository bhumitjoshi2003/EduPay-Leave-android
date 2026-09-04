import { BehaviorSubject, Subject, of } from 'rxjs';
import { NotificationCenterComponent } from './notification-center.component';
import { PagedResponse } from '../../services/notification.service';
import { UserNotification } from '../../interfaces/user-notification';

describe('NotificationCenterComponent', () => {
  const page = (content: UserNotification[] = []): PagedResponse<UserNotification> => ({
    content, totalElements: content.length, totalPages: content.length ? 1 : 0,
    last: true, first: true, numberOfElements: content.length,
    pageable: { pageNumber: 0, pageSize: 20 }
  });

  function setup(unreadCount = 3) {
    const unread$ = new BehaviorSubject(unreadCount);
    const changed$ = new Subject<void>();
    const api = jasmine.createSpyObj('NotificationService', [
      'getUserNotifications', 'getUnreadNotificationCount',
      'markNotificationAsRead', 'markAllNotificationsAsRead'
    ]);
    api.getUnreadNotificationCount.and.returnValue(of(unreadCount));
    api.getUserNotifications.and.returnValue(of(page()));
    api.markNotificationAsRead.and.returnValue(of(void 0));
    api.markAllNotificationsAsRead.and.returnValue(of(void 0));
    const state = {
      unreadCount$: unread$.asObservable(), changed$,
      refreshUnread: jasmine.createSpy('refreshUnread'),
      notificationRead: jasmine.createSpy('notificationRead'),
      allRead: jasmine.createSpy('allRead')
    };
    const navigation = jasmine.createSpyObj('NotificationNavigationService', ['navigate']);
    navigation.navigate.and.resolveTo(true);
    const toast = jasmine.createSpyObj('ToastService', ['success', 'error']);
    const cdr = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
    const component = new NotificationCenterComponent(api, state as any, navigation, toast, cdr);
    return { component, api, state, navigation };
  }

  it('requests combined unread and category filters from page zero', () => {
    const { component, api } = setup(0);
    api.getUserNotifications.and.returnValue(of(page()));
    component.ngOnInit();
    component.setFilter('UNREAD');
    component.setCategory('ATTENDANCE');

    expect(api.getUserNotifications.calls.mostRecent().args).toEqual([0, 20, false, 'ATTENDANCE']);
  });

  it('cancels a stale filter request so it cannot replace the latest rows', () => {
    const { component, api } = setup();
    const oldRequest = new Subject<PagedResponse<UserNotification>>();
    const latestRequest = new Subject<PagedResponse<UserNotification>>();
    api.getUserNotifications.and.returnValues(oldRequest, latestRequest);
    component.ngOnInit();
    component.setCategory('LEAVE');

    const latest = { inboxId: 22, id: 22, userId: 's1', title: 'Leave', message: 'Approved',
      type: 'LEAVE', isRead: false, createdAt: new Date().toISOString(), category: 'LEAVE' };
    latestRequest.next(page([latest]));
    oldRequest.next(page([{ ...latest, inboxId: 11, id: 11, category: 'ATTENDANCE' }]));

    expect(component.notifications).toEqual([latest]);
    component.ngOnDestroy();
  });

  it('renders returned read rows in All even when the unread count is zero', () => {
    const { component, api } = setup(0);
    const read = { inboxId: 31, id: 31, userId: 's1', title: 'Leave Applied', message: 'Submitted',
      type: 'LEAVE', isRead: true, createdAt: new Date().toISOString(), category: 'LEAVE' };
    api.getUserNotifications.and.returnValue(of(page([read])));

    component.ngOnInit();

    expect(api.getUserNotifications).toHaveBeenCalledOnceWith(0, 20, undefined, undefined);
    expect(component.visibleNotifications).toEqual([read]);
    component.ngOnDestroy();
  });

  it('sends the exact All/Unread and Leave filter combinations', () => {
    const { component, api } = setup();
    component.ngOnInit();
    component.setCategory('LEAVE');
    expect(api.getUserNotifications.calls.mostRecent().args).toEqual([0, 20, undefined, 'LEAVE']);

    component.setFilter('UNREAD');
    expect(api.getUserNotifications.calls.mostRecent().args).toEqual([0, 20, false, 'LEAVE']);
    component.ngOnDestroy();
  });

  it('appends load-more rows without wiping the first page', () => {
    const { component, api } = setup();
    const first = { inboxId: 1, id: 1, userId: 's1', title: 'First', message: 'First page',
      type: 'NOTICE', isRead: true, createdAt: new Date().toISOString(), category: 'NOTICE_ANNOUNCEMENT' };
    const second = { ...first, inboxId: 2, id: 2, title: 'Second', message: 'Second page' };
    api.getUserNotifications.and.returnValues(
      of({ ...page([first]), totalPages: 2 }),
      of({ ...page([second]), pageable: { pageNumber: 1, pageSize: 20 } })
    );
    component.ngOnInit();

    component.loadMore();

    expect(api.getUserNotifications.calls.mostRecent().args).toEqual([1, 20, undefined, undefined]);
    expect(component.notifications).toEqual([first, second]);
    component.ngOnDestroy();
  });

  it('uses the explicit inbox ID and completes mark-read before navigating', async () => {
    const { component, api, navigation, state } = setup();
    const markRead = new Subject<void>();
    api.markNotificationAsRead.and.returnValue(markRead);
    const item = { inboxId: 42, id: 900, userId: 's1', title: 'Event', message: 'Tomorrow',
      type: 'EVENT', isRead: false, createdAt: new Date().toISOString(), category: 'EVENT_CALENDAR' };

    const opening = component.open(item);
    expect(api.markNotificationAsRead).toHaveBeenCalledOnceWith(42);
    expect(navigation.navigate).not.toHaveBeenCalled();
    markRead.next(); markRead.complete();
    await opening;

    expect(state.notificationRead).toHaveBeenCalledOnceWith(true);
    expect(navigation.navigate).toHaveBeenCalledOnceWith(item);
  });
});
