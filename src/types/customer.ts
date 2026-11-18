import { Order } from './order';

export interface NotificationItem {
  id: string;
  db_id?: number;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: string;
  reference_url?: string | null;
}

export interface ChatProductOffer {
  product_id: string;
  db_id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  stock: number;
  image_url: string;
  vendor_id: string;
  vendor_name: string;
  vendor_area: string;
  vendor_rating: number;
  distance_km: number;
  eta_mins: number;
  recommended_badge: string;
  suggested_quantity: number;
}

export interface ChatOrderPreviewItem {
  product_id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  stock: number;
  image_url: string;
  vendor_id: string;
  vendor_name: string;
  vendor_rating: number;
  distance_km: number;
  eta_mins: number;
}

export interface ChatOrderPreview {
  items: ChatOrderPreviewItem[];
  assigned_address: {
    id?: string;
    title: string;
    street: string;
    area: string;
    city: string;
    lat: number;
    lng: number;
  };
  payment_method: 'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | string;
  delivery_option: 'EXPRESS_12_MINS' | 'SCHEDULED_TODAY' | string;
  coupon_code?: string | null;
  subtotal: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  handling_fee: number;
  discount: number;
  total_amount: number;
  estimated_mins: number;
  requires_auth: boolean;
}

export interface ChatResponsePayload {
  reply: string;
  groundingChunks?: { maps?: { uri?: string; title?: string } }[];
  recommendedOffers?: ChatProductOffer[];
  orderPreview?: ChatOrderPreview | null;
  placedOrder?: Order | null;
  requiresAuthForAutoOrder?: boolean;
  cartUpdated?: boolean;
  assignedLocation?: {
    title: string;
    area: string;
    street: string;
    city: string;
    lat: number;
    lng: number;
  };
  catalogStats?: {
    totalProducts: number;
    totalVendors: number;
  };
}
