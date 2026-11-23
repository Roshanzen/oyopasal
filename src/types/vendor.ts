export interface Vendor {
  id: string;
  db_id?: number;
  name: string;
  slug: string;
  rating: number;
  delivery_time_mins: string;
  verified: boolean;
  is_verified?: boolean;
  is_approved?: boolean;
  status?: string;
  kyc_status?: string;
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

export interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  logo?: string;
  banner?: string;
  contact_email?: string;
  contact_phone?: string;
  phone?: string;
  email?: string;
  address?: string;
  business_hours?: Record<string, string>;
  latitude?: number | null;
  longitude?: number | null;
  shipping_policy?: string;
  return_policy?: string;
  is_active: boolean;
  is_verified: boolean;
  verified?: boolean;
  is_approved?: boolean;
  vendor_id?: string;
  vendor_name?: string;
  vendor_slug?: string;
  kyc_status?: string;
  rating?: number;
  delivery_time_mins?: string;
  open_time?: string;
  close_time?: string;
  is_open?: boolean;
  fulfillment_modes?: string;
  gallery?: string[];
  distance_km?: number;
  created_at?: string;
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
  fulfillment_id: string | number;
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
  total_amount?: number;
  items_count?: number;
  commission_amount: number;
  net_payout: number;
  created_at: string;
  items: {
    id: number | string;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price?: number;
    total?: number;
    image?: string;
    color?: string;
    size?: string;
    variant_name?: string;
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

export interface SellerDashboardStats {
  total_products: number;
  in_stock_count: number;
  low_stock_count: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  total_commission: number;
  net_earnings: number;
  commission_rate: number;
}

export interface SellerTopProduct {
  productId: number | null;
  productName: string;
  qty: number;
  rev: number;
}

export interface SellerLedgerEntry {
  id: number;
  vendorId: number;
  orderId: number | null;
  settlementId: number | null;
  entryType: string;
  amount: number;
  description: string;
  createdAt: string | null;
}

export interface SellerSettlementItem {
  id: number;
  vendorId: number;
  grossSales: number;
  commissionTotal: number;
  netPayout: number;
  status: string;
  payoutReference: string | null;
  paidAt: string | null;
  createdAt: string | null;
}

export interface SellerDashboardResponse {
  vendor: Vendor;
  approval_status: string;
  stats: SellerDashboardStats;
  top_products: SellerTopProduct[];
  recent_ledger: SellerLedgerEntry[];
  products: import('./product').Product[];
}

