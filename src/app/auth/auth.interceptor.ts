import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';

import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';
import { TenantService } from '../services/tenant.service';
import { ToastService } from '../services/toast.service';
import { environment } from '../../environments/environment';

import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  /**
   * While isRefreshing=true, queued requests wait on this Subject.
   * Emits true once refresh completes, false if it fails.
   */
  private refreshDone$ = new BehaviorSubject<boolean>(false);

  constructor(
    private router: Router,
    private authService: AuthService,
    private authStateService: AuthStateService,
    private tenantService: TenantService,
    private injector: Injector
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const isAuthUrl =
      request.url.includes('/auth/login') ||
      request.url.includes('/auth/logout') ||
      request.url.includes('/auth/refresh-token') ||
      request.url.includes('/auth/request-password-reset') ||
      request.url.includes('/auth/reset-password');

    // Only attach credentials to our own API — not to third-party URLs (e.g. Razorpay CDN)
    const isOwnApi = request.url.startsWith(environment.apiUrl);

    // Attach credentials + X-School-Slug header so the backend TenantValidationFilter
    // can validate that the stored school slug matches the JWT's schoolId.
    // The Android app talks to the absolute API URL so the Host header never carries
    // a subdomain — the backend reads X-School-Slug instead.
    let clonedReq: HttpRequest<any>;
    if (isOwnApi) {
      const slug = this.tenantService.slug;
      clonedReq = request.clone({
        withCredentials: true,
        ...(slug ? { setHeaders: { 'X-School-Slug': slug } } : {}),
      });
    } else {
      clonedReq = request;
    }

    return next.handle(clonedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 = missing/expired/invalid token → attempt refresh (once)
        // 403 = valid token but wrong role, OR resource limit exceeded
        if (error.status === 401 && !isAuthUrl) {
          return this.handleTokenExpiry(clonedReq, next);
        }
        if (error.status === 402) {
          const toast = this.injector.get(ToastService);
          const body = error.error;
          const msg = typeof body === 'string' ? body : body?.message;
          toast.error('Subscription Expired', msg || 'Your subscription has expired. Please renew to continue.');
          this.router.navigate(['/dashboard/school-settings']);
          return throwError(() => error);
        }
        if (error.status === 403) {
          const body = error.error;
          const toast = this.injector.get(ToastService);
          const msg = typeof body === 'string' ? body : body?.message;
          if (msg === 'Unknown school' || msg === 'Forbidden') {
            // Tenant validation failed — stale cookie from a different school session.
            // Call logout to clear the HttpOnly cookies via Set-Cookie: Max-Age=0 response,
            // then redirect to login so the user can start a fresh session.
            this.authStateService.clearUser();
            this.authService.logout().subscribe({
              complete: () => this.router.navigate(['/home']),
              error: () => this.router.navigate(['/home']),
            });
            toast.error('Session Expired', 'Your session is no longer valid. Please log in again.');
          } else if (body?.code === 'RESOURCE_LIMIT_EXCEEDED') {
            toast.error('Limit Reached', body.message || 'You have reached your plan limit for this resource.');
          } else if (body?.code === 'FEATURE_NOT_AVAILABLE') {
            toast.warning('Feature Not Available', body.message || 'This feature is not available on your current plan. Upgrade to access it.');
          }
        }
        return throwError(() => error);
      })
    );
  }

  private handleTokenExpiry(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {

    if (!this.isRefreshing) {
      // First failing request kicks off the refresh
      this.isRefreshing = true;
      this.refreshDone$.next(false);

      return this.authService.refreshToken().pipe(
        tap((userInfo: any) => {
          this.authStateService.setUser(userInfo);
        }),
        switchMap(() => {
          this.isRefreshing = false;
          this.refreshDone$.next(true);
          return next.handle(request);
        }),
        catchError((refreshError) => {
          // Refresh token itself is expired/invalid → log out
          this.isRefreshing = false;
          this.refreshDone$.next(false);
          this.authStateService.clearUser();
          this.router.navigate(['/home']);
          return throwError(() => refreshError);
        })
      );
    } else {
      // Other requests that fail while refresh is in progress wait here.
      // Skip the initial false (set when refresh starts), wait for the outcome.
      return this.refreshDone$.pipe(
        filter(done => done === true || !this.isRefreshing),
        take(1),
        switchMap((done) => {
          if (done) {
            return next.handle(request);
          }
          // Refresh failed — propagate the error instead of hanging forever
          return throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Token refresh failed' }));
        })
      );
    }
  }
}
