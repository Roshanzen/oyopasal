import {
  ActiveCouponItem,
  Advertisement,
  Category,
  Promotion,
  PublicSettings,
  Vendor,
  Product,
  CartSummary,
  Order,
  Address,
  UserProfile,
  NotificationItem,
  DRFPaginatedResponse,
  Coupon,
  DeliveryZoneItem,
  ReviewItem,
  SupportTicket,
  DeliveryTrackingTelemetry,
  SellerAnalyticsResponse,
  SellerFulfillmentItem,
  SellerReviewItem,
  InventoryMovementItem,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';

function getOrCreateSessionKey(): string {
  const existing = localStorage.getItem('oyopasal_session_key');
  if (existing) return existing;
  const generated =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `sess-${crypto.randomUUID()}`
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('oyopasal_session_key', generated);
  return generated;
}

class ApiService {
  private token: string | null = null;
  private sellerToken: string | null = null;

  constructor() {
    const savedToken = localStorage.getItem('oyopasal_auth_token');
    this.token = savedToken && !savedToken.startsWith('drf-token-') ? savedToken : null;
    if (savedToken?.startsWith('drf-token-')) {
      localStorage.removeItem('oyopasal_auth_token');
      localStorage.removeItem('oyopasal_customer_logged_in');
    }
    const savedSellerToken = localStorage.getItem('oyopasal_seller_token');
    this.sellerToken = savedSellerToken || null;
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('oyopasal_auth_token', token);
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('oyopasal_auth_token');
  }

  setSellerToken(token: string) {
    this.sellerToken = token;
    localStorage.setItem('oyopasal_seller_token', token);
  }

  getSellerToken(): string | null {
    return this.sellerToken;
  }

  clearSellerToken() {
    this.sellerToken = null;
    localStorage.removeItem('oyopasal_seller_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useSellerTokenIfAvailable = false
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
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
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
      } catch {
        // fallback already set
      }
      throw new Error(errorDetail);
    }

    return await response.json();
  }

  // Categories, Promotions, Zones
  async getCategories(): Promise<DRFPaginatedResponse<Category>> {
    return this.request<DRFPaginatedResponse<Category>>('/categories/');
  }

  async getPromotions(placement?: string): Promise<DRFPaginatedResponse<Promotion>> {
    const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
    return this.request<DRFPaginatedResponse<Promotion>>(`/promotions/${qs}`);
  }

  async getAdvertisements(placement?: string): Promise<{ count: number; results: Advertisement[] }> {
    const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
    return this.request(`/advertisements/${qs}`);
  }

  async trackAdvertisementClick(id: string | number): Promise<{ success: boolean }> {
    return this.request(`/advertisements/${id}/click/`, { method: 'POST' });
  }

  async getActiveCoupons(): Promise<{ count: number; results: ActiveCouponItem[] }> {
    return this.request('/coupons/active/');
  }

  async getPublicSettings(): Promise<PublicSettings> {
    return this.request<PublicSettings>('/settings/public/');
  }

  async getZones(): Promise<{ count: number; results: DeliveryZoneItem[] }> {
    return this.request('/zones/');
  }

  async uploadMediaFile(
    file: File,
    entityType = 'general',
    entityId?: string,
    useSellerToken = true
  ): Promise<{ id: number; url: string; filename: string; mime_type: string; size_bytes: number }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read selected file'));
      reader.readAsDataURL(file);
    });

    const resp = await this.request<{ success: boolean; asset: any }>(
      '/media/upload/',
      {
        method: 'POST',
        body: JSON.stringify({
          data_url: dataUrl,
          filename: file.name,
          mime_type: file.type,
          entity_type: entityType,
          entity_id: entityId,
        }),
      },
      useSellerToken
    );
    return resp.asset;
  }

  // Vendors & Seller Auth
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
    password?: string;
    daily_orders?: string;
    pan_vat_number?: string;
  }): Promise<{ success: boolean; message: string; vendor: Vendor }> {
    return this.request('/vendors/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async loginAsSeller(data: {
    identifier?: string;
    password?: string;
    vendor_id?: string;
    demo_quick_login?: boolean;
  }): Promise<{ success: boolean; token: string; user: UserProfile; vendor: Vendor }> {
    return this.request('/auth/seller/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getSellerDashboard(vendorId?: string): Promise<any> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/dashboard/${qs}`, {}, true);
  }

  async getSellerAnalytics(vendorId?: string, months = 6): Promise<SellerAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (vendorId) qs.set('vendor_id', vendorId);
    qs.set('months', String(months));
    return this.request<SellerAnalyticsResponse>(`/seller/analytics/?${qs.toString()}`, {}, true);
  }

  async getSellerProducts(vendorId?: string): Promise<{ count: number; results: Product[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/products/${qs}`, {}, true);
  }

  async createSellerProduct(data: {
    vendor_id?: string;
    name: string;
    category_slug: string;
    unit: string;
    original_price: number;
    discounted_price: number;
    stock?: number;
    low_stock_threshold?: number;
    is_organic?: boolean;
    description?: string;
    image_url?: string;
    gallery_urls?: string[];
    sections?: string[];
  }): Promise<{ success: boolean; message: string; product: Product }> {
    return this.request(
      '/seller/products/',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      true
    );
  }

  async addSellerProductImage(
    productId: string,
    image_url: string,
    is_primary = false
  ): Promise<{ success: boolean; product: Product }> {
    return this.request(
      `/seller/products/${productId}/images/`,
      {
        method: 'POST',
        body: JSON.stringify({ image_url, is_primary }),
      },
      true
    );
  }

  async deleteSellerProductImage(
    productId: string,
    imageId: number
  ): Promise<{ success: boolean; product: Product }> {
    return this.request(
      `/seller/products/${productId}/images/${imageId}/`,
      { method: 'DELETE' },
      true
    );
  }

  async getSellerReviews(vendorId?: string): Promise<{ count: number; average_rating: number; results: SellerReviewItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/reviews/${qs}`, {}, true);
  }

  async updateSellerProduct(productId: string, data: Partial<Product>): Promise<{ success: boolean; product: Product }> {
    return this.request(
      `/seller/products/${productId}/`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      true
    );
  }

  async toggleProductStock(productId: string): Promise<{ success: boolean; in_stock: boolean; product: Product }> {
    return this.request(
      `/seller/products/${productId}/toggle-stock/`,
      {
        method: 'PATCH',
      },
      true
    );
  }

  async restockProduct(
    productId: string,
    addStock = 25
  ): Promise<{ success: boolean; message: string; stock: number; in_stock: boolean; product: Product }> {
    return this.request(
      `/seller/products/${productId}/restock/`,
      {
        method: 'PATCH',
        body: JSON.stringify({ add_stock: addStock }),
      },
      true
    );
  }

  async deleteProduct(productId: string): Promise<{ success: boolean; message: string }> {
    return this.request(
      `/seller/products/${productId}/`,
      {
        method: 'DELETE',
      },
      true
    );
  }

  async getSellerInventoryMovements(vendorId?: string): Promise<{ count: number; results: InventoryMovementItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/inventory/movements/${qs}`, {}, true);
  }

  async getSellerOrders(vendorId?: string): Promise<{ count: number; results: SellerFulfillmentItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/orders/${qs}`, {}, true);
  }

  async updateSellerFulfillmentStatus(
    fulfillmentId: number,
    status: 'CONFIRMED_BY_VENDOR' | 'PACKED_BY_VENDOR' | 'READY_FOR_RIDER_PICKUP' | 'REJECTED',
    vendorId?: string
  ): Promise<{ success: boolean; status: string }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(
      `/seller/orders/${fulfillmentId}/status/${qs}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      true
    );
  }

  async getSellerStore(vendorId?: string): Promise<{ vendor: Vendor; settlements: any[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(`/seller/store/${qs}`, {}, true);
  }

  async updateSellerStore(
    payload: {
      description?: string;
      is_online?: boolean;
      open_time?: string;
      close_time?: string;
      phone?: string;
      area?: string;
      eta?: string;
      logo_url?: string;
      cover_image_url?: string;
    },
    vendorId?: string
  ): Promise<{ success: boolean; vendor: Vendor }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return this.request(
      `/seller/store/${qs}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      true
    );
  }

  // Products & Reviews
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

  async getProductReviews(id: string): Promise<{ count: number; average_rating: number; results: ReviewItem[] }> {
    return this.request(`/products/${id}/reviews/`);
  }

  async submitProductReview(
    id: string,
    payload: { rating: number; title?: string; comment: string }
  ): Promise<{ success: boolean; review: ReviewItem }> {
    return this.request(`/products/${id}/reviews/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAutocomplete(query: string): Promise<{
    suggestions: { id: string; name: string; category: string; price: number; image_url: string; unit: string }[];
    categories: { id: string; name: string; slug: string }[];
  }> {
    return this.request(`/products/autocomplete/?q=${encodeURIComponent(query)}`);
  }

  // Cart & Coupons
  async getCart(): Promise<CartSummary> {
    return this.request<CartSummary>('/cart/');
  }

  async addToCart(productId: string, quantity = 1, variantId?: string): Promise<CartSummary> {
    return this.request<CartSummary>('/cart/items/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity, variant_id: variantId }),
    });
  }

  async updateCartItem(itemId: string, quantity: number): Promise<CartSummary> {
    return this.request<CartSummary>(`/cart/items/${itemId}/`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeCartItem(itemId: string): Promise<CartSummary> {
    return this.request<CartSummary>(`/cart/items/${itemId}/`, {
      method: 'DELETE',
    });
  }

  async clearCart(): Promise<CartSummary> {
    return this.request<CartSummary>('/cart/clear/', {
      method: 'DELETE',
    });
  }

  async applyCoupon(code: string): Promise<{ success: boolean; coupon: Coupon; cart: CartSummary }> {
    return this.request('/coupons/apply/', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async removeCoupon(): Promise<{ success: boolean; cart: CartSummary }> {
    return this.request('/coupons/remove/', {
      method: 'DELETE',
    });
  }

  // Checkout, Payments & Orders
  async validateCheckout(): Promise<{ valid: boolean; authoritative_cart: CartSummary }> {
    return this.request('/checkout/validate/', {
      method: 'POST',
    });
  }

  async createOrder(payload: {
    address_id: string;
    delivery_address?: Address;
    payment_method: string;
    delivery_option: string;
    notes?: string;
  }): Promise<Order> {
    return this.request<Order>('/orders/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getOrders(): Promise<DRFPaginatedResponse<Order>> {
    return this.request<DRFPaginatedResponse<Order>>('/orders/');
  }

  async getOrderById(id: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}/`);
  }

  async cancelOrder(id: string, reason?: string): Promise<Order> {
    return this.request<Order>(`/orders/${id}/cancel/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async reorderOrder(id: string): Promise<{ success: boolean; added_count: number; skipped_items: string[]; cart: CartSummary }> {
    return this.request(`/orders/${id}/reorder/`, {
      method: 'POST',
    });
  }

  async requestRefund(id: string, reason: string, amount?: number): Promise<{ success: boolean; refund: any }> {
    return this.request(`/orders/${id}/refund/`, {
      method: 'POST',
      body: JSON.stringify({ reason, amount }),
    });
  }

  async initiatePayment(orderId: string, method: string): Promise<{
    success: boolean;
    payment_id: number;
    order_id: string;
    order_number: string;
    method: string;
    amount: number;
    currency: string;
    transaction_uuid: string;
    product_code: string;
    signature: string;
    mode: string;
  }> {
    return this.request('/payments/initiate/', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, method }),
    });
  }

  async verifyPayment(payload: {
    order_id: string;
    transaction_uuid: string;
    signature: string;
    gateway_ref?: string;
  }): Promise<{ success: boolean; payment_status: string; transaction_uuid: string; order_number: string }> {
    return this.request('/payments/verify/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Delivery Tracking & Rider Portal
  async getOrderTracking(orderId: string): Promise<DeliveryTrackingTelemetry> {
    return this.request<DeliveryTrackingTelemetry>(`/delivery/orders/${orderId}/tracking/`);
  }

  async getDeliveryProfile(): Promise<any> {
    return this.request('/delivery/agent/profile/');
  }

  async updateDeliveryAvailability(availability_status: 'offline' | 'available' | 'busy'): Promise<any> {
    return this.request('/delivery/agent/availability/', {
      method: 'PATCH',
      body: JSON.stringify({ availability_status }),
    });
  }

  async getDeliveryAssignments(): Promise<{ count: number; results: any[] }> {
    return this.request('/delivery/assignments/');
  }

  async pushDeliveryLocation(
    assignmentId: number,
    payload: { lat: number; lng: number; speed_kmh?: number; eta_minutes?: number; status_note?: string }
  ): Promise<any> {
    return this.request(`/delivery/assignments/${assignmentId}/location/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateDeliveryStatus(
    assignmentId: number,
    status: 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'failed',
    proof_note?: string
  ): Promise<any> {
    return this.request(`/delivery/assignments/${assignmentId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, proof_note }),
    });
  }

  // User Profile & Auth
  async registerCustomer(data: {
    full_name: string;
    phone_or_email: string;
    password: string;
  }): Promise<{ success: boolean; token: string; user: UserProfile }> {
    return this.request('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async loginCustomer(data: {
    phone_or_email: string;
    password?: string;
    full_name?: string;
    demo_quick_login?: boolean;
  }): Promise<{ success?: boolean; token: string; user: UserProfile }> {
    return this.request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async firebaseLogin(data: {
    id_token: string;
    full_name?: string;
    phone?: string;
  }): Promise<{ success: boolean; token: string; user: UserProfile }> {
    return this.request('/auth/firebase-login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logoutCustomer(): Promise<{ success: boolean }> {
    return this.request('/auth/logout/', { method: 'POST' });
  }

  async getUser(): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/user/');
  }

  async updateUser(data: Partial<UserProfile>): Promise<UserProfile> {
    return this.request<UserProfile>('/auth/user/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Addresses, Wishlist, Notifications, Support
  async getAddresses(): Promise<{ count: number; results: Address[] }> {
    return this.request('/account/addresses/');
  }

  async createAddress(address: Partial<Address>): Promise<Address> {
    return this.request<Address>('/account/addresses/', {
      method: 'POST',
      body: JSON.stringify(address),
    });
  }

  async getWishlist(): Promise<DRFPaginatedResponse<Product>> {
    return this.request<DRFPaginatedResponse<Product>>('/wishlist/');
  }

  async toggleWishlist(productId: string): Promise<{ product_id: string; is_wishlisted: boolean; wishlist_ids: string[] }> {
    return this.request('/wishlist/toggle/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId }),
    });
  }

  async getNotifications(): Promise<{ count: number; results: NotificationItem[] }> {
    return this.request('/notifications/');
  }

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/notifications/${id}/read/`, { method: 'PATCH' });
  }

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return this.request('/notifications/read-all/', { method: 'PATCH' });
  }

  async getSupportTickets(): Promise<{ count: number; results: SupportTicket[] }> {
    return this.request('/support/tickets/');
  }

  async createSupportTicket(payload: {
    category: string;
    subject: string;
    message: string;
    order_id?: number;
  }): Promise<{ success: boolean; ticket: any }> {
    return this.request('/support/tickets/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async replySupportTicket(ticketId: number, message: string): Promise<{ success: boolean; message: any }> {
    return this.request(`/support/tickets/${ticketId}/reply/`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // Admin Operations API
  async getAdminOverview(from?: string, to?: string): Promise<any> {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/admin/overview/${suffix}`);
  }
  async getAdminUsers(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/users/');
  }
  async updateAdminUser(id: number, payload: { is_active?: boolean; role?: string }): Promise<any> {
    return this.request(`/admin/users/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async getAdminSellers(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/sellers/');
  }
  async updateSellerApproval(
    vendorDbId: number,
    payload: { approval_status?: string; commission_rate?: number; rejection_reason?: string }
  ): Promise<any> {
    return this.request(`/admin/sellers/${vendorDbId}/approval/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  async getAdminProducts(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/products/');
  }
  async moderateAdminProduct(productDbId: number, payload: { approval_status?: string; is_active?: boolean }): Promise<any> {
    return this.request(`/admin/products/${productDbId}/moderation/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
  async createAdminCategory(payload: {
    name: string;
    name_ne?: string;
    slug: string;
    icon?: string;
    accent?: string;
    description?: string;
    image_url?: string;
    parent_id?: number;
  }): Promise<any> {
    return this.request('/admin/categories/', { method: 'POST', body: JSON.stringify(payload) });
  }
  async updateAdminCategory(id: number, payload: Record<string, any>): Promise<any> {
    return this.request(`/admin/categories/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async deleteAdminCategory(id: number): Promise<any> {
    return this.request(`/admin/categories/${id}/`, { method: 'DELETE' });
  }
  async getAdminPromotions(): Promise<{ count: number; results: Promotion[] }> {
    return this.request('/admin/promotions/');
  }
  async createAdminPromotion(payload: Record<string, any>): Promise<any> {
    return this.request('/admin/promotions/', { method: 'POST', body: JSON.stringify(payload) });
  }
  async updateAdminPromotion(id: number, payload: Record<string, any>): Promise<any> {
    return this.request(`/admin/promotions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async deleteAdminPromotion(id: number): Promise<any> {
    return this.request(`/admin/promotions/${id}/`, { method: 'DELETE' });
  }
  async getAdminAdvertisements(): Promise<{ count: number; results: Advertisement[] }> {
    return this.request('/admin/advertisements/');
  }
  async createAdminAdvertisement(payload: Record<string, any>): Promise<any> {
    return this.request('/admin/advertisements/', { method: 'POST', body: JSON.stringify(payload) });
  }
  async updateAdminAdvertisement(id: number, payload: Record<string, any>): Promise<any> {
    return this.request(`/admin/advertisements/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async deleteAdminAdvertisement(id: number): Promise<any> {
    return this.request(`/admin/advertisements/${id}/`, { method: 'DELETE' });
  }
  async getAdminPayments(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/payments/');
  }
  async getAdminOrders(): Promise<{ count: number; results: Order[] }> {
    return this.request('/admin/orders/');
  }
  async assignRiderToOrder(orderId: string, agentId: number): Promise<any> {
    return this.request(`/admin/orders/${orderId}/assign-rider/`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    });
  }
  async getAdminRefunds(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/refunds/');
  }
  async updateAdminRefund(id: number, status: 'approved' | 'rejected' | 'processed', admin_note?: string): Promise<any> {
    return this.request(`/admin/refunds/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note }),
    });
  }
  async getAdminZones(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/zones/');
  }
  async createAdminZone(payload: Record<string, any>): Promise<any> {
    return this.request('/admin/zones/', { method: 'POST', body: JSON.stringify(payload) });
  }
  async getAdminRiders(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/riders/');
  }
  async updateAdminRider(id: number, payload: { verification_status?: string; availability_status?: string }): Promise<any> {
    return this.request(`/admin/riders/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  }
  async getAdminCoupons(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/coupons/');
  }
  async createAdminCoupon(payload: Record<string, any>): Promise<any> {
    return this.request('/admin/coupons/', { method: 'POST', body: JSON.stringify(payload) });
  }
  async toggleAdminCoupon(id: number, is_active: boolean): Promise<any> {
    return this.request(`/admin/coupons/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
  }
  async getAdminSettlements(): Promise<{ vendor_balances: any[]; settlements: any[] }> {
    return this.request('/admin/settlements/');
  }
  async generateSettlement(vendor_id: number): Promise<any> {
    return this.request('/admin/settlements/generate/', { method: 'POST', body: JSON.stringify({ vendor_id }) });
  }
  async paySettlement(id: number, payout_reference?: string): Promise<any> {
    return this.request(`/admin/settlements/${id}/pay/`, {
      method: 'PATCH',
      body: JSON.stringify({ payout_reference }),
    });
  }
  async getAdminTickets(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/tickets/');
  }
  async updateAdminTicket(id: number, status: string): Promise<any> {
    return this.request(`/admin/tickets/${id}/`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }
  async getAdminAuditLogs(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/audit-logs/');
  }
  async getAdminSettings(): Promise<{ count: number; results: any[] }> {
    return this.request('/admin/settings/');
  }
  async saveAdminSetting(key: string, value: Record<string, unknown>, description?: string): Promise<any> {
    return this.request('/admin/settings/', {
      method: 'PUT',
      body: JSON.stringify({ key, value, description }),
    });
  }

  // AI Concierge Chat & Direct Location-Aware Purchase
  async sendChatMessage(payload: {
    messages: { role: string; content: string }[];
    userLocation?: {
      latitude?: number;
      longitude?: number;
      area?: string;
      street?: string;
      city?: string;
      addressId?: string;
    } | null;
    language?: 'en' | 'ne';
  }): Promise<import('../types').ChatResponsePayload> {
    return this.request('/chat/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async placeDirectChatOrder(payload: {
    items: { product_id: string; quantity: number; variant_id?: string }[];
    address_id?: string;
    delivery_address?: Partial<Address>;
    payment_method?: string;
    delivery_option?: string;
    coupon_code?: string | null;
    notes?: string;
  }): Promise<{ success: boolean; order: Order }> {
    return this.request('/chat/direct-order/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const api = new ApiService();
