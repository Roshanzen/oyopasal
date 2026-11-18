import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { eq, inArray, or } from 'drizzle-orm';
import { createBackendApp } from '../app.ts';
import { seedInitialDatabase } from '../db/seed.ts';
import { createPool, db } from '../../src/db/index.ts';
import {
  addresses,
  auditLogs,
  cartItems,
  carts,
  deliveryAssignments,
  deliveryTrackingEvents,
  financialLedger,
  inventoryMovements,
  notifications,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  paymentTransactions,
  productImages,
  productVariants,
  products,
  reviews,
  sellerProfiles,
  userSessions,
  users,
  vendorFulfillments,
  vendors,
} from '../../src/db/schema.ts';

let server: http.Server;
let baseUrl = '';

const cleanupState = {
  userIds: [] as number[],
  vendorIds: [] as number[],
  productIds: [] as number[],
  orderIds: [] as number[],
  sessionKeys: [] as string[],
};

async function apiJson(
  path: string,
  options: RequestInit & { token?: string; sessionKey?: string } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.sessionKey) {
    headers['X-Session-Key'] = options.sessionKey;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, data: json };
}

before(async () => {
  await seedInitialDatabase();
  const app = createBackendApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  try {
    if (cleanupState.orderIds.length > 0) {
      await db.delete(reviews).where(inArray(reviews.orderId, cleanupState.orderIds));
      await db.delete(financialLedger).where(inArray(financialLedger.orderId, cleanupState.orderIds));
      await db.delete(orderStatusHistory).where(inArray(orderStatusHistory.orderId, cleanupState.orderIds));
      await db.delete(deliveryTrackingEvents).where(inArray(deliveryTrackingEvents.orderId, cleanupState.orderIds));
      await db.delete(deliveryAssignments).where(inArray(deliveryAssignments.orderId, cleanupState.orderIds));

      const payRows = await db.select().from(payments).where(inArray(payments.orderId, cleanupState.orderIds));
      if (payRows.length > 0) {
        await db.delete(paymentTransactions).where(
          inArray(paymentTransactions.paymentId, payRows.map((p) => p.id))
        );
      }
      await db.delete(payments).where(inArray(payments.orderId, cleanupState.orderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, cleanupState.orderIds));
      await db.delete(vendorFulfillments).where(inArray(vendorFulfillments.orderId, cleanupState.orderIds));
      await db.delete(orders).where(inArray(orders.id, cleanupState.orderIds));
    }

    if (cleanupState.productIds.length > 0) {
      await db.delete(reviews).where(inArray(reviews.productId, cleanupState.productIds));
      await db.delete(cartItems).where(inArray(cartItems.productId, cleanupState.productIds));
      await db.delete(inventoryMovements).where(inArray(inventoryMovements.productId, cleanupState.productIds));
      await db.delete(productImages).where(inArray(productImages.productId, cleanupState.productIds));
      await db.delete(productVariants).where(inArray(productVariants.productId, cleanupState.productIds));
      await db.delete(products).where(inArray(products.id, cleanupState.productIds));
    }

    if (cleanupState.vendorIds.length > 0) {
      await db.delete(sellerProfiles).where(inArray(sellerProfiles.vendorId, cleanupState.vendorIds));
      await db.delete(vendors).where(inArray(vendors.id, cleanupState.vendorIds));
    }

    if (cleanupState.sessionKeys.length > 0) {
      const cRows = await db.select().from(carts).where(inArray(carts.sessionKey, cleanupState.sessionKeys));
      if (cRows.length > 0) {
        await db.delete(cartItems).where(inArray(cartItems.cartId, cRows.map((c) => c.id)));
        await db.delete(carts).where(inArray(carts.id, cRows.map((c) => c.id)));
      }
    }

    if (cleanupState.userIds.length > 0) {
      const userCarts = await db.select().from(carts).where(inArray(carts.userId, cleanupState.userIds));
      if (userCarts.length > 0) {
        await db.delete(cartItems).where(inArray(cartItems.cartId, userCarts.map((c) => c.id)));
        await db.delete(carts).where(inArray(carts.id, userCarts.map((c) => c.id)));
      }
      await db.delete(addresses).where(inArray(addresses.userId, cleanupState.userIds));
      await db.delete(notifications).where(inArray(notifications.userId, cleanupState.userIds));
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, cleanupState.userIds));
      await db.delete(userSessions).where(inArray(userSessions.userId, cleanupState.userIds));
      await db.delete(users).where(inArray(users.id, cleanupState.userIds));
    }
  } finally {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    await createPool().end();
  }
});

