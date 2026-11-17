# OyoPasal Codebase Refactoring Report

## 1. Executive Summary
The OyoPasal frontend has been restructured from portal-siloed directories (`src/customer`, `src/vendor`, `src/admin`, `src/shared`) and a monolithic context/service structure into a clean, layered modular architecture under `src/`. All customer, seller, rider, admin, AI concierge, real-time tracking, payment verification, and bilingual features were preserved.

## 2. Key Architectural Changes Completed
1. **Configuration & Styles Centralization**:
   - Extracted runtime configuration into `src/config/environment.ts` and `src/config/appConfig.ts`.
   - Split global stylesheets into `src/styles/variables.css`, `src/styles/themes.css`, and `src/styles/globals.css`, updating `src/main.tsx`.
2. **Type System & Utilities Modularization**:
   - Split monolithic types into 9 domain files under `src/types/` (`auth`, `product`, `cart`, `order`, `payment`, `address`, `vendor`, `customer`, `common`).
   - Created pure utility modules under `src/utils/` (`distance`, `priceFormatter`, `dateFormatter`, `validation`, `storage`, `constants`).
   - Organized bilingual dictionaries under `src/i18n/` (`en.ts`, `ne.ts`, `translations.ts`).
3. **Service Layer Refactoring (`src/services/`)**:
   - Replaced the monolithic API client with `httpClient.ts` (centralized headers, `X-Session-Key`, bearer tokens, `ApiRequestError`, and 401 handler) plus 14 domain service files (`authService`, `productService`, `categoryService`, `vendorService`, `cartService`, `addressService`, `orderService`, `paymentService`, `wishlistService`, `notificationService`, `supportService`, `chatService`, `sellerService`, `adminService`) and a unified `api.ts` facade.
4. **State & Context Separation (`src/context/`)**:
   - Broke the monolithic `AppContext` into 8 focused, acyclic providers (`Toast`, `Theme`, `Language`, `Cart`, `Wishlist`, `Location`, `Auth`, `Seller`) composed cleanly in `AppContext.tsx` with backward-compatible `useApp()` support.
5. **Custom Hooks Extraction (`src/hooks/`)**:
   - Extracted reusable logic and page workflows into `useAuth`, `useCart`, `useLocation`, `useWishlist`, `useTheme`, `useLanguage`, `useSeller`, `useToast`, `useDebounce`, `useBanners`, `useHomeData`, `useProductDetail`, `useCategoryCatalog`, `useProductSearch`, and `useCheckout`.
6. **Components, Pages & Route Guards (`src/components/`, `src/pages/`, `src/routes/`)**:
   - Reorganized all UI components and pages into semantic directories (`common/`, `layout/`, `modals/`, `feedback/`, `loaders/`, `seller/`, and `pages/*`).
   - Added shared building blocks (`ErrorBoundary`, `EmptyState`, `ConfirmDialog`, `ErrorAlert`, `SkeletonCard`, `PageLoader`).
   - Extracted routing and guards into `src/routes/AppRoutes.tsx`, `ProtectedRoute.tsx`, and `SellerRoute.tsx`, with lazy-loaded portals (`SellerPortalPage`, `AdminPortalPage`, `RiderPortalPage`).
   - Refactored `Header`, `LoginModal`, `CartDrawer`, `HomePage`, `ProductDetailPage`, `SearchPage`, `CategoryPage`, and `CheckoutPage` to consume hooks, domain services, validation helpers, and shared feedback components.
   - Removed legacy directories (`src/customer`, `src/vendor`, `src/admin`, `src/shared`) and empty placeholder directories.
7. **Backend Integrity**:
   - Inspected `backend/` and `src/db/`; no structural rewrites were required because `/api/v1/*` routes and PostgreSQL models already match all frontend service contracts cleanly.

## 3. Remaining Runtime / Environment Notes
- The live server runtime uses `server.ts` + `backend/` (Express + Drizzle ORM + PostgreSQL) because Python Django is not installed in the execution container. All frontend services target `/api/v1/*` JSON contracts cleanly.
