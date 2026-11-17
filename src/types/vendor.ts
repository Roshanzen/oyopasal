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
