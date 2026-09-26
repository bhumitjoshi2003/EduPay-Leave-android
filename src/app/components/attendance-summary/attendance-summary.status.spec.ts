import { AttendanceSummaryComponent } from './attendance-summary.component';
import { attendanceHealth, LOW_ATTENDANCE_THRESHOLD } from '../../interfaces/attendance-insights';

/** The Detailed Attendance Report uses the same 75% rule and wording as the Session attendance overview. */
describe('AttendanceSummaryComponent status (75% rule)', () => {
  const component = new (AttendanceSummaryComponent as any)() as AttendanceSummaryComponent;

  it('uses one 75% threshold', () => {
    expect(LOW_ATTENDANCE_THRESHOLD).toBe(75);
    expect(attendanceHealth(75, 20)).toBe('healthy');
    expect(attendanceHealth(74.9, 20)).toBe('low');
    expect(attendanceHealth(0, 0)).toBe('none');
  });

  it('labels Healthy at or above 75%', () => {
    expect(component.getAttendanceLabel(77.8, 9)).toBe('Healthy');   // was "Low" under the old 80% rule
    expect(component.getAttendanceLabel(75, 20)).toBe('Healthy');
    expect(component.getAttendanceClass(77.8, 9)).toBe('status-green');
  });

  it('labels Low Attendance below 75% (no separate Critical band)', () => {
    expect(component.getAttendanceLabel(74.9, 20)).toBe('Low Attendance');
    expect(component.getAttendanceLabel(40, 20)).toBe('Low Attendance');
    expect(component.getAttendanceClass(40, 20)).toBe('status-red');
  });

  it('labels No Records when nothing was recorded', () => {
    expect(component.getAttendanceLabel(0, 0)).toBe('No Records');
    expect(component.getAttendanceClass(0, 0)).toBe('status-none');
  });
});
