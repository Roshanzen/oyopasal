import { Address, ChatResponsePayload, Order } from '../types';
import { httpClient } from './httpClient';

export const chatService = {
  sendChatMessage(payload: {
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
  }): Promise<ChatResponsePayload> {
    return httpClient.request<ChatResponsePayload>('/chat/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  placeDirectChatOrder(payload: {
    items: { product_id: string; quantity: number; variant_id?: string }[];
    address_id?: string;
    delivery_address?: Partial<Address>;
    payment_method?: string;
    delivery_option?: string;
    coupon_code?: string | null;
    notes?: string;
  }): Promise<{ success: boolean; order: Order }> {
    return httpClient.request('/chat/direct-order/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
