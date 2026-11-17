# State Management & Context Architecture

## 1. Acyclic Context Dependency Graph
To eliminate monolithic re-renders and prevent circular dependencies, global state is split into 8 single-responsibility React Contexts composed top-down in `src/context/AppContext.tsx`:

```text
ToastProvider
 └─ ThemeProvider
     └─ LanguageProvider
         └─ CartProvider         (consumes Toast + Language)
             └─ WishlistProvider (consumes Toast + Language)
                 └─ LocationProvider (consumes Toast)
                     └─ AuthProvider     (consumes Toast + Language + Cart + Wishlist + Location)
                         └─ SellerProvider (consumes Toast + Language)
                             └─ AppContextBridge (wires httpClient 401 handler & exposes useApp())
```

Because `LocationProvider` sits strictly above `AuthProvider`, there is no circular import between them. Operations needing both (such as linking a map-selected location to the signed-in user) are composed cleanly at the `AppContextBridge` level.

## 2. Context Responsibilities
- **`ToastContext`**: Transient user feedback banners (`showToast`, `dismissToast`, `toasts`).
- **`ThemeContext`**: Dark/light mode state persisted via `safeStorage` and synced to `document.documentElement.classList`.
- **`LanguageContext`**: Active locale (`en` / `ne`), strictly typed translator `t: TranslatorFn`, and NPR formatter `formatPrice(amount)`.
- **`CartContext`**: Active basket state, drawer toggle, item mutations, coupon apply/remove, and optimistic sync with `/api/v1/cart/`.
- **`WishlistContext`**: Wishlisted product IDs, server sync, and toggle handler.
- **`LocationContext`**: Saved delivery addresses, active address, Google Maps / live coordinate lookup, delivery zone checks, public store settings, and vendor distance/ETA calculation.
- **`AuthContext`**: Authenticated customer/admin/rider user profile (`UserProfile`), modal state, login/registration/logout, and hydration of cart/wishlist/addresses upon login.
- **`SellerContext`**: Seller portal session, seller modals (`BecomeSellerModal`, `SellerLoginModal`, `SellerDashboardModal`), and seller credentials.

## 3. Feature Hooks (`src/hooks/`)
Feature-level stateful workflows live in dedicated hooks rather than inside page or portal JSX components:
- `useHomeData`: Parallel catalog/vendor/category/ad hydration and section filtering.
- `useBanners`: Active promotional banners sorted by backend priority.
- `useProductDetail`, `useCategoryCatalog`, `useProductSearch`: Product PDP, reviews, category catalog, and filtered/paginated search.
- `useCheckout`: Checkout validation, order creation, and HMAC eSewa/Khalti/Card payment challenge verification.
- `useChatConcierge`: AI shopping concierge messaging, offer matching, and direct-to-location ordering.
- `useSellerPortal`: Seller authentication, catalog inventory/gallery management, fulfillment queue, reviews, and payout ledger state.
- `useAdminPortal`: RBAC admin dashboard overview, seller verification, dispatch, CMS, ads, and finance governance state.
- `useOrderTracking`: Live order telemetry polling, Google Maps route geometry, bearing calculation, and cancellation workflow.
- `useAccountPortal`: Customer profile editing, order reorder/refunds, saved addresses, notifications, and support tickets.
- `useDebounce`: Generic reactive debounce hook used for search autocomplete.
- Context wrapper hooks: `useAuth`, `useCart` (includes active coupon loading), `useLocation`, `useWishlist`, `useTheme`, `useLanguage`, `useSeller`, `useToast`.
