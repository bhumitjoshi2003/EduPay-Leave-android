import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Thought, ThoughtOverride, WisdomDashboard, WisdomPage, WisdomStatus } from '../interfaces/wisdom';
@Injectable({ providedIn: 'root' })
export class WisdomService {
 private base = `${environment.apiUrl}/wisdom`;
 constructor(private http: HttpClient) {}
 dashboard() { return this.http.get<WisdomDashboard>(`${this.base}/dashboard`); }
 list<T>(path: string, page = 0, q = '') { return this.http.get<WisdomPage<T>>(`${this.base}/${path}`, { params: new HttpParams().set('page', page).set('q', q) }); }
 status() { return this.http.get<WisdomStatus>(`${this.base}/admin/status`); }
 saveThought(input: Omit<Thought, 'id'|'schoolId'>, id?: number) { return id ? this.http.put<Thought>(`${this.base}/admin/thoughts/${id}`, input) : this.http.post<Thought>(`${this.base}/admin/thoughts`, input); }
 override(thoughtId: number, displayDate: string, audience: string) { return this.http.put<ThoughtOverride>(`${this.base}/admin/overrides`, { thoughtId, displayDate, audience }); }
 removeOverride(id: number) { return this.http.delete<void>(`${this.base}/admin/overrides/${id}`); }
}
