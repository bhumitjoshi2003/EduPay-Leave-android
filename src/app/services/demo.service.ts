import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DemoRequestPayload {
  schoolName:   string;
  contactName:  string;
  email:        string;
  phone:        string;
  numberOfStudents?: string;
  city?:        string;
  message?:     string;
}

export interface DemoRequestSummary {
  id:           number;
  schoolName:   string;
  contactName:  string;
  email:        string;
  phone:        string;
  numberOfStudents?: string;
  city?:        string;
  message?:     string;
  status:       'PENDING' | 'CONTACTED' | 'COMPLETED' | 'REJECTED';
  requestedAt:  string;
}

@Injectable({ providedIn: 'root' })
export class DemoService {

  private baseUrl = `${environment.apiUrl}/demo-requests`;

  constructor(private http: HttpClient) {}

  /** Public — no auth required */
  submitRequest(payload: DemoRequestPayload): Observable<string> {
    return this.http.post(this.baseUrl, payload, { responseType: 'text' });
  }

  /** Admin only — view all demo requests */
  getAll(): Observable<DemoRequestSummary[]> {
    return this.http.get<DemoRequestSummary[]>(this.baseUrl);
  }

  /** Admin only — update status */
  updateStatus(id: number, status: DemoRequestSummary['status']): Observable<string> {
    return this.http.patch(`${this.baseUrl}/${id}/status`, { status }, { responseType: 'text' });
  }
}
