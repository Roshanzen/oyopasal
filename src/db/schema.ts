import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  fullName: text('full_name'),
  phone: text('phone'),
  role: text('role').default('customer').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  rating: text('rating').default('4.8').notNull(),
  ratingCount: integer('rating_count').default(120).notNull(),
  eta: text('eta').default('12-15 mins').notNull(),
  distance: text('distance').default('1.2 km').notNull(),
  address: text('address').notNull(),
  lat: text('lat').default('27.7172').notNull(),
  lng: text('lng').default('85.3240').notNull(),
  image: text('image').notNull(),
  cuisine: text('cuisine').notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  subCategory: text('sub_category'),
  price: integer('price').notNull(),
  originalPrice: integer('original_price').notNull(),
  discountPercent: integer('discount_percent').default(0).notNull(),
  unit: text('unit').notNull(),
  inStock: boolean('in_stock').default(true).notNull(),
  stockCount: integer('stock_count').default(50).notNull(),
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
  createdAt: timestamp('created_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  userUid: text('user_uid'),
  status: text('status').default('placed').notNull(),
  totalAmount: integer('total_amount').notNull(),
  subtotal: integer('subtotal').notNull(),
  deliveryFee: integer('delivery_fee').notNull(),
  discount: integer('discount').default(0).notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  recipientName: text('recipient_name').notNull(),
  recipientPhone: text('recipient_phone').notNull(),
  paymentMethod: text('payment_method').default('cash').notNull(),
  paymentStatus: text('payment_status').default('pending').notNull(),
  vendorName: text('vendor_name').notNull(),
  estimatedMinutes: integer('estimated_minutes').default(15).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id).notNull(),
  productId: integer('product_id'),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
  image: text('image'),
  unit: text('unit'),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  vendor: one(vendors, {
    fields: [products.vendorId],
    references: [vendors.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
