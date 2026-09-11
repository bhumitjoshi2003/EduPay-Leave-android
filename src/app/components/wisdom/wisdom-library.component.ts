import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { WisdomService } from '../../services/wisdom.service';
import { Teaching, WisdomPage } from '../../interfaces/wisdom';
@Component({ standalone: true, imports: [CommonModule, FormsModule, RouterLink], template: `
<main class="wisdom-page"><a routerLink="/dashboard">← Dashboard</a><header><span class="eyebrow">❋ Gita for Life</span><h1>{{ id ? 'A moment of understanding' : 'Wisdom to return to' }}</h1><p>Thoughtfully chosen teachings for everyday life.</p></header>
 <form *ngIf="!id" (ngSubmit)="search()" class="search"><label for="teaching-search">Search published teachings</label><input id="teaching-search" name="q" [(ngModel)]="q" maxlength="200" placeholder="Search a title"><button>Search</button></form>
 <p *ngIf="loading" role="status">Opening your reading space…</p><p *ngIf="error" role="alert">This teaching or library could not be loaded. <button (click)="reload.next()">Try again</button></p>
 <article *ngIf="teaching && !loading" class="reading"><span class="eyebrow">Bhagavad Gita {{ teaching.scripture.chapter }}.{{ teaching.scripture.verse }}</span><h1>{{ teaching.title }}</h1><p class="quiet">Published {{ teaching.publicationDate | date:'longDate' }}</p>
 <section><h2>Original Sanskrit Shloka</h2><p class="sanskrit" lang="sa">{{ teaching.scripture.sanskrit }}</p></section>
 <section><h2>Transliteration</h2><p class="transliteration">{{ teaching.scripture.transliteration }}</p></section>
 <section><h2>Simple Meaning</h2><p>{{ teaching.simpleMeaning }}</p></section>
 <section><h2>Understanding &amp; Example</h2><p>{{ teaching.understanding }}</p></section>
 <section class="lesson"><h2>Lesson for Life</h2><p>{{ teaching.lesson }}</p></section>
 <details><summary>Verified translation &amp; source</summary><p>{{ teaching.scripture.translation }}</p><p>{{ teaching.scripture.sourceName }} · {{ teaching.scripture.sourceVersion }}</p><p>{{ teaching.scripture.license }}</p><p class="source">{{ teaching.scripture.sourceUrl }}</p></details>
 <a routerLink="/dashboard/wisdom/gita">← All published teachings</a></article>
 <ng-container *ngIf="!id && page && !loading"><p *ngIf="!page.content.length" class="empty">{{ q ? 'No teachings match this search.' : 'Your school has not published a teaching yet. This space will grow with each shared reflection.' }}</p><div class="library-grid"><a class="library-item" *ngFor="let t of page.content" [routerLink]="['/dashboard/wisdom/gita',t.id]"><span class="eyebrow">Bhagavad Gita {{ t.scripture.chapter }}.{{ t.scripture.verse }}</span><h2>{{ t.title }}</h2><p class="preview">{{ t.lesson }}</p><span class="quiet">{{ t.publicationDate | date:'mediumDate' }} · Read →</span></a></div><nav aria-label="Library pages" *ngIf="page.totalPages > 1"><button [disabled]="page.first" (click)="move(-1)">Previous</button><span>Page {{ page.number+1 }} of {{ page.totalPages }}</span><button [disabled]="page.last" (click)="move(1)">Next</button></nav></ng-container>
</main>`, styleUrl: './wisdom.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WisdomLibraryComponent implements OnInit, OnDestroy {
 private destroy$=new Subject<void>(); reload=new Subject<void>(); id: string|null=null; q=''; index=0; loading=true; error=false; teaching?: Teaching; page?: WisdomPage<Teaching>;
 constructor(private api: WisdomService, private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}
 ngOnInit() { this.route.paramMap.pipe(tap(params => { this.id=params.get('id'); this.index=0; }), switchMap(() => this.reload.pipe(startWith(undefined), tap(() => { this.loading=true;this.error=false;this.teaching=undefined;this.page=undefined; }), switchMap(() => this.fetch().pipe(catchError(() => { this.error=true; return of(null); }))))), takeUntil(this.destroy$)).subscribe(value => { if(value && 'content' in value) this.page=value; else if(value) this.teaching=value; this.loading=false;this.cdr.markForCheck(); }); }
 private fetch(): Observable<Teaching | WisdomPage<Teaching>> { return this.id ? this.api.read(this.id) : this.api.list<Teaching>('teachings',this.index,this.q); }
 search() { this.index=0;this.reload.next(); } move(delta: number) { this.index+=delta;this.reload.next(); }
 ngOnDestroy() {this.destroy$.next();this.destroy$.complete();}
}
