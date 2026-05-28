import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AcademicSession } from '../interfaces/academic-session';

@Injectable({
  providedIn: 'root'
})
export class AcademicSessionService {
  private apiUrl = `${environment.apiUrl}/academic-sessions`;

  constructor(private http: HttpClient) {}

  getAllSessions(): Observable<AcademicSession[]> {
    return this.http.get<AcademicSession[]>(this.apiUrl);
  }

  getCurrentSession(): Observable<AcademicSession> {
    return this.http.get<AcademicSession>(`${this.apiUrl}/current`);
  }

  createSession(session: Partial<AcademicSession>): Observable<AcademicSession> {
    return this.http.post<AcademicSession>(this.apiUrl, session);
  }

  setCurrentSession(sessionId: number): Observable<AcademicSession> {
    return this.http.put<AcademicSession>(`${this.apiUrl}/${sessionId}/set-current`, {});
  }

  deleteSession(sessionId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${sessionId}`);
  }
}
