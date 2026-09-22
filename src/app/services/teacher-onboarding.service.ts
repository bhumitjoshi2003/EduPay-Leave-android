import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import { PushNotificationService } from './push-notification.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export type TeacherOnboardingVisit = 'profileVisited' | 'todaysClassesVisited' | 'attendanceVisited' | 'leaveVisited';
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface TeacherOnboardingState {
  profileVisited: boolean;
  todaysClassesVisited: boolean;
  attendanceVisited: boolean;
  leaveVisited: boolean;
  minimized: boolean;
  completedAt: string | null;
}

export interface TeacherPermissionState {
  location: PermissionState;
  notifications: PermissionState;
}

const DEFAULT_STATE: TeacherOnboardingState = {
  profileVisited: false,
  todaysClassesVisited: false,
  attendanceVisited: false,
  leaveVisited: false,
  minimized: false,
  completedAt: null,
};

@Injectable({ providedIn: 'root' })
export class TeacherOnboardingService {
  private completionSynced = new Set<string>();
  constructor(private push: PushNotificationService, private http?: HttpClient) {}

  private key(userId: string): string {
    return `edunexify.teacher-onboarding.v1.${userId}`;
  }

  async load(userId: string): Promise<TeacherOnboardingState> {
    try {
      const value = await this.read(this.key(userId));
      return value ? { ...DEFAULT_STATE, ...JSON.parse(value) } : { ...DEFAULT_STATE };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async save(userId: string, state: TeacherOnboardingState): Promise<void> {
    try {
      await this.write(this.key(userId), JSON.stringify(state));
      if (state.completedAt && !this.completionSynced.has(userId) && this.http) {
        this.completionSynced.add(userId);
        firstValueFrom(this.http.post<void>(`${environment.apiUrl}/me/adoption/onboarding-completed`, {}, { withCredentials: true }))
          .catch(() => { this.completionSynced.delete(userId); });
      }
    } catch {
      // Onboarding is optional and must never interrupt the dashboard.
    }
  }

  async markVisited(userId: string, state: TeacherOnboardingState, field: TeacherOnboardingVisit): Promise<TeacherOnboardingState> {
    const next = { ...state, [field]: true };
    await this.save(userId, next);
    return next;
  }

  async permissions(): Promise<TeacherPermissionState> {
    if (!Capacitor.isNativePlatform()) return { location: 'unavailable', notifications: 'unavailable' };
    const [location, notifications] = await Promise.all([
      this.locationPermission(),
      this.push.permissionState(),
    ]);
    return { location, notifications };
  }

  async requestLocation(): Promise<PermissionState> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const permission = await Geolocation.requestPermissions({ permissions: ['location'] });
      return this.normalize(permission.location);
    } catch {
      return 'unavailable';
    }
  }

  async enableNotifications(): Promise<PermissionState> {
    return (await this.push.requestPermissionAndRegister()) ? 'granted' : this.push.permissionState();
  }

  private async locationPermission(): Promise<PermissionState> {
    try {
      const permission = await Geolocation.checkPermissions();
      return this.normalize(permission.location);
    } catch {
      return 'unavailable';
    }
  }

  private normalize(state: string): PermissionState {
    return state === 'prompt-with-rationale' ? 'prompt' : state as PermissionState;
  }

  private async read(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  }

  private async write(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }
}
