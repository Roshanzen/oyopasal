export interface GeocodedAddress {
  formattedAddress: string;
  street: string;
  area: string;
  city: string;
  district: string;
  province: string;
  postalCode: string;
  country: string;
  shortLabel: string;
  lat: number;
  lng: number;
}

export interface GeocodedSearchResult {
  id: string;
  formattedAddress: string;
  name: string;
  street: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
}

// In-memory LRU-like cache for coordinate lookups (keyed by 4 decimal places ~11 meters precision)
const geocodeCache = new Map<string, { data: GeocodedAddress; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1050; // Nominatim strictly requires <= 1 request/second

function coordKey(lat: number, lng: number): string {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'invalid_coord';
  }
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export const geocodingService = {
  /**
   * Reverse-geocodes coordinates into human-readable Nepal/international address details
   * using OpenStreetMap Nominatim.
   */
  async reverseGeocode(
    lat: number,
    lng: number,
    options?: { signal?: AbortSignal }
  ): Promise<GeocodedAddress> {
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return {
        formattedAddress: 'Coordinates unavailable',
        street: '',
        area: '',
        city: '',
        district: '',
        province: '',
        postalCode: '',
        country: 'Nepal',
        shortLabel: 'Coordinates unavailable',
        lat: 0,
        lng: 0,
      };
    }

    const key = coordKey(lat, lng);
    const cached = geocodeCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Rate-limiting throttle to respect OSM usage policy (1 request/sec)
    const now = Date.now();
    const waitTime = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - lastRequestTime));
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en,ne;q=0.9',
        },
        signal: options?.signal,
      });

      if (!res.ok) {
        throw new Error(`Reverse geocoding failed with status: ${res.status}`);
      }

      const json = await res.json();
      const addr = json.address || {};

      const street =
        addr.road ||
        addr.pedestrian ||
        addr.street ||
        addr.footway ||
        addr.path ||
        addr.residential ||
        '';

      const area =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.city_district ||
        addr.village ||
        addr.hamlet ||
        addr.residential ||
        '';

      const city =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.county ||
        addr.state_district ||
        '';

      const district =
        addr.county ||
        addr.district ||
        addr.state_district ||
        city;

      const province = addr.state || '';
      const postalCode = addr.postcode || '';
      const country = addr.country || 'Nepal';

      // Build short readable label without duplicating tokens
      let shortLabel = '';
      const cleanArea = (area || '').trim();
      const cleanCity = (city || '').trim();
      if (cleanArea && cleanCity && cleanArea.toLowerCase() !== cleanCity.toLowerCase()) {
        shortLabel = `${cleanArea}, ${cleanCity}`;
      } else if (cleanArea) {
        shortLabel = cleanArea;
      } else if (cleanCity) {
        shortLabel = cleanCity;
      } else if (street) {
        shortLabel = street;
      } else {
        shortLabel = Number.isFinite(lat) && Number.isFinite(lng)
          ? `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
          : 'Selected Location';
      }

      const result: GeocodedAddress = {
        formattedAddress: json.display_name || shortLabel,
        street,
        area: area || street || city || '',
        city,
        district,
        province,
        postalCode,
        country,
        shortLabel,
        lat,
        lng,
      };

      // Keep cache size bounded
      if (geocodeCache.size > 200) {
        const firstKey = geocodeCache.keys().next().value;
        if (firstKey) geocodeCache.delete(firstKey);
      }
      geocodeCache.set(key, { data: result, timestamp: Date.now() });

      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      // On network failure or rate limit, generate a structured fallback
      const fallbackCoords = Number.isFinite(lat) && Number.isFinite(lng)
        ? `(${lat.toFixed(4)}, ${lng.toFixed(4)})`
        : 'Selected Location';
      const fallback: GeocodedAddress = {
        formattedAddress: `Location ${fallbackCoords}`,
        street: '',
        area: '',
        city: '',
        district: '',
        province: '',
        postalCode: '',
        country: 'Nepal',
        shortLabel: fallbackCoords,
        lat: Number.isFinite(lat) ? lat : 0,
        lng: Number.isFinite(lng) ? lng : 0,
      };
      return fallback;
    }
  },

  /**
   * Search for addresses, neighborhoods, chowks, and landmarks in Nepal.
   * Returns a normalized array of suggestions with coordinates.
   */
  async searchAddress(
    query: string,
    options?: { signal?: AbortSignal }
  ): Promise<GeocodedSearchResult[]> {
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=np&addressdetails=1&limit=5`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en,ne;q=0.9',
        },
        signal: options?.signal,
      });

      if (!res.ok) {
        return [];
      }

      const json = await res.json();
      const list = Array.isArray(json) ? json : (Array.isArray(json?.results) ? json.results : []);

      return list
        .map((item: any, idx: number) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon ?? item.lng);
          if (Number.isNaN(lat) || !Number.isFinite(lat) || Number.isNaN(lng) || !Number.isFinite(lng)) {
            return null;
          }
          const addr = item.address || {};
          const street = addr.road || addr.street || addr.residential || '';
          const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.hamlet || '';
          const city = addr.city || addr.town || addr.municipality || addr.county || 'Kathmandu';
          const name = item.name || item.display_name?.split(',')[0] || street || area || 'Location';

          return {
            id: String(item.place_id || `search-${idx}-${Date.now()}`),
            formattedAddress: item.display_name || `${name}, ${city}`,
            name,
            street,
            area,
            city,
            lat,
            lng,
          };
        })
        .filter(Boolean) as GeocodedSearchResult[];
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      return [];
    }
  },

  /**
   * Attribution string required by OpenStreetMap
   */
  attribution: '© OpenStreetMap contributors',
};
