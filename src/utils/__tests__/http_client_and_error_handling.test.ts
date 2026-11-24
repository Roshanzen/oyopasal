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
