# OyoPasal Codebase Refactoring Report

## 1. Executive Summary
OyoPasal has been systematically reviewed and refactored across both the Express + TypeScript + Drizzle ORM backend (`backend/`) and the React 19 + TypeScript + Vite frontend (`src/`). All customer, seller, rider, admin, AI shopping concierge, real-time Google Maps order tracking, HMAC payment verification, PostgreSQL persistence, dark/light themes, and English/Nepali bilingual features are preserved.

## 2. Principal Engineering Review — Completed Stages

### Stage 1: Backend Modularization, Security Hardening & Query Optimization
- **Service Layer Extraction**: Extracted business logic out of monolithic route files into `backend/services/sellerService.ts`, `backend/services/adminService.ts`, and `backend/services/conciergeService.ts`, alongside `catalogService.ts` and `orderService.ts`.
- **Input Validation**: Added `backend/utils/validation.ts` (`parseNumericId`, `parsePositiveInt`, `parseNonNegativeInt`, `assertEnum`, `parseOptionalDate`) to eliminate silent `NaN` parsing and enforce strict `400` responses on malformed parameters.
- **Auth & Rate-Limiter Hardening**: Blocked account hijack attempts in `/vendors/register/` (`409 Conflict`), restricted `demo_quick_login` strictly to verified seeded vendors, bounded in-memory rate limiter sweeps in `backend/middleware/rateLimit.ts`, and added probabilistic expired-session pruning.
- **N+1 & Pagination Fixes**: Batched order serialization (`serializeOrdersBatch`), seller fulfillments, ticket messages, and delivery settlements; pushed section filtering and `COUNT(*)`/`LIMIT`/`OFFSET` pagination down to SQL; fixed `ordering=discount` calculation.
- **Automated Coverage**: Added security & validation regression tests in `backend/tests/workflow.test.ts` (9 E2E workflow tests passing).

### Stage 2: Frontend Type Contracts & Service Token Isolation
- **Dead Code Removal**: Deleted the orphaned duplicate `src/components/Admin/AdminPortalPage.tsx`.
- **Strict Domain Contracts**: Added `src/types/admin.ts`, expanded `src/types/vendor.ts`, `src/types/common.ts`, and `src/types/order.ts`, and strictly typed `adminService`, `sellerService`, `orderService`, and `productService` (including `productService.getDbStatus()`).
- **HttpClient Token Isolation**: Updated `src/services/httpClient.ts` so non-seller calls never fall back to `sellerToken`, and `401` handling clears only the matching credential (`usedSellerToken`).

### Stage 3: Portal Decomposition, `any` Elimination & Unit Tests
- **Oversized Component Decomposition**:
  - `Header.tsx` -> `components/layout/header/{AnnouncementBar,HeaderSearchBar,NotificationsDropdown,UserMenuDropdown}.tsx`
  - `ChatConcierge.tsx` -> `hooks/useChatConcierge.ts` + `components/chat/{ChatOfferCard,ChatDirectOrderCard,ChatPlacedOrderCard}.tsx`
  - `SellerPortalPage.tsx` -> `hooks/useSellerPortal.ts` + 8 focused components under `components/seller/` (replacing `window.confirm` with `ConfirmDialog`)
  - `AdminPortalPage.tsx` -> `hooks/useAdminPortal.ts` + 9 focused components under `components/admin/`
  - `OrderTrackingPage.tsx` -> `hooks/useOrderTracking.ts` + `components/orders/{OrderTrackingMapCard,OrderTrackingTimeline,OrderReceiptSidebar}.tsx`
  - `AccountPage.tsx` -> `hooks/useAccountPortal.ts` + `components/account/{ProfileTab,OrdersTab,AccountSecondaryTabs}.tsx` (routing `/api/v1/db/status/` through `productService.getDbStatus()`)
- **Zero `any` & Zero Legacy `api` Barrel Imports**: Replaced remaining `any` annotations and monolithic `api` imports in `RiderPortalPage`, `SellerVisualSummary`, `SellerDashboardModal`, `BecomeSellerModal`, `LocationModal`, and `PromotionalCarousel`, and enforced `TranslatorFn` across bilingual component props.
- **Frontend Unit Tests**: Added `src/utils/__tests__/formatters.test.ts` (6 unit tests covering NPR/Devanagari formatting, Haversine distance/ETA estimation, date formatting, and validation helpers).

## 3. Environment & Stack Disclosure
- No Python or Django files exist in this repository. The authoritative backend is `server.ts` + `backend/` (Express + TypeScript + Drizzle ORM + PostgreSQL), exposing `/api/v1/*` JSON endpoints compatible with DRF response shapes.
