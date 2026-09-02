import { Subject } from 'rxjs';
import { NotificationStateService } from './notification-state.service';

describe('NotificationStateService', () => {
  it('uses the latest unread refresh instead of dropping it', () => {
    const first = new Subject<number>();
    const latest = new Subject<number>();
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    api.getUnreadNotificationCount.and.returnValues(first, latest);
    const state = new NotificationStateService(api);
    const counts: number[] = [];
    state.unreadCount$.subscribe(value => counts.push(value));

    state.refreshUnread();
    state.refreshUnread();
    first.next(9);
    latest.next(3);

    expect(counts).toEqual([0, 3]);
  });

  it('publishes immediate one-read and all-read count changes', () => {
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    const state = new NotificationStateService(api);
    const counts: number[] = [];
    state.unreadCount$.subscribe(value => counts.push(value));

    state.setUnread(3);
    state.notificationRead(true);
    state.allRead();

    expect(counts).toEqual([0, 3, 2, 0]);
  });
});
