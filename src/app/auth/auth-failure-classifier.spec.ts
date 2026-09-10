import { HttpErrorResponse } from '@angular/common/http';
import { classifyAuthFailure } from './auth-failure-classifier';

describe('classifyAuthFailure', () => {
  it('classifies 401 as AUTHORITATIVE', () => {
    expect(classifyAuthFailure(new HttpErrorResponse({ status: 401 }))).toBe('AUTHORITATIVE');
  });

  it('classifies 403 as AUTHORITATIVE', () => {
    expect(classifyAuthFailure(new HttpErrorResponse({ status: 403 }))).toBe('AUTHORITATIVE');
  });

  it('classifies status 0 (network unavailable) as TRANSIENT', () => {
    expect(classifyAuthFailure(new HttpErrorResponse({ status: 0 }))).toBe('TRANSIENT');
  });

  it('classifies 502/503/504 as TRANSIENT, never destroying a session over a temporary outage', () => {
    for (const status of [502, 503, 504]) {
      expect(classifyAuthFailure(new HttpErrorResponse({ status }))).toBe('TRANSIENT');
    }
  });

  it('classifies an unexpected status as TRANSIENT (prefer recoverable over destructive)', () => {
    expect(classifyAuthFailure(new HttpErrorResponse({ status: 418 }))).toBe('TRANSIENT');
  });

  it('classifies a non-HttpErrorResponse (e.g. a thrown JS error) as TRANSIENT', () => {
    expect(classifyAuthFailure(new Error('boom'))).toBe('TRANSIENT');
    expect(classifyAuthFailure(undefined)).toBe('TRANSIENT');
  });
});
