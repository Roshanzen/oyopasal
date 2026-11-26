import { APP_CONFIG, ENVIRONMENT } from '../config';
import { safeStorage } from '../utils/storage';

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  data?: any;
  retryAfterSeconds?: number;
  constructor(status: number, message: string, code?: string, data?: any, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.data = data;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && (err.name === 'AbortError' || err.message.toLowerCase().includes('aborted'))) ||
    (typeof err === 'object' && err !== null && (err as any).name === 'AbortError')
  );
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  dedupe?: boolean;
  cacheTtlMs?: number;
  bypassCache?: boolean;
  skipAuth?: boolean;
  silent401?: boolean;
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
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH, token);
  }

  getToken(): string | null {
    if (!this.token) {
      const saved = safeStorage.get(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH) || safeStorage.get(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      this.token = saved && !saved.startsWith('drf-token-') ? saved : null;
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    this.clearCache();
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH);
  }

  setSellerToken(token: string) {
    this.sellerToken = token;
    this.clearCache();
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN, token);
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH, token);
  }

  getSellerToken(): string | null {
    if (!this.sellerToken) {
      this.sellerToken = safeStorage.get(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH) || safeStorage.get(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
    }
    return this.sellerToken;
  }

  clearSellerToken() {
    this.sellerToken = null;
    this.clearCache();
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH);
  }

  clearAllAuth() {
    this.token = null;
    this.sellerToken = null;
    this.clearCache();
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }
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
      ? sellerToken
      : token;
    const usedSellerToken = Boolean(useSellerTokenIfAvailable && effectiveToken);

    // Ensure public registration and unauthenticated endpoints NEVER attach stale/expired tokens
    const isPublicEndpoint =
      Boolean(options.skipAuth) ||
      endpoint.includes('/auth/register') ||
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/password-reset') ||
      endpoint.includes('/seller/applications/apply') ||
      endpoint.includes('/seller/applications/track') ||
      endpoint.includes('/seller/activation/');

    const cacheKey = `${method}:${endpoint}::${(!isPublicEndpoint && effectiveToken) || 'anon'}`;

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
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Session-Key': getOrCreateSessionKey(),
        ...((options.headers as Record<string, string>) || {}),
      };

      if (isFormData) {
        // When sending FormData, delete any manual Content-Type header so the browser
        // can supply the exact multipart/form-data boundary delimiter.
        delete headers['Content-Type'];
      } else if (!headers['Content-Type'] && method !== 'GET') {
        headers['Content-Type'] = 'application/json';
      }

      if (effectiveToken && !isPublicEndpoint) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }

      // Attach CSRF token on mutating requests if present in cookies
      if (!isGet && !headers['X-CSRFToken']) {
        const csrf = getCsrfToken();
        if (csrf) {
          headers['X-CSRFToken'] = csrf;
        }
      }

      // Configure timeout and abort controller
      const timeoutMs = options.timeoutMs ?? (isFormData ? 60000 : 15000);
      const controller = new AbortController();
      let didTimeout = false;
      const timer = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, timeoutMs);

      // Chain incoming signal if provided
      let abortListener: (() => void) | null = null;
      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          abortListener = () => controller.abort();
          options.signal.addEventListener('abort', abortListener, { once: true });
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
          let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
          let isTokenNotValid = false;
          let parsedCode = '';
          let errJson: any = null;

          try {
            errJson = (await response.json()) as any;
            const detailStr = String(
              errJson?.detail || errJson?.code || errJson?.message || errJson?.error?.message || ''
            );
            parsedCode = errJson?.code || errJson?.error?.code || '';

            if (
              errJson?.code === 'token_not_valid' ||
              errJson?.detail === 'token_not_valid' ||
              detailStr.toLowerCase().includes('token_not_valid') ||
              detailStr.toLowerCase().includes('token is invalid') ||
              detailStr.toLowerCase().includes('token not valid') ||
              (response.status === 401 && detailStr.toLowerCase().includes('given token not valid'))
            ) {
              isTokenNotValid = true;
              parsedCode = 'token_not_valid';
            }

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
                errorDetail =
                  firstKey === 'non_field_errors' || firstKey === 'detail' || firstKey === 'error'
                    ? msg
                    : `${firstKey.replace(/_/g, ' ')}: ${msg}`;
              } else {
                errorDetail = JSON.stringify(errJson);
              }
            }
          } catch {
            // default error kept
          }

          if (response.status === 401) {
            // Automatically clear expired auth tokens from localStorage when token_not_valid occurs
            if (isTokenNotValid || effectiveToken) {
              if (usedSellerToken) {
                this.clearSellerToken();
              } else {
                this.clearToken();
              }
            }

            if (this.unauthorizedHandler) {
              this.unauthorizedHandler(usedSellerToken);
            }

            // Silent handling for polling endpoints, unread-count, and logout
            const isSilentEndpoint =
              Boolean(options.silent401) ||
              endpoint.includes('/unread-count') ||
              endpoint.includes('/notifications') ||
              endpoint.includes('/auth/logout');

            if (isSilentEndpoint || isTokenNotValid) {
              if (endpoint.includes('unread-count')) {
                return { customer_unread: 0, vendor_unread: 0, total: 0 } as T;
              }
              if (endpoint.includes('notifications')) {
                return { count: 0, results: [] } as T;
              }
              if (endpoint.includes('/auth/logout')) {
                return { success: true, message: 'Logged out' } as T;
              }
              if (options.silent401) {
                return null as T;
              }
            }
          }

          let retryAfterSeconds: number | undefined;
          if (response.status === 429) {
            parsedCode = parsedCode || 'throttled';
            const retryHeader = response.headers.get('Retry-After');
            if (retryHeader) {
              const parsed = parseInt(retryHeader, 10);
              if (!isNaN(parsed) && parsed > 0) {
                retryAfterSeconds = parsed;
              }
            }
            if (!retryAfterSeconds && errorDetail) {
              const match = errorDetail.match(/Expected available in (\d+) seconds/i);
              if (match && match[1]) {
                retryAfterSeconds = parseInt(match[1], 10);
              }
            }
          }

          throw new ApiRequestError(response.status, errorDetail, parsedCode, errJson, retryAfterSeconds);
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
        if (didTimeout) {
          throw new ApiRequestError(408, `Request timed out after ${timeoutMs}ms: ${endpoint}`);
        }
        if (err instanceof Error && err.name === 'AbortError') {
          throw err;
        }
        throw err;
      } finally {
        clearTimeout(timer);
        if (abortListener && options.signal) {
          options.signal.removeEventListener('abort', abortListener);
        }
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

  /**
   * Convenience HTTP GET
   */
  get<T>(endpoint: string, options?: RequestOptions, useSellerTokenIfAvailable = false): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' }, useSellerTokenIfAvailable);
  }

  /**
   * Convenience HTTP POST (automatically serializes JSON bodies)
   */
  post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
    useSellerTokenIfAvailable = false
  ): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const serializedBody = isFormData
      ? (body as FormData)
      : typeof body === 'string'
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined;

    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'POST',
        body: serializedBody,
      },
      useSellerTokenIfAvailable
    );
  }

  /**
   * Convenience HTTP PUT (automatically serializes JSON bodies)
   */
  put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
    useSellerTokenIfAvailable = false
  ): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const serializedBody = isFormData
      ? (body as FormData)
      : typeof body === 'string'
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined;

    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'PUT',
        body: serializedBody,
      },
      useSellerTokenIfAvailable
    );
  }

  /**
   * Convenience HTTP PATCH (automatically serializes JSON bodies)
   */
  patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
    useSellerTokenIfAvailable = false
  ): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const serializedBody = isFormData
      ? (body as FormData)
      : typeof body === 'string'
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined;

    return this.request<T>(
      endpoint,
      {
        ...options,
        method: 'PATCH',
        body: serializedBody,
      },
      useSellerTokenIfAvailable
    );
  }

  /**
   * Convenience HTTP DELETE
   */
  delete<T>(endpoint: string, options?: RequestOptions, useSellerTokenIfAvailable = false): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' }, useSellerTokenIfAvailable);
  }
}

export const httpClient = new HttpClient();
