import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateInfo as NativeAppUpdateInfo } from '@capawesome/capacitor-app-update';

/**
 * Thin wrapper around Capacitor's native plugin calls — exists purely so consumers (like
 * AppUpdateService) can be unit-tested via normal Angular DI substitution instead of spying on
 * a third-party plugin's module-level export, which does not reliably intercept the bundled
 * reference in tests.
 */
@Injectable({ providedIn: 'root' })
export class AndroidPlatformService {
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  getAppUpdateInfo(): Promise<NativeAppUpdateInfo> {
    return AppUpdate.getAppUpdateInfo();
  }
}
