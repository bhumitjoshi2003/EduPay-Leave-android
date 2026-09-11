import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Teaching, TeachingInput, Thought, ThoughtOverride, VerseSuggestion, WisdomDashboard, WisdomPage, WisdomStatus } from '../interfaces/wisdom';
@Injectable({ providedIn: 'root' })
export class WisdomService {
 private base = `${environment.apiUrl}/wisdom`;
 constructor(private http: HttpClient) {}
 dashboard() { return this.http.get<WisdomDashboard>(`${this.base}/dashboard`); }
 list<T>(path: string, page = 0, q = '') { return this.http.get<WisdomPage<T>>(`${this.base}/${path}`, { params: new HttpParams().set('page', page).set('q', q) }); }
 read(id: string) { return this.http.get<Teaching>(`${this.base}/teachings/${encodeURIComponent(id)}`); }
 status() { return this.http.get<WisdomStatus>(`${this.base}/admin/status`); }
 saveThought(input: Omit<Thought, 'id'|'schoolId'>, id?: number) { return id ? this.http.put<Thought>(`${this.base}/admin/thoughts/${id}`, input) : this.http.post<Thought>(`${this.base}/admin/thoughts`, input); }
 override(thoughtId: number, displayDate: string, audience: string) { return this.http.put<ThoughtOverride>(`${this.base}/admin/overrides`, { thoughtId, displayDate, audience }); }
 removeOverride(id: number) { return this.http.delete<void>(`${this.base}/admin/overrides/${id}`); }
 saveTeaching(input: TeachingInput, id?: number) { return id ? this.http.put<Teaching>(`${this.base}/admin/teachings/${id}`, input) : this.http.post<Teaching>(`${this.base}/admin/teachings`, input); }
 schedule(t: Teaching, date: string, time: string | null = null) { return this.http.post<Teaching>(`${this.base}/admin/teachings/${t.id}/schedule`, { date, time, version: t.version }); }
 cancel(t: Teaching) { return this.http.post<Teaching>(`${this.base}/admin/teachings/${t.id}/cancel`, { version: t.version }); }
 draft(verseId: number, theme: string) { return this.http.post<Pick<Teaching,'simpleMeaning'|'understanding'|'lesson'>>(`${environment.apiUrl}/ai/wisdom/draft`, { verseId, theme }); }
 suggestVerses(theme: string) { return this.http.post<VerseSuggestion[]>(`${environment.apiUrl}/ai/wisdom/suggest-verses`, { theme }); }
}
