export const APP_CONFIG = {
  BRAND_NAME: 'OyoPasal',
  DEFAULT_COORDINATES: {
    lat: 27.6986,
    lng: 85.3292,
  },
  DEFAULT_DELIVERY_DEFAULTS: {
    freeDeliveryThreshold: 499,
    baseDeliveryFee: 35,
    handlingFee: 15,
    defaultEtaMins: 12,
  },
  STORAGE_KEYS: {
    AUTH_TOKEN: 'oyopasal_auth_token',
    SELLER_TOKEN: 'oyopasal_seller_token',
    SESSION_KEY: 'oyopasal_session_key',
    CUSTOMER_LOGGED_IN: 'oyopasal_customer_logged_in',
    SELLER_SESSION: 'oyopasal_seller_session',
    LANGUAGE: 'oyopasal_lang',
    THEME: 'oyopasal_theme',
  },
  TOAST_DURATION_MS: 3200,
  AUTOCOMPLETE_DEBOUNCE_MS: 220,
} as const;
