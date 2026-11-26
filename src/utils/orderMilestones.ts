import { TrackingStep } from '../types';

export const CANONICAL_MILESTONE_DEFINITIONS = [
  { key: 'ORDER_PLACED', title: 'Order Placed', description: 'Your order was successfully placed and recorded in OyoPasal.' },
  { key: 'CONFIRMED', title: 'Store Confirmed', description: 'Vendor verified inventory and accepted your order.' },
  { key: 'PACKING', title: 'Packing Items', description: 'Fresh goods are being gathered and carefully packaged.' },
  { key: 'READY_FOR_PICKUP', title: 'Ready for Pickup', description: 'Bag sealed with tamper-proof tag, assigned to rider.' },
  { key: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', description: 'Rider has picked up package and is en route to you.' },
  { key: 'DELIVERED', title: 'Delivered', description: 'Order handed over successfully at your doorstep.' },
] as const;

/**
 * Normalizes any order or sub-order status string to milestone sequence index (0 to 5):
 * 1. Order Placed (0): PENDING / PLACED / ORDER_PLACED
 * 2. Store Confirmed (1): CONFIRMED_BY_VENDOR / CONFIRMED
 * 3. Packing Items (2): PACKED / PACKED_BY_VENDOR / PROCESSING
 * 4. Ready for Pickup (3): READY_FOR_DISPATCH / READY_FOR_PICKUP / READY_FOR_RIDER_PICKUP
 * 5. Out for Delivery (4): OUT_FOR_DELIVERY / SHIPPED / DISPATCHED
 * 6. Delivered (5): DELIVERED / COMPLETED
 */
export function normalizeOrderStatus(rawStatus?: string): number {
  if (!rawStatus) return 0;
  const s = String(rawStatus).trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (s === 'DELIVERED' || s === 'COMPLETED') return 5;
  if (s === 'OUT_FOR_DELIVERY' || s === 'SHIPPED' || s === 'DISPATCHED') return 4;
  if (s === 'READY_FOR_DISPATCH' || s === 'READY_FOR_PICKUP' || s === 'READY_FOR_RIDER_PICKUP') return 3;
  if (s === 'PACKED' || s === 'PACKED_BY_VENDOR' || s === 'PROCESSING') return 2;
  if (s === 'CONFIRMED' || s === 'CONFIRMED_BY_VENDOR') return 1;
  return 0; // PENDING, PLACED, ORDER_PLACED, PENDING_PAYMENT
}

/**
 * Synchronizes milestone sequence with actual backend dispatch status, ensuring:
 * - All completed milestones and previous milestones are green (done = true)
 * - The current milestone is visually highlighted (current = true)
 * - Actual backend timestamps are preserved without generating fake future timestamps
 */
export function syncMilestoneSteps(
  rawStatus?: string,
  existingSteps?: TrackingStep[],
  fallbackCreatedAt?: string
): TrackingStep[] {
  const activeIdx = normalizeOrderStatus(rawStatus);
  const timeMap = new Map<number, string>();

  if (fallbackCreatedAt) {
    try {
      timeMap.set(0, new Date(fallbackCreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      timeMap.set(0, fallbackCreatedAt);
    }
  }

  (existingSteps || []).forEach((step, idx) => {
    if (step.timestamp && step.done) {
      timeMap.set(idx, step.timestamp);
    }
  });

  return CANONICAL_MILESTONE_DEFINITIONS.map((def, idx) => {
    const isDone = idx <= activeIdx;
    const isCurrent = idx === activeIdx;
    const existing = existingSteps?.[idx];
    const ts = isDone ? (timeMap.get(idx) || existing?.timestamp || '') : '';

    return {
      title: def.title,
      description: existing?.description || def.description,
      done: isDone,
      current: isCurrent,
      timestamp: ts,
    };
  });
}
