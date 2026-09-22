import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StaffAdoptionResponse } from '../interfaces/staff-adoption';
import {
  StaffAdoptionReminderPreview,
  StaffAdoptionReminderSendResult,
  StaffAdoptionReminderType,
} from '../interfaces/staff-adoption-reminder';

@Injectable({ providedIn: 'root' })
export class StaffAdoptionService {
  private readonly baseUrl = `${environment.apiUrl}/admin/staff-adoption`;

  constructor(private http: HttpClient) {}
  getStaffAdoption(): Observable<StaffAdoptionResponse> {
    return this.http.get<StaffAdoptionResponse>(this.baseUrl, { withCredentials: true });
  }

  /** Server re-resolves eligible recipients itself from `type` alone — no recipient ids are
   *  ever sent from here, for preview or for the actual send below. */
  previewReminder(type: StaffAdoptionReminderType): Observable<StaffAdoptionReminderPreview> {
    return this.http.get<StaffAdoptionReminderPreview>(`${this.baseUrl}/reminders/preview`,
      { params: new HttpParams().set('type', type), withCredentials: true });
  }

  sendReminder(type: StaffAdoptionReminderType): Observable<StaffAdoptionReminderSendResult> {
    return this.http.post<StaffAdoptionReminderSendResult>(`${this.baseUrl}/reminders`, { type }, { withCredentials: true });
  }
}
