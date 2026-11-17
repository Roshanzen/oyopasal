import { ApiError } from './errors.ts';

/**
 * Parses a strictly positive integer ID from route params or request payloads.
 * Throws a 400 ApiError instead of allowing NaN to reach Drizzle/PostgreSQL.
 */
export function parseNumericId(
  raw: unknown,
  label = 'id',
  code = 'INVALID_ID',
  stripPrefix?: RegExp
): number {
  const str = String(raw ?? '').trim();
  const normalized = stripPrefix ? str.replace(stripPrefix, '') : str;
  if (!/^\d+$/.test(normalized)) {
    throw new ApiError(400, `Invalid ${label}.`, code);
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, `Invalid ${label}.`, code);
  }
  return parsed;
}

/**
 * Parses a finite positive integer (> 0), throwing 400 on invalid or non-positive numbers.
 */
export function parsePositiveInt(
  raw: unknown,
  label = 'value',
  code = 'INVALID_NUMBER'
): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    throw new ApiError(400, `${label} must be a positive number.`, code);
  }
  return Math.round(num);
}

/**
 * Parses a finite non-negative integer (>= 0), throwing 400 on invalid or negative numbers.
 */
export function parseNonNegativeInt(
  raw: unknown,
  label = 'value',
  code = 'INVALID_NUMBER'
): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, `${label} must be zero or greater.`, code);
  }
  return Math.round(num);
}

/**
 * Validates an enum string against an explicit allowlist.
 */
export function assertEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  label = 'value',
  code = 'INVALID_VALUE'
): T {
  const value = String(raw ?? '').trim();
  if (!allowed.includes(value as T)) {
    throw new ApiError(
      400,
      `Invalid ${label}. Allowed: ${allowed.join(', ')}`,
      code
    );
  }
  return value as T;
}

/**
 * Parses an optional ISO date value. Returns undefined if omitted, null if empty/null,
 * or throws a 400 ApiError if malformed.
 */
export function parseOptionalDate(
  raw: unknown,
  label = 'date'
): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `Invalid ${label} format.`, 'INVALID_DATE');
  }
  return parsed;
}
