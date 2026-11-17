export function formatOrderDate(dateStr?: string | null, locale = 'en-US'): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return String(dateStr);
  return parsed.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimeShort(dateStr?: string | null): string {
  if (!dateStr) return '';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return String(dateStr);
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
