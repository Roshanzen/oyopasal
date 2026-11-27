import { ENVIRONMENT } from '../config/environment';

/**
 * Extracts a candidate URL string from a string or object.
 * Returns null if the value is null, undefined, empty, or whitespace.
 */
function extractUrlCandidate(val: unknown): string | null {
  if (val == null) return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const candidates = [
      obj.url,
      obj.src,
      obj.file,
      obj.path,
      obj.image_url,
      obj.imageUrl,
      obj.image,
      obj.cover_image,
      obj.coverImage,
      obj.original,
      obj.thumbnail,
      obj.href,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) return trimmed;
      }
    }
  }

  return null;
}

/**
 * Determines the backend host base URL (if any is configured with a protocol/host).
 */
export function getBackendBaseUrl(): string {
  const apiUrl = ENVIRONMENT.API_BASE_URL || '/api/v1';
  if (typeof apiUrl === 'string' && (apiUrl.startsWith('http://') || apiUrl.startsWith('https://'))) {
    try {
      const url = new URL(apiUrl);
      return url.origin;
    } catch {
      // ignore parsing error
    }
  }
  return '';
}

/**
 * Resolves a category's background image URL according to the specified priority:
 * 1. category.image_url
 * 2. category.imageUrl
 * 3. category.image
 *
 * Features:
 * - Supports DRF snake_case, camelCase, and object representations.
 * - Handles null, undefined, and empty/whitespace string values gracefully.
 * - Resolves relative media paths (/media/..., media/..., /uploads/...).
 * - Preserves external image CDNs (Unsplash, ImageKit, Cloudinary).
 * - Returns null when no valid image is configured.
 */
export function resolveCategoryImageUrl(category: any): string | null {
  if (!category || typeof category !== 'object') {
    return null;
  }

  // Priority chain: category.image_url || category.imageUrl || category.image || category.cover_image
  let candidate = extractUrlCandidate(category.image_url);
  if (!candidate) {
    candidate = extractUrlCandidate(category.imageUrl);
  }
  if (!candidate) {
    candidate = extractUrlCandidate(category.image);
  }
  if (!candidate) {
    candidate = extractUrlCandidate(category.cover_image);
  }
  if (!candidate) {
    candidate = extractUrlCandidate(category.coverImage);
  }

  if (!candidate) {
    return null;
  }

  // Handle protocol-relative URLs
  if (candidate.startsWith('//')) {
    return `https:${candidate}`;
  }

  // Direct absolute URLs or base64/blob
  if (
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('data:') ||
    candidate.startsWith('blob:')
  ) {
    return candidate;
  }

  // Handle relative media/upload paths
  const backendBase = getBackendBaseUrl();
  let normalizedPath = candidate;
  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  // If backend base URL is configured with an origin, prepend it
  if (backendBase) {
    return `${backendBase}${normalizedPath}`;
  }

  return normalizedPath;
}
