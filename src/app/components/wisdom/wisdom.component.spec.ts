import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { WisdomCardsComponent } from './wisdom-cards.component';
import { WisdomAdminComponent } from './wisdom-admin.component';
import { WisdomService } from '../../services/wisdom.service';
import { AuthStateService } from '../../auth/auth-state.service';
import { ToastService } from '../../services/toast.service';
const empty = { content: [], number:0, totalPages:0, first:true, last:true };
const dashboard = {thought:{body:'A thoughtful word matters.'},today:'2026-09-14',timezone:'Asia/Kolkata'};
const thought = {id:1,version:0,schoolId:null,body:'A small act of kindness can change the shape of someone\'s day.',audience:'EVERYONE',active:true};
describe('Wisdom dashboard cards',()=>{
 let api: jasmine.SpyObj<WisdomService>; let fixture: ComponentFixture<WisdomCardsComponent>; let role='STUDENT';
 beforeEach(async()=>{role='STUDENT';api=jasmine.createSpyObj('WisdomService',['dashboard']);api.dashboard.and.returnValue(of(dashboard as any));await TestBed.configureTestingModule({imports:[WisdomCardsComponent],providers:[provideRouter([]),{provide:WisdomService,useValue:api},{provide:AuthStateService,useValue:{getUser:()=>({role})}}]}).compileComponents();fixture=TestBed.createComponent(WisdomCardsComponent);});
 it('renders the Thought of the Day card',()=>{fixture.detectChanges();const text=fixture.nativeElement.textContent;expect(text).toContain('Thought of the Day');expect(text).toContain('A thoughtful word matters.');});
 it('shows loading before the response',()=>{api.dashboard.and.returnValue(new Subject());fixture.detectChanges();expect(fixture.nativeElement.querySelector('[role=status]').textContent).toContain('inspiration');});
 it('supports retry after failure',()=>{api.dashboard.and.returnValue(throwError(()=>new Error()));fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Try again');api.dashboard.and.returnValue(of(dashboard as any));fixture.nativeElement.querySelector('button').click();fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('A thoughtful word matters.');});
 it('shows administration only to admin roles',()=>{fixture.detectChanges();expect(fixture.nativeElement.querySelector('.manage-link')).toBeNull();role='SUB_ADMIN';fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();fixture.detectChanges();expect(fixture.nativeElement.querySelector('.manage-link')).toBeTruthy();}); // fixture.componentRef.changeDetectorRef is the host view's ref, not the component's own injected one — marking that dirty doesn't reliably re-run this OnPush component's template getters.
});
describe('Wisdom admin workflow',()=>{
 let api: jasmine.SpyObj<WisdomService>;let toast: any;let fixture: ComponentFixture<WisdomAdminComponent>;
 beforeEach(async()=>{api=jasmine.createSpyObj('WisdomService',['status','list','saveThought','override','removeOverride']);api.status.and.returnValue(of({today:'2026-09-14',timezone:'Asia/Kolkata'}));api.list.and.returnValue(of(empty as any));toast={success:jasmine.createSpy(),error:jasmine.createSpy(),info:jasmine.createSpy(),confirm:jasmine.createSpy().and.resolveTo(true)};await TestBed.configureTestingModule({imports:[WisdomAdminComponent],providers:[provideRouter([]),{provide:WisdomService,useValue:api},{provide:ToastService,useValue:toast}]}).compileComponents();fixture=TestBed.createComponent(WisdomAdminComponent);fixture.detectChanges();});
 it('loads the thought library and shows an empty state when there are none',()=>{expect(fixture.nativeElement.textContent).toContain('No thoughts match these filters');});
 it('filters the library by audience',()=>{const c=fixture.componentInstance;c.allThoughts=[thought as any,{...thought,id:2,audience:'STUDENT',body:'Ask a good question today.'} as any];c.setAudienceFilter('STUDENT');expect(c.filteredThoughts.length).toBe(1);expect(c.filteredThoughts[0].audience).toBe('STUDENT');});
 it('paginates the thought library client-side',()=>{const c=fixture.componentInstance;c.thoughtPageSize=1;c.allThoughts=[thought as any,{...thought,id:2} as any];expect(c.thoughtTotalPages).toBe(2);expect(c.pagedThoughts.length).toBe(1);c.moveThoughtPage(1);expect(c.pagedThoughts[0].id).toBe(2);});
 it('saves a new thought',()=>{const c=fixture.componentInstance;c.thoughtForm.setValue({body:'Be kind.',audience:'EVERYONE',active:true,version:0});api.saveThought.and.returnValue(of(thought as any));c.saveThought();expect(api.saveThought).toHaveBeenCalled();});
 it('selecting a thought shows its text in the scheduling hint',()=>{const c=fixture.componentInstance;c.selectThought(thought as any);expect(c.selectedThoughtText).toBe(thought.body);expect(c.overrideForm.controls.thoughtId.value).toBe(1);});
 it('schedules an override for the selected thought',()=>{const c=fixture.componentInstance;c.selectThought(thought as any);c.overrideForm.patchValue({displayDate:'2026-09-20'});api.override.and.returnValue(of({id:1,thoughtId:1,displayDate:'2026-09-20',audience:'EVERYONE'} as any));c.saveOverride();expect(api.override).toHaveBeenCalledWith(1,'2026-09-20','EVERYONE');});
 it('removes an override after confirmation',async()=>{api.removeOverride.and.returnValue(of(undefined));await fixture.componentInstance.removeOverride({id:5,thoughtId:1,displayDate:'2026-09-20',audience:'EVERYONE'});expect(api.removeOverride).toHaveBeenCalledWith(5);});
 it('builds calendar cells with today and overrides marked',()=>{const c=fixture.componentInstance;c.overrides={...empty,content:[{id:1,thoughtId:1,displayDate:c.status!.today,audience:'EVERYONE'}]} as any;const cells=c.calendarCells;const todayCell=cells.find(cell=>cell.iso===c.status!.today);expect(todayCell?.isToday).toBeTrue();expect(todayCell?.hasOverride).toBeTrue();});
});
