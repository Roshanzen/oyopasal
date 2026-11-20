import {
  AdminAuditLogItem,
  AdminCouponItem,
  AdminOverviewResponse,
  AdminPaymentItem,
  AdminProductItem,
  AdminRefundItem,
  AdminRiderItem,
  AdminSellerItem,
  AdminSettingItem,
  AdminSettlementItem,
  AdminTicketItem,
  AdminUserItem,
  AdminVendorBalance,
  AdminZoneItem,
  Advertisement,
  Category,
  HeroBanner,
  Order,
  Promotion,
} from '../types';
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

  getAdminOverview(from?: string, to?: string): Promise<AdminOverviewResponse> {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return httpClient.request<AdminOverviewResponse>(`/admin/overview/${suffix}`);
  },

  getAdminUsers(): Promise<{ count: number; results: AdminUserItem[] }> {
    return httpClient.request('/admin/users/');
  },

  updateAdminUser(
    id: number,
    payload: { is_active?: boolean; role?: string }
  ): Promise<{ success: boolean; user: AdminUserItem }> {
    return httpClient.request(`/admin/users/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  getAdminSellers(): Promise<{ count: number; results: AdminSellerItem[] }> {
    return httpClient.request('/admin/sellers/');
  },

  updateSellerApproval(
    vendorDbId: number,
    payload: { approval_status?: string; commission_rate?: number; rejection_reason?: string }
  ): Promise<{ success: boolean; vendor: AdminSellerItem }> {
    return httpClient.request(`/admin/sellers/${vendorDbId}/approval/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getAdminProducts(): Promise<{ count: number; results: AdminProductItem[] }> {
    return httpClient.request('/admin/products/');
  },

  moderateAdminProduct(
    productDbId: number,
    payload: { approval_status?: string; is_active?: boolean }
  ): Promise<{ success: boolean; product: AdminProductItem }> {
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
  }): Promise<{ success: boolean; category: Category }> {
    return httpClient.request('/admin/categories/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAdminCategory(
    id: number,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; category: Category }> {
    return httpClient.request(`/admin/categories/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAdminCategory(id: number): Promise<{ success: boolean }> {
    return httpClient.request(`/admin/categories/${id}/`, { method: 'DELETE' });
  },

  getAdminPromotions(): Promise<{ count: number; results: Promotion[] }> {
    return httpClient.request('/admin/promotions/');
  },

  createAdminPromotion(payload: Record<string, unknown>): Promise<{ success: boolean; promotion: Promotion }> {
    return httpClient.request('/admin/promotions/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAdminPromotion(
    id: number,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; promotion: Promotion }> {
    return httpClient.request(`/admin/promotions/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAdminPromotion(id: number): Promise<{ success: boolean }> {
    return httpClient.request(`/admin/promotions/${id}/`, { method: 'DELETE' });
  },

  getAdminAdvertisements(): Promise<{ count: number; results: Advertisement[] }> {
    return httpClient.request('/admin/advertisements/');
  },

  createAdminAdvertisement(
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; advertisement: Advertisement }> {
    return httpClient.request('/admin/advertisements/', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateAdminAdvertisement(
    id: number,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; advertisement: Advertisement }> {
    return httpClient.request(`/admin/advertisements/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  deleteAdminAdvertisement(id: number): Promise<{ success: boolean }> {
    return httpClient.request(`/admin/advertisements/${id}/`, { method: 'DELETE' });
  },

  getAdminPayments(): Promise<{ count: number; results: AdminPaymentItem[] }> {
    return httpClient.request('/admin/payments/');
  },

  getAdminOrders(): Promise<{ count: number; results: Order[] }> {
    return httpClient.request('/admin/orders/');
  },

  assignRiderToOrder(orderId: string, agentId: number): Promise<{ success: boolean; message?: string }> {
    return httpClient.request(`/admin/orders/${orderId}/assign-rider/`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    });
  },

  getAdminRefunds(): Promise<{ count: number; results: AdminRefundItem[] }> {
    return httpClient.request('/admin/refunds/');
  },

  updateAdminRefund(
    id: number,
    status: 'approved' | 'rejected' | 'processed',
    admin_note?: string
  ): Promise<{ success: boolean; refund: AdminRefundItem }> {
    return httpClient.request(`/admin/refunds/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, admin_note }),
    });
  },

  getAdminZones(): Promise<{ count: number; results: AdminZoneItem[] }> {
    return httpClient.request('/admin/zones/');
  },

  createAdminZone(payload: Record<string, unknown>): Promise<{ success: boolean; zone: AdminZoneItem }> {
    return httpClient.request('/admin/zones/', { method: 'POST', body: JSON.stringify(payload) });
  },

  getAdminRiders(): Promise<{ count: number; results: AdminRiderItem[] }> {
    return httpClient.request('/admin/riders/');
  },

  updateAdminRider(
    id: number,
    payload: { verification_status?: string; availability_status?: string }
  ): Promise<{ success: boolean; rider: AdminRiderItem }> {
    return httpClient.request(`/admin/riders/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  getAdminCoupons(): Promise<{ count: number; results: AdminCouponItem[] }> {
    return httpClient.request('/admin/coupons/');
  },

  createAdminCoupon(payload: Record<string, unknown>): Promise<{ success: boolean; coupon: AdminCouponItem }> {
    return httpClient.request('/admin/coupons/', { method: 'POST', body: JSON.stringify(payload) });
  },

  toggleAdminCoupon(id: number, is_active: boolean): Promise<{ success: boolean; coupon: AdminCouponItem }> {
    return httpClient.request(`/admin/coupons/${id}/`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
  },

  getAdminSettlements(): Promise<{ vendor_balances: AdminVendorBalance[]; settlements: AdminSettlementItem[] }> {
    return httpClient.request('/admin/settlements/');
  },

  generateSettlement(vendor_id: number): Promise<{ success: boolean; settlement: AdminSettlementItem }> {
    return httpClient.request('/admin/settlements/generate/', {
      method: 'POST',
      body: JSON.stringify({ vendor_id }),
    });
  },

  paySettlement(id: number, payout_reference?: string): Promise<{ success: boolean; settlement: AdminSettlementItem }> {
    return httpClient.request(`/admin/settlements/${id}/pay/`, {
      method: 'PATCH',
      body: JSON.stringify({ payout_reference }),
    });
  },

  getAdminTickets(): Promise<{ count: number; results: AdminTicketItem[] }> {
    return httpClient.request('/admin/tickets/');
  },

  updateAdminTicket(id: number, status: string): Promise<{ success: boolean; ticket: AdminTicketItem }> {
    return httpClient.request(`/admin/tickets/${id}/`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  getAdminAuditLogs(): Promise<{ count: number; results: AdminAuditLogItem[] }> {
    return httpClient.request('/admin/audit-logs/');
  },

  getAdminSettings(): Promise<{ count: number; results: AdminSettingItem[] }> {
    return httpClient.request('/admin/settings/');
  },

  saveAdminSetting(
    key: string,
    value: Record<string, unknown>,
    description?: string
  ): Promise<{ success: boolean; setting: AdminSettingItem }> {
    return httpClient.request('/admin/settings/', {
      method: 'PUT',
      body: JSON.stringify({ key, value, description }),
    });
  },

  getAdminHeroBanners(): Promise<HeroBanner[]> {
    return httpClient.request<HeroBanner[]>('/admin/hero-banners/', { bypassCache: true });
  },

  createAdminHeroBanner(payload: {
    data_url: string;
    filename?: string;
    target_url?: string;
    alt_text?: string;
    display_order?: number;
    is_active?: boolean;
  }): Promise<HeroBanner> {
    return httpClient.request<HeroBanner>('/admin/hero-banners/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAdminHeroBanner(
    id: number,
    payload: Partial<HeroBanner> & { data_url?: string; filename?: string }
  ): Promise<HeroBanner> {
    return httpClient.request<HeroBanner>(`/admin/hero-banners/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteAdminHeroBanner(id: number): Promise<{ success: boolean; message?: string }> {
    return httpClient.request<{ success: boolean; message?: string }>(`/admin/hero-banners/${id}/`, {
      method: 'DELETE',
    });
  },

  reorderAdminHeroBanner(banner_id: number, direction: 'up' | 'down'): Promise<HeroBanner[]> {
    return httpClient.request<HeroBanner[]>('/admin/hero-banners/reorder/', {
      method: 'POST',
      body: JSON.stringify({ banner_id, direction }),
    });
  },
};
