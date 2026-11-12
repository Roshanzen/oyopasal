import {
  Category,
  Promotion,
  Vendor,
  Product,
  CartSummary,
  Order,
  Address,
  UserProfile,
  NotificationItem,
  DRFPaginatedResponse,
  Coupon
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('oyopasal_auth_token') || 'drf-token-9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b';
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('oyopasal_auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('oyopasal_auth_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Token ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let errorDetail = 'An unexpected API error occurred.';
        try {
          const errJson = await response.json();
          errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch {
          errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail);
      }

      return await response.json();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      console.error(`API Error [${endpoint}]:`, message);
      throw err;
    }
  }

  // Categories
  async getCategories(): Promise<DRFPaginatedResponse<Category>> {
    return this.request<DRFPaginatedResponse<Category>>('/categories/');
  }

  // Promotions
  async getPromotions(): Promise<DRFPaginatedResponse<Promotion>> {
    return this.request<DRFPaginatedResponse<Promotion>>('/promotions/');
  }

  // Vendors
  async getVendors(): Promise<DRFPaginatedResponse<Vendor>> {
    return this.request<DRFPaginatedResponse<Vendor>>('/vendors/');
  }

  async registerVendor(data: {
    store_name: string;
    category: string;
    city?: string;
    area: string;
    contact_person: string;
    phone: string;
    email?: string;
    daily_orders?: string;
  }): Promise<{ success: boolean; message: string; vendor: Vendor }> {
    return this.request('/vendors/register/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async loginAsSeller(data: { identifier?: string; password?: string; vendor_id?: string }): Promise<any> {
    return this.request('/auth/seller/login/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getSellerDashboard(vendorId?: string): Promise<any> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/dashboard/${qs}`);
  }

  // Products
  async getProducts(params?: {
    category?: string;
    vendor?: string;
    section?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    ordering?: string;
    page?: number;
    page_size?: number;
    in_stock?: boolean;
  }): Promise<DRFPaginatedResponse<Product>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<DRFPaginatedResponse<Product>>(`/products/${qs}`);
  }

  async getProductById(id: string): Promise<Product> {
    return this.request<Product>(`/products/${id}/`);
  }

  async getSimilarProducts(id: string): Promise<DRFPaginatedResponse<Product>> {
    return this.request<DRFPaginatedResponse<Product>>(`/products/${id}/similar/`);
  }

  async getAutocomplete(query: string): Promise<{
    suggestions: { id: string; name: string; category: string; price: number; image_url: string; unit: string }[];
    categories: { id: string; name: string; slug: string }[];
  }> {
    return this.request(`/products/autocomplete/?q=${encodeURIComponent(query)}`);
  }

  // Cart
  async getCart(): Promise<CartSummary> {
    return this.request<CartSummary>('/cart/');
  }

  async addToCart(productId: string, quantity = 1, variantId?: string): Promise<CartSummary> {
    return this.request<CartSummary>('/cart/items/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity, variant_id: variantId })
    });
  }

  async updateCartItem(itemId: string, quantity: number): Promise<CartSummary> {
    return this.request<CartSummary>(`/cart/items/${itemId}/`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
  }

  async removeCartItem(itemId: string): Promise<CartSummary> {
    return this.request<CartSummary>(`/cart/items/${itemId}/`, {
      method: 'DELETE'
    });
  }

  async clearCart(): Promise<CartSummary> {
    return this.request<CartSummary>('/cart/clear/', {
      method: 'DELETE'
    });
  }

  // Coupon
  async applyCoupon(code: string): Promise<{ success: boolean; coupon: Coupon; cart: CartSummary }> {
    return this.request('/coupons/apply/', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }

  async removeCoupon(): Promise<{ success: boolean; cart: CartSummary }> {
    return this.request('/coupons/remove/', {
      method: 'DELETE'
    });
  }

  // Checkout & Orders
  async validateCheckout(): Promise<{ valid: boolean; authoritative_cart: CartSummary }> {
    return this.request('/checkout/validate/', {
      method: 'POST'
    });
  }

  async createOrder(payload: {
    address_id: string;
    payment_method: string;
    delivery_option: string;
    notes?: string;
  }): Promise<Order> {
    return this.request<Order>('/orders/', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getOrders(): Promise<DRFPaginatedResponse<Order>> {
    return this.request<DRFPaginatedResponse<Order>>('/orders/');
  }

  async getOrderById(id: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}/`);
  }

  async cancelOrder(id: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}/cancel/`, {
      method: 'POST'
    });
  }

  // User Profile
  async getUser(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/user/');
  }

  async updateUser(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/user/', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Addresses
  async getAddresses(): Promise<{ count: number; results: Address[] }> {
    return this.request('/account/addresses/');
  }

  async createAddress(address: Partial<Address>): Promise<Address> {
    return this.request<Address>('/account/addresses/', {
      method: 'POST',
      body: JSON.stringify(address)
    });
  }

  // Wishlist
  async getWishlist(): Promise<DRFPaginatedResponse<Product>> {
    return this.request<DRFPaginatedResponse<Product>>('/wishlist/');
  }

  async toggleWishlist(productId: string): Promise<{ product_id: string; is_wishlisted: boolean; wishlist_ids: string[] }> {
    return this.request('/wishlist/toggle/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId })
    });
  }

  // Notifications
  async getNotifications(): Promise<{ count: number; results: NotificationItem[] }> {
    return this.request('/notifications/');
  }
}

export const api = new ApiService();
