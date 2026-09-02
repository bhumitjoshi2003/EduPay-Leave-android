import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Subject, catchError, exhaustMap, tap } from 'rxjs';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class NotificationStateService {
  private readonly unreadSubject = new BehaviorSubject(0);
  readonly unreadCount$ = this.unreadSubject.asObservable();
  readonly changed$ = new Subject<void>();
  private readonly refreshRequest = new Subject<void>();

  constructor(private api: NotificationService) {
    this.refreshRequest.pipe(exhaustMap(() => this.api.getUnreadNotificationCount().pipe(
      tap(count => this.unreadSubject.next(count)), catchError(() => EMPTY)
    ))).subscribe();
  }

  refreshUnread(): void { this.refreshRequest.next(); }
  setUnread(count: number): void { this.unreadSubject.next(Math.max(0, count)); }
  notificationRead(wasUnread: boolean): void {
    if (wasUnread) this.setUnread(this.unreadSubject.value - 1);
    this.changed$.next();
  }
  allRead(): void { this.setUnread(0); this.changed$.next(); }
  clear(): void { this.setUnread(0); }
}