test('1. Health, Cloud SQL status & OpenAPI spec', async () => {
  const health = await apiJson('/api/v1/health/');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');
  assert.equal(health.data.database, 'connected');

  const dbStatus = await apiJson('/api/v1/db/status/');
  assert.equal(dbStatus.status, 200);
  assert.equal(dbStatus.data.status, 'connected');
  assert.ok(dbStatus.data.counts.products >= 10);

  const spec = await apiJson('/api/docs/openapi.json');
  assert.equal(spec.status, 200);
  assert.ok(spec.data.paths);
  assert.ok(spec.data.paths['/orders/']);
});

test('2. Public catalog pagination, category, search & ordering filters', async () => {
  const cats = await apiJson('/api/v1/categories/');
  assert.equal(cats.status, 200);
  assert.ok(Array.isArray(cats.data.results) && cats.data.results.length >= 5);

  const page1 = await apiJson('/api/v1/products/?page=1&page_size=4&ordering=price');
  assert.equal(page1.status, 200);
  assert.equal(page1.data.results.length, 4);
  for (let i = 1; i < page1.data.results.length; i++) {
    assert.ok(page1.data.results[i - 1].discounted_price <= page1.data.results[i].discounted_price);
  }

  const searchRes = await apiJson('/api/v1/products/?search=Avocado');
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.data.results.some((p: any) => p.name.toLowerCase().includes('avocado')));
});

test('3. Unauthenticated requests return 401 on protected routes', async () => {
  const ordersRes = await apiJson('/api/v1/orders/');
  assert.equal(ordersRes.status, 401);

  const sellerRes = await apiJson('/api/v1/seller/dashboard/');
  assert.equal(sellerRes.status, 401);

  const adminRes = await apiJson('/api/v1/admin/overview/');
  assert.equal(adminRes.status, 401);
});

test('4. Customer registration, login, wrong password 401 & cross-customer IDOR 403', async () => {
  const runId = crypto.randomBytes(3).toString('hex');
  const emailA = `cust.a.${runId}@oyopasal.np`;
  const emailB = `cust.b.${runId}@oyopasal.np`;

  const regA = await apiJson('/api/v1/auth/register/', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'Test Customer A',
      phone_or_email: emailA,
      password: 'Password@123',
    }),
  });
  assert.equal(regA.status, 201);
  assert.ok(regA.data.token);
  cleanupState.userIds.push(regA.data.user.db_id);

  const badLogin = await apiJson('/api/v1/auth/login/', {
    method: 'POST',
    body: JSON.stringify({
      phone_or_email: emailA,
      password: 'WrongPassword!',
    }),
  });
  assert.equal(badLogin.status, 401);

  const goodLogin = await apiJson('/api/v1/auth/login/', {
    method: 'POST',
    body: JSON.stringify({
      phone_or_email: emailA,
      password: 'Password@123',
    }),
  });
  assert.equal(goodLogin.status, 200);
  assert.ok(goodLogin.data.token);

  const regB = await apiJson('/api/v1/auth/register/', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'Test Customer B',
      phone_or_email: emailB,
      password: 'Password@123',
    }),
  });
  assert.equal(regB.status, 201);
  cleanupState.userIds.push(regB.data.user.db_id);

  // Customer A places an order
  const sessionA = `test-sess-idor-${runId}`;
  cleanupState.sessionKeys.push(sessionA);
  const addCart = await apiJson('/api/v1/cart/items/', {
    method: 'POST',
    token: regA.data.token,
    sessionKey: sessionA,
    body: JSON.stringify({ product_id: 'prod-milk', quantity: 1 }),
  });
  assert.equal(addCart.status, 200);

  const ordA = await apiJson('/api/v1/orders/', {
    method: 'POST',
    token: regA.data.token,
    sessionKey: sessionA,
    body: JSON.stringify({
      payment_method: 'CASH_ON_DELIVERY',
      delivery_address: {
        street: 'Baneshwor Test Marg',
        area: 'New Baneshwor',
        city: 'Kathmandu',
        phone: '+977 9800000111',
      },
    }),
  });
  assert.equal(ordA.status, 201);
  cleanupState.orderIds.push(ordA.data.db_id);

  // Customer B tries to read & cancel Customer A's order -> 403 Forbidden
  const crossRead = await apiJson(`/api/v1/orders/${ordA.data.id}/`, {
    token: regB.data.token,
  });
  assert.equal(crossRead.status, 403);

  const crossCancel = await apiJson(`/api/v1/orders/${ordA.data.id}/cancel/`, {
    method: 'POST',
    token: regB.data.token,
    body: JSON.stringify({ reason: 'IDOR attempt' }),
  });
  assert.equal(crossCancel.status, 403);

  // Customer A cancels own order cleanly (restores stock)
  const selfCancel = await apiJson(`/api/v1/orders/${ordA.data.id}/cancel/`, {
    method: 'POST',
    token: regA.data.token,
    body: JSON.stringify({ reason: 'Test cleanup cancel' }),
  });
  assert.equal(selfCancel.status, 200);
  assert.equal(selfCancel.data.status, 'CANCELLED');
});

