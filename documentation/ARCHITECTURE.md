# OyoPasal System Architecture

## 1. Architectural Overview
OyoPasal is a hyperlocal multi-vendor quick-commerce platform built with a layered React 19 + TypeScript + Vite frontend and a modular REST API backend (`/api/v1/*`) backed by PostgreSQL via Drizzle ORM.

The codebase follows a strict unidirectional dependency architecture:

```
  Pages & Components (Presentation)
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
     REST API (/api/v1/*) & Database
```

## 2. Frontend Layer Responsibilities
- **`src/config/`**: Runtime environment configuration (`environment.ts`) and brand/delivery/payment/currency constants (`appConfig.ts`).
- **`src/types/`**: Domain-segregated TypeScript interfaces (`auth`, `product`, `cart`, `order`, `payment`, `address`, `vendor`, `customer`, `common`) re-exported via `src/types/index.ts`.
- **`src/i18n/`**: Bilingual English (`en`) and Nepali (`ne`) dictionaries, pluralized translation resolver (`createTranslator`), and status/category/duration helpers.
- **`src/utils/`**: Pure stateless utility functions (Haversine distance calculation, NPR price formatting, date formatting, input validation, SSR-safe `safeStorage`, shared domain constants).
- **`src/services/`**: Single shared `HttpClient` managing headers (`X-Session-Key`, Bearer customer token, Bearer seller token), centralized error normalization (`ApiRequestError`), and 401 unauthorized callbacks, consumed by 14 domain-specific service modules plus an `api` facade.
- **`src/context/`**: Acyclic DAG of 8 focused React contexts (`ToastContext`, `ThemeContext`, `LanguageContext`, `CartContext`, `WishlistContext`, `LocationContext`, `AuthContext`, `SellerContext`) composed inside `AppContext` alongside a backward-compatible `useApp()` facade.
- **`src/hooks/`**: Reusable hooks wrapping contexts and domain workflows (`useAuth`, `useCart`, `useLocation`, `useWishlist`, `useTheme`, `useLanguage`, `useSeller`, `useToast`, `useDebounce`, `useBanners`, `useHomeData`, `useProductDetail`, `useCategoryCatalog`, `useProductSearch`, `useCheckout`).
- **`src/components/`**: Modular UI building blocks split by role (`common/`, `layout/`, `modals/`, `feedback/`, `loaders/`, `seller/`).
- **`src/pages/`**: Route-level views grouped by feature domain (`home/`, `products/`, `categories/`, `checkout/`, `orders/`, `profile/`, `seller/`, `admin/`).
- **`src/routes/`**: Route table (`AppRoutes.tsx`) and role guards (`ProtectedRoute.tsx`, `SellerRoute.tsx`) with lazy-loaded heavy portals and `PageLoader` Suspense fallbacks.

## 3. Resilience & Error Handling
- **Global Error Boundary**: `App.tsx` wraps `AppRoutes` in `ErrorBoundary` to isolate unexpected rendering faults with a clean recovery action.
- **Drawer/Portal Isolation**: `ChatConcierge` isolates its own internal `ChatErrorBoundary` and split `<AnimatePresence initial={false}>` nodes so drawer animations cannot interfere with the floating trigger.
- **API Fault Recovery**: Network failures surface through `ErrorAlert` components with explicit retry callbacks on Home, Search, Category, Product Detail, Cart coupons, and Notifications.

## 4. Backend & Database Runtime Note
The live runtime container executes the Express + TypeScript modular backend (`server.ts` -> `backend/app.ts`) connected to PostgreSQL (`src/db/`). All endpoints conform to `/api/v1/*` REST + DRF-compatible pagination (`{ count, next, previous, results }`) and JWT/session contracts. Python/Django is not installed in the container runtime, so `backend/` remains the authoritative server implementation in this environment.
