import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthStateService, UserInfo } from './auth-state.service';
import { environment } from '../../environments/environment';

describe('AuthStateService — mustChangePassword', () => {
  let service: AuthStateService;

  const baseUser: UserInfo = {
    userId: 'S1',
    role: 'STUDENT',
    name: 'Test Student',
    className: '10',
    schoolSlug: 'demo',
    featureKeys: null,
    planTier: null,
    planVersion: null,
    subscriptionStatus: null,
    trialEndsAt: null,
    expiresAt: null,
    graceEndsAt: null,
    permissionKeys: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AuthStateService);
  });

  it('returns false when no user is loaded', () => {
    expect(service.mustChangePassword()).toBeFalse();
  });

  it('returns false for a normal session (flag absent)', () => {
    service.setUser({ ...baseUser });
    expect(service.mustChangePassword()).toBeFalse();
  });

  it('returns false when the backend explicitly sends false', () => {
    service.setUser({ ...baseUser, mustChangePassword: false });
    expect(service.mustChangePassword()).toBeFalse();
  });

  it('returns true for a restricted first-login session', () => {
    service.setUser({ ...baseUser, mustChangePassword: true });
    expect(service.mustChangePassword()).toBeTrue();
  });

  it('returns false again after clearUser()', () => {
    service.setUser({ ...baseUser, mustChangePassword: true });
    service.clearUser();
    expect(service.mustChangePassword()).toBeFalse();
  });

  it('grants only explicitly entitled paid features', () => {
    service.setUser({ ...baseUser, featureKeys: ['FEE_MANAGEMENT', 'EXAM_MARKS'] });

    expect(service.hasFeature('FEE_MANAGEMENT')).toBeTrue();
    expect(service.hasFeature('AI_COPILOT')).toBeFalse();
  });

  it('denies paid features when no effective entitlement is available', () => {
    service.setUser({ ...baseUser, featureKeys: [] });
    expect(service.hasFeature('AI_COPILOT')).toBeFalse();

    service.setUser({ ...baseUser, featureKeys: null });
    expect(service.hasFeature('AI_COPILOT')).toBeFalse();
  });
});

/**
 * Bootstrap / tri-state auth status. loadCurrentUser()'s HTTP call is exercised directly via
 * HttpTestingController here (no AuthInterceptor registered) — this is deliberately testing
 * AuthStateService's OWN classification/state-transition logic in isolation; the "expired
 * access token → interceptor silently refreshes → retried /auth/me succeeds" round trip is
 * exercised end-to-end in auth.interceptor.spec.ts. From loadCurrentUser()'s point of view,
 * that whole dance is indistinguishable from any other successful /auth/me response.
 */
describe('AuthStateService — bootstrap tri-state (CHECKING / AUTHENTICATED / UNAUTHENTICATED)', () => {
  let service: AuthStateService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/auth/me`;

  const userInfo: UserInfo = {
    userId: 'T1', role: 'TEACHER', name: 'Teacher One', className: null, schoolSlug: 'demo',
    featureKeys: null, planTier: null, planVersion: null, subscriptionStatus: null,
    trialEndsAt: null, expiresAt: null, graceEndsAt: null, permissionKeys: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AuthStateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts CHECKING before any check has run', () => {
    expect(service.getStatus()).toBe('CHECKING');
    expect(service.isChecking()).toBeTrue();
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('1. a valid session (successful /auth/me) becomes AUTHENTICATED', async () => {
    const p = service.loadCurrentUser();
    http.expectOne(base).flush(userInfo);
    await p;

    expect(service.getStatus()).toBe('AUTHENTICATED');
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.getUser()?.userId).toBe('T1');
  });

  it('2. a request that eventually succeeds (as it would after a silent interceptor refresh) becomes AUTHENTICATED', async () => {
    // From loadCurrentUser()'s perspective this is identical to case 1 — the interceptor's
    // retry-after-refresh is transparent to it. Confirms bootstrap doesn't add its own
    // extra distinction that could get in the way of that transparency.
    const p = service.loadCurrentUser();
    http.expectOne(base).flush(userInfo);
    await p;
    expect(service.getStatus()).toBe('AUTHENTICATED');
  });

  it('3. a definitive 401 becomes UNAUTHENTICATED', async () => {
    const p = service.loadCurrentUser();
    http.expectOne(base).flush('nope', { status: 401, statusText: 'Unauthorized' });
    await p;

    expect(service.getStatus()).toBe('UNAUTHENTICATED');
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('4. a definitive 403 becomes UNAUTHENTICATED', async () => {
    const p = service.loadCurrentUser();
    http.expectOne(base).flush('nope', { status: 403, statusText: 'Forbidden' });
    await p;

    expect(service.getStatus()).toBe('UNAUTHENTICATED');
  });

  it('5. a network failure (status 0) does NOT force UNAUTHENTICATED — stays CHECKING', async () => {
    const p = service.loadCurrentUser();
    http.expectOne(base).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await p;

    expect(service.getStatus()).toBe('CHECKING');
    expect(service.isUnauthenticated()).toBeFalse();
  });

  it('6. a 503 during the check does NOT force UNAUTHENTICATED', async () => {
    const p = service.loadCurrentUser();
    http.expectOne(base).flush('unavailable', { status: 503, statusText: 'Service Unavailable' });
    await p;

    expect(service.getStatus()).toBe('CHECKING');
  });

  it('a transient failure never demotes an already-AUTHENTICATED session', async () => {
    let p = service.loadCurrentUser();
    http.expectOne(base).flush(userInfo);
    await p;
    expect(service.getStatus()).toBe('AUTHENTICATED');

    // A later re-check (e.g. tab-resume) hits a transient failure this time.
    p = service.loadCurrentUser();
    http.expectOne(base).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await p;

    expect(service.getStatus()).toBe('AUTHENTICATED');
    expect(service.getUser()?.userId).toBe('T1');
  });

  it('7. bootstrap (the returned promise) resolves even when the network is unavailable — never hangs', async () => {
    const p = service.loadCurrentUser();
    http.expectOne(base).error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await expectAsync(p).toBeResolved();
  });
});
