export type PaymentMethod = 'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | 'CARD';

export interface PendingPaymentChallenge {
  orderId: string;
  orderNumber: string;
  method: string;
  amount: number;
  transactionUuid: string;
  signature: string;
  productCode: string;
}

export interface PaymentInitiateResponse {
  success: boolean;
  payment_id: number;
  order_id: string;
  order_number: string;
  method: string;
  amount: number;
  currency: string;
  transaction_uuid: string;
  product_code: string;
  signature: string;
  mode: string;
}

export interface PaymentVerifyResponse {
  success: boolean;
  payment_status: string;
  transaction_uuid: string;
  order_number: string;
}
