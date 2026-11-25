import test from 'node:test';
import assert from 'node:assert/strict';

// Canonical status transition map matching Django backend OrderService.VALID_TRANSITIONS & STATUS_MAP
const STATUS_MAP: Record<string, string> = {
  ORDER_PLACED: 'CONFIRMED',
  CONFIRMED_BY_VENDOR: 'CONFIRMED',
  CONFIRMED: 'CONFIRMED',
  PENDING: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  PACKED_BY_VENDOR: 'PACKED',
  PACKED: 'PACKED',
  READY_FOR_RIDER_PICKUP: 'READY_FOR_DISPATCH',
  READY_FOR_PICKUP: 'READY_FOR_DISPATCH',
  READY_FOR_DISPATCH: 'READY_FOR_DISPATCH',
  SHIPPED: 'SHIPPED',
  DISPATCHED: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'DELIVERED',
  REJECTED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'PROCESSING', 'PACKED', 'CANCELLED'],
  PAYMENT_PROCESSING: ['CONFIRMED', 'CANCELLED', 'FAILED'],
  CONFIRMED: ['PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'CANCELLED'],
  PROCESSING: ['PACKED', 'READY_FOR_DISPATCH', 'CANCELLED'],
  PACKED: ['READY_FOR_DISPATCH', 'SHIPPED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  READY_FOR_DISPATCH: ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED'],
};

function canTransition(currentStatus: string, rawTargetStatus: string): { valid: boolean; targetCanonical: string; idempotent: boolean } {
  const canonical = STATUS_MAP[rawTargetStatus.toUpperCase()] || rawTargetStatus.toUpperCase();
  if (currentStatus === canonical) {
    return { valid: true, targetCanonical: canonical, idempotent: true };
  }
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return { valid: allowed.includes(canonical), targetCanonical: canonical, idempotent: false };
}

test('Vendor Order Transition 1: Maps frontend status labels to backend canonical states', () => {
  assert.equal(STATUS_MAP['PACKED_BY_VENDOR'], 'PACKED');
  assert.equal(STATUS_MAP['READY_FOR_RIDER_PICKUP'], 'READY_FOR_DISPATCH');
  assert.equal(STATUS_MAP['OUT_FOR_DELIVERY'], 'OUT_FOR_DELIVERY');
  assert.equal(STATUS_MAP['DELIVERED'], 'DELIVERED');
  assert.equal(STATUS_MAP['CONFIRMED_BY_VENDOR'], 'CONFIRMED');
  assert.equal(STATUS_MAP['REJECTED'], 'CANCELLED');
});

test('Vendor Order Transition 2: Sequential fulfillment pipeline from CONFIRMED to DELIVERED', () => {
  let status = 'CONFIRMED';

  // Step 1: Mark Packed
  const step1 = canTransition(status, 'PACKED_BY_VENDOR');
  assert.equal(step1.valid, true);
  status = step1.targetCanonical;
  assert.equal(status, 'PACKED');

  // Step 2: Ready for Rider Pickup
  const step2 = canTransition(status, 'READY_FOR_RIDER_PICKUP');
  assert.equal(step2.valid, true);
  status = step2.targetCanonical;
  assert.equal(status, 'READY_FOR_DISPATCH');

  // Step 3: Out for Delivery
  const step3 = canTransition(status, 'OUT_FOR_DELIVERY');
  assert.equal(step3.valid, true);
  status = step3.targetCanonical;
  assert.equal(status, 'OUT_FOR_DELIVERY');

  // Step 4: Mark Delivered
  const step4 = canTransition(status, 'DELIVERED');
  assert.equal(step4.valid, true);
  status = step4.targetCanonical;
  assert.equal(status, 'DELIVERED');
});

test('Vendor Order Transition 3: Idempotent transitions return success without ValueError', () => {
  const res = canTransition('READY_FOR_DISPATCH', 'READY_FOR_RIDER_PICKUP');
  assert.equal(res.valid, true);
  assert.equal(res.idempotent, true);
  assert.equal(res.targetCanonical, 'READY_FOR_DISPATCH');

  const resDelivered = canTransition('DELIVERED', 'DELIVERED');
  assert.equal(resDelivered.valid, true);
  assert.equal(resDelivered.idempotent, true);
});

test('Vendor Order Transition 4: Disallows backward or invalid transitions', () => {
  const res1 = canTransition('DELIVERED', 'PACKED_BY_VENDOR');
  assert.equal(res1.valid, false);

  const res2 = canTransition('READY_FOR_DISPATCH', 'CONFIRMED');
  assert.equal(res2.valid, false);
});

test('Safe Arrays & Length: Guarding undefined and empty responses against .length and .map runtime errors', () => {
  // Undefined analytics response
  const rawAnalytics: any = { summary: null, monthly_trend: null, top_products: undefined, category_breakdown: null };
  const monthlyTrend = Array.isArray(rawAnalytics?.monthly_trend) ? rawAnalytics.monthly_trend : [];
  const topProducts = Array.isArray(rawAnalytics?.top_products) ? rawAnalytics.top_products : [];
  const categoryBreakdown = Array.isArray(rawAnalytics?.category_breakdown) ? rawAnalytics.category_breakdown : [];

  // Should safely resolve length to 0 without throwing
  assert.equal(monthlyTrend.length, 0);
  assert.equal(topProducts.length, 0);
  assert.equal(categoryBreakdown.length, 0);

  // Latest point on empty trend safely resolves to undefined
  const latestPoint = monthlyTrend.length > 0 ? monthlyTrend[monthlyTrend.length - 1] : undefined;
  assert.equal(latestPoint, undefined);

  // Undefined order items
  const fulfillment: any = { id: 'test-123', items: undefined, items_count: undefined };
  const safeItems = fulfillment.items || [];
  const count = fulfillment.items_count ?? (fulfillment.items || []).length ?? 0;
  assert.equal(count, 0);
  assert.equal(safeItems.length, 0);
  const mapped = safeItems.map((i: any) => i.name);
  assert.deepEqual(mapped, []);

  // Undefined saved addresses
  const addresses: any = undefined;
  const mappedAddresses = (addresses || []).map((a: any) => a.title);
  assert.deepEqual(mappedAddresses, []);

  // Undefined payment method
  const order: any = { payment_method: undefined, payment_status: undefined };
  const formattedPayment = (order.payment_method || 'COD').replace(/_/g, ' ');
  assert.equal(formattedPayment, 'COD');
});