test('5. Pending seller blocked (403), cross-seller blocked (403) & stock oversell blocked (409)', async () => {
  const runId = crypto.randomBytes(3).toString('hex');
  const sellerEmail = `seller.${runId}@oyopasal.np`;

  const applyRes = await apiJson('/api/v1/vendors/register/', {
    method: 'POST',
    body: JSON.stringify({
      store_name: `Test Store ${runId}`,
      category: 'Grocery',
      city: 'Kathmandu',
      area: 'Thamel',
      contact_person: 'Seller Test Owner',
      phone: `+977 9811${Math.floor(100000 + Math.random() * 899999)}`,
      email: sellerEmail,
      password: 'SellerPass@123',
    }),
  });
  assert.equal(applyRes.status, 201);
  assert.equal(applyRes.data.vendor.approval_status, 'pending');

  const vendorDbId = applyRes.data.vendor.db_id;
  cleanupState.vendorIds.push(vendorDbId);
  const vRows = await db.select().from(vendors).where(eq(vendors.id, vendorDbId)).limit(1);
  if (vRows[0]?.ownerUserId) {
    cleanupState.userIds.push(vRows[0].ownerUserId);
  }

  const sellerLogin = await apiJson('/api/v1/auth/seller/login/', {
    method: 'POST',
    body: JSON.stringify({ identifier: sellerEmail, password: 'SellerPass@123' }),
  });
  assert.equal(sellerLogin.status, 200);
  const sellerToken = sellerLogin.data.token;

  // Pending seller tries to add a product -> 403
  const blockedAdd = await apiJson('/api/v1/seller/products/', {
    method: 'POST',
    token: sellerToken,
    body: JSON.stringify({
      name: `Blocked Item ${runId}`,
      category_slug: 'grocery',
      unit: '1 kg',
      original_price: 200,
      discounted_price: 150,
      stock: 5,
    }),
  });
  assert.equal(blockedAdd.status, 403);

  // Admin logs in and approves seller
  const adminLogin = await apiJson('/api/v1/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ phone_or_email: 'admin@oyopasal.np', demo_quick_login: true }),
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;

  const approveRes = await apiJson(`/api/v1/admin/sellers/${vendorDbId}/approval/`, {
    method: 'PATCH',
    token: adminToken,
    body: JSON.stringify({ approval_status: 'approved', commission_rate: 10 }),
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.vendor.approval_status, 'approved');

  // Approved seller can now add a product with limited stock = 2
  const createdProd = await apiJson('/api/v1/seller/products/', {
    method: 'POST',
    token: sellerToken,
    body: JSON.stringify({
      name: `Limited Harvest ${runId}`,
      category_slug: 'grocery',
      unit: '500 g',
      original_price: 250,
      discounted_price: 200,
      stock: 2,
    }),
  });
  assert.equal(createdProd.status, 201);
  const prodId = createdProd.data.product.id;
  cleanupState.productIds.push(createdProd.data.product.db_id);

  // Another approved seller tries to modify/restock this seller's product -> 403
  const otherSellerLogin = await apiJson('/api/v1/auth/seller/login/', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: 'v-himalayan', demo_quick_login: true }),
  });
  assert.equal(otherSellerLogin.status, 200);
  const crossSellerEdit = await apiJson(`/api/v1/seller/products/${prodId}/restock/`, {
    method: 'PATCH',
    token: otherSellerLogin.data.token,
    body: JSON.stringify({ add_stock: 10 }),
  });
  assert.equal(crossSellerEdit.status, 403);

  // Customer tries to add quantity 5 when stock is 2 -> 409 INSUFFICIENT_STOCK
  const oversellSess = `test-oversell-${runId}`;
  cleanupState.sessionKeys.push(oversellSess);
  const oversellRes = await apiJson('/api/v1/cart/items/', {
    method: 'POST',
    sessionKey: oversellSess,
    body: JSON.stringify({ product_id: prodId, quantity: 5 }),
  });
  assert.equal(oversellRes.status, 409);
  assert.equal(oversellRes.data.code, 'INSUFFICIENT_STOCK');
});

