export interface Vendor {
  id: string;
  name: string;
  slug: string;
  rating: number;
  delivery_time_mins: string;
  verified: boolean;
  distance_km?: number;
  location?: string;
  image?: string;
  tags?: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
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
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string };
  vendor: { id: string; name: string; rating: number; delivery_time_mins: string };
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  unit: string;
  stock: number;
  in_stock: boolean;
  is_organic: boolean;
  rating: number;
  reviews_count: number;
  image_url: string;
  gallery: string[];
  description: string;
  origin: string;
  variants: ProductVariant[];
  sections: string[];
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  cta_text: string;
  cta_category: string;
  image: string;
  code?: string;
  color_theme?: string;
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
  username: string;
  email: string;
  full_name: string;
  phone: string;
  token: string;
  default_address_id: string;
}

export interface TrackingStep {
  timestamp: string;
  title: string;
  description: string;
  done: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: 'ORDER_PLACED' | 'PACKED_BY_VENDOR' | 'RIDER_ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  estimated_delivery_mins: number;
  delivery_address: Address;
  delivery_option: 'EXPRESS_12_MINS' | 'SCHEDULED_TODAY';
  payment_method: 'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | 'CARD';
  payment_status: 'PAID' | 'PENDING';
  items_by_vendor: {
    vendor: { id: string; name: string };
    items: {
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
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: string;
}

export interface DRFPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
