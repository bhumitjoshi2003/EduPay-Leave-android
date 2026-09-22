import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StaffAdoptionResponse } from '../interfaces/staff-adoption';

@Injectable({ providedIn: 'root' })
export class StaffAdoptionService {
  constructor(private http: HttpClient) {}
  getStaffAdoption(): Observable<StaffAdoptionResponse> {
    return this.http.get<StaffAdoptionResponse>(`${environment.apiUrl}/admin/staff-adoption`, { withCredentials: true });
  }
}
