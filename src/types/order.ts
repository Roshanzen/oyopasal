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
  payment_id?: number | null;
  items_by_vendor?: {
    vendor: { id: string; name: string; lat?: number; lng?: number; area?: string };
    fulfillment_status?: string;
    fulfillment_id?: string | number;
    items: {
      id?: string | number;
      product_id?: string | null;
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
  grand_total?: number;
  delivery_total?: number;
  tracking_updates: TrackingStep[];
  delivery_assignment?: DeliveryTrackingTelemetry['assignment'];
  tracking_events?: DeliveryTrackingTelemetry['events'];
}

export interface DeliveryAgentProfile {
  id: number;
  full_name: string;
  phone: string;
  vehicle_type: string;
  vehicle_number: string;
  verification_status: 'pending' | 'approved' | 'suspended' | string;
  availability_status: 'offline' | 'available' | 'busy' | string;
  current_lat: number | null;
  current_lng: number | null;
  rating: number;
  total_deliveries: number;
}

export interface DeliveryAssignmentItem {
  id: number;
  status: string;
  order_id: number;
  order_external_id: string;
  order_number: string;
  order_status: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  vendor_name: string;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  current_lat: number | null;
  current_lng: number | null;
  eta_minutes: number | null;
  speed_kmh: number;
}

export interface DeliveryTrackingTelemetry {
  order_id: string;
  order_number: string;
  order_status: string;
  remaining_km?: number | null;
  estimated_minutes?: number | null;
  courier_speed_kmh?: number | null;
  prep_buffer_mins?: number | null;
  shipping_address?: Record<string, any> | null;
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
    courier_speed_kmh?: number | null;
    prep_buffer_mins?: number | null;
    remaining_km?: number | null;
    estimated_minutes?: number | null;
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

