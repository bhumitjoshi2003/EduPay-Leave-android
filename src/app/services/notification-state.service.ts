import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subject, catchError, switchMap, tap } from 'rxjs';
import { NotificationService } from './notification.service';

export type UnreadCountStatus = 'loading' | 'success' | 'error';

/** `count` is meaningful only when `status === 'success'` — a `loading`/`error` state must
 *  never be collapsed into a bare `0`, since a genuine zero and "we don't know yet" are
 *  different UI states (see Teacher Dashboard's Updates tile). */
export interface UnreadCountState {
  status: UnreadCountStatus;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationStateService {
  private readonly unreadSubject = new BehaviorSubject(0);
  readonly unreadCount$ = this.unreadSubject.asObservable();
  /** Status-aware companion to unreadCount$, for consumers (e.g. Teacher Dashboard's Daily
   *  Insights) that need to distinguish "still loading", a genuine zero, and "the fetch
   *  failed" instead of a bare number — added purely alongside unreadCount$, which keeps its
   *  existing plain-number contract unchanged for its current consumers (the shell badge,
   *  push-notification handling). */
  private readonly unreadStateSubject = new BehaviorSubject<UnreadCountState>({ status: 'loading', count: 0 });
  readonly unreadState$: Observable<UnreadCountState> = this.unreadStateSubject.asObservable();
  readonly changed$ = new Subject<void>();
  private readonly refreshRequest = new Subject<void>();

  constructor(private api: NotificationService) {
    this.refreshRequest.pipe(switchMap(() => this.api.getUnreadNotificationCount().pipe(
      tap(count => {
        this.unreadSubject.next(count);
        this.unreadStateSubject.next({ status: 'success', count });
      }),
      catchError(() => {
        this.unreadStateSubject.next({ status: 'error', count: this.unreadSubject.value });
        return EMPTY;
      }),
    ))).subscribe();
  }

  refreshUnread(): void { this.refreshRequest.next(); }
  setUnread(count: number): void {
    const next = Math.max(0, count);
    this.unreadSubject.next(next);
    this.unreadStateSubject.next({ status: 'success', count: next });
  }
  notificationRead(wasUnread: boolean): void {
    if (wasUnread) this.setUnread(this.unreadSubject.value - 1);
    this.changed$.next();
  }
  allRead(): void { this.setUnread(0); this.changed$.next(); }
  /** Back to the initial "unknown" state — called on logout so a subsequent session on the
   *  same device never briefly shows the previous user's unread count. */
  clear(): void {
    this.unreadSubject.next(0);
    this.unreadStateSubject.next({ status: 'loading', count: 0 });
  }
}
