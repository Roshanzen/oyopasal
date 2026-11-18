# OyoPasal – Database Design & Schema Specification

**Target Database:** MySQL 8.0  
**Storage Engine:** InnoDB  
**Character Encoding:** `utf8mb4`  
**Collation:** `utf8mb4_unicode_ci`  
**ORM:** Django ORM (5.x)  

---

## 1. Schema Architecture Overview

The OyoPasal database contains 68 relational tables partitioned into high-cohesion domain modules:

```text
├── Authentication & Identity: accounts_user, accounts_staffprofile
├── Customer Profiles & Addresses: customers_customerprofile, customers_address, customers_wishlistitem
├── Vendor Management: vendors_vendorprofile, vendors_vendordocument, vendors_vendorstaffmember
├── Storefronts: stores_store
├── Suppliers & Procurement: suppliers_supplierprofile, procurement_supplierproduct, procurement_purchaseorder...
├── Product Catalogue: catalogue_category, catalogue_brand, catalogue_product, catalogue_productvariant, catalogue_productimage...
├── Inventory & Warehousing: warehouse_warehouse, inventory_inventoryitem, inventory_stockmovement, inventory_stockreservation
├── Delivery & Logistics: delivery_deliveryzone
├── Shopping Cart: cart_cart, cart_cartitem
├── Orders & Fulfillment: orders_order, orders_vendorsuborder, orders_orderitem, orders_orderstatushistory
├── Payments & Ledger: payments_payment, payments_financialledgerentry
├── Commission & Settlements: commissions_commissionrecord, settlements_vendorsettlement, settlements_settlementitem
├── Refunds: refunds_refund
├── Marketing & Promotions: promotions_coupon, promotions_couponusage, promotions_marketingpromotion, promotions_advertisement
├── Subscriptions: subscriptions_subscriptionplan, subscriptions_tenantsubscription, subscriptions_subscriptioninvoice
├── Customer Reviews: reviews_productreview
├── Notifications & Support: notifications_notification, support_supportticket, support_ticketmessage
└── System Audit: audit_auditlog
```

---

## 2. Core Entity Relationships

### 2.1 Identity, Users & Roles
- **`accounts_user`**: Custom User model extending `AbstractUser`.
  - Primary Key: `id` (BigAuto / Integer)
  - Identifier: `phone_number` and `email` (Unique, case-normalized)
  - `role`: Enum choices (`customer`, `seller`, `admin`, `delivery_agent`, `staff`)
  - Password: PBKDF2 with SHA256 (Django default hasher)
  - One-to-One with `customers_customerprofile` and `vendors_vendorprofile` (by ownership).

### 2.2 Vendor & Storefront Isolation
- **`vendors_vendorprofile`**: Represents a registered merchant business.
  - Foreign Key: `user_id` -> `accounts_user.id` (CASCADE / RESTRICT)
  - `business_name`, `slug` (Unique), `status` (`pending`, `approved`, `suspended`)
  - `pan_vat_number`, `bank_account_number`, `commission_rate` (Decimal)
- **`stores_store`**: Physical or virtual outlet owned by a vendor.
  - Foreign Key: `vendor_id` -> `vendors_vendorprofile.id`

### 2.3 Product Catalogue & Variants
- **`catalogue_category`**: Self-referencing hierarchical categories (`parent_id` -> `catalogue_category.id`).
- **`catalogue_product`**:
  - Foreign Key: `vendor_id` -> `vendors_vendorprofile.id`
  - Foreign Key: `category_id` -> `catalogue_category.id`
  - Decimal prices: `regular_price`, `selling_price` (Precision 10, Scale 2)
  - Status flags: `is_active`, `approval_status`, `in_stock`
- **`catalogue_productvariant`**:
  - Foreign Key: `product_id` -> `catalogue_product.id` (CASCADE)
  - `sku` (Unique), `attributes` (JSON), `stock_count`
- **`catalogue_productimage`**:
  - Foreign Key: `product_id` -> `catalogue_product.id` (CASCADE)
  - `image_url`, `is_primary`, `display_order`

### 2.4 Cart & Checkout
- **`cart_cart`**:
  - Foreign Key: `user_id` -> `accounts_user.id` (Optional for guest sessions)
  - `session_key` (Indexed string for unauthenticated guest carts)
  - `status` (`active`, `ordered`, `abandoned`)
- **`cart_cartitem`**:
  - Foreign Key: `cart_id` -> `cart_cart.id` (CASCADE)
  - Foreign Key: `product_id` -> `catalogue_product.id`
  - Foreign Key: `variant_id` -> `catalogue_productvariant.id` (Optional)
  - `quantity`, `unit_price`, `total_price`

### 2.5 Orders & Multi-Vendor Sub-Orders
- **`orders_order`**: Primary customer order.
  - `order_number` (Unique alphanumeric)
  - Foreign Key: `user_id` -> `accounts_user.id`
  - Foreign Key: `delivery_address_id` -> `customers_address.id`
  - Financial totals: `subtotal`, `delivery_fee`, `discount_amount`, `total_amount`
  - `status`: `pending`, `confirmed`, `processing`, `delivered`, `cancelled`
  - `payment_status`: `pending`, `paid`, `failed`, `refunded`
- **`orders_vendorsuborder`**: Splits order by vendor for multi-vendor fulfillment isolation.
  - Foreign Key: `order_id` -> `orders_order.id` (CASCADE)
  - Foreign Key: `vendor_id` -> `vendors_vendorprofile.id`
  - `subtotal`, `commission_amount`, `vendor_payout`, `status`
- **`orders_orderitem`**:
  - Foreign Key: `order_id` -> `orders_order.id` (CASCADE)
  - Foreign Key: `vendor_sub_order_id` -> `orders_vendorsuborder.id`
  - Foreign Key: `product_id` -> `catalogue_product.id`

---

## 3. Database Constraints & Performance Indexes
1. **Foreign Keys:** Enforce referential integrity using `on_delete=models.CASCADE` for parent-child items (e.g. `cart_cartitem`, `orders_orderitem`) and `models.PROTECT` or `models.SET_NULL` for critical audit entities.
2. **Compound Indexes:**
   - `accounts_user(email, is_active)`
   - `catalogue_product(category_id, is_active, approval_status)`
   - `cart_cart(user_id, status)`
   - `orders_order(user_id, created_at)`
3. **Transactions:** All order placement, payment updates, and inventory reservations run within `transaction.atomic()` blocks.
