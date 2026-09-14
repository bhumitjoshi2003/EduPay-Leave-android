import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import * as Sentry from '@sentry/angular';
import { validRequestId } from './request-id';

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  private readonly reported = new WeakSet<object>();

  reportUnexpected(error: unknown, context: Record<string, string> = {}): void {
    if (typeof error === 'object' && error !== null) {
      if (this.reported.has(error)) return;
      this.reported.add(error);
    }
    this.capture(error instanceof Error ? error : new Error('Unexpected application error'), {
      tags: { service: 'frontend', client: Capacitor.isNativePlatform() ? 'android' : 'web', ...context },
    });
  }

  capture(error: Error, context: Sentry.CaptureContext): void {
    Sentry.captureException(error, context);
  }

  reportHttpFailure(error: HttpErrorResponse, method: string, requestId: string): void {
    if (error.status < 500) return;
    this.reportUnexpected(error, {
      operation: 'api.request', method, status: String(error.status),
      request_id: validRequestId(error.headers?.get('X-Request-ID')) ?? requestId,
    });
  }
}

export function initializeObservability(): void {
  const config = (globalThis as typeof globalThis & {
    __EDUNEXIFY_OBSERVABILITY__?: { sentryDsn?: string; environment?: string; release?: string };
  }).__EDUNEXIFY_OBSERVABILITY__;
  if (!config?.sentryDsn) return;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
}

export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  event.user = undefined;
  event.request = undefined;
  event.breadcrumbs = undefined;
  event.extra = undefined;
  event.contexts = undefined;
  event.server_name = undefined;
  event.transaction = undefined;
  event.message = 'Unexpected application error';
  event.exception?.values?.forEach(value => { value.value = 'Unexpected application error'; });
  const allowed = new Set(['service', 'operation', 'method', 'status', 'request_id', 'client']);
  event.tags = Object.fromEntries(Object.entries(event.tags ?? {}).filter(([key]) => allowed.has(key)));
  return event;
}
