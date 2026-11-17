# API Integration Guide

## 1. Centralized `HttpClient` (`src/services/httpClient.ts`)
All frontend HTTP traffic passes through a single `HttpClient` instance:
- **Base URL**: Configured via `ENV.API_BASE_URL` (defaults to `/api/v1`).
- **Automatic Headers**:
  - `Content-Type: application/json` (automatically omitted for `FormData` uploads).
  - `X-Session-Key`: Persistent anonymous/guest shopping session token managed in `safeStorage`.
  - `Authorization: Bearer <token>`: Automatically attached using customer token or seller token (`useSellerToken: true`).
- **Error Handling**: Throws typed `ApiRequestError` instances carrying HTTP `status` and parsed server `message`.
- **401 Handling**: Invokes `httpClient.setUnauthorizedHandler(...)` (wired inside `AppContext` to clear expired customer/seller tokens without triggering unintended redirects on optional checks).

## 2. Domain Service Modules (`src/services/`)
| Service Module | Primary Endpoints |
| :--- | :--- |
| `authService.ts` | `/auth/login/`, `/auth/register/`, `/auth/firebase-login/`, `/auth/me/`, `/auth/me/export/`, `/auth/logout/` |
| `productService.ts` | `/products/`, `/products/:id/`, `/products/:id/similar/`, `/products/:id/reviews/`, `/search/autocomplete/` |
| `categoryService.ts` | `/categories/` |
| `vendorService.ts` | `/vendors/`, `/promotions/`, `/advertisements/`, `/advertisements/:id/click/`, `/settings/public/` |
| `cartService.ts` | `/cart/`, `/cart/items/`, `/cart/items/:id/`, `/cart/clear/`, `/cart/apply-coupon/`, `/cart/remove-coupon/`, `/coupons/active/` |
| `addressService.ts` | `/addresses/`, `/addresses/:id/`, `/addresses/zones/` |
| `orderService.ts` | `/checkout/validate/`, `/orders/`, `/orders/:id/`, `/orders/:id/tracking/` |
| `paymentService.ts` | `/payments/initiate/`, `/payments/verify/` |
| `wishlistService.ts` | `/wishlist/`, `/wishlist/toggle/` |
| `notificationService.ts` | `/notifications/`, `/notifications/:id/read/`, `/notifications/read-all/` |
| `supportService.ts` | `/support-tickets/` |
| `chatService.ts` | `/chat/` (AI concierge purchase & product discovery) |
| `sellerService.ts` | `/seller/register/`, `/seller/login/`, `/seller/session/`, `/seller/dashboard/`, `/seller/analytics/`, `/seller/products/*`, `/seller/orders/*` |
| `adminService.ts` | `/admin/overview/`, `/admin/coupons/`, `/admin/promotions/*`, `/admin/advertisements/*`, `/admin/vendors/:id/verify/`, `/admin/orders/*`, `/admin/users/:id/role/`, `/delivery/*` |

Backward compatibility for shared consumers is preserved via `api` (`src/services/api.ts`) while hooks and refactored views consume domain services directly.

## 3. Environment Note
The container runtime serves all `/api/v1/*` routes from the Express server (`backend/` + Drizzle PostgreSQL) with DRF-compatible JSON contracts. Django REST Framework is not installed in the container runtime environment.
