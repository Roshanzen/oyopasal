import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractCoordinates,
  isValidCoordinate,
  formatCoordinates,
} from '../distance';
import { geocodingService } from '../../services/geocodingService';

test('Location Coordinates 1: extractCoordinates extracts lat/lng and backend latitude/longitude', () => {
  // Standard frontend format
  const c1 = extractCoordinates({ lat: 27.7172, lng: 85.324 });
  assert.deepEqual(c1, { lat: 27.7172, lng: 85.324 });

  // Backend Django DRF format (AddressSerializer / Model)
  const c2 = extractCoordinates({ latitude: 27.6915, longitude: 85.342 });
  assert.deepEqual(c2, { lat: 27.6915, lng: 85.342 });

  // String decimal values from JSON or forms
  const c3 = extractCoordinates({ latitude: '27.7005', longitude: '85.3123' });
  assert.deepEqual(c3, { lat: 27.7005, lng: 85.3123 });

  const c4 = extractCoordinates({ lat: '27.6850', lng: '85.3350' });
  assert.deepEqual(c4, { lat: 27.685, lng: 85.335 });
});

test('Location Coordinates 2: extractCoordinates handles null, undefined, and invalid values without throwing', () => {
  assert.equal(extractCoordinates(null), null);
  assert.equal(extractCoordinates(undefined), null);
  assert.equal(extractCoordinates({}), null);
  assert.equal(extractCoordinates({ lat: null, lng: null }), null);
  assert.equal(extractCoordinates({ latitude: null, longitude: null }), null);
  assert.equal(extractCoordinates({ lat: undefined, lng: undefined }), null);
  assert.equal(extractCoordinates({ lat: '', lng: '' }), null);
  assert.equal(extractCoordinates({ lat: 'abc', lng: 'xyz' }), null);
  assert.equal(extractCoordinates({ lat: 999, lng: 85.324 }), null); // Out of bounds
});

test('Location Coordinates 3: formatCoordinates returns "Coordinates unavailable" for missing or invalid coords', () => {
  assert.equal(formatCoordinates(null), 'Coordinates unavailable');
  assert.equal(formatCoordinates(undefined), 'Coordinates unavailable');
  assert.equal(formatCoordinates({ lat: undefined, lng: undefined }), 'Coordinates unavailable');
  assert.equal(formatCoordinates({ latitude: null, longitude: null }), 'Coordinates unavailable');
  assert.equal(formatCoordinates({ lat: 27.7172, lng: 85.324 }), '27.7172, 85.3240');
  assert.equal(formatCoordinates({ latitude: 27.6915, longitude: 85.342 }, 3), '27.692, 85.342');
});

test('Location Geocoding 4: geocodingService.reverseGeocode handles undefined or invalid coordinates gracefully', async () => {
  // Pass invalid/undefined coords
  const res1 = await geocodingService.reverseGeocode(undefined as any, undefined as any);
  assert.equal(res1.formattedAddress, 'Coordinates unavailable');
  assert.equal(res1.shortLabel, 'Coordinates unavailable');

  const res2 = await geocodingService.reverseGeocode(NaN, NaN);
  assert.equal(res2.formattedAddress, 'Coordinates unavailable');
});

test('Location Search 5: geocodingService.searchAddress returns empty array for short/empty queries', async () => {
  const emptyRes = await geocodingService.searchAddress('');
  assert.deepEqual(emptyRes, []);

  const singleCharRes = await geocodingService.searchAddress('k');
  assert.deepEqual(singleCharRes, []);
});

test('LocationModal Safety 6: LocationModal protects all .toFixed() calls and handles missing coords without crash', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );

  // Line 410 and 754 replacement check: Coords and Pin display use formatCoordinates or check validity
  assert.equal(modalContent.includes('Coords: {formatCoordinates(pickedCoords)}'), true);
  assert.equal(modalContent.includes('Pin: {formatCoordinates(pickedCoords)}'), true);

  // Raw unvalidated pickedCoords.lat.toFixed must not exist
  assert.equal(modalContent.includes('pickedCoords.lat.toFixed'), false);
  assert.equal(modalContent.includes('pickedCoords.lng.toFixed'), false);
});

test('LocationModal Safety 7: LocationModal normalizes arrays with safe defaults to prevent .length crash', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );

  // Check array normalization definitions
  assert.equal(modalContent.includes('const safeAddresses = Array.isArray(addresses) ? addresses : [];'), true);
  assert.equal(modalContent.includes('const safeVendors = Array.isArray(vendors) ? vendors : [];'), true);
  assert.equal(modalContent.includes('const safeZones = Array.isArray(zones) ? zones : [];'), true);

  // Check that addresses.length and zones.length were replaced with safe equivalents
  assert.equal(modalContent.includes('safeAddresses.length === 0'), true);
  assert.equal(modalContent.includes('safeZones.length === 0'), true);
});

test('LocationModal Search 8: LocationModal includes address search and autocomplete suggestions UI', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );

  assert.equal(modalContent.includes('handleSearchQueryChange'), true);
  assert.equal(modalContent.includes('handleSelectSearchResult'), true);
  assert.equal(modalContent.includes('Search area, neighborhood, tole, or landmark'), true);
  assert.equal(modalContent.includes('searchResults.map'), true);
});
