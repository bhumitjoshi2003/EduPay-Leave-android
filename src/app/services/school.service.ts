import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SchoolSettings {
  id: number;
  name: string;
  shortName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phoneNumber: string;
  email: string;
  website: string;
  boardType: string;
  plan: string;
  active: boolean;
  razorpayConfigured: boolean;
}

@Injectable({ providedIn: 'root' })
export class SchoolService {
  private baseUrl = `${environment.apiUrl}/school`;
  private superAdminUrl = `${environment.apiUrl}/super-admin`;

  // Cache the class list so multiple components don't fire duplicate requests
  private classes$: Observable<string[]> | null = null;

  constructor(private http: HttpClient) {}

  getClasses(): Observable<string[]> {
    if (!this.classes$) {
      this.classes$ = this.http.get<string[]>(`${this.baseUrl}/classes`).pipe(shareReplay(1));
    }
    return this.classes$;
  }

  /** Call this when class list may have changed (e.g. after onboarding a student). */
  invalidateClasses(): void {
    this.classes$ = null;
  }

  getSettings(): Observable<SchoolSettings> {
    return this.http.get<SchoolSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(data: Partial<SchoolSettings>): Observable<SchoolSettings> {
    return this.http.put<SchoolSettings>(`${this.baseUrl}/settings`, data);
  }

  updateRazorpayKeys(keyId: string, keySecret: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/razorpay`, { keyId, keySecret });
  }

  // ── SUPER_ADMIN ──────────────────────────────────────────────────────────

  getDashboard(): Observable<any> {
    return this.http.get<any>(`${this.superAdminUrl}/dashboard`);
  }

  listAllSchools(): Observable<SchoolSettings[]> {
    return this.http.get<SchoolSettings[]>(`${this.superAdminUrl}/schools`);
  }

  onboardSchool(data: any): Observable<SchoolSettings> {
    return this.http.post<SchoolSettings>(`${this.superAdminUrl}/schools`, data);
  }

  updateSubscription(schoolId: number, data: any): Observable<SchoolSettings> {
    return this.http.patch<SchoolSettings>(`${this.superAdminUrl}/schools/${schoolId}/subscription`, data);
  }
}
