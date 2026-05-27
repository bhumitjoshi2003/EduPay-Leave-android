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
  trialEndsAt: string | null;
  expiresAt: string | null;
  graceEndsAt: string | null;
  permissionKeys: string[];
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
    const keys = this.user?.featureKeys;
    if (!keys || keys.length === 0) return true;
    return keys.includes(featureKey);
  }

  /**
   * UX-only permission check — backend is always authoritative.
   * Returns true if the user's role has the given permission key,
   * or if no permission data is loaded (graceful fallback).
   */
  hasPermission(permissionKey: string): boolean {
    const keys = this.user?.permissionKeys;
    if (!keys || keys.length === 0) return true;
    return keys.includes(permissionKey);
  }

  getSubscriptionStatus(): string | null {
    return this.user?.subscriptionStatus ?? null;
  }

  /**
   * True if the subscription is GRACE, EXPIRED, or TRIAL ending within 7 days.
   * Used to show expiry warning banners in the dashboard nav.
   */
  isSubscriptionWarning(): boolean {
    const s = this.getSubscriptionStatus();
    if (s === 'GRACE' || s === 'EXPIRED') return true;
    if (s === 'TRIAL' && this.user?.trialEndsAt) {
      const msUntilExpiry = new Date(this.user.trialEndsAt).getTime() - Date.now();
      return msUntilExpiry <= 7 * 24 * 60 * 60 * 1000; // 7 days
    }
    return false;
  }
}
