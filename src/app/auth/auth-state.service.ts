import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserInfo {
  userId: string;
  role: string;
  name: string | null;
  className: string | null;
  schoolSlug: string | null;
  // Entitlement fields — null for SUPER_ADMIN or schools with no subscription
  featureKeys: string[];
  planTier: string | null;
  planVersion: string | null;
  subscriptionStatus: string | null;
  expiresAt: string | null;
  graceEndsAt: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private user: UserInfo | null = null;
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  async loadCurrentUser(): Promise<void> {
    try {
      const userInfo = await firstValueFrom(
        this.http.get<UserInfo>(`${this.apiUrl}/me`, { withCredentials: true })
      );
      this.user = userInfo;
    } catch (err) {
      // Expected on app start when no valid session exists (e.g. first visit, expired token)
      console.warn('[AuthStateService] Could not load current user — treating as logged out:', err);
      this.user = null;
    }
  }

  setUser(userInfo: UserInfo): void {
    this.user = userInfo;
  }

  getUser(): UserInfo | null {
    return this.user;
  }

  clearUser(): void {
    this.user = null;
  }

  getUserRole(): string {
    return this.user?.role ?? '';
  }

  getUserId(): string {
    return this.user?.userId ?? '';
  }

  isLoggedIn(): boolean {
    return this.user !== null;
  }

  /** UX-only feature check — backend is always authoritative. */
  hasFeature(featureKey: string): boolean {
    return this.user?.featureKeys?.includes(featureKey) ?? false;
  }

  getSubscriptionStatus(): string | null {
    return this.user?.subscriptionStatus ?? null;
  }

  isSubscriptionWarning(): boolean {
    const s = this.getSubscriptionStatus();
    return s === 'GRACE' || s === 'EXPIRED';
  }
}
