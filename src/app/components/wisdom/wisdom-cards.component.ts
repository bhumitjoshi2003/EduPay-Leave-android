import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { WisdomService } from '../../services/wisdom.service';
import { WisdomDashboard } from '../../interfaces/wisdom';
import { AuthStateService } from '../../auth/auth-state.service';
@Component({ selector: 'app-wisdom-cards', standalone: true, imports: [CommonModule, RouterLink], template: `
<section class="wisdom-cards" aria-label="A moment of wisdom">
 <p *ngIf="loading" role="status">A little inspiration is on its way…</p>
 <p *ngIf="error" role="status">Wisdom is unavailable right now. <button (click)="load()">Try again</button></p>
 <ng-container *ngIf="data && !loading && !error">
  <article class="thought-card"><span class="eyebrow">✦ Thought of the Day</span><blockquote>{{ data.thought.body }}</blockquote><span class="quiet">A small thought. A brighter day.</span></article>
  <article class="gita-card"><span class="eyebrow">❋ Gita for Life</span>
   <ng-container *ngIf="data.teaching as t; else empty"><p class="quiet">{{ isThisWeek(t.publicationDate) ? 'This week' : 'Latest teaching' }} · Bhagavad Gita {{ t.scripture.chapter }}.{{ t.scripture.verse }}</p><h2>{{ t.title }}</h2><p class="preview">{{ t.lesson }}</p><a [routerLink]="['/dashboard/wisdom/gita', t.id]">Read the teaching <span aria-hidden="true">→</span></a></ng-container>
   <ng-template #empty><h2>A moment to reflect</h2><p>Your school’s first teaching will appear here when it is published.</p></ng-template>
   <a class="library-link" routerLink="/dashboard/wisdom/gita">Explore the library</a>
  </article>
 </ng-container>
</section><a *ngIf="canManage" class="manage-link" routerLink="/dashboard/wisdom/manage">Manage Wisdom →</a>`, styleUrl: './wisdom.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WisdomCardsComponent implements OnInit, OnDestroy {
 private destroy$ = new Subject<void>(); data?: WisdomDashboard; loading = true; error = false;
 get canManage() { return ['ADMIN','SUB_ADMIN'].includes(this.auth.getUser()?.role || ''); }
 constructor(private api: WisdomService, private auth: AuthStateService, private cdr: ChangeDetectorRef) {}
 ngOnInit() { this.load(); }
 load() { this.loading=true; this.error=false; this.api.dashboard().pipe(takeUntil(this.destroy$)).subscribe({ next: data => { this.data=data; this.loading=false; this.cdr.markForCheck(); }, error: () => { this.loading=false; this.error=true; this.cdr.markForCheck(); } }); }
 isThisWeek(date: string | null) { if(!date || !this.data) return false; const d=new Date(this.data.today+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return date >= d.toISOString().slice(0,10); }
 ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
