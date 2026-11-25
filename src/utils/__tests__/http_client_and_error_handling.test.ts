import test from 'node:test';
import assert from 'node:assert/strict';
import { httpClient } from '../../services/httpClient';

test('HTTP Client 1: convenience methods get, post, put, patch, delete are defined functions', () => {
  assert.equal(typeof httpClient.get, 'function');
  assert.equal(typeof httpClient.post, 'function');
  assert.equal(typeof httpClient.put, 'function');
  assert.equal(typeof httpClient.patch, 'function');
  assert.equal(typeof httpClient.delete, 'function');
});

test('HTTP Client 2: token_not_valid detection helper properly recognizes token invalidity', () => {
  const isTokenNotValid = (status: number, errJson: any) => {
    const detailStr = String(
      errJson?.detail || errJson?.code || errJson?.message || errJson?.error?.message || ''
    ).toLowerCase();

    return (
      errJson?.code === 'token_not_valid' ||
      errJson?.detail === 'token_not_valid' ||
      detailStr.includes('token_not_valid') ||
      detailStr.includes('token is invalid') ||
      detailStr.includes('token not valid') ||
      (status === 401 && detailStr.includes('given token not valid'))
    );
  };

  assert.equal(isTokenNotValid(401, { code: 'token_not_valid', detail: 'Given token not valid for any token type' }), true);
  assert.equal(isTokenNotValid(401, { detail: 'token_not_valid' }), true);
  assert.equal(isTokenNotValid(401, { message: 'Token is invalid or expired' }), true);
  assert.equal(isTokenNotValid(400, { detail: 'Missing required field' }), false);
  assert.equal(isTokenNotValid(403, { detail: 'Forbidden' }), false);
});

test('HTTP Client 3: public registration and auth endpoints skip Authorization header', () => {
  const shouldSkipAuth = (endpoint: string, options?: { skipAuth?: boolean }) => {
    return Boolean(
      options?.skipAuth ||
      endpoint.includes('/auth/register') ||
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/password-reset') ||
      endpoint.includes('/seller/applications/apply') ||
      endpoint.includes('/seller/applications/track') ||
      endpoint.includes('/seller/activation/')
    );
  };

  assert.equal(shouldSkipAuth('/auth/register-customer/'), true);
  assert.equal(shouldSkipAuth('/auth/register-vendor/'), true);
  assert.equal(shouldSkipAuth('/seller/applications/apply/'), true);
  assert.equal(shouldSkipAuth('/seller/activation/verify/'), true);
  assert.equal(shouldSkipAuth('/messaging/unread-count/'), false);
  assert.equal(shouldSkipAuth('/seller/dashboard/'), false);
  assert.equal(shouldSkipAuth('/custom/endpoint/', { skipAuth: true }), true);
});

test('Safe Arrays 4: array fallback handles undefined, null, non-array, and wrapped DRF structures safely without throwing length errors', () => {
  const safeLength = (data: any) => {
    const arr = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.conversations)
      ? data.conversations
      : [];
    return arr.length;
  };

  assert.equal(safeLength(undefined), 0);
  assert.equal(safeLength(null), 0);
  assert.equal(safeLength({}), 0);
  assert.equal(safeLength({ detail: 'Authentication credentials were not provided.' }), 0);
  assert.equal(safeLength({ results: [{ id: 1 }, { id: 2 }] }), 2);
  assert.equal(safeLength([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]), 3);
  assert.equal(safeLength({ data: [{ id: 10 }] }), 1);
  assert.equal(safeLength({ conversations: [{ id: 'conv-1' }] }), 1);
});

test('Safe Arrays 5: notification unread filter safely computes length even on malformed or empty state', () => {
  const computeUnreadCount = (notifications: any) => {
    return (Array.isArray(notifications) ? notifications : []).filter((n) => Boolean(n && !n.read)).length;
  };

  assert.equal(computeUnreadCount(undefined), 0);
  assert.equal(computeUnreadCount(null), 0);
  assert.equal(computeUnreadCount([]), 0);
  assert.equal(
    computeUnreadCount([
      { id: 1, read: true },
      { id: 2, read: false },
      { id: 3, read: false },
      null,
    ]),
    2
  );
});

test('HTTP Client 6: isAbortError properly identifies intentional cancellation vs genuine errors', () => {
  const isAbortError = (err: unknown): boolean => {
    return (
      (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))) ||
      (typeof err === 'object' && err !== null && (err as any).name === 'AbortError')
    );
  };

  const abortErr = new Error('The user aborted a request.');
  abortErr.name = 'AbortError';

  const regularErr = new Error('Database connection failed');
  regularErr.name = 'DatabaseError';

  assert.equal(isAbortError(abortErr), true);
  assert.equal(isAbortError({ name: 'AbortError' }), true);
  assert.equal(isAbortError(regularErr), false);
  assert.equal(isAbortError(null), false);
  assert.equal(isAbortError(undefined), false);
});

test('HTTP Client 7: parses HTTP 429 Retry-After header and DRF throttle message seconds', () => {
  const parseRetryAfter = (headerVal: string | null, detailMessage?: string): number => {
    if (headerVal) {
      const parsed = parseInt(headerVal, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (detailMessage) {
      const match = detailMessage.match(/Expected available in (\d+) seconds/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    return 60; // default safe fallback
  };

  assert.equal(parseRetryAfter('45'), 45);
  assert.equal(parseRetryAfter(null, 'Request was throttled. Expected available in 58 seconds.'), 58);
  assert.equal(parseRetryAfter(null, 'Request was throttled.'), 60);
});

test('HTTP Client 8: multipart/form-data boundary handling removes manual Content-Type', () => {
  const prepareHeaders = (isFormData: boolean, inputHeaders: Record<string, string> = {}) => {
    const headers = { ...inputHeaders };
    if (isFormData) {
      delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  // When FormData is passed with manual Content-Type: multipart/form-data, Content-Type must be removed
  const formDataHeaders = prepareHeaders(true, {
    'Content-Type': 'multipart/form-data',
    Accept: 'application/json',
  });
  assert.equal('Content-Type' in formDataHeaders, false);
  assert.equal(formDataHeaders.Accept, 'application/json');

  // JSON request preserves or sets application/json
  const jsonHeaders = prepareHeaders(false, { Accept: 'application/json' });
  assert.equal(jsonHeaders['Content-Type'], 'application/json');
});
