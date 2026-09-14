import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ObservabilityService, scrubSentryEvent } from './observability.service';

describe('ObservabilityService', () => {
  it('ignores expected HTTP errors and reports unexpected server failures once', () => {
    const service = new ObservabilityService();
    const capture = spyOn(service, 'capture');
    service.reportHttpFailure(new HttpErrorResponse({ status: 403 }), 'POST', 'client_req-12345');
    expect(capture).not.toHaveBeenCalled();

    const failure = new HttpErrorResponse({
      status: 503,
      headers: new HttpHeaders({ 'X-Request-ID': 'server_req-12345' }),
    });
    service.reportHttpFailure(failure, 'GET', 'client_req-12345');
    service.reportHttpFailure(failure, 'GET', 'client_req-12345');

    expect(capture).toHaveBeenCalledTimes(1);
    expect((capture.calls.mostRecent().args[1] as any)?.tags?.['request_id']).toBe('server_req-12345');
  });

  it('removes private SDK context and keeps only allowlisted diagnostic tags', () => {
    const event = scrubSentryEvent({
      type: undefined,
      message: 'email parent@example.com',
      request: { headers: { Authorization: 'Bearer secret' }, data: 'private body' },
      user: { email: 'parent@example.com' },
      contexts: { private: { prompt: 'private prompt' } },
      extra: { token: 'secret' },
      transaction: '/students/123',
      tags: { service: 'frontend', request_id: 'client_req-12345', student: '123' },
      exception: { values: [{ value: 'private failure' }] },
    });

    expect(event.request).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.contexts).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.transaction).toBeUndefined();
    expect(event.exception?.values?.[0].value).toBe('Unexpected application error');
    expect(event.tags).toEqual({ service: 'frontend', request_id: 'client_req-12345' });
  });
});
