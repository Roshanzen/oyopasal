import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { api } from '../services/api';
import { CartSummary, Address, PublicSettings, UserProfile, Vendor } from '../types';
import {
  Language,
  TranslationKey,
  createTranslator,
  formatPrice as formatPriceHelper,
} from '../i18n/translations';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

interface AppContextType {
  cart: CartSummary | null;
  cartLoading: boolean;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (productId: string, quantity?: number, variantId?: string) => Promise<void>;
  updateCartQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;

  user: UserProfile | null;
  setUserDirect: (user: UserProfile | null) => void;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  loginCustomer: (payload: {
    phone_or_email: string;
    password?: string;
    full_name?: string;
    demo_quick_login?: boolean;
  }) => Promise<void>;
  registerCustomer: (payload: {
    full_name: string;
    phone_or_email: string;
    password: string;
  }) => Promise<void>;
  logoutCustomer: () => void;

  addresses: Address[];
  currentAddress: Address | null;
  setCurrentAddress: (addr: Address) => void;
  addNewAddress: (addr: Partial<Address>) => Promise<void>;
  refreshAddresses: () => Promise<void>;

  currentCoordinates: { lat: number; lng: number };
  setCurrentCoordinates: (coords: { lat: number; lng: number }) => void;
  setDeliveryLocationFromMap: (coords: { lat: number; lng: number }, areaName?: string, streetName?: string) => void;
  getDistanceToVendor: (
    vendorIdOrProduct: string | { id?: string; vendor?: { id: string } }
  ) => { distanceKm: number; distanceText: string; etaText: string };

  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  refreshWishlist: () => Promise<void>;

  locationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;

  becomeSellerModalOpen: boolean;
  setBecomeSellerModalOpen: (open: boolean) => void;

  sellerLoginModalOpen: boolean;
  setSellerLoginModalOpen: (open: boolean) => void;

  sellerDashboardModalOpen: boolean;
  setSellerDashboardModalOpen: (open: boolean) => void;

