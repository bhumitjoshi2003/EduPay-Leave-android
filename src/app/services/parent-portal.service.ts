import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateParentRequest, LinkStudentRequest, ParentProfile, ParentSummary } from '../interfaces/parent-portal';

@Injectable({ providedIn: 'root' })
export class ParentPortalService {
  private readonly baseUrl = `${environment.apiUrl}/parents`;
  constructor(private http: HttpClient) {}

  listParents(): Observable<ParentSummary[]> { return this.http.get<ParentSummary[]>(this.baseUrl); }
  createParent(request: CreateParentRequest): Observable<ParentProfile> {
    return this.http.post<ParentProfile>(this.baseUrl, request);
  }
  getParent(parentId: string): Observable<ParentProfile> {
    return this.http.get<ParentProfile>(`${this.baseUrl}/${encodeURIComponent(parentId)}`);
  }
  getMyProfile(): Observable<ParentProfile> { return this.http.get<ParentProfile>(`${this.baseUrl}/me/profile`); }
  linkStudent(parentId: string, request: LinkStudentRequest): Observable<ParentProfile> {
    return this.http.post<ParentProfile>(`${this.baseUrl}/${encodeURIComponent(parentId)}/children`, request);
  }
  unlinkStudent(parentId: string, relationshipId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${encodeURIComponent(parentId)}/children/${relationshipId}`);
  }
  setActive(parentId: string, active: boolean): Observable<{ parentId: string; active: boolean }> {
    return this.http.patch<{ parentId: string; active: boolean }>(
      `${this.baseUrl}/${encodeURIComponent(parentId)}/status`, { active });
  }
}
