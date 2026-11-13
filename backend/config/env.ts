import crypto from 'crypto';

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SESSION_SECRET:
    process.env.SESSION_SECRET ||
    process.env.SQL_PASSWORD ||
    crypto.createHash('sha256').update(process.env.SQL_DB_NAME || 'oyopasal-local-dev-key').digest('hex'),
  ESEWA_MERCHANT_CODE: process.env.ESEWA_MERCHANT_CODE || 'EPAYTEST',
  ESEWA_SECRET_KEY: process.env.ESEWA_SECRET_KEY || '8gBm/:&EnhH.1/q',
  KHALTI_SECRET_KEY: process.env.KHALTI_SECRET_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};
