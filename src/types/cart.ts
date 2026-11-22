import { Product } from './product';

export interface ActiveCouponItem {
  id: number;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  product: Product;
  quantity: number;
  selected_variant_id?: string;
  variant_id?: string;
  variant_sku?: string;
  variant_name?: string;
  color?: string;
  color_code?: string;
  size?: string;
  image_url?: string;
  attributes?: Record<string, any>;
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
