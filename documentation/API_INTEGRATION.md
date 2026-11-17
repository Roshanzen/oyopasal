# API Integration Guide

## 1. Centralized `HttpClient` (`src/services/httpClient.ts`)
All frontend HTTP traffic passes through a single `HttpClient` instance:
- **Base URL**: Configured via `ENV.API_BASE_URL` (defaults to `/api/v1`).
- **Automatic Headers & Token Isolation**:
  - `Content-Type: application/json` (automatically omitted for `FormData` uploads).
  - `X-Session-Key`: Persistent anonymous/guest shopping session token managed in `safeStorage`.
  - `Authorization: Bearer <token>`: Scoped strictly by role. Seller endpoints pass `{ useSellerToken: true }` and read only `sellerToken`; customer/admin/rider endpoints read only `customerToken` without falling back to `sellerToken`.
- **Error Handling**: Throws typed `ApiRequestError` instances carrying HTTP `status` and parsed server `message`.
- **Scoped 401 Handling**: `httpClient.setUnauthorizedHandler(...)` (wired inside `AppContext`) receives `{ usedSellerToken }` so an expired seller token clears only the seller session while an expired customer token clears only the customer session.

## 2. Domain Service Modules (`src/services/`)
| Service Module | Primary Endpoints |
| :--- | :--- |
| `authService.ts` | `/auth/login/`, `/auth/register/`, `/auth/firebase-login/`, `/auth/me/`, `/auth/me/export/`, `/auth/logout/` |
| `productService.ts` | `/products/`, `/products/:id/`, `/products/:id/similar/`, `/products/:id/reviews/`, `/search/autocomplete/`, `/db/status/` |
| `categoryService.ts` | `/categories/` |
| `vendorService.ts` | `/vendors/`, `/vendors/register/`, `/promotions/`, `/advertisements/`, `/advertisements/:id/click/`, `/settings/public/` |
| `cartService.ts` | `/cart/`, `/cart/items/`, `/cart/items/:id/`, `/cart/clear/`, `/cart/apply-coupon/`, `/cart/remove-coupon/`, `/coupons/active/` |
| `addressService.ts` | `/addresses/`, `/addresses/:id/`, `/addresses/zones/` |
| `orderService.ts` | `/checkout/validate/`, `/orders/`, `/orders/:id/`, `/orders/:id/tracking/`, `/delivery/*` |
| `paymentService.ts` | `/payments/initiate/`, `/payments/verify/` |
| `wishlistService.ts` | `/wishlist/`, `/wishlist/toggle/` |
| `notificationService.ts` | `/notifications/`, `/notifications/:id/read/`, `/notifications/read-all/` |
| `supportService.ts` | `/support-tickets/` |
| `chatService.ts` | `/chat/` (AI concierge purchase & product discovery) |
| `sellerService.ts` | `/seller/register/`, `/seller/login/`, `/seller/session/`, `/seller/dashboard/`, `/seller/analytics/`, `/seller/products/*`, `/seller/orders/*`, `/seller/reviews/` |
| `adminService.ts` | `/admin/overview/`, `/admin/coupons/`, `/admin/promotions/*`, `/admin/advertisements/*`, `/admin/vendors/:id/verify/`, `/admin/orders/*`, `/admin/users/:id/role/`, `/delivery/*` |

All UI components, portals, and hooks import domain service modules directly (no raw `fetch()` in UI components, and no new consumers of the legacy `api` barrel).

## 3. Environment Note
No Python or Django files exist in this repository. The server serves all `/api/v1/*` routes from Express + TypeScript (`backend/` + Drizzle ORM + PostgreSQL) with DRF-compatible JSON contracts.
