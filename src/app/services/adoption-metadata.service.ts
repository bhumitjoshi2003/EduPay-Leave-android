import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, EMPTY, from, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthStateService } from '../auth/auth-state.service';
import { AndroidPlatformService } from './android-platform.service';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class AdoptionMetadataService {
  private reported = false;
  constructor(private http: HttpClient, private auth: AuthStateService, private platform: AndroidPlatformService, private logger: LoggerService) {}
  reportAndroidVersionOnce(): void {
    if (this.reported || !this.platform.isNativePlatform() || this.auth.getUser()?.role !== 'TEACHER') return;
    this.reported = true;
    from(this.platform.getAppUpdateInfo()).pipe(
      switchMap(info => this.http.post<void>(`${environment.apiUrl}/me/adoption/android-version`, {
        appVersionName: info.currentVersionName,
        appVersionCode: Number(info.currentVersionCode),
      }, { withCredentials: true })),
      catchError(error => { this.logger.error('App version reporting failed', error); return EMPTY; }),
    ).subscribe();
  }
}
