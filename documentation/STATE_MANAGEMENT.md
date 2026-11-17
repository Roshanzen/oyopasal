# State Management & Context Architecture

## 1. Acyclic Context Dependency Graph
To eliminate monolithic re-renders and prevent circular dependencies, global state is split into 8 single-responsibility React Contexts composed top-down in `src/context/AppContext.tsx`:

```
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
- **`LanguageContext`**: Active locale (`en` / `ne`), translator `t(key, params)`, and NPR formatter `formatPrice(amount)`.
- **`CartContext`**: Active basket state, drawer toggle, item mutations, coupon apply/remove, and optimistic sync with `/api/v1/cart/`.
- **`WishlistContext`**: Wishlisted product IDs, server sync, and toggle handler.
- **`LocationContext`**: Saved delivery addresses, active address, Google Maps / live coordinate lookup, delivery zone checks, public store settings, and vendor distance/ETA calculation.
- **`AuthContext`**: Authenticated customer user profile, modal state, customer login/registration/logout, and hydration of cart/wishlist/addresses upon login.
- **`SellerContext`**: Seller portal session, seller modals (`BecomeSellerModal`, `SellerLoginModal`, `SellerDashboardModal`), and seller credentials.

## 3. Feature Hooks (`src/hooks/`)
Feature-level stateful workflows live in dedicated hooks rather than inside page JSX components:
- `useHomeData`: Parallel catalog/vendor/category/ad hydration and section filtering.
- `useBanners`: Active promotional banners sorted by backend priority.
- `useProductDetail`, `useCategoryCatalog`, `useProductSearch`: Product PDP, reviews, category catalog, and filtered/paginated search.
- `useCheckout`: Checkout validation, order creation, and HMAC eSewa/Khalti/Card payment challenge verification.
- `useDebounce`: Generic reactive debounce hook used for search autocomplete.
- Context wrapper hooks: `useAuth`, `useCart` (includes active coupon loading), `useLocation`, `useWishlist`, `useTheme`, `useLanguage`, `useSeller`, `useToast`.
