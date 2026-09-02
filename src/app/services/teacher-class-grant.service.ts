import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TeacherClassGrant, TeacherClassGrantRequest } from '../interfaces/teacher-class-grant';

/** Admin-managed grants letting a teacher self-serve timetable periods for a class/section they
 *  don't yet have any other connection to — see the Timetable component's teacher self-service
 *  flow and TeacherClassGrantController on the backend. */
@Injectable({ providedIn: 'root' })
export class TeacherClassGrantService {
  private baseUrl = `${environment.apiUrl}/teacher-class-grants`;

  constructor(private http: HttpClient) {}

  /** ADMIN/SUPER_ADMIN: pass teacherId to list a specific teacher's grants. TEACHER: always
   *  returns their own regardless of teacherId (the backend ignores it for that role). */
  getForTeacher(teacherId?: string): Observable<TeacherClassGrant[]> {
    let params = new HttpParams();
    if (teacherId) {
      params = params.set('teacherId', teacherId);
    }
    return this.http.get<TeacherClassGrant[]>(this.baseUrl, { params });
  }

  create(request: TeacherClassGrantRequest): Observable<TeacherClassGrant> {
    return this.http.post<TeacherClassGrant>(this.baseUrl, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
