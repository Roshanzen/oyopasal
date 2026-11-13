import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. IDENTITY, ROLES, PROFILES & SESSIONS
// ============================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or internal auth UID
  email: text('email').notNull(),
  username: text('username'),
  passwordHash: text('password_hash'),
  fullName: text('full_name'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  role: text('role').default('customer').notNull(), // customer | seller | admin | delivery_agent
  isActive: boolean('is_active').default(true).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  defaultAddressId: integer('default_address_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userSessions = pgTable(
  'user_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    deviceInfo: text('device_info'),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_user_sessions_user_id').on(table.userId)]
);

export const adminProfiles = pgTable('admin_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  department: text('department').default('Operations').notNull(),
  permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
  isSuperAdmin: boolean('is_super_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 2. DELIVERY ZONES, VENDORS & SELLER PROFILES
// ============================================================================

export const deliveryZones = pgTable('delivery_zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  city: text('city').default('Kathmandu').notNull(),
  centerLat: text('center_lat').default('27.6986').notNull(),
  centerLng: text('center_lng').default('85.3292').notNull(),
  radiusKm: numeric('radius_km', { precision: 6, scale: 2 }).default('5.00').notNull(),
  baseDeliveryFee: integer('base_delivery_fee').default(35).notNull(),
  freeDeliveryThreshold: integer('free_delivery_threshold').default(499).notNull(),
  estimatedMins: integer('estimated_mins').default(12).notNull(),
  surgeMultiplier: numeric('surge_multiplier', { precision: 4, scale: 2 }).default('1.00').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  externalKey: text('external_key'), // e.g., v-himalayan
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  description: text('description'),
  logoUrl: text('logo_url'),
  coverImageUrl: text('cover_image_url'),
  phone: text('phone'),
  email: text('email'),
  rating: text('rating').default('4.8').notNull(),
  ratingCount: integer('rating_count').default(120).notNull(),
  eta: text('eta').default('12-15 mins').notNull(),
  distance: text('distance').default('1.2 km').notNull(),
  address: text('address').notNull(),
  area: text('area').default('New Baneshwor').notNull(),
  city: text('city').default('Kathmandu').notNull(),
  zoneId: integer('zone_id').references(() => deliveryZones.id),
  lat: text('lat').default('27.7172').notNull(),
  lng: text('lng').default('85.3240').notNull(),
  image: text('image').notNull(),
  cuisine: text('cuisine').notNull(),
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  isVerified: boolean('is_verified').default(true).notNull(),
  approvalStatus: text('approval_status').default('approved').notNull(), // pending | approved | suspended | rejected
  isOnline: boolean('is_online').default(true).notNull(),
  openTime: text('open_time').default('06:00').notNull(),
  closeTime: text('close_time').default('22:30').notNull(),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 2 }).default('10.00').notNull(),
  minOrderAmount: integer('min_order_amount').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sellerProfiles = pgTable('seller_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  vendorId: integer('vendor_id')
    .references(() => vendors.id, { onDelete: 'cascade' })
    .notNull(),
  businessName: text('business_name').notNull(),
  contactPerson: text('contact_person').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  panVatNumber: text('pan_vat_number'),
  citizenshipDocUrl: text('citizenship_doc_url'),
  bankName: text('bank_name'),
  bankAccountNumber: text('bank_account_number'),
  bankAccountHolder: text('bank_account_holder'),
  esewaMerchantId: text('esewa_merchant_id'),
  khaltiMerchantId: text('khalti_merchant_id'),
  dailyOrdersEstimate: text('daily_orders_estimate').default('20-50'),
  approvalStatus: text('approval_status').default('pending').notNull(), // pending | approved | rejected | suspended
  rejectionReason: text('rejection_reason'),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const deliveryAgents = pgTable('delivery_agents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  vehicleType: text('vehicle_type').default('EV Scooter').notNull(),
  vehicleNumber: text('vehicle_number').default('Ba 98 Pa 4412').notNull(),
  licenseNumber: text('license_number'),
  verificationStatus: text('verification_status').default('pending').notNull(), // pending | approved | suspended
  availabilityStatus: text('availability_status').default('offline').notNull(), // offline | available | busy
  currentLat: text('current_lat'),
  currentLng: text('current_lng'),
  lastLocationAt: timestamp('last_location_at'),
  zoneId: integer('zone_id').references(() => deliveryZones.id),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('4.90').notNull(),
  totalDeliveries: integer('total_deliveries').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const addresses = pgTable(
  'addresses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').default('Home').notNull(),
    recipientName: text('recipient_name').notNull(),
    phone: text('phone').notNull(),
    street: text('street').notNull(),
    area: text('area').notNull(),
    city: text('city').default('Kathmandu').notNull(),
    landmark: text('landmark').default('').notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
    lng: numeric('lng', { precision: 10, scale: 7 }).notNull(),
    zoneId: integer('zone_id').references(() => deliveryZones.id),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('idx_addresses_user_id').on(table.userId)]
);

// ============================================================================
// 3. CATEGORIES, PRODUCTS, VARIANTS, IMAGES & INVENTORY
// ============================================================================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  externalKey: text('external_key').unique(), // e.g., cat-fresh
  name: text('name').notNull(),
  nameNe: text('name_ne'),
  slug: text('slug').notNull().unique(),
  parentId: integer('parent_id'),
  icon: text('icon').default('Package').notNull(),
  accent: text('accent').default('#059669').notNull(),
  description: text('description').default('').notNull(),
  imageUrl: text('image_url'),
  displayOrder: integer('display_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    externalKey: text('external_key'), // e.g., prod-avocado
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    subCategory: text('sub_category'),
    categoryId: integer('category_id').references(() => categories.id),
    sku: text('sku'),
    price: integer('price').notNull(),
    originalPrice: integer('original_price').notNull(),
    discountPercent: integer('discount_percent').default(0).notNull(),
    unit: text('unit').notNull(),
    inStock: boolean('in_stock').default(true).notNull(),
    stockCount: integer('stock_count').default(50).notNull(),
    reservedStock: integer('reserved_stock').default(0).notNull(),
    lowStockThreshold: integer('low_stock_threshold').default(5).notNull(),
    isOrganic: boolean('is_organic').default(false).notNull(),
    origin: text('origin').default('Kathmandu Valley').notNull(),
    rating: text('rating').default('4.8').notNull(),
    ratingCount: integer('rating_count').default(85).notNull(),
    image: text('image').notNull(),
    description: text('description').notNull(),
    vendorId: integer('vendor_id').references(() => vendors.id),
    vendorName: text('vendor_name').notNull(),
    isBestSeller: boolean('is_best_seller').default(false).notNull(),
    isTrending: boolean('is_trending').default(false).notNull(),
    isFresh: boolean('is_fresh').default(false).notNull(),
    isDeal: boolean('is_deal').default(false).notNull(),
    isRecommended: boolean('is_recommended').default(false).notNull(),
    sections: jsonb('sections').$type<string[]>().default([]).notNull(),
    approvalStatus: text('approval_status').default('approved').notNull(), // pending | approved | rejected
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_products_vendor_id').on(table.vendorId),
    index('idx_products_category_id').on(table.categoryId),
  ]
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: serial('id').primaryKey(),
    externalKey: text('external_key'),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    unit: text('unit').notNull(),
    sku: text('sku'),
    price: integer('price').notNull(),
    originalPrice: integer('original_price').notNull(),
    stock: integer('stock').default(0).notNull(),
    reservedStock: integer('reserved_stock').default(0).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_product_variants_product_id').on(table.productId)]
);

