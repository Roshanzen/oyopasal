import crypto from 'crypto';
import { ENV } from '../config/env.ts';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function generateSessionToken(): string {
  return `op_sess_${crypto.randomBytes(32).toString('hex')}`;
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', ENV.SESSION_SECRET).update(token).digest('hex');
}

export function signGatewayPayload(payload: Record<string, string | number>, secret: string): string {
  const canonical = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join(',');
  return crypto.createHmac('sha256', secret).update(canonical).digest('base64');
}

export function verifyGatewaySignature(
  payload: Record<string, string | number>,
  signature: string,
  secret: string
): boolean {
  const expected = signGatewayPayload(payload, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
