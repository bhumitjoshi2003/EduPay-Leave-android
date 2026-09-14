export const REQUEST_ID_HEADER = 'X-Request-ID';
const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function validRequestId(value: string | null): string | null {
  return value && VALID_REQUEST_ID.test(value) ? value : null;
}

export function newRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}
