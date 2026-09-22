import { Subject, throwError } from 'rxjs';
import { NotificationStateService, UnreadCountState } from './notification-state.service';

describe('NotificationStateService', () => {
  // ─── Shared status-aware unreadState$ — the loading/success/error companion to unreadCount$ ───

  it('starts in a loading/unknown state before any refresh has resolved', () => {
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    const state = new NotificationStateService(api);
    let latest: UnreadCountState | undefined;
    state.unreadState$.subscribe(s => (latest = s));
    expect(latest).toEqual({ status: 'loading', count: 0 });
  });

  it('refreshUnread() publishes a success state to unreadState$ alongside the plain unreadCount$', () => {
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    const source = new Subject<number>();
    api.getUnreadNotificationCount.and.returnValue(source);
    const state = new NotificationStateService(api);

    const states: UnreadCountState[] = [];
    state.unreadState$.subscribe(s => states.push(s));
    state.refreshUnread();
    source.next(5);

    expect(states[states.length - 1]).toEqual({ status: 'success', count: 5 });
  });

  it('a fetch failure publishes an error state — never collapsed into a false zero', () => {
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    api.getUnreadNotificationCount.and.returnValue(throwError(() => new Error('offline')));
    const state = new NotificationStateService(api);

    const states: UnreadCountState[] = [];
    state.unreadState$.subscribe(s => states.push(s));
    state.refreshUnread();

    expect(states[states.length - 1].status).toBe('error');
  });

  it('a failure never changes the plain unreadCount$ value (last known good count is kept)', () => {
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    const first = new Subject<number>();
    api.getUnreadNotificationCount.and.returnValue(first);
    const state = new NotificationStateService(api);
    state.refreshUnread();
    first.next(4);

    api.getUnreadNotificationCount.and.returnValue(throwError(() => new Error('offline')));
    const counts: number[] = [];
    state.unreadCount$.subscribe(c => counts.push(c));
    state.refreshUnread();

    expect(counts[counts.length - 1]).toBe(4);
  });

  it('clear() resets both unreadCount$ and unreadState$ back to unknown (logout safety)', () => {
    const api = jasmine.createSpyObj('NotificationService', ['getUnreadNotificationCount']);
    const state = new NotificationStateService(api);
    state.setUnread(7);

    state.clear();

    let latestCount: number | undefined;
    state.unreadCount$.subscribe(c => (latestCount = c));
    let latestState: UnreadCountState | undefined;
    state.unreadState$.subscribe(s => (latestState = s));
    expect(latestCount).toBe(0);
    expect(latestState).toEqual({ status: 'loading', count: 0 });
  });

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
