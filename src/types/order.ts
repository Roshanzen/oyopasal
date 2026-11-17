import { Address } from './address';
import { PaymentMethod } from './payment';

export interface TrackingStep {
  timestamp: string;
  title: string;
  description: string;
  done: boolean;
}

export type OrderStatus =
  | 'ORDER_PLACED'
  | 'CONFIRMED_BY_VENDOR'
  | 'PACKED_BY_VENDOR'
  | 'RIDER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Order {
  id: string;
  db_id?: number;
  order_number: string;
  created_at: string;
  status: OrderStatus;
  estimated_delivery_mins: number;
  delivery_address: Address;
  delivery_option: 'EXPRESS_12_MINS' | 'SCHEDULED_TODAY';
  payment_method: PaymentMethod;
  payment_status: 'PAID' | 'PENDING';
  items_by_vendor: {
    vendor: { id: string; name: string };
    fulfillment_status?: string;
    items: {
      product_id?: string;
      product_name: string;
      unit: string;
      quantity: number;
      unit_price: number;
      total: number;
      image_url: string;
    }[];
    vendor_delivery_fee: number;
  }[];
  subtotal: number;
  delivery_fee: number;
  handling_fee: number;
  coupon_discount: number;
  total_amount: number;
  tracking_updates: TrackingStep[];
}

export interface DeliveryTrackingTelemetry {
  order_id: string;
  order_number: string;
  order_status: string;
  assignment: {
    id: number;
    status: string;
    pickup_lat: number | null;
    pickup_lng: number | null;
    dropoff_lat: number | null;
    dropoff_lng: number | null;
    current_lat: number | null;
    current_lng: number | null;
    speed_kmh: number;
    eta_minutes: number | null;
    agent: {
      id: number;
      full_name: string;
      phone: string;
      vehicle_type: string;
      vehicle_number: string;
      rating: number;
    } | null;
    updated_at: string | null;
  } | null;
  events: {
    id: number;
    lat: number;
    lng: number;
    speed_kmh: number;
    heading: number;
    status_note: string | null;
    recorded_at: string | null;
  }[];
}

export interface SupportTicket {
  id: number;
  ticket_number: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | string;
  priority: string;
  order_id?: number | null;
  created_at: string;
  messages: {
    id: number;
    sender_role: string;
    message: string;
    created_at: string;
  }[];
}
