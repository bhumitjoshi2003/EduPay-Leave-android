import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, from, of, switchMap, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { ToastService } from './toast.service';
import { LoggerService } from './logger.service';
import { AndroidPlatformService } from './android-platform.service';
import { AppUpdateInfo } from '../interfaces/app-update-info';

/**
 * Backend-driven update awareness — separate from the existing native Play-Store-query banner
 * in dashboard.component.ts (which only fires when Play Store itself reports an update, and
 * cannot express "no longer supported"). This uses our own config so update messaging works
 * consistently regardless of Play Store's own signal, and can later support a real minimum-
 * supported-version cutoff. Uses versionCode (integer) for every comparison, never versionName
 * strings — see AppUpdateService's Javadoc-equivalent on the backend (AppUpdateConfig).
 *
 * Never blocks app usage on failure: any HTTP or native-plugin error is caught and swallowed.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private checkedThisSession = false;

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private logger: LoggerService,
    private platform: AndroidPlatformService,
  ) {}

  /** Call once per app session (see AppComponent.ngOnInit). No-op on web / repeated calls. */
  checkOnStartup(): void {
    if (this.checkedThisSession) return;
    this.checkedThisSession = true;
    if (!this.platform.isNativePlatform()) return;

    from(this.platform.getAppUpdateInfo()).pipe(
      catchError(err => {
        this.logger.error('AppUpdateService: failed to read the installed app version', err);
        return of(null);
      }),
      switchMap(current => {
        if (!current) return of(null);
        const currentVersionCode = parseInt(current.currentVersionCode, 10);
        if (Number.isNaN(currentVersionCode)) return of(null);
        return this.http.get<AppUpdateInfo>(`${environment.apiUrl}/public/app-update`).pipe(
          map(remote => ({ currentVersionCode, remote })),
          catchError(err => {
            this.logger.error('AppUpdateService: failed to fetch update config', err);
            return of(null);
          }),
        );
      }),
    ).subscribe(result => {
      if (result) this.evaluate(result.currentVersionCode, result.remote);
    });
  }

  private evaluate(currentVersionCode: number, remote: AppUpdateInfo): void {
    if (currentVersionCode < remote.minimumSupportedVersionCode) {
      this.promptForcedUpdate(remote);
    } else if (currentVersionCode < remote.latestVersionCode) {
      this.promptOptionalUpdate(remote);
    }
  }

  private promptOptionalUpdate(remote: AppUpdateInfo): void {
    this.toast.confirm({
      title: 'Update available',
      message: remote.updateMessage || `Edunexify ${remote.latestVersionName} is available.`,
      confirmText: 'Update',
      cancelText: 'Later',
      icon: 'info',
    }).then(confirmed => {
      if (confirmed) this.openStore(remote.playStoreUrl);
    });
  }

  /**
   * Detection/messaging only — NOT a real enforcement mechanism yet. ConfirmDialogComponent
   * always closes on Escape regardless of `disableClose`, so this can currently be dismissed.
   * A genuinely unbypassable dialog is future work for whenever forced-update is actually
   * activated (minimumSupportedVersionCode defaults to the current shipped version, so this
   * path never fires today).
   */
  private promptForcedUpdate(remote: AppUpdateInfo): void {
    this.toast.confirm({
      title: 'Update required',
      message: 'This version is no longer supported. Please update Edunexify to continue.',
      confirmText: 'Update',
      icon: 'warning',
      danger: true,
    }).then(() => this.openStore(remote.playStoreUrl));
  }

  private openStore(url: string): void {
    window.open(url, '_system');
  }
}
