import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthStateService } from './auth-state.service';

interface ChangePasswordRequest {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient, private authStateService: AuthStateService) { }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData, { responseType: 'text' });
  }

  login(userId: string, password: string, schoolSlug?: string | null): Observable<any> {
    const body: Record<string, string> = { userId, password };
    if (schoolSlug) body['schoolSlug'] = schoolSlug;
    return this.http.post<any>(`${this.apiUrl}/login`, body, { withCredentials: true });
  }

  refreshToken(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh-token`, {}, { withCredentials: true });
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true, responseType: 'text' }).pipe(
      tap(() => {
        this.authStateService.clearUser();
        localStorage.removeItem('redirectUrl');
      })
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, request, { responseType: 'text', withCredentials: true });
  }

  requestPasswordReset(userId: string, email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/request-password-reset`, { userId, email }, { responseType: 'text' });
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    const params = new HttpParams().set('token', token);
    return this.http.post(this.apiUrl + '/reset-password', { newPassword }, { params, responseType: 'text' });
  }

  getUserRole(): string {
    return this.authStateService.getUserRole();
  }

  getUserId(): string {
    return this.authStateService.getUserId();
  }
}
