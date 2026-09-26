import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ClassAttendanceInsightsComponent } from './class-attendance-insights.component';
import { AttendanceService } from '../../services/attendance.service';
import { ClassAttendanceInsights } from '../../interfaces/attendance-insights';

describe('ClassAttendanceInsightsComponent', () => {
  let fixture: ComponentFixture<ClassAttendanceInsightsComponent>;
  let service: jasmine.SpyObj<AttendanceService>;

  const classInsights = (overrides: Partial<ClassAttendanceInsights> = {}): ClassAttendanceInsights => ({
    classId: 10, className: '8', sectionId: 3, sectionName: 'A', sessionLabel: '2026-2027', from: '2026-04-01', to: '2026-09-25',
    lowAttendanceThreshold: 75, streakThreshold: 3, totalStudents: 3, submittedRecords: 24, classPercentage: 79.2,
    belowThresholdCount: 1, consecutiveAbsenceCount: 1,
    students: [
      { studentId: 'A2', studentName: 'Bina', sectionName: 'A', submittedDays: 4, present: 1, absent: 3, approvedLeave: 0, percentage: 25, lowAttendance: true, currentAbsenceStreak: 3, streakApprovedLeaveDays: 1 },
      { studentId: 'A1', studentName: 'Aarav', sectionName: 'A', submittedDays: 20, present: 18, absent: 2, approvedLeave: 1, percentage: 90, lowAttendance: false, currentAbsenceStreak: 0, streakApprovedLeaveDays: 0 },
      { studentId: 'A3', studentName: 'Chetan', sectionName: 'A', submittedDays: 0, present: 0, absent: 0, approvedLeave: 0, percentage: 0, lowAttendance: false, currentAbsenceStreak: 0, streakApprovedLeaveDays: 0 },
    ],
    ...overrides,
  });

  function render(inputs: Partial<ClassAttendanceInsightsComponent>): HTMLElement {
    fixture = TestBed.createComponent(ClassAttendanceInsightsComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('AttendanceService', ['getMyClassInsights', 'getClassInsights']);
    TestBed.configureTestingModule({
      imports: [ClassAttendanceInsightsComponent],
      providers: [{ provide: AttendanceService, useValue: service }],
    });
  });

  it('teacher mode loads the own-class endpoint and shows the compact tiles', () => {
    service.getMyClassInsights.and.returnValue(of(classInsights()));
    const el = render({ mode: 'teacher' });

    expect(service.getMyClassInsights).toHaveBeenCalled();
    expect(service.getClassInsights).not.toHaveBeenCalled();
    expect(el.querySelector('.ai-title')!.textContent).toContain('Class 8 – A');
    const tiles = Array.from(el.querySelectorAll('.ai-tile')).map(t => Array.from(t.children).map(c => c.textContent!.trim()).join(' '));
    expect(tiles).toEqual(['79.2% Class attendance', '3 Students', '1 Below 75%', '1 3+ absences in a row']);
    expect(el.querySelector('.ai-students')).toBeNull();   // detail list is collapsed by default
  });

  it('opens the detail list low-attendance first and filters it', () => {
    service.getMyClassInsights.and.returnValue(of(classInsights()));
    const el = render({ mode: 'teacher' });

    (el.querySelector('.ai-expand') as HTMLButtonElement).click();
    fixture.detectChanges();
    const names = Array.from(el.querySelectorAll('.ai-student-name')).map(n => n.textContent!.trim());
    expect(names).toEqual(['Bina', 'Aarav', 'Chetan']);
    expect(el.querySelector('.ai-streak-tag')!.textContent).toContain('Absent 3 days in a row');
    expect(el.querySelectorAll('.ai-pct')[2].textContent!.trim()).toBe('—');

    (el.querySelector('.ai-tile-low') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('.ai-student-name')).map(n => n.textContent!.trim())).toEqual(['Bina']);
  });

  it('hides itself for a teacher without a class-teacher assignment', () => {
    service.getMyClassInsights.and.returnValue(throwError(() => ({ status: 403 })));
    const el = render({ mode: 'teacher' });
    expect(el.querySelector('.ai-card')).toBeNull();
  });

  it('admin mode waits for a class, then loads that class and section', () => {
    service.getClassInsights.and.returnValue(of(classInsights({ sectionId: null, sectionName: null })));
    render({ mode: 'admin', classId: null });
    expect(service.getClassInsights).not.toHaveBeenCalled();

    fixture.componentInstance.classId = 10;
    fixture.componentInstance.sectionId = 3;
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    expect(service.getClassInsights).toHaveBeenCalledWith(10, 3);
  });

  it('shows an empty state for a class with no enrolled students', () => {
    service.getMyClassInsights.and.returnValue(of(classInsights({ totalStudents: 0, students: [], submittedRecords: 0, classPercentage: 0, belowThresholdCount: 0, consecutiveAbsenceCount: 0 })));
    const el = render({ mode: 'teacher' });
    expect(el.querySelector('.ai-empty-title')!.textContent).toContain('No students enrolled');
    expect(el.querySelector('.ai-tiles')).toBeNull();
  });
});
