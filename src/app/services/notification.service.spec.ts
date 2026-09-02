import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads only the requested recent page', () => {
    service.getUserNotifications(0, 5).subscribe();
    const request = http.expectOne(req => req.url === `${environment.apiUrl}/notification/user`);
    expect(request.request.params.get('page')).toBe('0');
    expect(request.request.params.get('size')).toBe('5');
    request.flush({ content: [], totalElements: 0, totalPages: 0, last: true, first: true, numberOfElements: 0, pageable: { pageNumber: 0, pageSize: 5 } });
  });

  it('sends read-state and category filters with pagination', () => {
    service.getUserNotifications(3, 20, false, 'ATTENDANCE').subscribe();
    const request = http.expectOne(req => req.url === `${environment.apiUrl}/notification/user`);
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('size')).toBe('20');
    expect(request.request.params.get('isRead')).toBe('false');
    expect(request.request.params.get('category')).toBe('ATTENDANCE');
    request.flush({ content: [], totalElements: 0, totalPages: 0, last: true, first: false, numberOfElements: 0, pageable: { pageNumber: 3, pageSize: 20 } });
  });

  it('omits optional inbox filters for the all view', () => {
    service.getUserNotifications(0, 20).subscribe();
    const request = http.expectOne(req => req.url === `${environment.apiUrl}/notification/user`);
    expect(request.request.params.has('isRead')).toBeFalse();
    expect(request.request.params.has('category')).toBeFalse();
    request.flush({ content: [], totalElements: 0, totalPages: 0, last: true, first: true, numberOfElements: 0, pageable: { pageNumber: 0, pageSize: 20 } });
  });

  it('marks the authenticated inbox row read without a user id', () => {
    service.markNotificationAsRead(42).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/notification/user/42/read`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({});
    request.flush(null);
  });

  it('marks all authenticated notifications read', () => {
    service.markAllNotificationsAsRead().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/notification/user/read-all`);
    expect(request.request.method).toBe('PUT');
    request.flush(null);
  });
});