test('6. Full E2E Order -> Payment HMAC -> Seller Pack -> Admin Dispatch -> Rider GPS -> Delivered -> Review', async () => {
  const runId = crypto.randomBytes(3).toString('hex');
  const custEmail = `e2e.cust.${runId}@oyopasal.np`;

  const custReg = await apiJson('/api/v1/auth/register/', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'E2E Buyer',
      phone_or_email: custEmail,
      password: 'BuyerPass@123',
    }),
  });
  assert.equal(custReg.status, 201);
  const custToken = custReg.data.token;
  cleanupState.userIds.push(custReg.data.user.db_id);

  const sessKey = `e2e-sess-${runId}`;
  cleanupState.sessionKeys.push(sessKey);

  // Add item to cart
  const cartAdd = await apiJson('/api/v1/cart/items/', {
    method: 'POST',
    token: custToken,
    sessionKey: sessKey,
    body: JSON.stringify({ product_id: 'prod-avocado', quantity: 1 }),
  });
  assert.equal(cartAdd.status, 200);

  // Validate checkout
  const validateRes = await apiJson('/api/v1/checkout/validate/', {
    method: 'POST',
    token: custToken,
    sessionKey: sessKey,
  });
  assert.equal(validateRes.status, 200);
  assert.equal(validateRes.data.valid, true);

  // Place ESEWA order
  const orderRes = await apiJson('/api/v1/orders/', {
    method: 'POST',
    token: custToken,
    sessionKey: sessKey,
    body: JSON.stringify({
      payment_method: 'ESEWA',
      delivery_address: {
        title: 'Home',
        recipient_name: 'E2E Buyer',
        phone: '+977 9841000222',
        street: 'Minbhawan Marg',
        area: 'New Baneshwor',
        city: 'Kathmandu',
        lat: 27.6921,
        lng: 85.3445,
      },
    }),
  });
  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.data.payment_status, 'PENDING');
  cleanupState.orderIds.push(orderRes.data.db_id);

  // Initiate gateway payment
  const initPay = await apiJson('/api/v1/payments/initiate/', {
    method: 'POST',
    token: custToken,
    body: JSON.stringify({ order_id: orderRes.data.id, method: 'ESEWA' }),
  });
  assert.equal(initPay.status, 200);
  assert.ok(initPay.data.signature);

  // Tampered signature must fail (400)
  const badVerify = await apiJson('/api/v1/payments/verify/', {
    method: 'POST',
    token: custToken,
    body: JSON.stringify({
      order_id: orderRes.data.id,
      transaction_uuid: initPay.data.transaction_uuid,
      signature: 'tampered_invalid_hmac',
    }),
  });
  assert.equal(badVerify.status, 400);

  // Valid signature marks order PAID
  const goodVerify = await apiJson('/api/v1/payments/verify/', {
    method: 'POST',
    token: custToken,
    body: JSON.stringify({
      order_id: orderRes.data.id,
      transaction_uuid: initPay.data.transaction_uuid,
      signature: initPay.data.signature,
    }),
  });
  assert.equal(goodVerify.status, 200);
  assert.equal(goodVerify.data.payment_status, 'PAID');

  // Seller verifies the newly placed customer order is immediately visible in GET /api/v1/seller/orders/
  const sellerLogin = await apiJson('/api/v1/auth/seller/login/', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: 'v-himalayan', demo_quick_login: true }),
  });
  assert.equal(sellerLogin.status, 200);

  const sellerOrdersRes = await apiJson('/api/v1/seller/orders/?vendor_id=v-himalayan', {
    token: sellerLogin.data.token,
  });
  assert.equal(sellerOrdersRes.status, 200);
  const foundVendorOrder = sellerOrdersRes.data.results.find(
    (o: any) => o.order_number === orderRes.data.order_number
  );
  assert.ok(foundVendorOrder, 'Customer order must appear in vendor orders queue');
  assert.equal(foundVendorOrder.customer_name, 'E2E Buyer');
  assert.equal(foundVendorOrder.customer_area, 'New Baneshwor');
  assert.ok(Array.isArray(foundVendorOrder.items) && foundVendorOrder.items.length >= 1);

  // Mismatched store query param must fail with 403 rather than silently returning another vendor's orders
  const wrongStoreOrders = await apiJson('/api/v1/seller/orders/?vendor_id=v-patan-bakery', {
    token: sellerLogin.data.token,
  });
  assert.equal(wrongStoreOrders.status, 403);

  const fulfillmentId = orderRes.data.items_by_vendor[0].fulfillment_id;
  const packRes = await apiJson(`/api/v1/seller/orders/${fulfillmentId}/status/`, {
    method: 'PATCH',
    token: sellerLogin.data.token,
    body: JSON.stringify({ status: 'PACKED_BY_VENDOR' }),
  });
  assert.equal(packRes.status, 200);

  // Admin assigns seeded rider Ramesh Pandey
  const adminLogin = await apiJson('/api/v1/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ phone_or_email: 'admin@oyopasal.np', demo_quick_login: true }),
  });
  assert.equal(adminLogin.status, 200);

  const ridersRes = await apiJson('/api/v1/admin/riders/', { token: adminLogin.data.token });
  assert.equal(ridersRes.status, 200);
  const ramesh = ridersRes.data.results[0];

  const assignRes = await apiJson(`/api/v1/admin/orders/${orderRes.data.id}/assign-rider/`, {
    method: 'POST',
    token: adminLogin.data.token,
    body: JSON.stringify({ agent_id: ramesh.id }),
  });
  assert.equal(assignRes.status, 200);

  // Rider logs in, pushes live GPS coordinate, marks in_transit and delivered
  const riderLogin = await apiJson('/api/v1/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ phone_or_email: 'rider.ramesh@oyopasal.np', demo_quick_login: true }),
  });
  assert.equal(riderLogin.status, 200);
  const riderToken = riderLogin.data.token;

  const assignmentsRes = await apiJson('/api/v1/delivery/assignments/', { token: riderToken });
  assert.equal(assignmentsRes.status, 200);
  const myAssign = assignmentsRes.data.results.find((a: any) => a.order_id === orderRes.data.db_id);
  assert.ok(myAssign, 'Rider should see assigned order');

  const gpsPush = await apiJson(`/api/v1/delivery/assignments/${myAssign.id}/location/`, {
    method: 'POST',
    token: riderToken,
    body: JSON.stringify({
      lat: 27.6933,
      lng: 85.3411,
      speed_kmh: 28,
      eta_minutes: 4,
      status_note: 'Crossing Baneshwor Chowk',
    }),
  });
  assert.equal(gpsPush.status, 200);

  // Customer reads live tracking from PostgreSQL and confirms real rider coordinates
  const trackingRes = await apiJson(`/api/v1/delivery/orders/${orderRes.data.id}/tracking/`, {
    token: custToken,
  });
  assert.equal(trackingRes.status, 200);
  assert.equal(trackingRes.data.assignment.current_lat, 27.6933);
  assert.equal(trackingRes.data.assignment.current_lng, 85.3411);

  const deliverRes = await apiJson(`/api/v1/delivery/assignments/${myAssign.id}/status/`, {
    method: 'PATCH',
    token: riderToken,
    body: JSON.stringify({ status: 'delivered', proof_note: 'Handed over at gate' }),
  });
  assert.equal(deliverRes.status, 200);
  assert.equal(deliverRes.data.order_status, 'DELIVERED');

  // Verified buyer leaves product review
  const reviewRes = await apiJson('/api/v1/products/prod-avocado/reviews/', {
    method: 'POST',
    token: custToken,
    body: JSON.stringify({
      rating: 5,
      title: 'Super fresh!',
      comment: 'Arrived right in 10 minutes with verified rider tracking.',
    }),
  });
  assert.equal(reviewRes.status, 201);
  assert.equal(reviewRes.data.review.is_verified_purchase, true);

  // Restock avocado by +1 so catalog stock stays untouched overall
  await apiJson('/api/v1/seller/products/prod-avocado/restock/', {
    method: 'PATCH',
    token: sellerLogin.data.token,
    body: JSON.stringify({ add_stock: 1 }),
  });
});

