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

export interface FeatureCatalogItem {
  featureKey: string;
  displayName: string;
  description: string;
  category: string;
  isAlwaysOn: boolean;
}

export interface PlanFeatureChange {
  id: number;
  featureKey: string;
  actionType: string;
  policy: string;
  effectiveAt: string;
  applied: boolean;
  createdBy: string;
  createdAt: string;
}

export interface PlanDetail {
  id: number;
  name: string;
  tier: string;
  version: string;
  isPublic: boolean;
  isActive: boolean;
  priorityScore: number;
  maxStudents: number | null;
  studentSoftLimitPct: number;
  studentHardLimitPct: number;
  maxStaff: number | null;
  staffSoftLimitPct: number;
  staffHardLimitPct: number;
  storageGbLimit: number | null;
  storageSoftLimitPct: number;
  storageHardLimitPct: number;
  monthlyPricePaise: number | null;
  annualPricePaise: number | null;
  currency: string;
  features: FeatureCatalogItem[];
  pendingChanges: PlanFeatureChange[];
}

export interface SchoolEntitlementSummary {
  planName: string | null;
  planTier: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  expiresAt: string | null;
  graceEndsAt: string | null;
  maxStudents: number | null;
  studentSoftLimitPct: number;
  studentHardLimitPct: number;
  maxStaff: number | null;
  staffSoftLimitPct: number;
  staffHardLimitPct: number;
  storageGbLimit: number | null;
  featureCount: number;
  features: string[];
  activeStudents: number;
  totalStaff: number;
  teachers: number;
  admins: number;
}

export interface GlobalSubscriptionConfig {
  gracePeriodDays: number;
  defaultTrialDays: number;
  expiryNotifyDays: number;
  updatedByAdminId: string;
  updatedAt: string;
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

  // ── Subscription management (SUPER_ADMIN) ─────────────────────────────────

  getSchoolSubscription(schoolId: number): Observable<any> {
    return this.http.get<any>(`${this.superAdminUrl}/schools/${schoolId}/subscription`);
  }

  assignSubscription(schoolId: number, data: any): Observable<any> {
    return this.http.post<any>(`${this.superAdminUrl}/schools/${schoolId}/subscription`, data);
  }

  updateSchoolSubscription(schoolId: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.superAdminUrl}/schools/${schoolId}/subscription`, data);
  }

  refreshEntitlement(schoolId: number): Observable<any> {
    return this.http.post<any>(`${this.superAdminUrl}/schools/${schoolId}/subscription/refresh`, {});
  }

  getEntitlement(): Observable<SchoolEntitlementSummary> {
    return this.http.get<SchoolEntitlementSummary>(`${this.baseUrl}/entitlement`);
  }

  getPublicPlans(): Observable<PlanDetail[]> {
    return this.http.get<PlanDetail[]>(`${environment.apiUrl}/public/plans`);
  }

  createUpgradeOrder(planId: number, billingCycle: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/subscription/upgrade/order`, { planId, billingCycle });
  }

  verifyUpgradePayment(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/subscription/upgrade/verify`, data);
  }

  // ── School-level feature overrides (ADMIN) ────────────────────────────────

  getSchoolFeatures(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/features`);
  }

  setFeatureOverride(featureKey: string, overrideState: 'DEFAULT' | 'DISABLED'): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/features/${featureKey}/override`, { overrideState });
  }

  // ── Plan Management (SUPER_ADMIN) ─────────────────────────────────────────

  getPlans(includeInactive = false): Observable<PlanDetail[]> {
    return this.http.get<PlanDetail[]>(`${this.superAdminUrl}/plans`, {
      params: { includeInactive: String(includeInactive) }
    });
  }

  createPlan(data: Partial<PlanDetail> & { name: string; tier: string }): Observable<PlanDetail> {
    return this.http.post<PlanDetail>(`${this.superAdminUrl}/plans`, data);
  }

  updatePlan(planId: number, data: Partial<PlanDetail>): Observable<PlanDetail> {
    return this.http.put<PlanDetail>(`${this.superAdminUrl}/plans/${planId}`, data);
  }

  deactivatePlan(planId: number): Observable<void> {
    return this.http.delete<void>(`${this.superAdminUrl}/plans/${planId}`);
  }

  addFeatureToPlan(planId: number, featureKey: string): Observable<void> {
    return this.http.post<void>(`${this.superAdminUrl}/plans/${planId}/features`, { featureKey });
  }

  removeFeatureFromPlan(planId: number, featureKey: string, policy: string): Observable<void> {
    return this.http.delete<void>(`${this.superAdminUrl}/plans/${planId}/features/${featureKey}`, {
      body: { policy }
    });
  }

  getFeatureCatalog(): Observable<FeatureCatalogItem[]> {
    return this.http.get<FeatureCatalogItem[]>(`${this.superAdminUrl}/features`);
  }

  getSubscriptionConfig(): Observable<GlobalSubscriptionConfig> {
    return this.http.get<GlobalSubscriptionConfig>(`${this.superAdminUrl}/subscription-config`);
  }

  updateSubscriptionConfig(data: Partial<GlobalSubscriptionConfig>): Observable<GlobalSubscriptionConfig> {
    return this.http.put<GlobalSubscriptionConfig>(`${this.superAdminUrl}/subscription-config`, data);
  }
}
