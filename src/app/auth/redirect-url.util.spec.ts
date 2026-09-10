import { saveIntendedRoute, consumeIntendedRoute, clearIntendedRoute } from './redirect-url.util';

describe('redirect-url.util', () => {
  beforeEach(() => localStorage.removeItem('redirectUrl'));

  it('saves and consumes a genuine internal path', () => {
    saveIntendedRoute('/dashboard/timetable');
    expect(consumeIntendedRoute()).toBe('/dashboard/timetable');
  });

  it('consuming clears it — a second read falls back to /dashboard', () => {
    saveIntendedRoute('/dashboard/fees');
    consumeIntendedRoute();
    expect(consumeIntendedRoute()).toBe('/dashboard');
  });

  it('never saves an absolute/external URL', () => {
    saveIntendedRoute('https://evil.example.com/phish');
    expect(consumeIntendedRoute()).toBe('/dashboard');
  });

  it('never saves a protocol-relative "//" URL', () => {
    saveIntendedRoute('//evil.example.com');
    expect(consumeIntendedRoute()).toBe('/dashboard');
  });

  it('ignores null/undefined/empty', () => {
    saveIntendedRoute(null);
    saveIntendedRoute(undefined);
    saveIntendedRoute('');
    expect(consumeIntendedRoute()).toBe('/dashboard');
  });

  it('clearIntendedRoute removes it without needing to read it', () => {
    saveIntendedRoute('/dashboard/attendance');
    clearIntendedRoute();
    expect(consumeIntendedRoute()).toBe('/dashboard');
  });
});