test('7. Dynamic settings, active coupons, advertisements CRUD, media upload & seller reviews', async () => {
  // Public endpoints
  const [adsRes, couponsRes, settingsRes, promosRes, heroPromosRes] = await Promise.all([
    apiJson('/api/v1/advertisements/'),
    apiJson('/api/v1/coupons/active/'),
    apiJson('/api/v1/settings/public/'),
    apiJson('/api/v1/promotions/'),
    apiJson('/api/v1/promotions/?placement=hero'),
  ]);
  assert.equal(adsRes.status, 200);
  assert.ok(Array.isArray(adsRes.data.results));
  assert.equal(couponsRes.status, 200);
  assert.ok(Array.isArray(couponsRes.data.results));
  assert.equal(settingsRes.status, 200);
  assert.ok(settingsRes.data.delivery_fees);
  assert.ok(settingsRes.data.store_support);
  assert.equal(promosRes.status, 200);
  assert.ok(Array.isArray(promosRes.data.results) && promosRes.data.results.length >= 1);
  for (let i = 1; i < promosRes.data.results.length; i++) {
    assert.ok((promosRes.data.results[i - 1].sort_order ?? 0) <= (promosRes.data.results[i].sort_order ?? 0));
  }
  assert.equal(heroPromosRes.status, 200);
  assert.ok(heroPromosRes.data.results.every((p: any) => p.placement === 'hero'));

  // Admin auth
  const adminLogin = await apiJson('/api/v1/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ phone_or_email: 'admin@oyopasal.np', demo_quick_login: true }),
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.token;

  // Media upload (1x1 transparent PNG)
  const png1x1Base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const uploadRes = await apiJson('/api/v1/media/upload/', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      base64: png1x1Base64,
      mime_type: 'image/png',
      filename: 'e2e-test-pixel.png',
      entity_type: 'advertisement',
    }),
  });
  assert.equal(uploadRes.status, 201);
  assert.ok(uploadRes.data.asset.url.startsWith('/uploads/'));

  // Verify static serving of uploaded asset
  const staticCheck = await fetch(`${baseUrl}${uploadRes.data.asset.url}`);
  assert.equal(staticCheck.status, 200);

  // Create & clean up advertisement via Admin API
  const createAdRes = await apiJson('/api/v1/admin/advertisements/', {
    method: 'POST',
    token: adminToken,
    body: JSON.stringify({
      title: 'E2E Dynamic Banner',
      subtitle: 'Fresh harvest from PostgreSQL',
      image_url: uploadRes.data.asset.url,
      destination_url: '/category/fruits-vegetables',
      placement: 'homepage_mid',
      priority: 99,
    }),
  });
  assert.equal(createAdRes.status, 201);
  const createdAdId = createAdRes.data.advertisement.db_id;

  const listAdminAds = await apiJson('/api/v1/admin/advertisements/', { token: adminToken });
  assert.equal(listAdminAds.status, 200);
  assert.ok(listAdminAds.data.results.some((a: any) => a.db_id === createdAdId));

  const delAdRes = await apiJson(`/api/v1/admin/advertisements/${createdAdId}/`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(delAdRes.status, 200);

  // Clean up uploaded media asset
  const delMediaRes = await apiJson(`/api/v1/media/${uploadRes.data.asset.id}/`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(delMediaRes.status, 200);

  // Admin payments ledger
  const payLedgerRes = await apiJson('/api/v1/admin/payments/', { token: adminToken });
  assert.equal(payLedgerRes.status, 200);
  assert.ok(Array.isArray(payLedgerRes.data.results));

  // Seller reviews endpoint
  const sellerLogin = await apiJson('/api/v1/auth/seller/login/', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: 'v-himalayan', demo_quick_login: true }),
  });
  assert.equal(sellerLogin.status, 200);
  const sellerReviewsRes = await apiJson('/api/v1/seller/reviews/', {
    token: sellerLogin.data.token,
  });
  assert.equal(sellerReviewsRes.status, 200);
  assert.ok(Array.isArray(sellerReviewsRes.data.results));
});

