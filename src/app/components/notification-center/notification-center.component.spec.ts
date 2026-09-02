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

  function setup() {
    const unread$ = new BehaviorSubject(3);
    const changed$ = new Subject<void>();
    const api = jasmine.createSpyObj('NotificationService', [
      'getUserNotifications', 'getUnreadNotificationCount',
      'markNotificationAsRead', 'markAllNotificationsAsRead'
    ]);
    api.getUnreadNotificationCount.and.returnValue(of(3));
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
    const { component, api } = setup();
    api.getUserNotifications.and.returnValue(of(page()));
    component.load(true);
    component.setFilter('UNREAD');
    component.setCategory('ATTENDANCE');

    expect(api.getUserNotifications.calls.mostRecent().args).toEqual([0, 20, false, 'ATTENDANCE']);
  });

  it('cancels a stale filter request so it cannot replace the latest rows', () => {
    const { component, api } = setup();
    const oldRequest = new Subject<PagedResponse<UserNotification>>();
    const latestRequest = new Subject<PagedResponse<UserNotification>>();
    api.getUserNotifications.and.returnValues(oldRequest, latestRequest);
    component.load(true);
    component.setCategory('LEAVE');

    const latest = { inboxId: 22, id: 22, userId: 's1', title: 'Leave', message: 'Approved',
      type: 'LEAVE', isRead: false, createdAt: new Date().toISOString(), category: 'LEAVE' };
    latestRequest.next(page([latest]));
    oldRequest.next(page([{ ...latest, inboxId: 11, id: 11, category: 'ATTENDANCE' }]));

    expect(component.notifications).toEqual([latest]);
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
