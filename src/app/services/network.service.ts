import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, map, distinctUntilChanged, skip } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NetworkService implements OnDestroy {

  private readonly online$ = new BehaviorSubject<boolean>(navigator.onLine);

  readonly isOffline$: Observable<boolean> = this.online$.pipe(
    map(v => !v),
    distinctUntilChanged()
  );

  /** Fires only when transitioning from offline → online (not on init). */
  readonly reconnected$: Observable<void> = this.online$.pipe(
    skip(1),
    distinctUntilChanged(),
    map(isOnline => { if (!isOnline) throw null; }),
  ) as Observable<void>;

  private onOnline  = () => this.online$.next(true);
  private onOffline = () => this.online$.next(false);

  constructor() {
    window.addEventListener('online',  this.onOnline);
    window.addEventListener('offline', this.onOffline);
  }

  ngOnDestroy() {
    window.removeEventListener('online',  this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  recheck(): void {
    this.online$.next(navigator.onLine);
  }

  get isOnline(): boolean {
    return this.online$.getValue();
  }
}
