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

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  dedupe?: boolean;
  cacheTtlMs?: number;
  bypassCache?: boolean;
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
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
  private inFlightRequests = new Map<string, Promise<unknown>>();
  private memoryCache = new Map<string, CacheEntry>();

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
    this.clearCache();
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
  }

  getToken(): string | null {
    if (!this.token) {
      const saved = safeStorage.get(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      this.token = saved && !saved.startsWith('drf-token-') ? saved : null;
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    this.clearCache();
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  }

  setSellerToken(token: string) {
    this.sellerToken = token;
    this.clearCache();
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN, token);
  }

  getSellerToken(): string | null {
    if (!this.sellerToken) {
      this.sellerToken = safeStorage.get(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
    }
    return this.sellerToken;
  }

  clearSellerToken() {
    this.sellerToken = null;
    this.clearCache();
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
  }

  clearCache(endpointPrefix?: string) {
    if (!endpointPrefix) {
      this.memoryCache.clear();
      return;
    }
    for (const key of this.memoryCache.keys()) {
      if (key.includes(endpointPrefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    useSellerTokenIfAvailable = false
  ): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';

    const token = this.getToken();
    const sellerToken = this.getSellerToken();
    const effectiveToken = useSellerTokenIfAvailable
      ? (sellerToken || token)
      : (token || sellerToken);
    const usedSellerToken = Boolean(effectiveToken && effectiveToken === sellerToken);

    const cacheKey = `${method}:${endpoint}::${effectiveToken || 'anon'}`;

    // 1. Check TTL Cache for GET requests
    if (isGet && !options.bypassCache && options.cacheTtlMs && options.cacheTtlMs > 0) {
      const cached = this.memoryCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data as T;
      }
    }

    // 2. In-flight request deduplication for concurrent GET requests
    const shouldDedupe = isGet && options.dedupe !== false;
    if (shouldDedupe) {
      const activePromise = this.inFlightRequests.get(cacheKey);
      if (activePromise) {
        return activePromise as Promise<T>;
      }
    }

    // 3. Invalidate relevant caches on mutating methods
    if (!isGet) {
      const baseResource = endpoint.split('?')[0].split('/').filter(Boolean)[1];
      if (baseResource) {
        this.clearCache(baseResource);
      }
    }

    const execute = async (): Promise<T> => {
      const url = `${ENVIRONMENT.API_BASE_URL}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Session-Key': getOrCreateSessionKey(),
        ...((options.headers as Record<string, string>) || {}),
      };

      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }

      // Attach CSRF token on mutating requests if present in cookies (for session/cookie authentication)
      if (!isGet && !headers['X-CSRFToken']) {
        const csrf = getCsrfToken();
        if (csrf) {
          headers['X-CSRFToken'] = csrf;
        }
      }

      // Configure timeout and abort controller
      const timeoutMs = options.timeoutMs ?? 15000;
      const controller = new AbortController();
      let didTimeout = false;
      const timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, timeoutMs);

      // Chain incoming signal if provided
      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      try {
        const response = await fetch(url, {
          credentials: options.credentials ?? 'same-origin',
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          if (response.status === 401 && effectiveToken && this.unauthorizedHandler) {
            this.unauthorizedHandler(usedSellerToken);
          }

          let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errJson = (await response.json()) as any;
            if (errJson?.error) {
              if (errJson.error.details && typeof errJson.error.details === 'object') {
                const firstKey = Object.keys(errJson.error.details)[0];
                const firstVal = errJson.error.details[firstKey];
                errorDetail = Array.isArray(firstVal) ? String(firstVal[0]) : String(firstVal);
              } else {
                errorDetail = errJson.error.message || errJson.error.detail || errorDetail;
              }
            } else if (errJson?.message) {
              errorDetail = String(errJson.message);
            } else if (errJson?.detail) {
              errorDetail = String(errJson.detail);
            } else if (errJson && typeof errJson === 'object') {
              const keys = Object.keys(errJson);
              if (keys.length > 0) {
                const firstKey = keys[0];
                const firstVal = errJson[firstKey];
                const msg = Array.isArray(firstVal) ? String(firstVal[0]) : String(firstVal);
                errorDetail = (firstKey === 'non_field_errors' || firstKey === 'detail' || firstKey === 'error')
                  ? msg
                  : `${firstKey.replace(/_/g, ' ')}: ${msg}`;
              } else {
                errorDetail = JSON.stringify(errJson);
              }
            }
          } catch {
            // default error message kept
          }
          throw new ApiRequestError(response.status, errorDetail);
        }

        const data = (await response.json()) as T;

        // Store in cache if configured
        if (isGet && options.cacheTtlMs && options.cacheTtlMs > 0) {
          this.memoryCache.set(cacheKey, {
            data,
            expiresAt: Date.now() + options.cacheTtlMs,
          });
        }

        return data;
      } catch (err: unknown) {
        clearTimeout(timer);
        if (didTimeout) {
          throw new ApiRequestError(408, `Request timed out after ${timeoutMs}ms: ${endpoint}`);
        }
        if (err instanceof Error && err.name === 'AbortError') {
          throw err;
        }
        throw err;
      }
    };

    const promise = execute();

    if (shouldDedupe) {
      this.inFlightRequests.set(cacheKey, promise);
      promise.finally(() => {
        this.inFlightRequests.delete(cacheKey);
      });
    }

    return promise;
  }
}

export const httpClient = new HttpClient();
