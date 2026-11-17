import { PaymentInitiateResponse, PaymentVerifyResponse } from '../types';
import { httpClient } from './httpClient';

export const paymentService = {
  initiatePayment(orderId: string, method: string): Promise<PaymentInitiateResponse> {
    return httpClient.request<PaymentInitiateResponse>('/payments/initiate/', {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, method }),
    });
  },

  verifyPayment(payload: {
    order_id: string;
    transaction_uuid: string;
    signature: string;
    gateway_ref?: string;
  }): Promise<PaymentVerifyResponse> {
    return httpClient.request<PaymentVerifyResponse>('/payments/verify/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
