import { newRequestId, validRequestId } from './request-id';

describe('request IDs', () => {
  it('accepts safe IDs and rejects unsafe values', () => {
    expect(validRequestId('client_req-12345')).toBe('client_req-12345');
    expect(validRequestId('person@example.com')).toBeNull();
    expect(validRequestId('bad value')).toBeNull();
  });

  it('generates a safe non-personal ID', () => {
    expect(validRequestId(newRequestId())).not.toBeNull();
  });
});
