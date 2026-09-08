import { of } from 'rxjs';
import { AcademicSessionSelectorComponent, sessionKind } from './academic-session-selector.component';
describe('F6A academic-session selection', () => {
  const current = { id: 7, label: 'Current', startDate: '2020-01-01', endDate: '2999-01-01', current: true };
  it('matches the backend UTC historical boundary', () => {
    const session = { ...current, current: false, endDate: '2026-09-07' };
    expect(sessionKind(session, new Date('2026-09-08T01:00:00+05:30'))).not.toBe('HISTORICAL');
    expect(sessionKind(session, new Date('2026-09-08T00:00:00Z'))).toBe('HISTORICAL');
  });
  it('defaults to an authoritative current object', () => {
    const c = new AcademicSessionSelectorComponent({ getAllSessions: () => of([current]) } as any);
    const emit = spyOn(c.selected, 'emit'); c.ngOnInit(); expect(emit).toHaveBeenCalledWith(current); c.ngOnDestroy();
  });
  it('does not silently replace an invalid explicitly requested session with current', () => {
    const c = new AcademicSessionSelectorComponent({ getAllSessions: () => of([current]) } as any);
    c.initialId = 99; const emit = spyOn(c.selected, 'emit'); c.ngOnInit(); expect(emit).toHaveBeenCalledWith(null); c.ngOnDestroy();
  });
  it('does not invent a current session when none exists', () => {
    const c = new AcademicSessionSelectorComponent({ getAllSessions: () => of([]) } as any);
    const emit = spyOn(c.selected, 'emit'); c.ngOnInit(); expect(emit).toHaveBeenCalledWith(null); c.ngOnDestroy();
  });
});