export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    imageUrl: text('image_url').notNull(),
    altText: text('alt_text'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (table) => [index('idx_product_images_product_id').on(table.productId)]
);

export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    delta: integer('delta').notNull(),
    previousStock: integer('previous_stock').notNull(),
    newStock: integer('new_stock').notNull(),
    reason: text('reason').notNull(), // initial | restock | order_placed | order_cancelled | adjustment | toggle_stock
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_inventory_movements_product_id').on(table.productId)]
);

export const stockReservations = pgTable('stock_reservations', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id'),
  orderId: integer('order_id'),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  variantId: integer('variant_id'),
  quantity: integer('quantity').notNull(),
  status: text('status').default('active').notNull(), // active | committed | released | expired
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============================================================================
// 4. CARTS & WISHLISTS
// ============================================================================

export const carts = pgTable('carts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  sessionKey: text('session_key').notNull().unique(),
  appliedCouponCode: text('applied_coupon_code'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    cartId: integer('cart_id')
      .references(() => carts.id, { onDelete: 'cascade' })
      .notNull(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    variantId: integer('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    quantity: integer('quantity').default(1).notNull(),
    unitPriceSnapshot: integer('unit_price_snapshot').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('idx_cart_items_cart_id').on(table.cartId)]
);

export const wishlists = pgTable(
  'wishlists',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionKey: text('session_key'),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_wishlists_user_product').on(table.userId, table.productId)]
);

// ============================================================================
// 5. ORDERS, MULTI-VENDOR FULFILLMENTS & STATUS HISTORY
// ============================================================================

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    externalKey: text('external_key'),
    orderNumber: text('order_number').notNull().unique(),
    userId: integer('user_id').references(() => users.id),
    userUid: text('user_uid'),
    status: text('status').default('ORDER_PLACED').notNull(),
    totalAmount: integer('total_amount').notNull(),
    subtotal: integer('subtotal').notNull(),
    deliveryFee: integer('delivery_fee').notNull(),
    handlingFee: integer('handling_fee').default(15).notNull(),
    discount: integer('discount').default(0).notNull(),
    couponCode: text('coupon_code'),
    addressId: integer('address_id').references(() => addresses.id, { onDelete: 'set null' }),
    deliveryAddress: text('delivery_address').notNull(),
    deliveryArea: text('delivery_area').default('Kathmandu').notNull(),
    deliveryCity: text('delivery_city').default('Kathmandu').notNull(),
    deliveryLandmark: text('delivery_landmark').default(''),
    deliveryTitle: text('delivery_title').default('Home'),
    deliveryLat: numeric('delivery_lat', { precision: 10, scale: 7 }),
    deliveryLng: numeric('delivery_lng', { precision: 10, scale: 7 }),
    recipientName: text('recipient_name').notNull(),
    recipientPhone: text('recipient_phone').notNull(),
    deliveryOption: text('delivery_option').default('EXPRESS_12_MINS').notNull(),
    paymentMethod: text('payment_method').default('CASH_ON_DELIVERY').notNull(),
    paymentStatus: text('payment_status').default('PENDING').notNull(),
    vendorName: text('vendor_name').notNull(),
    estimatedMinutes: integer('estimated_minutes').default(12).notNull(),
    notes: text('notes'),
    cancelledReason: text('cancelled_reason'),
    cancelledAt: timestamp('cancelled_at'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_orders_user_id').on(table.userId),
    index('idx_orders_status').on(table.status),
  ]
);

export const vendorFulfillments = pgTable(
  'vendor_fulfillments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    vendorId: integer('vendor_id')
      .references(() => vendors.id)
      .notNull(),
    status: text('status').default('ORDER_PLACED').notNull(), // ORDER_PLACED | CONFIRMED_BY_VENDOR | PACKED_BY_VENDOR | READY_FOR_RIDER_PICKUP | OUT_FOR_DELIVERY | DELIVERED | CANCELLED | REJECTED
    subtotal: integer('subtotal').notNull(),
    deliveryFee: integer('delivery_fee').default(0).notNull(),
    commissionRate: numeric('commission_rate', { precision: 5, scale: 2 }).default('10.00').notNull(),
    commissionAmount: integer('commission_amount').default(0).notNull(),
    vendorNetPayout: integer('vendor_net_payout').default(0).notNull(),
    packedAt: timestamp('packed_at'),
    dispatchedAt: timestamp('dispatched_at'),
    deliveredAt: timestamp('delivered_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_vendor_fulfillments_order_id').on(table.orderId),
    index('idx_vendor_fulfillments_vendor_id').on(table.vendorId),
  ]
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    vendorFulfillmentId: integer('vendor_fulfillment_id').references(() => vendorFulfillments.id, {
      onDelete: 'set null',
    }),
    vendorId: integer('vendor_id').references(() => vendors.id),
    productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: integer('variant_id'),
    variantName: text('variant_name'),
    productName: text('product_name').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    totalPrice: integer('total_price').notNull(),
    image: text('image'),
    unit: text('unit'),
    commissionAmount: integer('commission_amount').default(0).notNull(),
    vendorNetAmount: integer('vendor_net_amount').default(0).notNull(),
  },
  (table) => [index('idx_order_items_order_id').on(table.orderId)]
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    vendorFulfillmentId: integer('vendor_fulfillment_id').references(() => vendorFulfillments.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role').default('system').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_order_status_history_order_id').on(table.orderId)]
);

