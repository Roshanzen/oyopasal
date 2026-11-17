import { APP_CONFIG, ENVIRONMENT } from '../config';
import { safeStorage } from '../utils/storage';

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function getOrCreateSessionKey(): string {
  const existing = safeStorage.get(APP_CONFIG.STORAGE_KEYS.SESSION_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `sess-${crypto.randomUUID()}`
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  safeStorage.set(APP_CONFIG.STORAGE_KEYS.SESSION_KEY, generated);
  return generated;
}

class HttpClient {
  private token: string | null = null;
  private sellerToken: string | null = null;
  private unauthorizedHandler: ((isSellerRequest: boolean) => void) | null = null;

  constructor() {
    const savedToken = safeStorage.get(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    this.token = savedToken && !savedToken.startsWith('drf-token-') ? savedToken : null;
    if (savedToken?.startsWith('drf-token-')) {
      safeStorage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
    }
    this.sellerToken = safeStorage.get(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
  }

  onUnauthorized(handler: (isSellerRequest: boolean) => void) {
    this.unauthorizedHandler = handler;
  }

  setToken(token: string) {
    this.token = token;
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  }

  setSellerToken(token: string) {
    this.sellerToken = token;
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN, token);
  }

  getSellerToken(): string | null {
    return this.sellerToken;
  }

  clearSellerToken() {
    this.sellerToken = null;
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useSellerTokenIfAvailable = false
  ): Promise<T> {
    const url = `${ENVIRONMENT.API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Session-Key': getOrCreateSessionKey(),
      ...((options.headers as Record<string, string>) || {}),
    };

    const effectiveToken = useSellerTokenIfAvailable
      ? this.sellerToken || this.token
      : this.token || this.sellerToken;

    if (effectiveToken) {
      headers['Authorization'] = `Bearer ${effectiveToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 && effectiveToken && this.unauthorizedHandler) {
        this.unauthorizedHandler(useSellerTokenIfAvailable);
      }

      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = (await response.json()) as { detail?: string; message?: string };
        errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
      } catch {
        // default error message kept
      }
      throw new ApiRequestError(response.status, errorDetail);
    }

    return (await response.json()) as T;
  }
}

export const httpClient = new HttpClient();
