# OyoPasal Folder Structure

```text
/
├── backend/                     # Authoritative Express + TypeScript REST backend (/api/v1/*)
│   ├── app.ts                   # Express app factory, middleware & module mounting
│   ├── config/env.ts            # Server & security environment loader
│   ├── db/seed.ts               # Database seed helpers
│   ├── docs/openapi.ts          # OpenAPI specification helpers
│   ├── middleware/              # Auth guards & bounded rate limiting (rateLimit.ts)
│   ├── modules/                 # Domain route handlers (account, admin, auth, cart, catalog, chat, delivery, media, orders, payments, seller, system)
│   ├── services/                # Business logic & batched queries (adminService, catalogService, conciergeService, orderService, sellerService)
│   ├── tests/workflow.test.ts   # End-to-end backend workflow test suite (9 tests)
│   └── utils/                   # Crypto, audit logging, errors, and strict input validation (validation.ts)
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
│   │   ├── account/             # ProfileTab, OrdersTab, AccountSecondaryTabs
│   │   ├── admin/               # AdminAuthView, AdminOverviewTab, AdminSellersTab, AdminOrdersDispatchTab, AdminProductsTab, AdminCmsTab, AdminAdsTab, AdminFinanceTabs, AdminGovernanceTabs
│   │   ├── chat/                # ChatOfferCard, ChatDirectOrderCard, ChatPlacedOrderCard
│   │   ├── common/              # CategoryBar, ConfirmDialog, EmptyState, ErrorBoundary, ProductCard, ProductSection, PromotionalCarousel
│   │   ├── feedback/            # ErrorAlert, ToastContainer
│   │   ├── layout/              # Header, MobileBottomNav, ChatConcierge, and header/ (AnnouncementBar, HeaderSearchBar, NotificationsDropdown, UserMenuDropdown)
│   │   ├── loaders/             # PageLoader, SkeletonCard
│   │   ├── modals/              # BecomeSellerModal, CartDrawer, LocationModal, LoginModal, SellerDashboardModal, SellerLoginModal, VendorMapModal
│   │   ├── orders/              # OrderTrackingMapCard, OrderTrackingTimeline, OrderReceiptSidebar
│   │   └── seller/              # SellerAuthView, SellerAddProductTab, SellerCatalogTab, SellerOrdersTab, SellerReviewsTab, SellerLedgerTab, SellerSettingsTab, ProductGalleryModal, SellerVisualSummary
│   ├── config/                  # environment.ts, appConfig.ts, index.ts
│   ├── context/                 # ToastContext, ThemeContext, LanguageContext, CartContext, WishlistContext, LocationContext, AuthContext, SellerContext, AppContext, index.ts
│   ├── db/                      # Drizzle ORM schema, connection, and user helpers
│   ├── hooks/                   # useAuth, useBanners, useCart, useCheckout, useChatConcierge, useSellerPortal, useAdminPortal, useOrderTracking, useAccountPortal, useDebounce, useHomeData, useLanguage, useLocation, useProducts, useSeller, useTheme, useToast, useWishlist, index.ts
│   ├── i18n/                    # en.ts, ne.ts, translations.ts (TranslatorFn, TranslationKey), index.ts
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
│   ├── services/                # httpClient.ts + 14 typed domain services + api.ts facade + index.ts
│   ├── styles/                  # variables.css, themes.css, globals.css
│   ├── types/                   # Domain-split TypeScript definitions (admin, auth, cart, common, customer, order, payment, product, vendor) + index.ts
│   ├── utils/                   # distance, priceFormatter, dateFormatter, validation, storage, constants, index.ts, and __tests__/formatters.test.ts
│   ├── App.tsx                  # Root shell wrapping ErrorBoundary + AppRoutes + persistent overlays
│   └── main.tsx                 # Entry mount importing styles/globals.css and AppProvider
└── server.ts                    # Express + Vite middleware dev/prod entrypoint (port 3000)
```