  currentSeller: Vendor | null;
  loginAsSeller: (payload: {
    identifier?: string;
    password?: string;
    vendor_id?: string;
    demo_quick_login?: boolean;
  }) => Promise<void>;
  logoutSeller: () => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;

  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  formatPrice: (amount: number | string) => string;

  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  vendors: Vendor[];
  publicSettings: PublicSettings | null;
  refreshVendors: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

export function calculateDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [cartLoading, setCartLoading] = useState<boolean>(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [currentAddress, setCurrentAddressState] = useState<Address | null>(null);
  const [currentCoordinates, setCurrentCoordinates] = useState<{ lat: number; lng: number }>({
    lat: 27.6986,
    lng: 85.3292,
  });

  const setCurrentAddress = useCallback((addr: Address) => {
    setCurrentAddressState(addr);
    if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
      setCurrentCoordinates({ lat: addr.lat, lng: addr.lng });
    }
  }, []);

  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [becomeSellerModalOpen, setBecomeSellerModalOpen] = useState<boolean>(false);
  const [sellerLoginModalOpen, setSellerLoginModalOpen] = useState<boolean>(false);
  const [sellerDashboardModalOpen, setSellerDashboardModalOpen] = useState<boolean>(false);
  const [currentSeller, setCurrentSeller] = useState<Vendor | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('oyopasal_seller_session');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('oyopasal_lang');
      if (saved === 'en' || saved === 'ne') return saved;
    }
    return 'en';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
    localStorage.setItem('oyopasal_lang', language);
  }, [language]);

  const t = useMemo(() => createTranslator(language), [language]);
  const formatPrice = useCallback((amount: number | string) => formatPriceHelper(amount, language), [language]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toastItem) => toastItem.id !== id));
    }, 3200);
  }, []);

  const setLanguage = useCallback(
    (nextLang: Language) => {
      setLanguageState(nextLang);
      const nextT = createTranslator(nextLang);
      showToast(nextT('toast.languageSwitched'), 'info');
    },
    [showToast]
  );

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === 'en' ? 'ne' : 'en';
      const nextT = createTranslator(next);
      showToast(nextT('toast.languageSwitched'), 'info');
      return next;
    });
  }, [showToast]);

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('oyopasal_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('oyopasal_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toastItem) => toastItem.id !== id));
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      setCartLoading(true);
      const data = await api.getCart();
      setCart(data);
    } catch (err) {
      console.error('Failed to load cart', err);
    } finally {
      setCartLoading(false);
    }
  }, []);

  const refreshAddresses = useCallback(async () => {
    try {
      const resp = await api.getAddresses();
      setAddresses(resp.results);
      if (resp.results.length > 0) {
        const defaultAddr = resp.results.find((a) => a.is_default) || resp.results[0];
        setCurrentAddressState(defaultAddr);
        if (typeof defaultAddr.lat === 'number' && typeof defaultAddr.lng === 'number') {
          setCurrentCoordinates({ lat: defaultAddr.lat, lng: defaultAddr.lng });
        }
      }
    } catch {
      // Unauthenticated guests get empty address list cleanly
    }
  }, []);

  const refreshWishlist = useCallback(async () => {
    try {
      const resp = await api.getWishlist();
      setWishlistIds(resp.results.map((p) => p.id));
    } catch {
      // ignore
    }
  }, []);

  const refreshVendors = useCallback(async () => {
    try {
      const [vResp, settingsResp] = await Promise.all([api.getVendors(), api.getPublicSettings()]);
      setVendors(vResp.results);
      setPublicSettings(settingsResp);
    } catch (err) {
      console.error('Failed to load vendors/settings:', err);
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        const hasToken = Boolean(api.getToken());
        let resolvedUserRole: string | null = null;
        if (hasToken) {
          try {
            const me = await api.getUser();
            setUser(me);
            resolvedUserRole = me.role || null;
            localStorage.setItem('oyopasal_customer_logged_in', 'true');
          } catch {
            api.clearToken();
            localStorage.removeItem('oyopasal_customer_logged_in');
            setUser(null);
          }
        }
        const savedSellerRaw = localStorage.getItem('oyopasal_seller_session');
        if (savedSellerRaw) {
          const hasSellerToken = Boolean(api.getSellerToken());
          if (!hasSellerToken && resolvedUserRole !== 'admin') {
            localStorage.removeItem('oyopasal_seller_session');
            setCurrentSeller(null);
          } else {
            try {
              const parsedSeller = JSON.parse(savedSellerRaw) as Vendor;
              const storeRes = await api.getSellerStore(parsedSeller?.id);
              if (storeRes?.vendor) {
                setCurrentSeller(storeRes.vendor);
                localStorage.setItem('oyopasal_seller_session', JSON.stringify(storeRes.vendor));
              }
            } catch {
              api.clearSellerToken();
              localStorage.removeItem('oyopasal_seller_session');
              setCurrentSeller(null);
            }
          }
        }
        await Promise.all([refreshCart(), refreshAddresses(), refreshWishlist(), refreshVendors()]);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initApp();
  }, [refreshCart, refreshAddresses, refreshWishlist, refreshVendors]);

  const setUserDirect = useCallback(
    (newUser: UserProfile | null) => {
      setUser(newUser);
      if (newUser) {
        if (newUser.token) api.setToken(newUser.token);
        localStorage.setItem('oyopasal_customer_logged_in', 'true');
        refreshAddresses();
        refreshWishlist();
        refreshCart();
      } else {
        api.clearToken();
        localStorage.removeItem('oyopasal_customer_logged_in');
      }
    },
    [refreshAddresses, refreshWishlist, refreshCart]
  );

  const loginCustomer = async (payload: {
    phone_or_email: string;
    password?: string;
    full_name?: string;
    demo_quick_login?: boolean;
  }) => {
    try {
      const res = await api.loginCustomer(payload);
      if (res.token) {
        api.setToken(res.token);
      }
      setUser(res.user);
      localStorage.setItem('oyopasal_customer_logged_in', 'true');
      setLoginModalOpen(false);
      await Promise.all([refreshAddresses(), refreshWishlist(), refreshCart()]);
      showToast(t('toast.welcomeCustomer', { name: res.user.full_name.split(' ')[0] }), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      showToast(msg, 'error');
      throw err;
    }
  };

  const registerCustomer = async (payload: {
    full_name: string;
    phone_or_email: string;
    password: string;
  }) => {
    try {
      const res = await api.registerCustomer(payload);
      if (res.token) {
        api.setToken(res.token);
      }
      setUser(res.user);
      localStorage.setItem('oyopasal_customer_logged_in', 'true');
      setLoginModalOpen(false);
      await Promise.all([refreshAddresses(), refreshWishlist(), refreshCart()]);
      showToast(t('toast.welcomeCustomer', { name: res.user.full_name.split(' ')[0] }), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      showToast(msg, 'error');
      throw err;
    }
  };

  const logoutCustomer = () => {
    if (api.getToken()) {
      api.logoutCustomer().catch(() => {});
    }
    api.clearToken();
    setUser(null);
    setAddresses([]);
    localStorage.removeItem('oyopasal_customer_logged_in');
    refreshCart();
    refreshWishlist();
    showToast(t('toast.signedOutCustomer'), 'info');
  };

  const addToCart = async (productId: string, quantity = 1, variantId?: string) => {
    try {
      setCartLoading(true);
      const updated = await api.addToCart(productId, quantity, variantId);
      setCart(updated);
      showToast(t('toast.addedToBasket'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not add item to basket';
      showToast(msg, 'error');
    } finally {
      setCartLoading(false);
    }
  };

  const updateCartQuantity = async (itemId: string, quantity: number) => {
    try {
      setCartLoading(true);
      const updated = await api.updateCartItem(itemId, quantity);
      setCart(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update item';
      showToast(msg, 'error');
    } finally {
      setCartLoading(false);
    }
  };

  const removeCartItem = async (itemId: string) => {
    try {
      setCartLoading(true);
      const updated = await api.removeCartItem(itemId);
      setCart(updated);
      showToast(t('toast.removedFromBasket'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove item';
      showToast(msg, 'error');
    } finally {
      setCartLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      setCartLoading(true);
      const updated = await api.clearCart();
      setCart(updated);
      showToast(t('toast.basketCleared'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not clear basket';
      showToast(msg, 'error');
    } finally {
      setCartLoading(false);
    }
  };

  const applyCoupon = async (code: string) => {
    try {
      const res = await api.applyCoupon(code);
      setCart(res.cart);
      showToast(t('toast.couponApplied', { code: code.toUpperCase() }), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid coupon code';
      showToast(msg, 'error');
      throw err;
    }
  };

  const removeCoupon = async () => {
    try {
      const res = await api.removeCoupon();
      setCart(res.cart);
      showToast(t('toast.couponRemoved'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove coupon';
      showToast(msg, 'error');
    }
  };

  const toggleWishlist = async (productId: string) => {
    try {
      const res = await api.toggleWishlist(productId);
      setWishlistIds(res.wishlist_ids);
      if (res.is_wishlisted) {
        showToast(t('toast.savedWishlist'), 'success');
      } else {
        showToast(t('toast.removedWishlist'), 'info');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not update wishlist';
      showToast(msg, 'error');
    }
  };

  const isWishlisted = (productId: string) => wishlistIds.includes(productId);

  const addNewAddress = async (addr: Partial<Address>) => {
    try {
      const created = await api.createAddress(addr);
      setAddresses((prev) => [...prev, created]);
      if (created.is_default || !currentAddress) {
        setCurrentAddress(created);
      }
      showToast(t('toast.addressSaved'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save address';
      showToast(msg, 'error');
      throw err;
    }
  };

  const loginAsSeller = async (payload: {
    identifier?: string;
    password?: string;
    vendor_id?: string;
    demo_quick_login?: boolean;
  }) => {
    try {
      const res = await api.loginAsSeller(payload);
      if (res.token) {
        api.setSellerToken(res.token);
      }
      setCurrentSeller(res.vendor);
      localStorage.setItem('oyopasal_seller_session', JSON.stringify(res.vendor));
      setSellerLoginModalOpen(false);
      setSellerDashboardModalOpen(true);
      showToast(t('toast.welcomeSeller', { name: res.vendor.name }), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Seller login failed';
      showToast(msg, 'error');
      throw err;
    }
  };

  const logoutSeller = () => {
    api.clearSellerToken();
    setCurrentSeller(null);
    localStorage.removeItem('oyopasal_seller_session');
    setSellerDashboardModalOpen(false);
    showToast(t('toast.signedOutSeller'), 'info');
  };

  const getDistanceToVendor = useCallback(
    (vendorIdOrProduct: string | { id?: string; vendor?: { id: string } }) => {
      let vId = '';
      if (typeof vendorIdOrProduct === 'string') {
        vId = vendorIdOrProduct;
      } else if (vendorIdOrProduct && typeof vendorIdOrProduct === 'object') {
        if (vendorIdOrProduct.vendor && typeof vendorIdOrProduct.vendor === 'object') {
          vId = vendorIdOrProduct.vendor.id || '';
        }
        if (!vId && 'id' in vendorIdOrProduct) {
          vId = (vendorIdOrProduct as any).id || '';
        }
      }

      const vendorRow = vendors.find((v) => v.id === vId || v.slug === vId) || vendors[0];
      const vLat = vendorRow?.lat ?? currentCoordinates.lat;
      const vLng = vendorRow?.lng ?? currentCoordinates.lng;
      const parsedMins = parseInt(String(vendorRow?.delivery_time_mins || ''), 10);
      const baseMins =
        !Number.isNaN(parsedMins) && parsedMins > 0
          ? parsedMins
          : publicSettings?.delivery_fees.defaultEtaMins ?? 12;

      const dist = vendorRow
        ? calculateDistanceInKm(currentCoordinates.lat, currentCoordinates.lng, vLat, vLng)
        : 1.0;
      const roundedDist = Math.max(0.2, dist);
      const kmUnit = language === 'ne' ? 'कि.मि.' : 'km';
      const minsUnit = language === 'ne' ? 'मिनेट' : 'mins';
      const distanceText = `${roundedDist.toFixed(1)} ${kmUnit}`;

      const estMins = Math.min(30, Math.max(9, Math.round(baseMins + roundedDist * 2.0)));
      const etaText = `${estMins}-${estMins + 3} ${minsUnit}`;

      return {
        distanceKm: roundedDist,
        distanceText,
        etaText,
      };
    },
    [currentCoordinates, language, vendors, publicSettings]
  );

  const setDeliveryLocationFromMap = useCallback(
    (coords: { lat: number; lng: number }, areaName?: string, streetName?: string) => {
      setCurrentCoordinates(coords);
      const computedArea = areaName || 'Kathmandu Valley';
      const computedStreet = streetName || `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

      const mappedAddress: Address = {
        id: `addr-map-${Date.now()}`,
        title: 'Pinned Location',
        recipient_name: user?.full_name || 'Guest Customer',
        phone: user?.phone || '+977 9800000000',
        street: computedStreet,
        area: computedArea,
        city: 'Kathmandu',
        landmark: 'Selected via Google Geo Map',
        is_default: true,
        lat: coords.lat,
        lng: coords.lng,
      };

      setCurrentAddressState(mappedAddress);
      showToast(t('toast.locationSet', { area: computedArea }), 'success');
    },
    [user, showToast, t]
  );

  return (
    <AppContext.Provider
      value={{
        cart,
        cartLoading,
        cartDrawerOpen,
        setCartDrawerOpen,
        addToCart,
        updateCartQuantity,
        removeCartItem,
        clearCart,
        applyCoupon,
        removeCoupon,
        user,
        setUserDirect,
        loginModalOpen,
        setLoginModalOpen,
        loginCustomer,
        registerCustomer,
        logoutCustomer,
        addresses,
        currentAddress,
        setCurrentAddress,
        addNewAddress,
        refreshAddresses,
        currentCoordinates,
        setCurrentCoordinates,
        setDeliveryLocationFromMap,
        getDistanceToVendor,
        wishlistIds,
        toggleWishlist,
        isWishlisted,
        refreshWishlist,
        locationModalOpen,
        setLocationModalOpen,
        becomeSellerModalOpen,
        setBecomeSellerModalOpen,
        sellerLoginModalOpen,
        setSellerLoginModalOpen,
        sellerDashboardModalOpen,
        setSellerDashboardModalOpen,
        currentSeller,
        loginAsSeller,
        logoutSeller,
        searchQuery,
        setSearchQuery,
        theme,
        toggleTheme,
        setTheme,
        language,
        setLanguage,
        toggleLanguage,
        t,
        formatPrice,
        toasts,
        showToast,
        dismissToast,
        vendors,
        publicSettings,
        refreshVendors,
        refreshCart,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
