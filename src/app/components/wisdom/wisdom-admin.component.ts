import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { WisdomService } from '../../services/wisdom.service';
import { ToastService } from '../../services/toast.service';
import { Scripture, Teaching, Thought, ThoughtOverride, VerseSuggestion, WisdomPage, WisdomStatus } from '../../interfaces/wisdom';
import { AuthStateService } from '../../auth/auth-state.service';
@Component({ standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterLink], templateUrl: './wisdom-admin.component.html', styleUrl: './wisdom.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class WisdomAdminComponent implements OnInit, OnDestroy {
 private fb=inject(FormBuilder); private auth=inject(AuthStateService);
 private destroy$=new Subject<void>(); private reload$=new Subject<void>();
 audiences=['EVERYONE','STUDENT','TEACHER','PARENT','ADMIN']; loading=true; error=false; busy=false; aiBusy=false;
 status?: WisdomStatus; thoughts?: WisdomPage<Thought>; overrides?: WisdomPage<ThoughtOverride>; verses?: WisdomPage<Scripture>; teachings?: WisdomPage<Teaching>;
 indices={thoughts:0,overrides:0,verses:0,teachings:0}; verseQuery=''; thoughtId?: number; teachingId?: number; preview?: Teaching;
 aiEnabled=this.auth.getUser()?.featureKeys?.includes('AI_COPILOT') || false;
 suggestBusy=false; suggestions?: VerseSuggestion[];
 thoughtForm=this.fb.nonNullable.group({body:['',[Validators.required,Validators.maxLength(300)]],audience:['EVERYONE'],active:[true],version:[0]});
 overrideForm=this.fb.nonNullable.group({thoughtId:[0,Validators.min(1)],displayDate:['',Validators.required],audience:['EVERYONE']});
 teachingForm=this.fb.nonNullable.group({verseId:[0,Validators.min(1)],title:['',[Validators.required,Validators.maxLength(160)]],simpleMeaning:['',[Validators.required,Validators.maxLength(4000)]],understanding:['',[Validators.required,Validators.maxLength(12000)]],lesson:['',[Validators.required,Validators.maxLength(2000)]],version:[0]});
 dateForm=this.fb.nonNullable.group({date:['',Validators.required],time:['']});
 sourceForm=this.fb.nonNullable.group({q:['']}); themeForm=this.fb.nonNullable.group({theme:['',[Validators.required,Validators.maxLength(500)]]});
 suggestForm=this.fb.nonNullable.group({theme:['',[Validators.required,Validators.maxLength(500)]]});
 constructor(private api: WisdomService,private toast: ToastService,private cdr: ChangeDetectorRef) {}
 ngOnInit() { this.reload$.pipe(startWith(undefined),tap(()=>{this.loading=true;this.error=false;}),switchMap(()=>forkJoin({status:this.api.status(),thoughts:this.api.list<Thought>('admin/thoughts',this.indices.thoughts),overrides:this.api.list<ThoughtOverride>('admin/overrides',this.indices.overrides),verses:this.api.list<Scripture>('admin/verses',this.indices.verses,this.verseQuery),teachings:this.api.list<Teaching>('admin/teachings',this.indices.teachings)}).pipe(catchError(()=>{this.error=true;return of(null);}))),takeUntil(this.destroy$)).subscribe(data=>{if(data){Object.assign(this,data);if(!this.overrideForm.controls.displayDate.value)this.overrideForm.patchValue({displayDate:data.status.today});if(!this.dateForm.controls.date.value){const d=new Date(data.status.today+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+((8-d.getUTCDay())%7 || 7));this.dateForm.patchValue({date:d.toISOString().slice(0,10)});}}this.loading=false;this.cdr.markForCheck();}); }
 reload(){this.reload$.next();}
 move(key: keyof typeof this.indices,delta: number){this.indices[key]+=delta;this.reload();}
 searchVerses(){this.verseQuery=this.sourceForm.controls.q.value;this.indices.verses=0;this.reload();}
 private mutate<T>(request: Observable<T>,message: string,done?: (value:T)=>void){if(this.busy)return;this.busy=true;request.pipe(takeUntil(this.destroy$)).subscribe({next:value=>{this.busy=false;done?.(value);this.toast.success(message);this.reload();this.cdr.markForCheck();},error:e=>{this.busy=false;this.toast.error('Could not save',e.error?.message || 'Please retry. Your changes are still here.');this.cdr.markForCheck();}});}
 editThought(t: Thought){this.thoughtId=t.schoolId===null?undefined:t.id;this.thoughtForm.patchValue({...t,version:t.schoolId===null?0:t.version});}
 newThought(){this.thoughtId=undefined;this.thoughtForm.reset({body:'',audience:'EVERYONE',active:true,version:0});}
 saveThought(){if(this.thoughtForm.invalid)return;this.mutate(this.api.saveThought(this.thoughtForm.getRawValue(),this.thoughtId),'Thought saved',t=>{this.overrideForm.patchValue({thoughtId:t.id,audience:t.audience});this.newThought();});}
 selectThought(t: Thought){this.overrideForm.patchValue({thoughtId:t.id,audience:t.audience});}
 saveOverride(){if(this.overrideForm.invalid)return;const v=this.overrideForm.getRawValue();this.mutate(this.api.override(v.thoughtId,v.displayDate,v.audience),'Daily override saved');}
 async removeOverride(o: ThoughtOverride){if(await this.toast.confirm({title:'Remove this override?',message:'Automatic selection will resume unless another audience override applies.',confirmText:'Remove',cancelText:'Keep'}))this.mutate(this.api.removeOverride(o.id),'Override removed');}
 editTeaching(t: Teaching){this.teachingId=t.id;this.teachingForm.patchValue({...t,verseId:t.scripture.id});this.selectedScripture=t.scripture;}
 selectedScripture?: Scripture;
 selectVerse(v: Scripture){this.selectedScripture=v;this.teachingForm.patchValue({verseId:v.id});this.suggestions=undefined;}
 suggestVerses(){if(this.suggestForm.invalid || this.suggestBusy)return;this.suggestBusy=true;this.suggestions=undefined;this.api.suggestVerses(this.suggestForm.controls.theme.value).pipe(takeUntil(this.destroy$)).subscribe({next:s=>{this.suggestions=s;this.suggestBusy=false;this.cdr.markForCheck();},error:()=>{this.suggestBusy=false;this.toast.error('Suggestions unavailable','You can continue searching manually.');this.cdr.markForCheck();}});}
 useSuggestion(s: VerseSuggestion){this.selectVerse(s.scripture);}
 newTeaching(){this.teachingId=undefined;this.selectedScripture=undefined;this.teachingForm.reset({verseId:0,title:'',simpleMeaning:'',understanding:'',lesson:'',version:0});}
 saveTeaching(){if(this.teachingForm.invalid)return;this.mutate(this.api.saveTeaching(this.teachingForm.getRawValue(),this.teachingId),'Draft saved',()=>this.newTeaching());}
 async schedule(t: Teaching){if(this.dateForm.invalid)return;const date=this.dateForm.controls.date.value;const time=this.dateForm.controls.time.value||null;const when=time?`${date} at ${time}`:`${date} (school-local midnight)`;if(await this.toast.confirm({title:'Approve this teaching?',message:`Publish “${t.title}” on ${when} (${this.status?.timezone}). Choosing today makes it visible immediately once the time has passed. Confirm that you have reviewed the complete teaching.`,confirmText:'Approve publication',cancelText:'Keep draft'}))this.mutate(this.api.schedule(t,date,time),'Publication approved');}
 async cancel(t: Teaching){if(await this.toast.confirm({title:'Return to draft?',message:'This teaching will no longer publish on its scheduled date.',confirmText:'Cancel schedule',cancelText:'Keep schedule'}))this.mutate(this.api.cancel(t),'Returned to draft');}
 async draft(){if(!this.selectedScripture || this.themeForm.invalid || this.aiBusy)return;if(!(await this.toast.confirm({title:'Draft editorial text with AI?',message:'This replaces the three editorial fields in the form. You must review the result before saving or approving publication.',confirmText:'Draft text',cancelText:'Keep my text'})))return;this.aiBusy=true;this.api.draft(this.selectedScripture.id,this.themeForm.controls.theme.value).pipe(takeUntil(this.destroy$)).subscribe({next:d=>{this.teachingForm.patchValue(d);this.aiBusy=false;this.toast.info('Unapproved AI draft','Review and edit every section. Nothing has been saved or published.');this.cdr.markForCheck();},error:()=>{this.aiBusy=false;this.toast.error('AI draft unavailable','You can continue writing manually.');this.cdr.markForCheck();}});}
 ngOnDestroy(){this.destroy$.next();this.destroy$.complete();}
}
