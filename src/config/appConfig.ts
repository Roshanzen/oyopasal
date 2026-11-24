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
    CUSTOMER_AUTH: 'oyopasal_customer_auth',
    VENDOR_AUTH: 'oyopasal_vendor_auth',
    AUTH_TOKEN: 'oyopasal_customer_auth',
    SELLER_TOKEN: 'oyopasal_vendor_auth',
    SESSION_KEY: 'oyopasal_session_key',
    CUSTOMER_LOGGED_IN: 'oyopasal_customer_logged_in',
    SELLER_SESSION: 'oyopasal_vendor_auth_session',
    LANGUAGE: 'oyopasal_lang',
    THEME: 'oyopasal_theme',
  },
  TOAST_DURATION_MS: 3200,
  AUTOCOMPLETE_DEBOUNCE_MS: 220,
} as const;