// ============================================================================
// 6. PAYMENTS, REFUNDS, SETTLEMENTS & FINANCIAL LEDGER
// ============================================================================

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    userId: integer('user_id').references(() => users.id),
    method: text('method').notNull(), // CASH_ON_DELIVERY | ESEWA | KHALTI | CARD | CONNECTIPS
    provider: text('provider').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').default('NPR').notNull(),
    status: text('status').default('pending').notNull(), // pending | initiated | paid | failed | refunded
    gatewayRefId: text('gateway_ref_id'),
    idempotencyKey: text('idempotency_key').unique(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('idx_payments_order_id').on(table.orderId)]
);

export const paymentTransactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  paymentId: integer('payment_id')
    .references(() => payments.id, { onDelete: 'cascade' })
    .notNull(),
  transactionType: text('transaction_type').notNull(), // initiate | verify | webhook | refund
  gatewayTransactionId: text('gateway_transaction_id'),
  status: text('status').notNull(),
  amount: integer('amount').notNull(),
  signatureVerified: boolean('signature_verified').default(false).notNull(),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const refunds = pgTable('refunds', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('requested').notNull(), // requested | approved | rejected | processed
  adminNote: text('admin_note'),
  processedBy: integer('processed_by').references(() => users.id),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const settlements = pgTable(
  'settlements',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id')
      .references(() => vendors.id, { onDelete: 'cascade' })
      .notNull(),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    grossSales: integer('gross_sales').default(0).notNull(),
    commissionTotal: integer('commission_total').default(0).notNull(),
    refundDeductions: integer('refund_deductions').default(0).notNull(),
    netPayout: integer('net_payout').default(0).notNull(),
    status: text('status').default('pending').notNull(), // pending | processing | paid | held
    payoutReference: text('payout_reference'),
    paidAt: timestamp('paid_at'),
    processedBy: integer('processed_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_settlements_vendor_id').on(table.vendorId)]
);

