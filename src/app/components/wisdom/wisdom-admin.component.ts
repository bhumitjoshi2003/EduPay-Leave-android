import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { WisdomService } from '../../services/wisdom.service';
import { ToastService } from '../../services/toast.service';
import { Thought, ThoughtOverride, WisdomPage, WisdomStatus } from '../../interfaces/wisdom';
@Component({ standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterLink], templateUrl: './wisdom-admin.component.html', styleUrl: './wisdom.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WisdomAdminComponent implements OnInit, OnDestroy {
 private fb=inject(FormBuilder);
 private destroy$=new Subject<void>(); private reload$=new Subject<void>();
 audiences=['EVERYONE','STUDENT','TEACHER','PARENT','ADMIN']; loading=true; error=false; busy=false;
 status?: WisdomStatus; thoughts?: WisdomPage<Thought>; overrides?: WisdomPage<ThoughtOverride>;
 indices={thoughts:0,overrides:0}; thoughtId?: number;

 // ── Thought library: fully loaded once, paginated/filtered client-side ──
 allThoughts: Thought[] = [];
 thoughtPageSize = 8; thoughtPage = 0; thoughtAudienceFilter = 'ALL';
 audienceFilters = ['ALL','EVERYONE','STUDENT','TEACHER','PARENT'];
 showThoughtEditor = false;
 get filteredThoughts(): Thought[] {
  return this.allThoughts.filter(t => this.thoughtAudienceFilter === 'ALL' || t.audience === this.thoughtAudienceFilter);
 }
 get thoughtTotalPages(): number { return Math.max(1, Math.ceil(this.filteredThoughts.length / this.thoughtPageSize)); }
 get pagedThoughts(): Thought[] { const start = this.thoughtPage * this.thoughtPageSize; return this.filteredThoughts.slice(start, start + this.thoughtPageSize); }
 setAudienceFilter(a: string) { this.thoughtAudienceFilter = a; this.thoughtPage = 0; this.cdr.markForCheck(); }
 moveThoughtPage(delta: number) { this.thoughtPage = Math.min(Math.max(0, this.thoughtPage + delta), this.thoughtTotalPages - 1); }
 openThoughtEditor(t?: Thought) { if (t) this.editThought(t); else this.newThought(); this.showThoughtEditor = true; }
 closeThoughtEditor() { this.showThoughtEditor = false; this.newThought(); }

 // ── Mini calendar widget for the Daily calendar panel ────────────────────
 private calendarInitialized = false;
 calendarViewYear = new Date().getFullYear(); calendarViewMonth = new Date().getMonth();
 private initCalendarFromToday() {
  if (this.calendarInitialized || !this.status) return;
  const d = new Date(this.status.today + 'T00:00:00Z');
  this.calendarViewYear = d.getUTCFullYear(); this.calendarViewMonth = d.getUTCMonth();
  this.calendarInitialized = true;
 }
 prevCalendarMonth() { this.calendarViewMonth--; if (this.calendarViewMonth < 0) { this.calendarViewMonth = 11; this.calendarViewYear--; } }
 nextCalendarMonth() { this.calendarViewMonth++; if (this.calendarViewMonth > 11) { this.calendarViewMonth = 0; this.calendarViewYear++; } }
 get calendarMonthLabel(): string {
  return new Date(Date.UTC(this.calendarViewYear, this.calendarViewMonth, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
 }
 private isoDate(y: number, m: number, d: number): string { return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
 get calendarCells(): { day: number | null; iso: string; isToday: boolean; isSelected: boolean; hasOverride: boolean; isPast: boolean }[] {
  const y = this.calendarViewYear, m = this.calendarViewMonth;
  const firstDow = new Date(Date.UTC(y, m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const today = this.status?.today || '';
  const selected = this.overrideForm.controls.displayDate.value;
  const overrideDates = new Set((this.overrides?.content || []).map(o => o.displayDate));
  const cells: { day: number | null; iso: string; isToday: boolean; isSelected: boolean; hasOverride: boolean; isPast: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: '', isToday: false, isSelected: false, hasOverride: false, isPast: false });
  for (let d = 1; d <= daysInMonth; d++) {
   const iso = this.isoDate(y, m, d);
   cells.push({ day: d, iso, isToday: iso === today, isSelected: iso === selected, hasOverride: overrideDates.has(iso), isPast: !!today && iso < today });
  }
  return cells;
 }
 selectCalendarDate(cell: { iso: string; isPast: boolean; day: number | null }) {
  if (cell.day === null || cell.isPast) return;
  this.overrideForm.patchValue({ displayDate: cell.iso });
 }
 audienceAccentClass(audience: string): string {
  switch (audience) {
   case 'STUDENT': return 'wz-aud-student';
   case 'TEACHER': return 'wz-aud-teacher';
   case 'PARENT': return 'wz-aud-parent';
   case 'ADMIN': return 'wz-aud-admin';
   default: return 'wz-aud-everyone';
  }
 }
 overrideMonthShort(iso: string): string { return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(); }
 overrideDay(iso: string): number { return new Date(iso + 'T00:00:00Z').getUTCDate(); }

 thoughtForm=this.fb.nonNullable.group({body:['',[Validators.required,Validators.maxLength(300)]],audience:['EVERYONE'],active:[true],version:[0]});
 overrideForm=this.fb.nonNullable.group({thoughtId:[0,Validators.min(1)],displayDate:['',Validators.required],audience:['EVERYONE']});
 constructor(private api: WisdomService,private toast: ToastService,private cdr: ChangeDetectorRef) {}
 ngOnInit() { this.reload$.pipe(startWith(undefined),tap(()=>{this.loading=true;this.error=false;}),switchMap(()=>forkJoin({status:this.api.status(),thoughts:this.api.list<Thought>('admin/thoughts',this.indices.thoughts),allThoughts:this.loadAllThoughts(),overrides:this.api.list<ThoughtOverride>('admin/overrides',this.indices.overrides)}).pipe(catchError(()=>{this.error=true;return of(null);}))),takeUntil(this.destroy$)).subscribe(data=>{if(data){Object.assign(this,data);this.initCalendarFromToday();if(!this.overrideForm.controls.displayDate.value)this.overrideForm.patchValue({displayDate:data.status.today});}this.loading=false;this.cdr.markForCheck();}); }
 /** Backend pages the curated+custom Thought collection at 30/page; the library
  *  needs the full set to paginate/filter client-side at a tighter page size
  *  (155 curated+custom thoughts is small enough to load once per refresh
  *  without a backend change). */
 private loadAllThoughts(): Observable<Thought[]> {
  const collect = (page: number, acc: Thought[]): Observable<Thought[]> =>
   this.api.list<Thought>('admin/thoughts', page).pipe(
    switchMap(p => p.last ? of([...acc, ...p.content]) : collect(page + 1, [...acc, ...p.content])));
  return collect(0, []);
 }
 reload(){this.reload$.next();}
 move(key: keyof typeof this.indices,delta: number){this.indices[key]+=delta;this.reload();}
 private mutate<T>(request: Observable<T>,message: string,done?: (value:T)=>void){if(this.busy)return;this.busy=true;request.pipe(takeUntil(this.destroy$)).subscribe({next:value=>{this.busy=false;done?.(value);this.toast.success(message);this.reload();this.cdr.markForCheck();},error:e=>{this.busy=false;this.toast.error('Could not save',e.error?.message || 'Please retry. Your changes are still here.');this.cdr.markForCheck();}});}
 editThought(t: Thought){this.thoughtId=t.schoolId===null?undefined:t.id;this.thoughtForm.patchValue({...t,version:t.schoolId===null?0:t.version});}
 newThought(){this.thoughtId=undefined;this.thoughtForm.reset({body:'',audience:'EVERYONE',active:true,version:0});}
 saveThought(){if(this.thoughtForm.invalid)return;this.mutate(this.api.saveThought(this.thoughtForm.getRawValue(),this.thoughtId),'Thought saved',t=>{this.overrideForm.patchValue({thoughtId:t.id,audience:t.audience});this.selectedThoughtText=t.body;this.newThought();this.showThoughtEditor=false;});}
 selectedThoughtText?: string;
 selectThought(t: Thought){this.overrideForm.patchValue({thoughtId:t.id,audience:t.audience});this.selectedThoughtText=t.body;}
 saveOverride(){if(this.overrideForm.invalid)return;const v=this.overrideForm.getRawValue();this.mutate(this.api.override(v.thoughtId,v.displayDate,v.audience),'Daily override saved');}
 async removeOverride(o: ThoughtOverride){if(await this.toast.confirm({title:'Remove this override?',message:'Automatic selection will resume unless another audience override applies.',confirmText:'Remove',cancelText:'Keep'}))this.mutate(this.api.removeOverride(o.id),'Override removed');}
 ngOnDestroy(){this.destroy$.next();this.destroy$.complete();}
}
