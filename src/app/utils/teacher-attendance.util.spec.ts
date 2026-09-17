import {
  formatTeacherAttendanceTime,
  localDateKey,
  teacherAttendanceErrorMessage,
} from './teacher-attendance.util';

describe('teacher attendance utilities', () => {
  it('prefers a JSON API message', () => {
    expect(teacherAttendanceErrorMessage(
      { error: { message: 'School location is not configured.' } },
      'Fallback'
    )).toBe('School location is not configured.');
  });

  it('keeps a meaningful plain-string API error', () => {
    expect(teacherAttendanceErrorMessage(
      { error: 'You have already checked in today.' },
      'Fallback'
    )).toBe('You have already checked in today.');
  });

  it('rejects technical and HTML responses in favour of a safe fallback', () => {
    expect(teacherAttendanceErrorMessage(
      { error: { message: 'java.lang.IllegalStateException: failed' } },
      'Check-in failed. Please try again.'
    )).toBe('Check-in failed. Please try again.');
    expect(teacherAttendanceErrorMessage(
      { error: '<html>Bad gateway</html>' },
      'Check-in failed. Please try again.'
    )).toBe('Check-in failed. Please try again.');
  });

  it('builds a local calendar key without UTC conversion', () => {
    const nearLocalMidnight = new Date(2026, 8, 17, 0, 15, 0);
    expect(localDateKey(nearLocalMidnight)).toBe('2026-09-17');
  });

  it('formats time-only and date-time values consistently', () => {
    expect(formatTeacherAttendanceTime('08:05:00')).toBe('8:05 AM');
    expect(formatTeacherAttendanceTime('2026-09-17T13:07:00')).toBe('1:07 PM');
  });
});