export const financialLedger = pgTable(
  'financial_ledger',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id')
      .references(() => vendors.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    settlementId: integer('settlement_id').references(() => settlements.id, { onDelete: 'set null' }),
    entryType: text('entry_type').notNull(), // sale_credit | commission_debit | refund_debit | payout_debit | adjustment
    amount: integer('amount').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_financial_ledger_vendor_id').on(table.vendorId)]
);

// ============================================================================
// 7. DELIVERY ASSIGNMENTS & LIVE GPS TELEMETRY
// ============================================================================

export const deliveryAssignments = pgTable(
  'delivery_assignments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    vendorFulfillmentId: integer('vendor_fulfillment_id').references(() => vendorFulfillments.id, {
      onDelete: 'set null',
    }),
    agentId: integer('agent_id').references(() => deliveryAgents.id, { onDelete: 'set null' }),
    status: text('status').default('unassigned').notNull(), // unassigned | assigned | accepted | picked_up | in_transit | delivered | failed
    pickupLat: text('pickup_lat'),
    pickupLng: text('pickup_lng'),
    dropoffLat: text('dropoff_lat'),
    dropoffLng: text('dropoff_lng'),
    currentLat: text('current_lat'),
    currentLng: text('current_lng'),
    speedKmh: integer('speed_kmh').default(0).notNull(),
    etaMinutes: integer('eta_minutes').default(12).notNull(),
    proofNote: text('proof_note'),
    assignedAt: timestamp('assigned_at'),
    pickedUpAt: timestamp('picked_up_at'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('idx_delivery_assignments_order_id').on(table.orderId)]
);

export const deliveryTrackingEvents = pgTable(
  'delivery_tracking_events',
  {
    id: serial('id').primaryKey(),
    assignmentId: integer('assignment_id')
      .references(() => deliveryAssignments.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'cascade' })
      .notNull(),
    lat: text('lat').notNull(),
    lng: text('lng').notNull(),
    speedKmh: integer('speed_kmh').default(0).notNull(),
    heading: integer('heading').default(0).notNull(),
    statusNote: text('status_note'),
    recordedAt: timestamp('recorded_at').defaultNow(),
  },
  (table) => [index('idx_delivery_tracking_order_id').on(table.orderId)]
);

// ============================================================================
// 8. REVIEWS, COUPONS, PROMOTIONS CMS, NOTIFICATIONS, SUPPORT & AUDIT
// ============================================================================

