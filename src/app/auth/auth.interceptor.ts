import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';

import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthStateService } from './auth-state.service';
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
    private authStateService: AuthStateService
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const isAuthUrl =
      request.url.includes('/auth/login') ||
      request.url.includes('/auth/refresh-token') ||
      request.url.includes('/auth/request-password-reset') ||
      request.url.includes('/auth/reset-password');

    // Only attach credentials to our own API — not to third-party URLs (e.g. Razorpay CDN)
    const isOwnApi = request.url.startsWith(environment.apiUrl);
    const clonedReq = isOwnApi ? request.clone({ withCredentials: true }) : request;

    return next.handle(clonedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 = missing/expired/invalid token → attempt refresh (once)
        // 403 = valid token but wrong role → propagate as-is
        if (error.status === 401 && !isAuthUrl) {
          return this.handleTokenExpiry(clonedReq, next);
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
      // Other requests that fail while refresh is in progress wait here
      return this.refreshDone$.pipe(
        filter(done => done === true),
        take(1),
        switchMap(() => next.handle(request))
      );
    }
  }
}
