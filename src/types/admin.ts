export interface AdminRevenueSeriesPoint {
  day: string;
  revenue: number;
  orders: number;
}

export interface AdminOverviewKpis {
  total_gmv: number;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_users: number;
  total_customers: number;
  active_vendors: number;
  pending_seller_approvals: number;
  pending_products: number;
  platform_commission: number;
  total_refunds: number;
  pending_refunds: number;
  open_support_tickets: number;
  low_stock_products: number;
  delivery_agent_stats: {
    total: number;
    approved: number;
    available: number;
    busy: number;
  };
}

export interface AdminOverviewResponse {
  filter: {
    from: string | null;
    to: string | null;
  };
  kpis: AdminOverviewKpis;
  revenue_series: AdminRevenueSeriesPoint[];
}

export interface AdminUserItem {
  id: number;
  uid: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'customer' | 'seller' | 'admin' | 'delivery_agent' | string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string | null;
}

export interface AdminSellerProfile {
  id: number;
  vendorId: number;
  userId: number;
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  panVatNumber: string | null;
  dailyOrdersEstimate: string | null;
  approvalStatus: string;
  rejectionReason: string | null;
}

export interface AdminSellerItem {
  id: string;
  db_id: number;
  name: string;
  slug: string;
  rating: number;
  delivery_time_mins: string;
  verified: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended' | string;
  commission_rate: number;
  is_online: boolean;
  area: string;
  city: string;
  phone?: string;
  email?: string;
  profile: AdminSellerProfile | null;
}

export interface AdminProductItem {
  id: number;
  externalKey: string | null;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  unit: string;
  inStock: boolean;
  stockCount: number;
  lowStockThreshold: number;
  vendorName: string;
  image: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | string;
  isActive: boolean;
  createdAt: string | null;
}

export interface AdminPaymentItem {
  id: number;
  order_id: number;
  order_number: string;
  order_status: string;
  customer_name: string;
  customer_email: string;
  method: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  gateway_ref_id: string | null;
  created_at: string | null;
}

export interface AdminRefundItem {
  id: number;
  order_id: number;
  order_number: string;
  customer_name: string;
  amount: number;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'processed' | string;
  admin_note: string | null;
  created_at: string | null;
}

export interface AdminZoneItem {
  id: number;
  name: string;
  slug: string;
  city: string;
  baseDeliveryFee: number;
  freeDeliveryThreshold: number;
  estimatedMins: number;
  radiusKm: string;
  isActive: boolean;
}

export interface AdminRiderItem {
  id: number;
  userId: number;
  fullName: string;
  phone: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string | null;
  verificationStatus: 'pending' | 'approved' | 'suspended' | string;
  availabilityStatus: 'offline' | 'available' | 'busy' | string;
  currentLat: string | null;
  currentLng: string | null;
  rating: string;
  totalDeliveries: number;
}

export interface AdminCouponItem {
  id: number;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  usedCount: number;
  usageLimit: number | null;
  isActive: boolean;
}

export interface AdminVendorBalance {
  vendor_id: number;
  vendor_name: string;
  commission_rate: number;
  gross_sales: number;
  commission: number;
  net_balance: number;
}

export interface AdminSettlementItem {
  id: number;
  vendorId: number;
  vendor_name: string;
  grossSales: number;
  commissionTotal: number;
  netPayout: number;
  status: string;
  payoutReference: string | null;
  paidAt: string | null;
  createdAt: string | null;
}

export interface AdminTicketMessageItem {
  id: number;
  ticketId: number;
  senderRole: string;
  message: string;
  createdAt: string | null;
}

export interface AdminTicketItem {
  id: number;
  ticketNumber: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | string;
  priority: string;
  orderId: number | null;
  customer_name: string;
  customer_email: string;
  createdAt: string | null;
  updatedAt: string | null;
  messages: AdminTicketMessageItem[];
}

export interface AdminAuditLogItem {
  id: number;
  actorUserId: number | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string | null;
}

export interface AdminSettingItem {
  id: number;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updatedAt: string | null;
}