export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .references(() => products.id, { onDelete: 'cascade' })
      .notNull(),
    vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    title: text('title'),
    comment: text('comment').notNull(),
    isVerifiedPurchase: boolean('is_verified_purchase').default(false).notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_reviews_product_id').on(table.productId)]
);

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  discountType: text('discount_type').default('percentage').notNull(), // percentage | flat | free_delivery
  discountValue: integer('discount_value').default(0).notNull(),
  maxDiscountAmount: integer('max_discount_amount'),
  minOrderAmount: integer('min_order_amount').default(0).notNull(),
  usageLimit: integer('usage_limit'),
  usedCount: integer('used_count').default(0).notNull(),
  perUserLimit: integer('per_user_limit').default(5).notNull(),
  vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const couponRedemptions = pgTable('coupon_redemptions', {
  id: serial('id').primaryKey(),
  couponId: integer('coupon_id')
    .references(() => coupons.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  discountAmount: integer('discount_amount').notNull(),
  redeemedAt: timestamp('redeemed_at').defaultNow(),
});

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  externalKey: text('external_key').unique(),
  title: text('title').notNull(),
  titleNe: text('title_ne'),
  subtitle: text('subtitle').notNull(),
  subtitleNe: text('subtitle_ne'),
  badge: text('badge').notNull(),
  badgeNe: text('badge_ne'),
  ctaText: text('cta_text').notNull(),
  ctaTextNe: text('cta_text_ne'),
  ctaCategory: text('cta_category').notNull(),
  imageUrl: text('image_url').notNull(),
  couponCode: text('coupon_code'),
  colorTheme: text('color_theme').default('emerald').notNull(),
  placement: text('placement').default('hero').notNull(),
  destinationUrl: text('destination_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const advertisements = pgTable('advertisements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  titleNe: text('title_ne'),
  subtitle: text('subtitle').default('').notNull(),
  subtitleNe: text('subtitle_ne'),
  imageUrl: text('image_url').notNull(),
  destinationUrl: text('destination_url').default('/search').notNull(),
  placement: text('placement').default('homepage_mid').notNull(), // homepage_mid | homepage_bottom | category_top
  priority: integer('priority').default(10).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  clicksCount: integer('clicks_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
  entityType: text('entity_type').default('general').notNull(), // product | category | vendor | promotion | advertisement | avatar
  entityId: text('entity_id'),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').default(0).notNull(),
  url: text('url').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    roleScope: text('role_scope').default('all').notNull(), // all | customer | seller | admin | delivery_agent
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').default('info').notNull(),
    referenceUrl: text('reference_url'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_notifications_user_id').on(table.userId)]
);

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  vendorId: integer('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  category: text('category').default('order_issue').notNull(),
  subject: text('subject').notNull(),
  status: text('status').default('open').notNull(), // open | in_progress | resolved | closed
  priority: text('priority').default('normal').notNull(), // low | normal | high | urgent
  assignedAdminId: integer('assigned_admin_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ticketMessages = pgTable('ticket_messages', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id')
    .references(() => supportTickets.id, { onDelete: 'cascade' })
    .notNull(),
  senderUserId: integer('sender_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  senderRole: text('sender_role').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorUserId: integer('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role').default('system').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_audit_logs_entity').on(table.entityType, table.entityId)]
);

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: jsonb('value').$type<Record<string, unknown>>().default({}).notNull(),
  description: text('description'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  orders: many(orders),
  addresses: many(addresses),
  sessions: many(userSessions),
  sellerProfiles: many(sellerProfiles),
  adminProfile: one(adminProfiles),
  deliveryAgent: one(deliveryAgents),
}));

export const vendorsRelations = relations(vendors, ({ many, one }) => ({
  products: many(products),
  fulfillments: many(vendorFulfillments),
  settlements: many(settlements),
  zone: one(deliveryZones, {
    fields: [vendors.zoneId],
    references: [deliveryZones.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [products.vendorId],
    references: [vendors.id],
  }),
  categoryRef: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  variants: many(productVariants),
  images: many(productImages),
  reviews: many(reviews),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
  fulfillments: many(vendorFulfillments),
  statusHistory: many(orderStatusHistory),
  payments: many(payments),
  deliveryAssignments: many(deliveryAssignments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  fulfillment: one(vendorFulfillments, {
    fields: [orderItems.vendorFulfillmentId],
    references: [vendorFulfillments.id],
  }),
}));
