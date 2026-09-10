import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { passwordChangeGuard } from './password-change.guard';
import { AuthStateService } from './auth-state.service';
import { environment } from '../../environments/environment';

describe('passwordChangeGuard', () => {
  let authState: jasmine.SpyObj<AuthStateService>;
  let router: Router;

  beforeEach(() => {
    authState = jasmine.createSpyObj('AuthStateService', ['isLoggedIn', 'isChecking', 'mustChangePassword']);
    authState.isChecking.and.returnValue(false);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [{ provide: AuthStateService, useValue: authState }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  function run() {
    return TestBed.runInInjectionContext(() => passwordChangeGuard({} as any, {} as any));
  }

  it('redirects a confirmed-logged-out visitor to /home', () => {
    authState.isLoggedIn.and.returnValue(false);

    expect(run()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  });

  it('redirects a normal (non-restricted) user to /dashboard', () => {
    authState.isLoggedIn.and.returnValue(true);
    authState.mustChangePassword.and.returnValue(false);

    expect(run()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('allows a restricted (mustChangePassword) user through', () => {
    authState.isLoggedIn.and.returnValue(true);
    authState.mustChangePassword.and.returnValue(true);

    expect(run()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

/**
 * CHECKING must not let an unresolved identity skip the password-change gate, and must not be
 * treated as a confirmed rejection either. Real AuthStateService, same pattern as the other two
 * guards' CHECKING coverage.
 */
describe('passwordChangeGuard — CHECKING resolution', () => {
  let authState: AuthStateService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule, RouterTestingModule] });
    authState = TestBed.inject(AuthStateService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  afterEach(() => http.verify());

  it('a CHECKING user who resolves to AUTHENTICATED + mustChangePassword is let through', fakeAsync(() => {
    let result: boolean | undefined;
    (TestBed.runInInjectionContext(() => passwordChangeGuard({} as any, {} as any)) as Promise<boolean>)
      .then(r => (result = r));

    flushMicrotasks();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({
      userId: 'T1', role: 'TEACHER', name: null, className: null, schoolSlug: null,
      featureKeys: null, planTier: null, planVersion: null, subscriptionStatus: null,
      trialEndsAt: null, expiresAt: null, graceEndsAt: null, permissionKeys: null,
      mustChangePassword: true,
    } as any);
    flushMicrotasks();

    expect(result).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  }));

  it('a CHECKING user who resolves to AUTHENTICATED but does NOT need a password change is redirected to /dashboard', fakeAsync(() => {
    let result: boolean | undefined;
    (TestBed.runInInjectionContext(() => passwordChangeGuard({} as any, {} as any)) as Promise<boolean>)
      .then(r => (result = r));

    flushMicrotasks();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush({
      userId: 'T1', role: 'TEACHER', name: null, className: null, schoolSlug: null,
      featureKeys: null, planTier: null, planVersion: null, subscriptionStatus: null,
      trialEndsAt: null, expiresAt: null, graceEndsAt: null, permissionKeys: null,
    } as any);
    flushMicrotasks();

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  }));

  it('a CHECKING user who resolves to an authoritative 401 is redirected to /home', fakeAsync(() => {
    let result: boolean | undefined;
    (TestBed.runInInjectionContext(() => passwordChangeGuard({} as any, {} as any)) as Promise<boolean>)
      .then(r => (result = r));

    flushMicrotasks();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush('nope', { status: 401, statusText: 'Unauthorized' });
    flushMicrotasks();

    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
  }));
});
