import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  trigger, transition, style, animate,
} from '@angular/animations';
import { ToastService, Toast } from '../../services/toast.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('toastAnim', [
      transition(':enter', [
        style({ transform: 'translateY(-24px) scale(0.94)', opacity: 0 }),
        animate('240ms cubic-bezier(0.34, 1.15, 0.64, 1)',
          style({ transform: 'translateY(0) scale(1)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('160ms ease-in',
          style({ transform: 'translateY(-12px) scale(0.95)', opacity: 0 })),
      ]),
    ]),
  ],
  template: `
    <div class="toast-wrap" role="status" aria-live="polite" aria-atomic="true">
      <div
        *ngFor="let t of toasts; trackBy: trackById"
        class="toast toast-{{ t.type }}"
        [attr.role]="(t.type === 'error' || t.type === 'warning') ? 'alert' : 'status'"
        [@toastAnim]>

        <span class="sr-only">{{ t.type }}: {{ t.title }}{{ t.message ? ' - ' + t.message : '' }}</span>

        <div class="toast-icon-col">
          <span class="material-icons">{{ icon(t.type) }}</span>
        </div>

        <div class="toast-body">
          <p class="toast-title">{{ t.title }}</p>
          <p *ngIf="t.message" class="toast-msg">{{ t.message }}</p>
        </div>

        <button class="toast-close" (click)="dismiss(t.id)" aria-label="Dismiss notification">
          <span class="material-icons">close</span>
        </button>

        <div class="toast-progress"
             [style.animation-duration.ms]="t.duration">
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast-wrap {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 20px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(360px, calc(100vw - 32px));
      pointer-events: none;
    }

    .toast {
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.08);
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 12px 20px 14px;
      position: relative;
      overflow: hidden;
      pointer-events: all;
      border-left: 4px solid var(--tc);
    }

    .toast-success { --tc: #16a34a; }
    .toast-error   { --tc: #dc2626; }
    .toast-warning { --tc: #d97706; }
    .toast-info    { --tc: #2563eb; }

    .toast-icon-col .material-icons {
      font-size: 22px;
      color: var(--tc);
      margin-top: 1px;
      display: block;
    }

    .toast-body { flex: 1; min-width: 0; }

    .toast-title {
      font-size: 13.5px;
      font-weight: 600;
      color: #111827;
      margin: 0 0 2px;
      line-height: 1.4;
    }

    .toast-msg {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
      line-height: 1.45;
    }

    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: #9ca3af;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      line-height: 1;
    }
    .toast-close:hover { color: #374151; }
    .toast-close .material-icons { font-size: 17px; }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      width: 100%;
      background: var(--tc);
      transform-origin: left;
      animation: drain linear forwards;
    }

    @keyframes drain {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }
  `],
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private destroy$ = new Subject<void>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private svc: ToastService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.svc.toasts$.pipe(takeUntil(this.destroy$)).subscribe(toasts => {
      toasts.forEach(t => {
        if (!this.timers.has(t.id)) {
          this.timers.set(t.id, setTimeout(() => this.dismiss(t.id), t.duration));
        }
      });
      this.toasts = toasts;
      this.cdr.markForCheck();
    });
  }

  dismiss(id: string): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.svc.dismiss(id);
  }

  icon(type: Toast['type']): string {
    return { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' }[type];
  }

  trackById(_: number, t: Toast): string { return t.id; }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.timers.forEach(t => clearTimeout(t));
  }
}
