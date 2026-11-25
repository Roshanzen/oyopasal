export function calculateDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

  /**
   * Calculates realistic delivery time based on geographic distance, road conditions, and order prep time.
   * - Intra-city (0 - 12 km): Bike/scooter in city traffic (~22 km/h) -> 10 to 45 mins.
   * - Sub-urban (12 - 40 km): Express transit (~30 km/h) -> 1 to 2 hrs.
   * - Long distance / Inter-city (40+ km, e.g. 158 km): Highway courier transit in Nepal (~32 km/h + handling) -> 5 to 6 hrs.
   */
  export function calculateDeliveryEstimate(
    distanceKm: number,
    basePrepMins = 10,
    lang: 'en' | 'ne' = 'en'
  ): {
    estimatedMinutes: number;
    etaText: string;
  } {
    const dist = Math.max(0.1, distanceKm);
    let totalMinutes = 0;

    if (dist <= 12) {
      // City / Hyperlocal delivery (approx 22 km/h = 2.7 mins/km)
      totalMinutes = Math.round(basePrepMins + dist * 2.7);
    } else if (dist <= 40) {
      // Suburban / Ring Road / Valley outskirts (approx 30 km/h = 2 mins/km)
      totalMinutes = Math.round(basePrepMins + 12 * 2.7 + (dist - 12) * 2.0);
    } else {
      // Inter-city / Highway distance in Nepal (approx 32 km/h highway speed + 45m hub handling)
      const highwayMins = (dist / 32) * 60;
      totalMinutes = Math.round(basePrepMins + 45 + highwayMins);
    }

    const minsUnit = lang === 'ne' ? 'मिनेट' : 'mins';
    const hrsUnit = lang === 'ne' ? 'घण्टा' : 'hrs';
    const daysUnit = lang === 'ne' ? 'दिन' : 'days';

    let etaText = '';
    if (totalMinutes < 60) {
      const low = Math.max(10, totalMinutes - 2);
      const high = totalMinutes + 3;
      etaText = `${low}-${high} ${minsUnit}`;
    } else if (totalMinutes < 1440) {
      const lowHours = Math.floor(totalMinutes / 60);
      const highHours = Math.ceil(totalMinutes / 60);
      if (lowHours === highHours) {
        etaText = `~${lowHours} ${hrsUnit}`;
      } else {
        etaText = `${lowHours}-${highHours} ${hrsUnit}`;
      }
    } else {
      const days = Math.round(totalMinutes / 1440);
      etaText = `${days}-${days + 1} ${daysUnit}`;
    }

    return { estimatedMinutes: totalMinutes, etaText };
  }

export function estimateDeliveryMinutes(distanceKm: number, baseMins = 10): number {
  return calculateDeliveryEstimate(distanceKm, baseMins).estimatedMinutes;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Validates whether a value is a valid, finite numeric coordinate.
 */
export function isValidCoordinate(val: unknown): val is number {
  if (typeof val === 'number') {
    return !Number.isNaN(val) && Number.isFinite(val);
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = parseFloat(val);
    return !Number.isNaN(parsed) && Number.isFinite(parsed);
  }
  return false;
}

/**
 * Normalizes coordinate objects from either {lat, lng} or {latitude, longitude},
 * handling strings, numbers, nulls, undefined, and empty values safely.
 */
export function extractCoordinates(obj: unknown): Coordinates | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const rawLat = o.lat ?? o.latitude;
  const rawLng = o.lng ?? o.longitude;

  if (rawLat == null || rawLng == null || rawLat === '' || rawLng === '') {
    return null;
  }

  const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
  const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

  if (!Number.isNaN(lat) && !Number.isNaN(lng) && Number.isFinite(lat) && Number.isFinite(lng)) {
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Safely formats coordinates to N decimal places without crashing on null/undefined.
 * Returns "Coordinates unavailable" fallback when coordinates are missing.
 */
export function formatCoordinates(coords: unknown, digits = 4): string {
  const extracted = extractCoordinates(coords);
  if (!extracted) {
    return 'Coordinates unavailable';
  }
  return `${extracted.lat.toFixed(digits)}, ${extracted.lng.toFixed(digits)}`;
}

