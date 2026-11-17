# OyoPasal Folder Structure

```text
/
├── backend/                     # Authoritative Express REST backend (/api/v1/*)
│   ├── config/env.ts            # Server & security environment loader
│   ├── db/seed.ts               # Database seed helpers
│   ├── docs/openapi.ts          # OpenAPI specification helpers
│   ├── middleware/              # Auth & rate limiting middleware
│   ├── modules/                 # Domain route handlers (auth, catalog, cart, orders, payments, seller, admin, delivery, chat, etc.)
│   ├── services/                # Server-side catalog & order business logic
│   ├── tests/workflow.test.ts   # End-to-end backend workflow test suite
│   └── utils/                   # Crypto, audit, and error utilities
│
├── documentation/               # Architecture, standards, and refactoring docs
│   ├── API_INTEGRATION.md
│   ├── ARCHITECTURE.md
│   ├── CODING_STANDARDS.md
│   ├── FOLDER_STRUCTURE.md
│   ├── REFACTORING_REPORT.md
│   └── STATE_MANAGEMENT.md
│
├── src/
│   ├── assets/images/           # Bundled storefront imagery
│   ├── components/
│   │   ├── common/              # CategoryBar, ConfirmDialog, EmptyState, ErrorBoundary, ProductCard, ProductSection, PromotionalCarousel
│   │   ├── feedback/            # ErrorAlert, ToastContainer
│   │   ├── layout/              # Header, MobileBottomNav, ChatConcierge
│   │   ├── loaders/             # PageLoader, SkeletonCard
│   │   ├── modals/              # BecomeSellerModal, CartDrawer, LocationModal, LoginModal, SellerDashboardModal, SellerLoginModal, VendorMapModal
│   │   └── seller/              # SellerVisualSummary
│   ├── config/                  # environment.ts, appConfig.ts, index.ts
│   ├── context/                 # ToastContext, ThemeContext, LanguageContext, CartContext, WishlistContext, LocationContext, AuthContext, SellerContext, AppContext, index.ts
│   ├── db/                      # Drizzle ORM schema, connection, and user helpers
│   ├── hooks/                   # useAuth, useBanners, useCart, useCheckout, useDebounce, useHomeData, useLanguage, useLocation, useProducts, useSeller, useTheme, useToast, useWishlist, index.ts
│   ├── i18n/                    # en.ts, ne.ts, translations.ts, index.ts
│   ├── lib/                     # firebase.ts, firebase-admin.ts
│   ├── pages/
│   │   ├── admin/               # AdminPortalPage, RiderPortalPage
│   │   ├── categories/          # CategoryPage
│   │   ├── checkout/            # CheckoutPage
│   │   ├── home/                # HomePage
│   │   ├── orders/              # OrderTrackingPage
│   │   ├── products/            # ProductDetailPage, SearchPage
│   │   ├── profile/             # AccountPage
│   │   └── seller/              # SellerPortalPage
│   ├── routes/                  # AppRoutes.tsx, ProtectedRoute.tsx, SellerRoute.tsx, index.ts
│   ├── services/                # httpClient.ts + domain services + api.ts facade + index.ts
│   ├── styles/                  # variables.css, themes.css, globals.css
│   ├── types/                   # Domain-split TypeScript definitions + index.ts
│   ├── utils/                   # distance, priceFormatter, dateFormatter, validation, storage, constants, index.ts
│   ├── App.tsx                  # Root shell wrapping ErrorBoundary + AppRoutes + persistent overlays
│   └── main.tsx                 # Entry mount importing styles/globals.css and AppProvider
└── server.ts                    # Express + Vite middleware dev/prod entrypoint (port 3000)
```
