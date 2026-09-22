import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StaffAdoptionService } from '../../services/staff-adoption.service';
import { StaffAdoptionComponent } from './staff-adoption.component';

describe('StaffAdoptionComponent', () => {
  let fixture: ComponentFixture<StaffAdoptionComponent>;
  let service: jasmine.SpyObj<StaffAdoptionService>;
  const response: any = { summary: { totalTeachers: 2, startedTeachers: 1, notStartedTeachers: 1, attendanceUsedTeachers: 1, disabledTeachers: 0 }, teachers: [
    { teacherId: 'T1', name: 'Meenakshi Negi', accountStatus: 'STARTED', lastActiveAt: new Date().toISOString(), hasUsedAttendance: true, lastAttendanceAt: null, onboardingStatus: 'COMPLETED', appVersionName: '1.3.0', appVersionStatus: 'UP_TO_DATE' },
    { teacherId: 'T2', name: 'Tarun Bisht', accountStatus: 'NOT_STARTED', lastActiveAt: null, hasUsedAttendance: false, lastAttendanceAt: null, onboardingStatus: 'UNKNOWN', appVersionStatus: 'UNKNOWN' },
  ]};
  beforeEach(async () => { service = jasmine.createSpyObj('StaffAdoptionService', ['getStaffAdoption']); service.getStaffAdoption.and.returnValue(of(response)); await TestBed.configureTestingModule({ imports: [StaffAdoptionComponent], providers: [provideRouter([]), { provide: StaffAdoptionService, useValue: service }] }).compileComponents(); fixture = TestBed.createComponent(StaffAdoptionComponent); });
  it('renders summary, account, attendance, onboarding and app states', () => { fixture.detectChanges(); const text = fixture.nativeElement.textContent; expect(text).toContain('2'); expect(text).toContain('Started'); expect(text).toContain('Not yet used'); expect(text).toContain('Completed'); expect(text).toContain('Up to date'); expect(text).toContain('No version reported'); });
  it('filters by search and readiness filter', () => { fixture.detectChanges(); fixture.componentInstance.searchTerm = 'Tarun'; fixture.componentInstance.filter = 'NOT_STARTED'; expect(fixture.componentInstance.rows.length).toBe(1); });
  it('shows a recoverable error', () => { service.getStaffAdoption.and.returnValue(throwError(() => new Error('offline'))); fixture = TestBed.createComponent(StaffAdoptionComponent); fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('could not be loaded'); expect(fixture.nativeElement.textContent).toContain('Retry'); });
});
