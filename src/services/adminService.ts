import { Advertisement, Order, Promotion } from '../types';
import { httpClient } from './httpClient';

export const adminService = {
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

    const resp = await httpClient.request<{
      success: boolean;
      asset: { id: number; url: string; filename: string; mime_type: string; size_bytes: number };
    }>(
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
  },

  getAdminOverview(from?: string, to?: string): Promise<any> {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return httpClient.request(`/admin/overview/${suffix}`);
  },

  getAdminUsers(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/users/');
  },

  updateAdminUser(id: number, payload: { is_active?: boolean; role?: string }): Promise<any> {
    return httpClient.request(`/admin/users/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  getAdminSellers(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/sellers/');
  },

  updateSellerApproval(
    vendorDbId: number,
    payload: { approval_status?: string; commission_rate?: number; rejection_reason?: string }
  ): Promise<any> {
    return httpClient.request(`/admin/sellers/${vendorDbId}/approval/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getAdminProducts(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/products/');
  },

  moderateAdminProduct(
    productDbId: number,
    payload: { approval_status?: string; is_active?: boolean }
  ): Promise<any> {
    return httpClient.request(`/admin/products/${productDbId}/moderation/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  createAdminCategory(payload: {
    name: string;
    name_ne?: string;
    slug: string;
    icon?: string;
    accent?: string;
    description?: string;
    image_url?: string;
    parent_id?: number;
  }): Promise<any> {
    return httpClient.request('/admin/categories/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAdminCategory(id: number, payload: Record<string, unknown>): Promise<any> {
    return httpClient.request(`/admin/categories/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAdminCategory(id: number): Promise<any> {
    return httpClient.request(`/admin/categories/${id}/`, { method: 'DELETE' });
  },

  getAdminPromotions(): Promise<{ count: number; results: Promotion[] }> {
    return httpClient.request('/admin/promotions/');
  },

  createAdminPromotion(payload: Record<string, unknown>): Promise<any> {
    return httpClient.request('/admin/promotions/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAdminPromotion(id: number, payload: Record<string, unknown>): Promise<any> {
    return httpClient.request(`/admin/promotions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAdminPromotion(id: number): Promise<any> {
    return httpClient.request(`/admin/promotions/${id}/`, { method: 'DELETE' });
  },

  getAdminAdvertisements(): Promise<{ count: number; results: Advertisement[] }> {
    return httpClient.request('/admin/advertisements/');
  },

  createAdminAdvertisement(payload: Record<string, unknown>): Promise<any> {
    return httpClient.request('/admin/advertisements/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAdminAdvertisement(id: number, payload: Record<string, unknown>): Promise<any> {
    return httpClient.request(`/admin/advertisements/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAdminAdvertisement(id: number): Promise<any> {
    return httpClient.request(`/admin/advertisements/${id}/`, { method: 'DELETE' });
  },

  getAdminPayments(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/payments/');
  },

  getAdminOrders(): Promise<{ count: number; results: Order[] }> {
    return httpClient.request('/admin/orders/');
  },

  assignRiderToOrder(orderId: string, agentId: number): Promise<any> {
    return httpClient.request(`/admin/orders/${orderId}/assign-rider/`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    });
  },

  getAdminRefunds(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/refunds/');
  },

  updateAdminRefund(
    id: number,
    status: 'approved' | 'rejected' | 'processed',
    admin_note?: string
  ): Promise<any> {
    return httpClient.request(`/admin/refunds/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note }),
    });
  },

  getAdminZones(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/zones/');
  },

  createAdminZone(payload: Record<string, unknown>): Promise<any> {
    return httpClient.request('/admin/zones/', { method: 'POST', body: JSON.stringify(payload) });
  },

  getAdminRiders(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/riders/');
  },

  updateAdminRider(id: number, payload: { verification_status?: string; availability_status?: string }): Promise<any> {
    return httpClient.request(`/admin/riders/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  getAdminCoupons(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/coupons/');
  },

  createAdminCoupon(payload: Record<string, unknown>): Promise<any> {
    return httpClient.request('/admin/coupons/', { method: 'POST', body: JSON.stringify(payload) });
  },

  toggleAdminCoupon(id: number, is_active: boolean): Promise<any> {
    return httpClient.request(`/admin/coupons/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
  },

  getAdminSettlements(): Promise<{ vendor_balances: any[]; settlements: any[] }> {
    return httpClient.request('/admin/settlements/');
  },

  generateSettlement(vendor_id: number): Promise<any> {
    return httpClient.request('/admin/settlements/generate/', {
      method: 'POST',
      body: JSON.stringify({ vendor_id }),
    });
  },

  paySettlement(id: number, payout_reference?: string): Promise<any> {
    return httpClient.request(`/admin/settlements/${id}/pay/`, {
      method: 'PATCH',
      body: JSON.stringify({ payout_reference }),
    });
  },

  getAdminTickets(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/tickets/');
  },

  updateAdminTicket(id: number, status: string): Promise<any> {
    return httpClient.request(`/admin/tickets/${id}/`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  getAdminAuditLogs(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/audit-logs/');
  },

  getAdminSettings(): Promise<{ count: number; results: any[] }> {
    return httpClient.request('/admin/settings/');
  },

  saveAdminSetting(key: string, value: Record<string, unknown>, description?: string): Promise<any> {
    return httpClient.request('/admin/settings/', {
      method: 'PUT',
      body: JSON.stringify({ key, value, description }),
    });
  },
};
