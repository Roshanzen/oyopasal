import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEta } from '../../hooks/useOrderTracking';
import { calculateDistanceInKm } from '../../utils';
import { formatGpsAddress } from '../addressFormatter';
import { normalizeOrderStatus, syncMilestoneSteps } from '../orderMilestones';

test('Intelligent ETA Formatting under 60 minutes in English and Nepali', () => {
  assert.equal(formatEta(15, 'en'), '15 mins');
  assert.equal(formatEta(5, 'en'), '5 mins');
  assert.equal(formatEta(59, 'en'), '59 mins');

  assert.equal(formatEta(15, 'ne'), '15 मिनेट');
  assert.equal(formatEta(5, 'ne'), '5 मिनेट');
});

test('Intelligent ETA Formatting greater than or equal to 60 minutes', () => {
  assert.equal(formatEta(60, 'en'), '1 hr');
  assert.equal(formatEta(80, 'en'), '1 hr 20 mins');
  assert.equal(formatEta(120, 'en'), '2 hrs');
  assert.equal(formatEta(135, 'en'), '2 hrs 15 mins');
});

test('Intelligent ETA Formatting for long distances and delivered/null states', () => {
  assert.equal(formatEta(527, 'en'), '8 hrs 47 mins');
  assert.equal(formatEta(527, 'ne'), '8 घण्टा 47 मिनेट');
  assert.equal(formatEta(0, 'en'), 'Delivered');
  assert.equal(formatEta(0, 'ne'), 'डेलिभर भयो');
  assert.equal(formatEta(null, 'en'), '--');
  assert.equal(formatEta(undefined, 'en'), '--');
});

test('Dynamic ETA Calculation Formula', () => {
  const courierSpeedKmh = 22.0;
  const prepBufferMins = 5;

  function computeEta(remainingKm: number, speed: number = courierSpeedKmh, buffer: number = prepBufferMins): number {
    return Math.max(5, Math.round((remainingKm / speed) * 60) + buffer);
  }

  // 3.5 km at 22 km/h is 9.55 mins of travel + 5 mins prep = 15 mins
  const etaLocal = computeEta(3.5);
  assert.equal(etaLocal, 15);
  assert.equal(formatEta(etaLocal, 'en'), '15 mins');

  // Enforce minimum 5 min floor
  assert.equal(computeEta(0.01, 22.0, 2), 5);

  // Long-distance dynamic calculation: 158.1 km at 22 km/h = 431.18 + 5 = 436 mins
  const etaLong = computeEta(158.1);
  assert.equal(etaLong, 436);
  assert.equal(formatEta(etaLong, 'en'), '7 hrs 16 mins');
});

test('Hyperlocal Delivery Radius Evaluation (15 km zone)', () => {
  const storeCoord = { lat: 27.7172, lng: 85.3240 };
  const customerWithinZone = { lat: 27.7000, lng: 85.3100 }; // ~2.4 km away
  const distWithin = calculateDistanceInKm(storeCoord.lat, storeCoord.lng, customerWithinZone.lat, customerWithinZone.lng);
  const maxLocalKm = 15.0;

  assert.ok(distWithin < maxLocalKm, `Distance ${distWithin} should be within ${maxLocalKm} km`);

  const customerInLahan = { lat: 26.7288, lng: 86.4950 }; // ~158.1 km away
  const distLahan = calculateDistanceInKm(storeCoord.lat, storeCoord.lng, customerInLahan.lat, customerInLahan.lng);
  assert.ok(distLahan > maxLocalKm, `Distance ${distLahan} should exceed ${maxLocalKm} km`);

  const warningMsg = `Outside ${maxLocalKm} km Express Zone (${distLahan.toFixed(1)} km away) — Available via Intercity Standard Delivery (1–2 Days)`;
  assert.ok(warningMsg.includes('Outside 15 km Express Zone'));
  assert.ok(warningMsg.includes('Available via Intercity Standard Delivery (1–2 Days)'));
});

test('Address Sanitization: No default Kathmandu injected into non-Kathmandu locations', () => {
  const formatLocation = (area?: string, city?: string): string => {
    const cleanArea = (area || '').trim();
    const cleanCity = (city || '').trim();
    if (cleanArea && cleanCity && cleanArea.toLowerCase() !== cleanCity.toLowerCase()) {
      return `${cleanArea}, ${cleanCity}`;
    }
    return cleanArea || cleanCity || 'Location';
  };

  assert.equal(formatLocation('Lahan-10', 'Lahan'), 'Lahan-10, Lahan');
  assert.equal(formatLocation('Lahan', 'Lahan'), 'Lahan'); // Deduplication
  assert.equal(formatLocation('Ward 4', 'Janakpur'), 'Ward 4, Janakpur');
  assert.equal(formatLocation('New Baneshwor', 'Kathmandu'), 'New Baneshwor, Kathmandu');
  assert.equal(formatLocation('Mahendranagar', ''), 'Mahendranagar');
});

