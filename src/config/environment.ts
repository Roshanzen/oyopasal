export const ENVIRONMENT = {
  API_BASE_URL: (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1',
  IS_DEV: Boolean(import.meta.env.DEV),
  IS_PROD: Boolean(import.meta.env.PROD),
} as const;
