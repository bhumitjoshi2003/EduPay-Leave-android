import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppUpdateService } from './app-update.service';
import { AndroidPlatformService } from './android-platform.service';
import { ToastService } from './toast.service';
import { LoggerService } from './logger.service';
import { environment } from '../../environments/environment';
import { AppUpdateInfo } from '../interfaces/app-update-info';

/** Lets every pending microtask (promise .then chains, RxJS operators) drain before we assert. */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

describe('AppUpdateService', () => {
  let service: AppUpdateService;
  let httpMock: HttpTestingController;
  let platform: jasmine.SpyObj<AndroidPlatformService>;
  let toast: jasmine.SpyObj<ToastService>;
  let logger: jasmine.SpyObj<LoggerService>;
  let openSpy: jasmine.Spy;

  const remote = (overrides: Partial<AppUpdateInfo> = {}): AppUpdateInfo => ({
    latestVersionName: '1.3.0',
    latestVersionCode: 2,
    minimumSupportedVersionCode: 1,
    updateMessage: 'A new version of Edunexify is available.',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.edunexify.app',
    ...overrides,
  });

  beforeEach(() => {
    platform = jasmine.createSpyObj('AndroidPlatformService', ['isNativePlatform', 'getAppUpdateInfo']);
    toast = jasmine.createSpyObj('ToastService', ['confirm']);
    logger = jasmine.createSpyObj('LoggerService', ['error']);
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AndroidPlatformService, useValue: platform },
        { provide: ToastService, useValue: toast },
        { provide: LoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(AppUpdateService);
    httpMock = TestBed.inject(HttpTestingController);
    openSpy = spyOn(window, 'open');
  });

  afterEach(() => httpMock.verify());

  function nativeWithCurrentVersion(versionCode: string): void {
    platform.isNativePlatform.and.returnValue(true);
    platform.getAppUpdateInfo.and.returnValue(Promise.resolve({
      currentVersionName: '1.2.0',
      currentVersionCode: versionCode,
      updateAvailability: 0 as any,
    }));
  }

  async function respondWith(release: AppUpdateInfo): Promise<void> {
    await flushMicrotasks();
    httpMock.expectOne(`${environment.apiUrl}/public/app-update`).flush(release);
    await flushMicrotasks();
  }

  it('does nothing at all on a non-native platform — no HTTP call, no prompt', async () => {
    platform.isNativePlatform.and.returnValue(false);

    service.checkOnStartup();
    await flushMicrotasks();

    httpMock.expectNone(`${environment.apiUrl}/public/app-update`);
    expect(platform.getAppUpdateInfo).not.toHaveBeenCalled();
    expect(toast.confirm).not.toHaveBeenCalled();
  });

  it('current version < latest shows the optional Update/Later prompt', async () => {
    nativeWithCurrentVersion('1');
    toast.confirm.and.resolveTo(false);

    service.checkOnStartup();
    await respondWith(remote());

    expect(toast.confirm).toHaveBeenCalledTimes(1);
    const data = toast.confirm.calls.mostRecent().args[0];
    expect(data.title).toBe('Update available');
    expect(data.confirmText).toBe('Update');
    expect(data.cancelText).toBe('Later');
  });

  it('current version == latest shows no prompt', async () => {
    nativeWithCurrentVersion('2');

    service.checkOnStartup();
    await respondWith(remote());

    expect(toast.confirm).not.toHaveBeenCalled();
  });

  it('current version > latest shows no prompt', async () => {
    nativeWithCurrentVersion('5');

    service.checkOnStartup();
    await respondWith(remote());

    expect(toast.confirm).not.toHaveBeenCalled();
  });

  it('choosing Later does not open the Play Store', async () => {
    nativeWithCurrentVersion('1');
    toast.confirm.and.resolveTo(false);

    service.checkOnStartup();
    await respondWith(remote());
    await flushMicrotasks();

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('choosing Update opens the configured Play Store URL', async () => {
    nativeWithCurrentVersion('1');
    toast.confirm.and.resolveTo(true);

    service.checkOnStartup();
    await respondWith(remote());
    await flushMicrotasks();

    expect(openSpy).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=in.edunexify.app', '_system');
  });

  it('a backend API failure never blocks the app and never shows a prompt', async () => {
    nativeWithCurrentVersion('1');

    service.checkOnStartup();
    await flushMicrotasks();
    httpMock.expectOne(`${environment.apiUrl}/public/app-update`).error(new ProgressEvent('network error'));
    await flushMicrotasks();

    expect(toast.confirm).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('a native-plugin failure never blocks the app and never calls the backend', async () => {
    platform.isNativePlatform.and.returnValue(true);
    platform.getAppUpdateInfo.and.returnValue(Promise.reject(new Error('plugin unavailable')));

    service.checkOnStartup();
    await flushMicrotasks();

    httpMock.expectNone(`${environment.apiUrl}/public/app-update`);
    expect(toast.confirm).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('checks only once per session even if called multiple times', async () => {
    nativeWithCurrentVersion('1');
    toast.confirm.and.resolveTo(false);

    service.checkOnStartup();
    service.checkOnStartup();
    service.checkOnStartup();
    await flushMicrotasks();
    httpMock.expectOne(`${environment.apiUrl}/public/app-update`).flush(remote());
    await flushMicrotasks();

    expect(platform.getAppUpdateInfo).toHaveBeenCalledTimes(1);
  });

  it('minimum-supported logic is safe by default — a higher latest version alone never triggers forced update', async () => {
    nativeWithCurrentVersion('1');
    toast.confirm.and.resolveTo(false);

    service.checkOnStartup();
    await respondWith(remote());

    // minimumSupportedVersionCode (1) <= current (1): the optional path fires, not forced.
    expect(toast.confirm.calls.mostRecent().args[0].title).toBe('Update available');
  });

  it('a deliberately raised minimum-supported version triggers the forced-update message', async () => {
    nativeWithCurrentVersion('1');
    toast.confirm.and.resolveTo(true);

    service.checkOnStartup();
    await respondWith(remote({ minimumSupportedVersionCode: 2, latestVersionCode: 2 }));

    const data = toast.confirm.calls.mostRecent().args[0];
    expect(data.title).toBe('Update required');
    expect(data.message).toContain('no longer supported');
  });
});
