import {
  InventoryMovementItem,
  Product,
  SellerAnalyticsResponse,
  SellerDashboardResponse,
  SellerFulfillmentItem,
  SellerReviewItem,
  SellerSettlementItem,
  Vendor,
} from '../types';
import { httpClient } from './httpClient';

export const sellerService = {
  getSellerDashboard(vendorId?: string): Promise<SellerDashboardResponse> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request<SellerDashboardResponse>(`/seller/dashboard/${qs}`, {}, true);
  },

  getSellerAnalytics(vendorId?: string, months = 6): Promise<SellerAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (vendorId) qs.set('vendor_id', vendorId);
    qs.set('months', String(months));
    return httpClient.request<SellerAnalyticsResponse>(`/seller/analytics/?${qs.toString()}`, {}, true);
  },

  getSellerProducts(vendorId?: string): Promise<{ count: number; results: Product[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/products/${qs}`, {}, true);
  },

  createSellerProduct(data: {
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
    return httpClient.request(
      '/seller/products/',
      { method: 'POST', body: JSON.stringify(data) },
      true
    );
  },

  updateSellerProduct(productId: string, data: Partial<Product>): Promise<{ success: boolean; product: Product }> {
    return httpClient.request(
      `/seller/products/${productId}/`,
      { method: 'PUT', body: JSON.stringify(data) },
      true
    );
  },

  toggleProductStock(productId: string): Promise<{ success: boolean; in_stock: boolean; product: Product }> {
    return httpClient.request(`/seller/products/${productId}/toggle-stock/`, { method: 'PATCH' }, true);
  },

  restockProduct(
    productId: string,
    addStock = 25
  ): Promise<{ success: boolean; message: string; stock: number; in_stock: boolean; product: Product }> {
    return httpClient.request(
      `/seller/products/${productId}/restock/`,
      { method: 'PATCH', body: JSON.stringify({ add_stock: addStock }) },
      true
    );
  },

  deleteProduct(productId: string): Promise<{ success: boolean; message: string }> {
    return httpClient.request(`/seller/products/${productId}/`, { method: 'DELETE' }, true);
  },

  addSellerProductImage(
    productId: string,
    image_url: string,
    is_primary = false
  ): Promise<{ success: boolean; product: Product }> {
    return httpClient.request(
      `/seller/products/${productId}/images/`,
      { method: 'POST', body: JSON.stringify({ image_url, is_primary }) },
      true
    );
  },

  deleteSellerProductImage(productId: string, imageId: number): Promise<{ success: boolean; product: Product }> {
    return httpClient.request(`/seller/products/${productId}/images/${imageId}/`, { method: 'DELETE' }, true);
  },

  getSellerReviews(
    vendorId?: string
  ): Promise<{ count: number; average_rating: number; results: SellerReviewItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/reviews/${qs}`, {}, true);
  },

  getSellerInventoryMovements(vendorId?: string): Promise<{ count: number; results: InventoryMovementItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/inventory/movements/${qs}`, {}, true);
  },

  getSellerOrders(vendorId?: string): Promise<{ count: number; results: SellerFulfillmentItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/orders/${qs}`, {}, true);
  },

  updateSellerFulfillmentStatus(
    fulfillmentId: number,
    status: 'CONFIRMED_BY_VENDOR' | 'PACKED_BY_VENDOR' | 'READY_FOR_RIDER_PICKUP' | 'REJECTED',
    vendorId?: string
  ): Promise<{ success: boolean; status: string }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(
      `/seller/orders/${fulfillmentId}/status/${qs}`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      true
    );
  },

  getSellerStore(vendorId?: string): Promise<{ vendor: Vendor; settlements: SellerSettlementItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/store/${qs}`, {}, true);
  },

  updateSellerStore(
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
    return httpClient.request(
      `/seller/store/${qs}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      true
    );
  },
};
