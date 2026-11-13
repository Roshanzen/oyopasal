export interface Vendor {
  id: string;
  db_id?: number;
  name: string;
  slug: string;
  rating: number;
  delivery_time_mins: string;
  verified: boolean;
  approval_status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  commission_rate?: number;
  is_online?: boolean;
  open_time?: string;
  close_time?: string;
  phone?: string;
  email?: string;
  area?: string;
  city?: string;
  description?: string;
  distance_km?: number;
  location?: string;
  image?: string;
  logo_url?: string;
  cover_image_url?: string;
  tags?: string[];
  lat?: number;
  lng?: number;
}

export interface Category {
  id: string;
  db_id?: number;
  name: string;
  name_ne?: string;
  slug: string;
  parent_id?: number | null;
  icon: string;
  image_url?: string | null;
  item_count: number;
  accent: string;
  description: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  unit: string;
  price: number;
  original_price: number;
  stock: number;
}

export interface Product {
  id: string;
  db_id?: number;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string };
  vendor: { id: string; name: string; rating: number; delivery_time_mins: string };
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  unit: string;
  stock: number;
  low_stock_threshold?: number;
  in_stock: boolean;
  is_organic: boolean;
  rating: number;
  reviews_count: number;
  image_url: string;
  gallery: string[];
  gallery_items?: { id: number; image_url: string; alt_text?: string; sort_order: number; is_primary: boolean }[];
  description: string;
  origin: string;
  variants: ProductVariant[];
  sections: string[];
}

export interface Promotion {
  id: string;
  db_id?: number;
  title: string;
  title_ne?: string;
  subtitle: string;
  subtitle_ne?: string;
  badge: string;
  badge_ne?: string;
  cta_text: string;
  cta_text_ne?: string;
  cta_category: string;
  destination_url?: string | null;
  image: string;
  code?: string;
  color_theme?: string;
  placement?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

export interface Advertisement {
  id: string;
  db_id: number;
  title: string;
  title_ne?: string;
  subtitle: string;
  subtitle_ne?: string;
  image_url: string;
  destination_url: string;
  placement: string;
  priority: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  clicks_count: number;
}

export interface DeliveryZoneItem {
  id: number;
  name: string;
  slug: string;
  city: string;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  base_delivery_fee: number;
  free_delivery_threshold: number;
  estimated_mins: number;
}

export interface ActiveCouponItem {
  id: number;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
}

export interface PublicSettings {
  delivery_fees: {
    baseDeliveryFee: number;
    freeDeliveryThreshold: number;
    handlingFee: number;
    defaultEtaMins: number;
  };
  commission_policy: {
    defaultCommissionRate: number;
    newSellerZeroCommissionDays: number;
  };
  store_support: {
    brandName: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    hours: string;
  };
}

export interface SellerReviewItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image: string;
  author_name: string;
  rating: number;
  title?: string | null;
  comment: string;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  product: Product;
  quantity: number;
  selected_variant_id?: string;
  unit_price: number;
  total_price: number;
}

export interface VendorCartGroup {
  vendor: { id: string; name: string };
  items: CartItem[];
  subtotal: number;
  delivery_fee: number;
}

export interface Coupon {
  code: string;
  discount_amount: number;
  description: string;
}

export interface CartSummary {
  items: CartItem[];
  item_count: number;
  vendor_groups: VendorCartGroup[];
  subtotal: number;
  delivery_fee: number;
  free_delivery_threshold: number;
  amount_needed_for_free_delivery: number;
  handling_fee: number;
  coupon: Coupon | null;
  total: number;
}

export interface Address {
  id: string;
  title: string;
  recipient_name: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  landmark: string;
  is_default: boolean;
  lat?: number;
  lng?: number;
}

export interface UserProfile {
  id: string;
  db_id?: number;
  uid?: string;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  role?: 'customer' | 'seller' | 'admin' | 'delivery_agent' | string;
  is_verified?: boolean;
  token: string;
  default_address_id: string;
  vendor_id?: string | null;
  vendor_approval_status?: string | null;
}

export interface TrackingStep {
  timestamp: string;
  title: string;
  description: string;
  done: boolean;
}

export interface Order {
  id: string;
  db_id?: number;
  order_number: string;
  created_at: string;
  status:
    | 'ORDER_PLACED'
    | 'CONFIRMED_BY_VENDOR'
    | 'PACKED_BY_VENDOR'
    | 'RIDER_ASSIGNED'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED';
  estimated_delivery_mins: number;
  delivery_address: Address;
  delivery_option: 'EXPRESS_12_MINS' | 'SCHEDULED_TODAY';
  payment_method: 'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | 'CARD';
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

export interface ReviewItem {
  id: number;
  rating: number;
  title?: string | null;
  comment: string;
  author_name: string;
  is_verified_purchase: boolean;
  created_at: string;
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

export interface SellerAnalyticsResponse {
  vendor_id: string;
  period_months: number;
  summary: {
    total_revenue: number;
    total_orders: number;
    avg_order_value: number;
  };
  monthly_trend: {
    month: string;
    revenue: number;
    orders: number;
    netPayout: number;
  }[];
  top_products: {
    name: string;
    shortName: string;
    units: number;
    revenue: number;
  }[];
  category_breakdown: {
    category: string;
    revenue: number;
    units: number;
  }[];
  fulfillment_status_counts: { status: string; count: number }[];
}

export interface SellerFulfillmentItem {
  fulfillment_id: number;
  order_id: string;
  order_number: string;
  vendor_id?: string;
  vendor_name?: string;
  status: string;
  parent_order_status: string;
  customer_name: string;
  customer_phone?: string;
  customer_area: string;
  delivery_address?: string;
  delivery_city?: string;
  notes?: string | null;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  commission_amount: number;
  net_payout: number;
  created_at: string;
  items: {
    id: number;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    image: string;
  }[];
}

export interface InventoryMovementItem {
  id: number;
  product_name: string;
  delta: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  reference_id?: string | null;
  note?: string | null;
  created_at: string;
}

export interface DRFPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
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
  groundingChunks?: any[];
  recommendedOffers?: ChatProductOffer[];
  orderPreview?: ChatOrderPreview | null;
  placedOrder?: Order | null;
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

