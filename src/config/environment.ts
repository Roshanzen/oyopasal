const env =
  (typeof import.meta !== 'undefined' && (import.meta as any)?.env) ||
  (typeof process !== 'undefined' ? process.env : {}) ||
  {};

export const ENVIRONMENT = {
  API_BASE_URL: (env.VITE_API_BASE_URL as string) || '/api/v1',
  IS_DEV: Boolean(env.DEV),
  IS_PROD: Boolean(env.PROD),
} as const;
