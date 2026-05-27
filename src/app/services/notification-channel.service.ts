import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NotificationChannel } from '../interfaces/notification-channel';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NotificationChannelService {
  private readonly baseUrl = `${environment.apiUrl}/notification-channels`;

  constructor(private http: HttpClient) {}

  getChannels(): Observable<NotificationChannel[]> {
    return this.http.get<NotificationChannel[]>(this.baseUrl);
  }

  upsertChannel(channel: NotificationChannel): Observable<NotificationChannel> {
    return this.http.put<NotificationChannel>(this.baseUrl, channel);
  }
}
