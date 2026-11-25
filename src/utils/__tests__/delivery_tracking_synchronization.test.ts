import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEta } from '../../hooks/useOrderTracking';
import { calculateDistanceInKm } from '../../utils';

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
