import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { environment } from '../../environments/environment';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly tokenKey = 'fcm_token';

  constructor(private http: HttpClient, private logger: LoggerService) {}

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Clear any listeners left over from a previous session before adding new ones.
    // Without this, each re-login stacks another set of handlers → duplicate notifications.
    await PushNotifications.removeAllListeners();

    // Request permission
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') {
      this.logger.error('Push notification permission denied');
      return;
    }

    await PushNotifications.register();

    // Token received — send to backend
    await PushNotifications.addListener('registration', (token) => {
      const fcmToken = token.value;
      const stored = localStorage.getItem(this.tokenKey);

      // Only register if token is new or changed
      if (fcmToken !== stored) {
        this.registerToken(fcmToken);
        localStorage.setItem(this.tokenKey, fcmToken);
      }
    });

    // Token error
    await PushNotifications.addListener('registrationError', (err) => {
      this.logger.error('FCM registration error:', err);
    });

    // Notification received while app is open — no action needed, Notice Board updates on next visit
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      this.logger.log('Push received (foreground):', notification.title);
    });

    // User tapped a notification — navigate to notice board
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {
      window.location.href = '/dashboard/notice';
    });
  }

  private registerToken(token: string): void {
    this.http.post(`${environment.apiUrl}/users/device-token`, { token }, { responseType: 'text' })
      .subscribe({
        next: () => this.logger.log('FCM token registered'),
        error: (e) => this.logger.error('FCM token registration failed:', e),
      });
  }

  async clearToken(): Promise<void> {
    const token = localStorage.getItem(this.tokenKey);
    if (!token || !Capacitor.isNativePlatform()) return;

    this.http.delete(`${environment.apiUrl}/users/device-token`, { body: { token }, responseType: 'text' })
      .subscribe({
        next: () => {
          localStorage.removeItem(this.tokenKey);
          this.logger.log('FCM token cleared');
        },
        error: (e) => this.logger.error('FCM token clear failed:', e),
      });

    await PushNotifications.removeAllListeners();
  }
}
