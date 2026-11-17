# OyoPasal System Architecture

## 1. Architectural Overview
OyoPasal is a hyperlocal multi-vendor quick-commerce platform built with a layered React 19 + TypeScript + Vite frontend and a modular Express + TypeScript REST API backend (`/api/v1/*`) backed by PostgreSQL via Drizzle ORM.

The codebase follows a strict unidirectional dependency architecture across both frontend and backend:

```text
  Pages & Feature Components (Presentation)
           │
           ▼
    Custom Hooks (Feature Orchestration)
           │
           ▼
   Domain Contexts (Global Reactive State)
           │
           ▼
   Domain Services + HttpClient (API Layer)
           │
           ▼
     REST API (/api/v1/*)
     ├─ backend/modules/*.routes.ts (Validation & HTTP Mapping)
     ├─ backend/services/*.ts       (Business Logic & Batched Queries)
     └─ src/db/*                    (Drizzle ORM + PostgreSQL)
```

## 2. Frontend Layer Responsibilities
- **`src/config/`**: Runtime environment configuration (`environment.ts`) and brand/delivery/payment/currency constants (`appConfig.ts`).
- **`src/types/`**: Domain-segregated TypeScript interfaces (`auth`, `product`, `cart`, `order`, `payment`, `address`, `vendor`, `customer`, `admin`, `common`) re-exported via `src/types/index.ts`.
- **`src/i18n/`**: Bilingual English (`en`) and Nepali (`ne`) dictionaries, strictly typed `TranslatorFn` / `TranslationKey`, pluralized translation resolver (`createTranslator`), and status/category/duration helpers.
- **`src/utils/`**: Pure stateless utility functions (Haversine distance calculation, NPR price formatting, date formatting, input validation, SSR-safe `safeStorage`, shared domain constants) plus Node unit tests in `src/utils/__tests__/`.
- **`src/services/`**: Single shared `HttpClient` managing headers (`X-Session-Key`, strictly isolated Bearer customer token vs `useSellerToken: true` seller token), centralized error normalization (`ApiRequestError`), and scoped `401` unauthorized callbacks, consumed by 14 domain-specific service modules (with `api.ts` kept solely as a backward-compatible facade).
- **`src/context/`**: Acyclic DAG of 8 focused React contexts (`ToastContext`, `ThemeContext`, `LanguageContext`, `CartContext`, `WishlistContext`, `LocationContext`, `AuthContext`, `SellerContext`) composed inside `AppContext` alongside a backward-compatible `useApp()` facade.
- **`src/hooks/`**: Reusable hooks wrapping contexts and domain/portal workflows (`useAuth`, `useCart`, `useLocation`, `useWishlist`, `useTheme`, `useLanguage`, `useSeller`, `useToast`, `useDebounce`, `useBanners`, `useHomeData`, `useProductDetail`, `useCategoryCatalog`, `useProductSearch`, `useCheckout`, `useChatConcierge`, `useSellerPortal`, `useAdminPortal`, `useOrderTracking`, `useAccountPortal`).
- **`src/components/`**: Modular UI building blocks split by role (`common/`, `layout/`, `layout/header/`, `modals/`, `feedback/`, `loaders/`, `account/`, `admin/`, `chat/`, `orders/`, `seller/`).
- **`src/pages/`**: Thin route-level shells grouped by feature domain (`home/`, `products/`, `categories/`, `checkout/`, `orders/`, `profile/`, `seller/`, `admin/`) that delegate orchestration to hooks and rendering to focused subcomponents.
- **`src/routes/`**: Route table (`AppRoutes.tsx`) and role guards (`ProtectedRoute.tsx`, `SellerRoute.tsx`) with lazy-loaded heavy portals and `PageLoader` Suspense fallbacks.

## 3. Backend Layer Responsibilities (`backend/`)
- **`backend/modules/*.routes.ts`**: Thin Express route handlers validating request inputs via `backend/utils/validation.ts` and delegating business logic to `backend/services/`.
- **`backend/services/`**:
  - `catalogService.ts`: SQL-level filtering, `ordering=discount` calculation, `COUNT(*)`/`LIMIT`/`OFFSET` pagination, and section queries.
  - `orderService.ts`: Order creation, stock validation, status transitions, batched order serialization (`serializeOrdersBatch`), and HMAC payment verification.
  - `sellerService.ts`: Merchant dashboard hydration, batched seller fulfillment & review queries, stock/product mutations, and payout ledgers.
  - `adminService.ts`: Admin overview aggregation, vendor verification, dispatch/delivery assignment, refunds/tickets batching, and settlement recording.
  - `conciergeService.ts`: AI Shopping Concierge full-catalog best-seller ranking and direct-to-location ordering.
- **`backend/middleware/`**: Bearer session auth, RBAC guards, and bounded in-memory rate limiting (`rateLimit.ts`) plus probabilistic session cleanup.

## 4. Resilience & Error Handling
- **Global Error Boundary**: `App.tsx` wraps `AppRoutes` in `ErrorBoundary` to isolate unexpected rendering faults with a clean recovery action.
- **Drawer/Portal Isolation**: `ChatConcierge` isolates its own internal `ChatErrorBoundary` and split `<AnimatePresence initial={false}>` nodes so drawer animations cannot interfere with the floating trigger.
- **API Fault Recovery**: Network failures surface through `ErrorAlert` components with explicit retry callbacks and `ConfirmDialog` replacements for browser-blocking dialogs.

## 5. Backend & Database Runtime Note
No Python or Django source files exist in this repository. The live server (`server.ts` -> `backend/app.ts`) is implemented in Express + TypeScript with Drizzle ORM + PostgreSQL (`src/db/`), exposing `/api/v1/*` REST contracts and DRF-compatible paginated JSON envelopes (`{ count, next, previous, results }`).
