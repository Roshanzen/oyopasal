import { Router } from 'express';

export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'OyoPasal Multi-Vendor Quick-Commerce API',
    version: '2.0.0',
    description:
      'Production-ready multi-vendor grocery delivery REST API backed by Cloud SQL PostgreSQL + Drizzle ORM + Firebase Auth.',
  },
  servers: [{ url: '/api/v1', description: 'Primary API v1' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'DB-backed op_sess_* token or Firebase ID token',
      },
    },
  },
  paths: {
    '/health/': { get: { summary: 'System & PostgreSQL health check', tags: ['System'] } },
    '/db/status/': { get: { summary: 'Live PostgreSQL table row counts', tags: ['System'] } },
    '/auth/register/': { post: { summary: 'Register customer account with password hash', tags: ['Auth'] } },
    '/auth/login/': { post: { summary: 'Login with password or preview demo account', tags: ['Auth'] } },
    '/auth/firebase-login/': { post: { summary: 'Verify Firebase ID token & issue DB session', tags: ['Auth'] } },
    '/auth/seller/login/': { post: { summary: 'Seller login returning store & session token', tags: ['Auth'] } },
    '/auth/logout/': { post: { summary: 'Revoke active session token', tags: ['Auth'], security: [{ BearerAuth: [] }] } },
    '/auth/user/': {
      get: { summary: 'Get authenticated profile', tags: ['Auth'], security: [{ BearerAuth: [] }] },
      put: { summary: 'Update authenticated profile', tags: ['Auth'], security: [{ BearerAuth: [] }] },
    },
    '/categories/': { get: { summary: 'List active grocery categories', tags: ['Catalog'] } },
    '/promotions/': { get: { summary: 'List active CMS homepage banners', tags: ['Catalog'] } },
    '/vendors/': { get: { summary: 'List approved neighborhood vendors', tags: ['Catalog'] } },
    '/vendors/register/': { post: { summary: 'Apply to become a marketplace vendor (pending admin approval)', tags: ['Catalog'] } },
    '/products/': { get: { summary: 'Search, filter, and paginate approved products', tags: ['Catalog'] } },
    '/products/autocomplete/': { get: { summary: 'Search suggestions for products & categories', tags: ['Catalog'] } },
    '/products/{id}/': { get: { summary: 'Get product details & variants', tags: ['Catalog'] } },
    '/products/{id}/reviews/': {
      get: { summary: 'List product reviews', tags: ['Reviews'] },
      post: { summary: 'Submit product review (checks verified purchase)', tags: ['Reviews'], security: [{ BearerAuth: [] }] },
    },
    '/cart/': { get: { summary: 'Get persistent cart & authoritative totals', tags: ['Cart'] } },
    '/cart/items/': { post: { summary: 'Add item to cart with stock check', tags: ['Cart'] } },
    '/cart/items/{itemId}/': {
      put: { summary: 'Update cart item quantity', tags: ['Cart'] },
      delete: { summary: 'Remove cart item', tags: ['Cart'] },
    },
    '/coupons/apply/': { post: { summary: 'Validate and apply coupon code', tags: ['Cart'] } },
    '/orders/': {
      get: { summary: 'List authenticated user orders', tags: ['Orders'], security: [{ BearerAuth: [] }] },
      post: { summary: 'Place transactional order with row-locked stock deduction', tags: ['Orders'], security: [{ BearerAuth: [] }] },
    },
    '/orders/{id}/': { get: { summary: 'Get order details & tracking telemetry', tags: ['Orders'], security: [{ BearerAuth: [] }] } },
    '/orders/{id}/cancel/': { post: { summary: 'Cancel order & restore inventory', tags: ['Orders'], security: [{ BearerAuth: [] }] } },
    '/orders/{id}/reorder/': { post: { summary: 'Re-add past order items to cart', tags: ['Orders'], security: [{ BearerAuth: [] }] } },
    '/orders/{id}/refund/': { post: { summary: 'Submit refund request for delivered/paid order', tags: ['Orders'], security: [{ BearerAuth: [] }] } },
    '/payments/initiate/': { post: { summary: 'Initiate payment & generate HMAC signature', tags: ['Payments'], security: [{ BearerAuth: [] }] } },
    '/payments/verify/': { post: { summary: 'Verify payment using cryptographic HMAC signature', tags: ['Payments'], security: [{ BearerAuth: [] }] } },
    '/seller/dashboard/': { get: { summary: 'Vendor KPIs, stats & inventory', tags: ['Seller'], security: [{ BearerAuth: [] }] } },
    '/seller/analytics/': { get: { summary: 'Real SQL monthly revenue & top product analytics', tags: ['Seller'], security: [{ BearerAuth: [] }] } },
    '/seller/products/': {
      get: { summary: 'List vendor products', tags: ['Seller'], security: [{ BearerAuth: [] }] },
      post: { summary: 'Create product (requires approved seller)', tags: ['Seller'], security: [{ BearerAuth: [] }] },
    },
    '/seller/products/{id}/restock/': { patch: { summary: 'Restock product & record inventory movement', tags: ['Seller'], security: [{ BearerAuth: [] }] } },
    '/seller/orders/': { get: { summary: 'List vendor-isolated order fulfillments', tags: ['Seller'], security: [{ BearerAuth: [] }] } },
    '/seller/orders/{fulfillmentId}/status/': { patch: { summary: 'Update vendor fulfillment status', tags: ['Seller'], security: [{ BearerAuth: [] }] } },
    '/delivery/orders/{orderId}/tracking/': { get: { summary: 'Live rider GPS coordinates & tracking events', tags: ['Delivery'], security: [{ BearerAuth: [] }] } },
    '/delivery/assignments/': { get: { summary: 'List delivery rider assignments', tags: ['Delivery'], security: [{ BearerAuth: [] }] } },
    '/delivery/assignments/{id}/location/': { post: { summary: 'Push real rider GPS ping', tags: ['Delivery'], security: [{ BearerAuth: [] }] } },
    '/delivery/assignments/{id}/status/': { patch: { summary: 'Update delivery lifecycle status', tags: ['Delivery'], security: [{ BearerAuth: [] }] } },
    '/admin/overview/': { get: { summary: 'Platform-wide GMV, orders & operational KPIs', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
    '/admin/sellers/': { get: { summary: 'Manage vendor stores & KYC applications', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
    '/admin/sellers/{id}/approval/': { patch: { summary: 'Approve, suspend, or set commission for vendor', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
    '/admin/orders/{id}/assign-rider/': { post: { summary: 'Assign verified delivery agent to order', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
    '/admin/refunds/': { get: { summary: 'View & process customer refund requests', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
    '/admin/settlements/': { get: { summary: 'View vendor balances & generate/pay settlements', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
    '/admin/audit-logs/': { get: { summary: 'Inspect immutable platform audit trail', tags: ['Admin'], security: [{ BearerAuth: [] }] } },
  },
};

const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(OPENAPI_SPEC);
});

docsRouter.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OyoPasal API Documentation (OpenAPI 3.0)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0;background:#f8fafc;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui' });
  </script>
</body>
</html>`);
});

export default docsRouter;
