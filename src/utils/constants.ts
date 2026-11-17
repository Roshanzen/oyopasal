export const ORDER_FULFILLMENT_STEPS = [
  'ORDER_PLACED',
  'CONFIRMED_BY_VENDOR',
  'PACKED_BY_VENDOR',
  'RIDER_ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  'CASH_ON_DELIVERY',
  'ESEWA',
  'KHALTI',
  'CARD',
] as const;

export const DELIVERY_OPTION_TYPES = [
  'EXPRESS_12_MINS',
  'SCHEDULED_TODAY',
] as const;

export function isExternalHttpUrl(url?: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

export function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Kathmandu')}`;
}
