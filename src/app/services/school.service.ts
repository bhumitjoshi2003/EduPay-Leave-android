import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SchoolClass {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  streamEligible: boolean;
}

export interface SchoolSettings {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  themeColor: string;
  contactPersonName: string;
  boardType: string;
  plan: string;
  maxStudents: number;
  expiryDate: string;
  active: boolean;
  razorpayConfigured: boolean;
  adminUserId?: string;
  createdAt?: string;
  onboardedBy?: string;
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
      this.classes$ = this.http.get<string[]>(`${this.baseUrl}/classes`).pipe(
        catchError(err => {
          // Reset so the next subscriber triggers a fresh HTTP request instead of
          // replaying the cached error (shareReplay(1) would otherwise replay it forever)
          this.classes$ = null;
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    }
    return this.classes$;
  }

  /** Call this when class list may have changed (e.g. after adding/deleting a class). */
  invalidateClasses(): void {
    this.classes$ = null;
  }

  // ── Class management (ADMIN only) ────────────────────────────────────────

  getManagedClasses(): Observable<SchoolClass[]> {
    return this.http.get<SchoolClass[]>(`${this.baseUrl}/classes/manage`);
  }

  addClass(name: string): Observable<SchoolClass> {
    return this.http.post<SchoolClass>(`${this.baseUrl}/classes`, { name });
  }

  deleteClass(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/classes/${id}`);
  }

  reorderClasses(orderedIds: number[]): Observable<any> {
    return this.http.patch(`${this.baseUrl}/classes/reorder`, orderedIds);
  }

  toggleStreamEligible(id: number, eligible: boolean): Observable<SchoolClass> {
    return this.http.patch<SchoolClass>(`${this.baseUrl}/classes/${id}/stream-eligible`, { eligible });
  }

  getSettings(): Observable<SchoolSettings> {
    return this.http.get<SchoolSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(data: Partial<SchoolSettings>): Observable<SchoolSettings> {
    return this.http.put<SchoolSettings>(`${this.baseUrl}/settings`, data);
  }

  uploadLogo(file: File): Observable<{ logoUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ logoUrl: string }>(`${this.baseUrl}/logo`, form);
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

  updateSubscription(schoolId: number, data: { plan?: string; maxStudents?: number; expiryDate?: string; active?: boolean }): Observable<SchoolSettings> {
    let params = new HttpParams();
    if (data.plan !== undefined) params = params.set('plan', data.plan);
    if (data.maxStudents !== undefined) params = params.set('maxStudents', String(data.maxStudents));
    if (data.expiryDate !== undefined) params = params.set('expiryDate', data.expiryDate);
    if (data.active !== undefined) params = params.set('active', String(data.active));
    return this.http.patch<SchoolSettings>(`${this.superAdminUrl}/schools/${schoolId}/subscription`, null, { params });
  }

  updateSchoolAll(schoolId: number, data: Partial<SchoolSettings> & { newAdminPassword?: string }): Observable<SchoolSettings> {
    return this.http.put<SchoolSettings>(`${this.superAdminUrl}/schools/${schoolId}`, data);
  }

  resetAdminPassword(schoolId: number, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.superAdminUrl}/schools/${schoolId}/admin-password`, { newPassword });
  }

  deleteSchool(schoolId: number): Observable<void> {
    return this.http.delete<void>(`${this.superAdminUrl}/schools/${schoolId}`);
  }
}
