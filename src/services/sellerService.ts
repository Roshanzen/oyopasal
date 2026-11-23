import {
  DeliveryTrackingTelemetry,
  InventoryMovementItem,
  Product,
  SellerAnalyticsResponse,
  SellerDashboardResponse,
  SellerFulfillmentItem,
  SellerReviewItem,
  SellerSettlementItem,
  Vendor,
} from '../types';
import { httpClient, RequestOptions } from './httpClient';

export const sellerService = {
  getSellerDashboard(vendorId?: string, options?: RequestOptions): Promise<SellerDashboardResponse> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request<SellerDashboardResponse>(`/seller/dashboard/${qs}`, options, true);
  },

  getSellerAnalytics(vendorId?: string, months = 6, options?: RequestOptions): Promise<SellerAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (vendorId) qs.set('vendor_id', vendorId);
    qs.set('months', String(months));
    return httpClient.request<SellerAnalyticsResponse>(`/seller/analytics/?${qs.toString()}`, options, true);
  },

  getSellerProducts(vendorId?: string, options?: RequestOptions): Promise<{ count: number; results: Product[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/products/${qs}`, options, true);
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
    images?: string[];
    sections?: string[];
    variants?: any[];
  }): Promise<{ success: boolean; message: string; product: Product }> {
    return httpClient.request(
      '/seller/products/',
      { method: 'POST', body: JSON.stringify(data) },
      true
    );
  },

  getSellerProductDetail(productId: string): Promise<{ success: boolean; product: Product }> {
    return httpClient.request(`/seller/products/${productId}/`, undefined, true);
  },

  updateSellerProduct(
    productId: string,
    data: Partial<Product> & { images?: string[]; gallery_urls?: string[]; variants?: any[] }
  ): Promise<{ success: boolean; product: Product }> {
    return httpClient.request(
      `/seller/products/${productId}/`,
      { method: 'PUT', body: JSON.stringify(data) },
      true
    );
  },

  toggleProductStock(productId: string, variantId?: string): Promise<{ success: boolean; in_stock: boolean; product: Product }> {
    return httpClient.request(
      `/seller/products/${productId}/toggle-stock/`,
      { method: 'PATCH', body: JSON.stringify(variantId ? { variant_id: variantId } : {}) },
      true
    );
  },

  restockProduct(
    productId: string,
    addStock = 25,
    variantId?: string
  ): Promise<{ success: boolean; message: string; stock: number; in_stock: boolean; product: Product }> {
    return httpClient.request(
      `/seller/products/${productId}/restock/`,
      { method: 'PATCH', body: JSON.stringify({ add_stock: addStock, ...(variantId ? { variant_id: variantId } : {}) }) },
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
    vendorId?: string,
    options?: RequestOptions
  ): Promise<{ count: number; average_rating: number; results: SellerReviewItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/reviews/${qs}`, options, true);
  },

  getSellerInventoryMovements(vendorId?: string, options?: RequestOptions): Promise<{ count: number; results: InventoryMovementItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/inventory/movements/${qs}`, options, true);
  },

  getSellerOrders(vendorId?: string, options?: RequestOptions): Promise<{ count: number; results: SellerFulfillmentItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/orders/${qs}`, options, true);
  },

  updateSellerFulfillmentStatus(
    fulfillmentId: string | number,
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

  getSellerOrderTracking(
    orderIdOrFulfillmentId: string | number,
    options?: RequestOptions
  ): Promise<DeliveryTrackingTelemetry> {
    return httpClient.request<DeliveryTrackingTelemetry>(
      `/delivery/orders/${orderIdOrFulfillmentId}/tracking/`,
      options,
      true
    );
  },

  getSellerStore(vendorId?: string, options?: RequestOptions): Promise<{ vendor: Vendor; settlements: SellerSettlementItem[] }> {
    const qs = vendorId ? `?vendor_id=${encodeURIComponent(vendorId)}` : '';
    return httpClient.request(`/seller/store/${qs}`, options, true);
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
