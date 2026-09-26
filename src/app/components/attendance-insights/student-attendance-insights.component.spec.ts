import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StudentAttendanceInsightsComponent } from './student-attendance-insights.component';
import { AttendanceService } from '../../services/attendance.service';
import { StudentAttendanceInsights } from '../../interfaces/attendance-insights';

describe('StudentAttendanceInsightsComponent', () => {
  let fixture: ComponentFixture<StudentAttendanceInsightsComponent>;
  let service: jasmine.SpyObj<AttendanceService>;

  const insights = (overrides: Partial<StudentAttendanceInsights> = {}): StudentAttendanceInsights => ({
    studentId: 'S1', studentName: 'Aarav', className: '8', sessionLabel: '2026-2027', from: '2026-04-01', to: '2026-09-25',
    submittedDays: 20, present: 18, absent: 2, approvedLeave: 1, percentage: 90, lowAttendanceThreshold: 75,
    lowAttendance: false, currentAbsenceStreak: 0,
    monthlyTrend: [
      { year: 2026, month: 8, label: 'Aug 2026', submittedDays: 1, present: 1, absent: 0, approvedLeave: 0, percentage: 100 },
      { year: 2026, month: 9, label: 'Sep 2026', submittedDays: 19, present: 17, absent: 2, approvedLeave: 1, percentage: 89.5 },
    ],
    recent: [
      { date: '2026-09-25', status: 'PRESENT', approvedLeave: false },
      { date: '2026-09-15', status: 'ABSENT', approvedLeave: true },
    ],
    ...overrides,
  });

  function render(inputs: Partial<StudentAttendanceInsightsComponent> = {}): HTMLElement {
    fixture = TestBed.createComponent(StudentAttendanceInsightsComponent);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('AttendanceService', ['getMyInsights', 'getStudentInsights']);
    TestBed.configureTestingModule({
      imports: [StudentAttendanceInsightsComponent],
      providers: [{ provide: AttendanceService, useValue: service }],
    });
  });

  it('renders the headline figures, trend and recent days for a healthy student', () => {
    service.getMyInsights.and.returnValue(of(insights()));
    const el = render();

    expect(service.getMyInsights).toHaveBeenCalled();
    expect(el.querySelector('.ai-ring-num')!.textContent).toContain('90%');
    const stats = Array.from(el.querySelectorAll('.ai-stat')).map(s => Array.from(s.children).map(c => c.textContent!.trim()).join(' '));
    expect(stats).toEqual(['18 Present', '2 Absent', '1 Approved leave', '20 Recorded days']);
    expect(el.querySelector('.ai-status')!.textContent).toContain('Healthy');
    expect(el.querySelector('.ai-banner-low')).toBeNull();
    expect(el.querySelectorAll('.ai-bar-row').length).toBe(2);
    expect(el.querySelectorAll('.ai-recent-row').length).toBe(2);
    expect(el.querySelector('.ai-leave-tag')!.textContent).toContain('Approved leave');
  });

  it('warns below 75% and shows the absence streak', () => {
    service.getMyInsights.and.returnValue(of(insights({ submittedDays: 4, present: 1, absent: 3, approvedLeave: 0, percentage: 25, lowAttendance: true, currentAbsenceStreak: 3 })));
    const el = render();

    expect(el.querySelector('.ai-status')!.textContent).toContain('Low attendance');
    expect(el.querySelector('.ai-banner-low')!.textContent).toContain('below 75%');
    // (1 + 8) / (4 + 8) = 75% -> 8 more present days
    expect(el.querySelector('.ai-banner-low')!.textContent).toContain('8 more present days');
    expect(el.querySelector('.ai-banner-streak')!.textContent).toContain('last 3 recorded days');
  });

  it('shows an empty state when nothing has been recorded', () => {
    service.getMyInsights.and.returnValue(of(insights({ submittedDays: 0, present: 0, absent: 0, approvedLeave: 0, percentage: 0, monthlyTrend: [], recent: [] })));
    const el = render();

    expect(el.querySelector('.ai-empty-title')!.textContent).toContain('No attendance recorded yet');
    expect(el.querySelector('.ai-ring')).toBeNull();
    expect(el.querySelector('.ai-status')!.textContent).toContain('No records yet');
  });

  it('a parent view waits for a child and then loads that child', () => {
    service.getStudentInsights.and.returnValue(of(insights()));
    const el = render({ requireStudentId: true, studentId: null });
    expect(service.getStudentInsights).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Select a child');

    fixture.componentInstance.studentId = 'S1';
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
    expect(service.getStudentInsights).toHaveBeenCalledWith('S1');
    expect(service.getMyInsights).not.toHaveBeenCalled();
  });

  it('shows the server error', () => {
    service.getMyInsights.and.returnValue(throwError(() => ({ status: 500, error: { message: 'Boom' } })));
    expect(render().querySelector('.ai-error')!.textContent).toContain('Boom');
  });
});
