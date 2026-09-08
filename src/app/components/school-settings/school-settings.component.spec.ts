import { of, throwError } from 'rxjs';
import { SchoolSettingsComponent } from './school-settings.component';
import { AcademicSession } from '../../interfaces/academic-session';
import { ActivationPreview, SessionActivationOutcome } from '../../interfaces/session-activation';

const current: AcademicSession = { id: 1, label: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', current: true };
const target: AcademicSession = { id: 2, label: '2027-2028', startDate: '2027-04-01', endDate: '2028-03-31', current: false };
const basePreview: ActivationPreview = {
  academicSessionId: 2, activationState: 'NEVER_APPLIED', lastAppliedAt: null, lastAppliedBy: null,
  inSync: true, hasIssues: false, unchanged: 0, ineligibleTeacher: 0, invalidClassOrSection: 0,
  configuredCount: 3, becomingLive: 3, changing: 0, clearing: 0, details: [],
};

describe('G2 Make Current activation parity', () => {
  let c: SchoolSettingsComponent;
  let academicSessionService: any;
  let toast: any;
  let logger: any;

  beforeEach(() => {
    academicSessionService = {
      getActivationPreview: jasmine.createSpy().and.returnValue(of(basePreview)),
      setCurrentSession: jasmine.createSpy().and.returnValue(of({ session: target, activationPerformed: true, activation: { applied: 3, cleared: 0 } } as SessionActivationOutcome)),
      getAllSessions: jasmine.createSpy().and.returnValue(of([current, target])),
    };
    toast = { confirm: jasmine.createSpy().and.resolveTo(true), success: jasmine.createSpy(), error: jasmine.createSpy() };
    logger = { error: jasmine.createSpy() };
    c = new SchoolSettingsComponent(
      {} as any, {} as any, {} as any, { markForCheck: () => {} } as any, logger, toast,
      { snapshot: { queryParamMap: { get: () => null } } } as any, {} as any, academicSessionService, {} as any
    );
    c.sessions = [current, target];
  });

  it('fetches the activation preview before any mutation, and it is read-only', async () => {
    academicSessionService.setCurrentSession.and.stub();
    toast.confirm.and.callFake(() => new Promise<boolean>(() => { /* never resolves — simulates dialog left open */ }));
    void c.setCurrentSession(target);
    await Promise.resolve(); await Promise.resolve();
    expect(academicSessionService.getActivationPreview).toHaveBeenCalledWith(2);
    expect(academicSessionService.setCurrentSession).not.toHaveBeenCalled();
  });

  it('shows the activation impact counts in the confirmation before calling set-current', async () => {
    await c.setCurrentSession(target);
    const html = toast.confirm.calls.mostRecent().args[0].html;
    expect(html).toContain('Becoming live 3');
    expect(html).toContain('Unchanged 0');
    expect(academicSessionService.setCurrentSession).toHaveBeenCalledWith(2);
  });

  it('warns when the target has zero usable configuration and would clear live assignments', async () => {
    academicSessionService.getActivationPreview.and.returnValue(of({ ...basePreview, configuredCount: 0, becomingLive: 0, clearing: 4 }));
    await c.setCurrentSession(target);
    const args = toast.confirm.calls.mostRecent().args[0];
    expect(args.danger).toBeTrue();
    expect(args.icon).toBe('warning');
    expect(args.html).toContain('no usable class-teacher');
    expect(args.html).toContain('(4)');
  });

  it('does not warn when zero-configured but nothing would be cleared', async () => {
    academicSessionService.getActivationPreview.and.returnValue(of({ ...basePreview, configuredCount: 0, becomingLive: 0, clearing: 0 }));
    await c.setCurrentSession(target);
    const args = toast.confirm.calls.mostRecent().args[0];
    expect(args.danger).toBeFalsy();
    expect(args.icon).toBe('question');
  });

  it('performs no set-current call when the admin cancels the confirmation', async () => {
    toast.confirm.and.resolveTo(false);
    await c.setCurrentSession(target);
    expect(academicSessionService.setCurrentSession).not.toHaveBeenCalled();
  });

  it('calls set-current exactly once when confirmed', async () => {
    await c.setCurrentSession(target);
    expect(academicSessionService.setCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('surfaces the applied/cleared counts from a real activation outcome', async () => {
    await c.setCurrentSession(target);
    expect(toast.success).toHaveBeenCalledWith('Updated', jasmine.stringMatching(/3 granted, 0 cleared/));
  });

  it('reports a genuine no-op distinctly when the target was already current', async () => {
    academicSessionService.setCurrentSession.and.returnValue(of({ session: current, activationPerformed: false, activation: null } as SessionActivationOutcome));
    await c.setCurrentSession(current);
    expect(toast.success).toHaveBeenCalledWith('Updated', jasmine.stringMatching(/already the current session/));
  });

  it('fails closed with no confirmation dialog when the preview fetch errors', async () => {
    academicSessionService.getActivationPreview.and.returnValue(throwError(() => new Error('network')));
    await c.setCurrentSession(target);
    expect(toast.confirm).not.toHaveBeenCalled();
    expect(academicSessionService.setCurrentSession).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});
