import { Address, CartSummary, DeliveryTrackingTelemetry, DRFPaginatedResponse, Order } from '../types';
import { httpClient } from './httpClient';

export const orderService = {
  validateCheckout(): Promise<{ valid: boolean; authoritative_cart: CartSummary }> {
    return httpClient.request('/checkout/validate/', {
      method: 'POST',
    });
  },

  createOrder(payload: {
    address_id: string;
    delivery_address?: Address;
    payment_method: string;
    delivery_option: string;
    notes?: string;
  }): Promise<Order> {
    return httpClient.request<Order>('/orders/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getOrders(): Promise<DRFPaginatedResponse<Order>> {
    return httpClient.request<DRFPaginatedResponse<Order>>('/orders/');
  },

  getOrderById(id: string): Promise<Order> {
    return httpClient.request<Order>(`/orders/${id}/`);
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

  getOrderTracking(orderId: string): Promise<DeliveryTrackingTelemetry> {
    return httpClient.request<DeliveryTrackingTelemetry>(`/delivery/orders/${orderId}/tracking/`);
  },

  getDeliveryProfile(): Promise<unknown> {
    return httpClient.request('/delivery/agent/profile/');
  },

  updateDeliveryAvailability(availability_status: 'offline' | 'available' | 'busy'): Promise<unknown> {
    return httpClient.request('/delivery/agent/availability/', {
      method: 'PATCH',
      body: JSON.stringify({ availability_status }),
    });
  },

  getDeliveryAssignments(): Promise<{ count: number; results: unknown[] }> {
    return httpClient.request('/delivery/assignments/');
  },

  pushDeliveryLocation(
    assignmentId: number,
    payload: { lat: number; lng: number; speed_kmh?: number; eta_minutes?: number; status_note?: string }
  ): Promise<unknown> {
    return httpClient.request(`/delivery/assignments/${assignmentId}/location/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDeliveryStatus(
    assignmentId: number,
    status: 'accepted' | 'picked_up' | 'in_transit' | 'delivered' | 'failed',
    proof_note?: string
  ): Promise<unknown> {
    return httpClient.request(`/delivery/assignments/${assignmentId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status, proof_note }),
    });
  },
};
