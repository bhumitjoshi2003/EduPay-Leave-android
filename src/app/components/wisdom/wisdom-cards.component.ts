import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { WisdomService } from '../../services/wisdom.service';
import { WisdomDashboard } from '../../interfaces/wisdom';
import { AuthStateService } from '../../auth/auth-state.service';
@Component({ selector: 'app-wisdom-cards', standalone: true, imports: [CommonModule, RouterLink], template: `
<section class="wz-cards" aria-label="A moment of wisdom">
 <p *ngIf="loading" class="wz-status" role="status">A little inspiration is on its way…</p>
 <p *ngIf="error" class="wz-status" role="status">Wisdom is unavailable right now. <button (click)="load()">Try again</button></p>
 <article class="wz-thought-card" *ngIf="data && !loading && !error">
  <div class="wz-thought-card-head">
   <span class="wz-eyebrow">Thought of the Day</span>
   <a *ngIf="canManage" class="manage-link" routerLink="/dashboard/wisdom/manage">Manage Wisdom →</a>
  </div>
  <blockquote class="wz-quote">{{ data.thought.body }}</blockquote>
  <span class="wz-quiet">A small thought. A brighter day.</span>
 </article>
</section>`, styleUrl: './wisdom.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WisdomCardsComponent implements OnInit, OnDestroy {
 private destroy$ = new Subject<void>(); data?: WisdomDashboard; loading = true; error = false;
 get canManage() { return ['ADMIN','SUB_ADMIN'].includes(this.auth.getUser()?.role || ''); }
 constructor(private api: WisdomService, private auth: AuthStateService, private cdr: ChangeDetectorRef) {}
 ngOnInit() { this.load(); }
 load() { this.loading=true; this.error=false; this.api.dashboard().pipe(takeUntil(this.destroy$)).subscribe({ next: data => { this.data=data; this.loading=false; this.cdr.markForCheck(); }, error: () => { this.loading=false; this.error=true; this.cdr.markForCheck(); } }); }
 ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
