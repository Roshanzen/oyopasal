export interface GpsAddressParts {
  street?: string;
  locality?: string;
  area?: string;
  municipality?: string;
  city?: string;
  district?: string;
  province?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

/**
 * Formats GPS location into a clean, dynamic address string without hardcoding Kathmandu.
 * Example:
 * - Locality: Lahan, District: Siraha, Country: Nepal -> "Lahan, Siraha, Nepal"
 * - Locality: New Baneshwor, District: Kathmandu, Country: Nepal -> "New Baneshwor, Kathmandu, Nepal"
 * Handles missing city or district values gracefully and avoids duplicate city/district names.
 */
export function formatGpsAddress(parts: GpsAddressParts): { formattedAddress: string; shortLabel: string } {
  const street = (parts.street || '').trim();
  const loc = (parts.locality || parts.municipality || parts.area || parts.city || '').trim();
  const dist = (parts.district || '').trim();
  const country = (parts.country || 'Nepal').trim();

  const tokens: string[] = [];
  const seenLower = new Set<string>();

  const addToken = (t?: string) => {
    if (!t) return;
    const lower = t.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      tokens.push(t);
    }
  };

  if (street) addToken(street);
  if (loc) addToken(loc);
  if (dist) addToken(dist);
  if (country) addToken(country);

  let formattedAddress = tokens.join(', ');
  if (!formattedAddress) {
    if (Number.isFinite(parts.lat) && Number.isFinite(parts.lng)) {
      formattedAddress = `Location (${parts.lat!.toFixed(4)}, ${parts.lng!.toFixed(4)})`;
    } else {
      formattedAddress = 'Selected Location';
    }
  }

  // Build short label without token duplication
  let shortLabel = '';
  if (street && loc && street.toLowerCase() !== loc.toLowerCase()) {
    shortLabel = `${street}, ${loc}`;
  } else if (loc && dist && loc.toLowerCase() !== dist.toLowerCase()) {
    shortLabel = `${loc}, ${dist}`;
  } else if (loc) {
    shortLabel = loc;
  } else if (dist) {
    shortLabel = dist;
  } else if (street) {
    shortLabel = street;
  } else {
    shortLabel = formattedAddress;
  }

  return { formattedAddress, shortLabel };
}
