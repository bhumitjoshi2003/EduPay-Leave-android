import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SchoolHoliday } from '../interfaces/school-holiday';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SchoolHolidayService {
  private readonly baseUrl = `${environment.apiUrl}/holidays`;

  constructor(private http: HttpClient) {}

  getHolidays(academicYear?: string): Observable<SchoolHoliday[]> {
    let params = new HttpParams();
    if (academicYear) params = params.set('academicYear', academicYear);
    return this.http.get<SchoolHoliday[]>(this.baseUrl, { params });
  }

  getHolidaysByRange(start: string, end: string): Observable<SchoolHoliday[]> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<SchoolHoliday[]>(`${this.baseUrl}/range`, { params });
  }

  isHoliday(date: string): Observable<boolean> {
    const params = new HttpParams().set('date', date);
    return this.http.get<boolean>(`${this.baseUrl}/check`, { params });
  }

  createHoliday(holiday: SchoolHoliday): Observable<SchoolHoliday> {
    return this.http.post<SchoolHoliday>(this.baseUrl, holiday);
  }

  updateHoliday(id: number, holiday: SchoolHoliday): Observable<SchoolHoliday> {
    return this.http.put<SchoolHoliday>(`${this.baseUrl}/${id}`, holiday);
  }

  deleteHoliday(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
