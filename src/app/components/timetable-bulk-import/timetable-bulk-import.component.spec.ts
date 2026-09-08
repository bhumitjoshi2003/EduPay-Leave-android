import { of, throwError } from 'rxjs';
import { TimetableBulkImportComponent } from './timetable-bulk-import.component';
describe('F6A bulk import screen', () => {
  let c: TimetableBulkImportComponent;
  let api: any;
  beforeEach(() => {
    api = { bulkImport: jasmine.createSpy().and.returnValue(of({ academicSessionId: 2 })) };
    c = new TimetableBulkImportComponent(api, {} as any, { snapshot: { queryParamMap: { get: () => '2' } } } as any, { markForCheck: () => {} } as any);
    c.selectedFile = new File(['Class'], 'timetable.csv');
  });
  afterEach(() => c.ngOnDestroy());
  it('blocks missing or historical session', () => {
    c.import(); c.selectedSession = { id: 3, label: 'Past', startDate: '2000-01-01', endDate: '2001-01-01', current: false }; c.import(); expect(api.bulkImport).not.toHaveBeenCalled();
  });
  it('imports into the explicitly selected future session and retains report authority', () => {
    c.selectedSession = { id: 2, label: 'Future', startDate: '2998-01-01', endDate: '2999-01-01', current: false }; c.import();
    expect(api.bulkImport).toHaveBeenCalledWith(c.selectedFile, 2); expect(c.result?.academicSessionId).toBe(2);
  });
  it('surfaces backend validation errors', () => {
    c.selectedSession = { id: 2, label: 'Current', startDate: '2000-01-01', endDate: '2999-01-01', current: true };
    api.bulkImport.and.returnValue(throwError(() => ({ error: 'Session has ended and is read-only.' }))); c.import(); expect(c.importError).toContain('read-only');
  });
});
