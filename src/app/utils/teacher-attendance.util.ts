export function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTeacherAttendanceTime(value: string | null): string {
  if (!value) return '—';
  const time = value.includes('T') ? value.split('T')[1] : value;
  const [hourText = '', minute = ''] = time.split(':');
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !/^\d{2}$/.test(minute)) return value;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function teacherAttendanceErrorMessage(error: any, fallback: string): string {
  const candidates = [
    error?.error?.message,
    typeof error?.error === 'string' ? error.error : null,
    error?.error?.detail,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const message = candidate.trim();
    if (!message || message.length > 500) continue;
    if (/<\/?[a-z][\s\S]*>/i.test(message)) continue;
    if (/^\s*[\[{]/.test(message)) continue;
    if (/\b(?:exception|stack trace|org\.springframework|java\.)\b/i.test(message)) continue;
    return message;
  }
  return fallback;
}
