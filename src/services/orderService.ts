import {
  Address,
  CartSummary,
  DeliveryAgentProfile,
  DeliveryAssignmentItem,
  DeliveryTrackingTelemetry,
  DRFPaginatedResponse,
  Order,
} from '../types';
import { httpClient, RequestOptions } from './httpClient';

export const orderService = {
  validateCheckout(): Promise<{ valid: boolean; authoritative_cart: CartSummary }> {
    return httpClient.request('/checkout/validate/', {
      method: 'POST',
    });
  },

  async createOrder(payload: {
    address_id?: string;
    delivery_address?: Address;
    payment_method: string;
    delivery_option?: string;
    notes?: string;
  }): Promise<Order> {
    const res = await httpClient.request<any>('/orders/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res?.data && typeof res.data === 'object' && res.data.id) {
      return res.data;
    }
    return res;
  },

  async getOrders(options?: RequestOptions): Promise<DRFPaginatedResponse<Order>> {
    const res = await httpClient.request<any>('/orders/', options);
    const normalizeOrder = (raw: any): Order => {
      if (!raw || typeof raw !== 'object') return raw;
      const rawVendorItems = Array.isArray(raw.items_by_vendor) ? raw.items_by_vendor : [];
      return {
        ...raw,
        items_by_vendor: rawVendorItems.map((vg: any) => ({
          vendor: {
            id: vg?.vendor?.id || '',
            name: vg?.vendor?.name || 'Local Store',
            lat: vg?.vendor?.lat,
            lng: vg?.vendor?.lng,
            area: vg?.vendor?.area || 'Kathmandu',
          },
          fulfillment_status: vg?.fulfillment_status || raw.status || 'CONFIRMED',
          fulfillment_id: vg?.fulfillment_id,
          items: Array.isArray(vg?.items)
            ? vg.items.map((it: any) => ({
                id: it?.id,
                product_id: it?.product_id || null,
                product_name: it?.product_name || 'Item',
                unit: it?.unit || 'piece',
                quantity: Number(it?.quantity || 1),
                unit_price: Number(it?.unit_price || it?.price || 0),
                total: Number(it?.total || (Number(it?.unit_price || 0) * Number(it?.quantity || 1))),
                image_url: it?.image_url || '',
              }))
            : [],
          vendor_delivery_fee: Number(vg?.vendor_delivery_fee || 0),
        })),
        tracking_updates: Array.isArray(raw.tracking_updates) ? raw.tracking_updates : [],
        total_amount: Number(raw.total_amount ?? raw.grand_total ?? 0),
        subtotal: Number(raw.subtotal ?? 0),
        delivery_fee: Number(raw.delivery_fee ?? raw.delivery_total ?? 0),
        handling_fee: Number(raw.handling_fee ?? 15),
        coupon_discount: Number(raw.coupon_discount ?? raw.discount_total ?? 0),
        payment_method: raw.payment_method || 'COD',
        payment_status: raw.payment_status || 'UNPAID',
        status: raw.status || 'ORDER_PLACED',
      };
    };

    if (Array.isArray(res)) {
      const normalized = res.map(normalizeOrder);
      return { count: normalized.length, next: null, previous: null, results: normalized };
    }
    if (Array.isArray(res?.results)) {
      const normalized = res.results.map(normalizeOrder);
      return {
        count: res.count ?? normalized.length,
        next: res.next ?? null,
        previous: res.previous ?? null,
        results: normalized,
      };
    }
    return { count: 0, next: null, previous: null, results: [] };
  },

  async getOrderById(id: string, options?: RequestOptions): Promise<Order> {
    const res = await httpClient.request<any>(`/orders/${id}/`, options);
    const raw = res?.data && typeof res.data === 'object' && res.data.id ? res.data : res;
    if (!raw || typeof raw !== 'object') return raw;
    const rawVendorItems = Array.isArray(raw.items_by_vendor) ? raw.items_by_vendor : [];
    return {
      ...raw,
      items_by_vendor: rawVendorItems.map((vg: any) => ({
        vendor: {
          id: vg?.vendor?.id || '',
          name: vg?.vendor?.name || 'Local Store',
          lat: vg?.vendor?.lat,
          lng: vg?.vendor?.lng,
          area: vg?.vendor?.area || 'Kathmandu',
        },
        fulfillment_status: vg?.fulfillment_status || raw.status || 'CONFIRMED',
        fulfillment_id: vg?.fulfillment_id,
        items: Array.isArray(vg?.items)
          ? vg.items.map((it: any) => ({
              id: it?.id,
              product_id: it?.product_id || null,
              product_name: it?.product_name || 'Item',
              unit: it?.unit || 'piece',
              quantity: Number(it?.quantity || 1),
              unit_price: Number(it?.unit_price || it?.price || 0),
              total: Number(it?.total || (Number(it?.unit_price || 0) * Number(it?.quantity || 1))),
              image_url: it?.image_url || '',
            }))
          : [],
        vendor_delivery_fee: Number(vg?.vendor_delivery_fee || 0),
      })),
      tracking_updates: Array.isArray(raw.tracking_updates) ? raw.tracking_updates : [],
      total_amount: Number(raw.total_amount ?? raw.grand_total ?? 0),
      subtotal: Number(raw.subtotal ?? 0),
      delivery_fee: Number(raw.delivery_fee ?? raw.delivery_total ?? 0),
      handling_fee: Number(raw.handling_fee ?? 15),
      coupon_discount: Number(raw.coupon_discount ?? raw.discount_total ?? 0),
      payment_method: raw.payment_method || 'COD',
      payment_status: raw.payment_status || 'UNPAID',
      status: raw.status || 'ORDER_PLACED',
    };
  },

  cancelOrder(id: string, reason?: string): Promise<Order> {
    return httpClient.request<Order>(`/orders/${id}/cancel/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  reorderOrder(id: string): Promise<{ success: boolean; added_count: number; skipped_items: string[]; cart: CartSummary }> {
    return httpClient.request(`/orders/${id}/reorder/`, {
      method: 'POST',
    });
  },

  requestRefund(id: string, reason: string, amount?: number): Promise<{ success: boolean; refund: unknown }> {
    return httpClient.request(`/orders/${id}/refund/`, {
      method: 'POST',
      body: JSON.stringify({ reason, amount }),
    });
  },

  getOrderTracking(orderId: string, options?: RequestOptions): Promise<DeliveryTrackingTelemetry> {
    return httpClient.request<DeliveryTrackingTelemetry>(`/orders/${orderId}/tracking/`, options);
  },

  getDeliveryProfile(): Promise<DeliveryAgentProfile> {
    return httpClient.request<DeliveryAgentProfile>('/delivery/agent/profile/');
  },

  updateDeliveryAvailability(
    availability_status: 'offline' | 'available' | 'busy'
  ): Promise<{ success: boolean; availability_status: string }> {
    return httpClient.request('/delivery/agent/availability/', {
      method: 'PATCH',
      body: JSON.stringify({ availability_status }),
    });
  },

  getDeliveryAssignments(): Promise<{ count: number; results: DeliveryAssignmentItem[] }> {
    return httpClient.request('/delivery/assignments/');
  },

  pushDeliveryLocation(
    assignmentId: number,
    payload: { lat: number; lng: number; speed_kmh?: number; eta_minutes?: number; status_note?: string }
  ): Promise<{ success: boolean; lat: number; lng: number }> {
    return httpClient.request(`/delivery/assignments/${assignmentId}/location/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDeliveryStatus(
    assignmentId: number,
    status: 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'failed',
    proof_note?: string
  ): Promise<{ success: boolean; status: string; order_status: string | null }> {
    return httpClient.request(`/delivery/assignments/${assignmentId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, proof_note }),
    });
  },
};
