import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SchoolClass {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
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

  updateSubscription(schoolId: number, data: { plan?: string; maxStudents?: number; expiryDate?: string; active?: boolean }): Observable<SchoolSettings> {
    let params = new HttpParams();
    if (data.plan !== undefined) params = params.set('plan', data.plan);
    if (data.maxStudents !== undefined) params = params.set('maxStudents', String(data.maxStudents));
    if (data.expiryDate !== undefined) params = params.set('expiryDate', data.expiryDate);
    if (data.active !== undefined) params = params.set('active', String(data.active));
    return this.http.patch<SchoolSettings>(`${this.superAdminUrl}/schools/${schoolId}/subscription`, null, { params });
  }
}
