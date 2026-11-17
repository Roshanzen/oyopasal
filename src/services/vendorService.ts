import { Advertisement, DRFPaginatedResponse, Promotion, PublicSettings, Vendor } from '../types';
import { httpClient } from './httpClient';

export const vendorService = {
  getVendors(): Promise<DRFPaginatedResponse<Vendor>> {
    return httpClient.request<DRFPaginatedResponse<Vendor>>('/vendors/');
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
    return httpClient.request('/vendors/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPromotions(placement?: string): Promise<DRFPaginatedResponse<Promotion>> {
    const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
    return httpClient.request<DRFPaginatedResponse<Promotion>>(`/promotions/${qs}`);
  },

  getAdvertisements(placement?: string): Promise<{ count: number; results: Advertisement[] }> {
    const qs = placement ? `?placement=${encodeURIComponent(placement)}` : '';
    return httpClient.request(`/advertisements/${qs}`);
  },

  trackAdvertisementClick(id: string | number): Promise<{ success: boolean }> {
    return httpClient.request(`/advertisements/${id}/click/`, { method: 'POST' });
  },

  getPublicSettings(): Promise<PublicSettings> {
    return httpClient.request<PublicSettings>('/settings/public/');
  },
};