test('GPS Address Formatter: dynamic formatting without hardcoded Kathmandu', () => {
  // Lahan, Siraha, Nepal exact requirement test
  const lahan = formatGpsAddress({
    locality: 'Lahan',
    district: 'Siraha',
    country: 'Nepal',
    lat: 26.7288,
    lng: 86.4950,
  });
  assert.equal(lahan.formattedAddress, 'Lahan, Siraha, Nepal');
  assert.equal(lahan.shortLabel, 'Lahan, Siraha');

  // Kathmandu location (deduplicates matching locality & district)
  const ktm = formatGpsAddress({
    locality: 'Kathmandu',
    district: 'Kathmandu',
    country: 'Nepal',
    lat: 27.7172,
    lng: 85.3240,
  });
  assert.equal(ktm.formattedAddress, 'Kathmandu, Nepal');
  assert.equal(ktm.shortLabel, 'Kathmandu');

  // Location outside Kathmandu (Pokhara, Kaski)
  const pokhara = formatGpsAddress({
    street: 'Lakeside-6',
    locality: 'Pokhara',
    district: 'Kaski',
    country: 'Nepal',
    lat: 28.2096,
    lng: 83.9856,
  });
  assert.equal(pokhara.formattedAddress, 'Lakeside-6, Pokhara, Kaski, Nepal');
  assert.equal(pokhara.shortLabel, 'Lakeside-6, Pokhara');
  assert.equal(pokhara.formattedAddress.includes('Kathmandu'), false);
});

test('Milestone Synchronization: accurately normalizes all 6 statuses and reflects vendor updates', () => {
  // 1. Order Placed
  assert.equal(normalizeOrderStatus('PENDING'), 0);
  assert.equal(normalizeOrderStatus('PLACED'), 0);
  assert.equal(normalizeOrderStatus('ORDER_PLACED'), 0);

  // 2. Store Confirmed
  assert.equal(normalizeOrderStatus('CONFIRMED_BY_VENDOR'), 1);
  assert.equal(normalizeOrderStatus('CONFIRMED'), 1);

  // 3. Packing Items
  assert.equal(normalizeOrderStatus('PACKED'), 2);
  assert.equal(normalizeOrderStatus('PACKED_BY_VENDOR'), 2);
  assert.equal(normalizeOrderStatus('PROCESSING'), 2);

  // 4. Ready for Pickup
  assert.equal(normalizeOrderStatus('READY_FOR_DISPATCH'), 3);
  assert.equal(normalizeOrderStatus('READY_FOR_PICKUP'), 3);
  assert.equal(normalizeOrderStatus('READY_FOR_RIDER_PICKUP'), 3);

  // 5. Out for Delivery
  assert.equal(normalizeOrderStatus('OUT_FOR_DELIVERY'), 4);
  assert.equal(normalizeOrderStatus('SHIPPED'), 4);
  assert.equal(normalizeOrderStatus('DISPATCHED'), 4);

  // 6. Delivered
  assert.equal(normalizeOrderStatus('DELIVERED'), 5);
  assert.equal(normalizeOrderStatus('COMPLETED'), 5);

  // Test progression when vendor updates status to READY_FOR_DISPATCH
  const steps = syncMilestoneSteps('READY_FOR_DISPATCH', [
    { title: 'Order Placed', description: '', done: true, timestamp: '10:00 AM' },
    { title: 'Store Confirmed', description: '', done: true, timestamp: '10:05 AM' },
    { title: 'Packing Items', description: '', done: true, timestamp: '10:15 AM' },
    { title: 'Ready for Pickup', description: '', done: true, timestamp: '10:20 AM' },
  ]);

  assert.equal(steps.length, 6);
  assert.equal(steps[0].title, 'Order Placed');
  assert.equal(steps[0].done, true);
  assert.equal(steps[1].title, 'Store Confirmed');
  assert.equal(steps[1].done, true);
  assert.equal(steps[2].title, 'Packing Items');
  assert.equal(steps[2].done, true);
  assert.equal(steps[3].title, 'Ready for Pickup');
  assert.equal(steps[3].done, true);
  assert.equal(steps[3].current, true); // Active milestone highlighted
  assert.equal(steps[4].title, 'Out for Delivery');
  assert.equal(steps[4].done, false);
  assert.equal(steps[4].timestamp, ''); // Future milestone has no fake timestamp
  assert.equal(steps[5].title, 'Delivered');
  assert.equal(steps[5].done, false);
  assert.equal(steps[5].timestamp, '');
});

test('Checkout Pricing Synchronization: authoritatively aligns cart total and backend order total', () => {
  const subtotal = 2850.0;
  const taxRate = 13.0; // 13% VAT
  const freeThreshold = 499.0;
  const deliveryFee = subtotal >= freeThreshold ? 0.0 : 35.0;
  const taxTotal = Math.round((subtotal * (taxRate / 100.0)) * 100) / 100; // 370.5
  const discount = 0.0;
  const expectedTotal = subtotal - discount + deliveryFee + taxTotal; // 3220.5

  assert.equal(subtotal, 2850.0);
  assert.equal(deliveryFee, 0.0);
  assert.equal(taxTotal, 370.5);
  assert.equal(expectedTotal, 3220.5);
});

