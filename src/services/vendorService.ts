import { Advertisement, DRFPaginatedResponse, HeroBanner, Promotion, PublicSettings, StoreDetail, Vendor } from '../types';
import { httpClient, RequestOptions } from './httpClient';

export const vendorService = {
  getStoreBySlug(slug: string, options?: RequestOptions): Promise<StoreDetail> {
    return httpClient.request<StoreDetail>(`/stores/${encodeURIComponent(slug)}/`, {
      cacheTtlMs: 5000,
      ...options,
    });
  },

  getHeroBanners(options?: RequestOptions): Promise<HeroBanner[]> {
    return httpClient.request<HeroBanner[]>('/hero-banners/', {
      cacheTtlMs: 2000,
      bypassCache: true,
      ...options,
    });
  },
  getVendors(options?: RequestOptions): Promise<DRFPaginatedResponse<Vendor>> {
    return httpClient.request<DRFPaginatedResponse<Vendor>>('/vendors/', {
      cacheTtlMs: 30000,
      ...options,
    });
  },

  registerVendor(data: {
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
    return httpClient.request('/auth/register-vendor/', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        owner_name: data.contact_person,
        store_category: data.category,
        store_address: `${data.area}${data.city ? ', ' + data.city : ''}`,
        email_or_phone: data.email || data.phone,
      }),
    });
  },

  getPromotions(placement?: string, options?: RequestOptions): Promise<DRFPaginatedResponse<Promotion>> {
    const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
    return httpClient.request<DRFPaginatedResponse<Promotion>>(`/promotions/${qs}`, {
      cacheTtlMs: 20000,
      ...options,
    });
  },

  getAdvertisements(placement?: string, options?: RequestOptions): Promise<{ count: number; results: Advertisement[] }> {
    const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
    return httpClient.request(`/advertisements/${qs}`, {
      cacheTtlMs: 20000,
      ...options,
    });
  },

  trackAdvertisementClick(id: string | number): Promise<{ success: boolean }> {
    return httpClient.request(`/advertisements/${id}/click/`, { method: 'POST' });
  },

  getPublicSettings(options?: RequestOptions): Promise<PublicSettings> {
    return httpClient.request<PublicSettings>('/settings/public/', {
      cacheTtlMs: 60000,
      ...options,
    });
  },
};