test('8. AI Shopping Concierge full-catalog best-seller ranking & direct purchase to assigned location', async () => {
  const runId = crypto.randomBytes(3).toString('hex');
  const buyerEmail = `ai.buyer.${runId}@oyopasal.np`;

  const regRes = await apiJson('/api/v1/auth/register/', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'AI Direct Buyer',
      phone_or_email: buyerEmail,
      password: 'BuyerPass@123',
    }),
  });
  assert.equal(regRes.status, 201);
  const buyerToken = regRes.data.token;
  cleanupState.userIds.push(regRes.data.user.db_id);

  // Ask AI concierge to find cheapest milk & avocados delivered to Pulchowk
  const chatRes = await apiJson('/api/v1/chat/', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      messages: [
        { role: 'user', content: 'Buy cheapest fresh milk and avocados delivered to Pulchowk' },
      ],
      userLocation: {
        latitude: 27.674,
        longitude: 85.318,
        area: 'Pulchowk',
        street: 'Jhamsikhel Road',
        city: 'Lalitpur',
      },
      language: 'en',
    }),
  });
  assert.equal(chatRes.status, 200);
  assert.ok(chatRes.data.reply && chatRes.data.reply.length > 10);
  assert.ok(chatRes.data.catalogStats.totalProducts >= 10);
  assert.ok(Array.isArray(chatRes.data.recommendedOffers) && chatRes.data.recommendedOffers.length >= 1);
  assert.equal(chatRes.data.assignedLocation.area, 'Pulchowk');
  assert.ok(chatRes.data.orderPreview && chatRes.data.orderPreview.items.length >= 1);

  // Place direct order from AI preview to assigned location
  const previewItem = chatRes.data.orderPreview.items[0];
  const directOrderRes = await apiJson('/api/v1/chat/direct-order/', {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({
      items: [{ product_id: previewItem.product_id, quantity: 1 }],
      delivery_address: {
        title: 'AI Pinned Home',
        street: 'Jhamsikhel Road',
        area: 'Pulchowk',
        city: 'Lalitpur',
        lat: 27.674,
        lng: 85.318,
      },
      payment_method: 'CASH_ON_DELIVERY',
      delivery_option: 'EXPRESS_12_MINS',
    }),
  });
  assert.equal(directOrderRes.status, 201);
  assert.equal(directOrderRes.data.success, true);
  assert.equal(directOrderRes.data.order.delivery_address.area, 'Pulchowk');
  cleanupState.orderIds.push(directOrderRes.data.order.db_id);

  // Verify the vendor of the AI direct-ordered item immediately sees the order in /seller/orders/
  const orderedVendorId = directOrderRes.data.order.items_by_vendor?.[0]?.vendor?.id;
  assert.ok(orderedVendorId, 'Direct order should reference vendor id');
  const directSellerLogin = await apiJson('/api/v1/auth/seller/login/', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: orderedVendorId, demo_quick_login: true }),
  });
  assert.equal(directSellerLogin.status, 200);
  const directSellerOrders = await apiJson(`/api/v1/seller/orders/?vendor_id=${orderedVendorId}`, {
    token: directSellerLogin.data.token,
  });
  assert.equal(directSellerOrders.status, 200);
  assert.ok(
    directSellerOrders.data.results.some((o: any) => o.order_number === directOrderRes.data.order.order_number),
    'AI direct purchase order must appear in seller orders queue'
  );

  // Cancel test order to restore stock cleanly
  const cancelRes = await apiJson(`/api/v1/orders/${directOrderRes.data.order.id}/cancel/`, {
    method: 'POST',
    token: buyerToken,
    body: JSON.stringify({ reason: 'Test cleanup' }),
  });
  assert.equal(cancelRes.status, 200);
});

