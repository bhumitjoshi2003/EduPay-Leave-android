import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FreeSubstituteTeacher, TeacherSubstitution, UncoveredPeriod } from '../interfaces/teacher-substitution';

@Injectable({ providedIn: 'root' })
export class TeacherSubstitutionService {
  private readonly baseUrl = `${environment.apiUrl}/substitutions`;

  constructor(private http: HttpClient) {}

  getUncovered(date: string): Observable<UncoveredPeriod[]> {
    return this.http.get<UncoveredPeriod[]>(`${this.baseUrl}/uncovered`, { params: { date } });
  }

  getFreeTeachers(timetableEntryId: number, date: string): Observable<FreeSubstituteTeacher[]> {
    const params = new HttpParams().set('timetableEntryId', timetableEntryId).set('date', date);
    return this.http.get<FreeSubstituteTeacher[]>(`${this.baseUrl}/free-teachers`, { params });
  }

  assign(timetableEntryId: number, date: string, substituteTeacherId: string): Observable<TeacherSubstitution> {
    return this.http.post<TeacherSubstitution>(this.baseUrl, { timetableEntryId, date, substituteTeacherId });
  }

  change(id: number, substituteTeacherId: string): Observable<TeacherSubstitution> {
    return this.http.put<TeacherSubstitution>(`${this.baseUrl}/${id}`, { substituteTeacherId });
  }

  cancel(id: number): Observable<TeacherSubstitution> {
    return this.http.delete<TeacherSubstitution>(`${this.baseUrl}/${id}`);
  }

  getMine(date: string): Observable<TeacherSubstitution[]> {
    return this.http.get<TeacherSubstitution[]>(`${this.baseUrl}/mine`, { params: { date } });
  }
}

