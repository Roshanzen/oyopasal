import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceInKm,
  estimateDeliveryMinutes,
} from '../distance';
import {
  formatCompactCurrency,
  formatPrice,
  toNepaliDigits,
} from '../priceFormatter';
import { formatOrderDate, formatTimeShort } from '../dateFormatter';
import {
  validatePassword,
  validatePhoneOrEmail,
  validateRequired,
} from '../validation';

test('toNepaliDigits converts ASCII numerals into Devanagari digits', () => {
  assert.equal(toNepaliDigits('2026-11-17'), '२०२६-११-१७');
  assert.equal(toNepaliDigits(98410), '९८४१०');
});

test('formatPrice formats English and Nepali currency cleanly', () => {
  assert.equal(formatPrice(1250, 'en'), 'Rs. 1,250');
  assert.equal(formatPrice('499', 'ne'), 'रु. ४९९');
  assert.equal(formatPrice('not-a-number', 'en'), 'Rs. 0');
});

test('formatCompactCurrency compacts thousands and lakhs', () => {
  assert.equal(formatCompactCurrency(850, 'en'), 'Rs. 850');
  assert.equal(formatCompactCurrency(2500, 'en'), 'Rs. 2.5k');
  assert.equal(formatCompactCurrency(150000, 'ne'), 'रु. 1.5L');
});

test('calculateDistanceInKm and estimateDeliveryMinutes return bounded Haversine values', () => {
  assert.equal(calculateDistanceInKm(27.7172, 85.324, 27.7172, 85.324), 0);
  const km = calculateDistanceInKm(27.7172, 85.324, 27.6766, 85.317);
  assert.ok(km > 4 && km < 5.5, `Expected ~4.5km, got ${km}`);

  assert.equal(estimateDeliveryMinutes(0), 12);
  assert.equal(estimateDeliveryMinutes(50), 30);
});

test('formatOrderDate and formatTimeShort handle empty and invalid inputs gracefully', () => {
  assert.equal(formatOrderDate(null), '—');
  assert.equal(formatOrderDate('invalid-date'), 'invalid-date');
  const formatted = formatOrderDate('2026-05-10T10:30:00Z', 'en-US');
  assert.ok(formatted.includes('2026'));

  assert.equal(formatTimeShort(undefined), '');
  assert.equal(formatTimeShort('bad'), 'bad');
  assert.ok(formatTimeShort('2026-05-10T10:30:00Z').length > 0);
});

test('validation helpers verify required fields, password lengths, and phone/email formats', () => {
  assert.equal(validateRequired('  ', 'Store name'), 'Store name is required.');
  assert.equal(validateRequired('OyoPasal', 'Store name'), null);

  assert.equal(validatePassword('123', 6), 'Password must be at least 6 characters.');
  assert.equal(validatePassword('secret12', 6), null);

  assert.equal(validatePhoneOrEmail(''), 'Phone number or email is required.');
  assert.equal(validatePhoneOrEmail('bad@email'), 'Please enter a valid email address.');
  assert.equal(validatePhoneOrEmail('buyer@oyopasal.np'), null);
  assert.equal(validatePhoneOrEmail('12345'), 'Please enter a valid phone number or email address.');
  assert.equal(validatePhoneOrEmail('+977 9841234567'), null);
});
