import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../services/api';
import { CartSummary, Address, UserProfile, Product } from '../types';

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
  addresses: Address[];
  currentAddress: Address | null;
  setCurrentAddress: (addr: Address) => void;
  addNewAddress: (addr: Partial<Address>) => Promise<void>;
  refreshAddresses: () => Promise<void>;

  currentCoordinates: { lat: number; lng: number };
  setCurrentCoordinates: (coords: { lat: number; lng: number }) => void;
  setDeliveryLocationFromMap: (coords: { lat: number; lng: number }, areaName?: string, streetName?: string) => void;
  getDistanceToVendor: (vendorIdOrProduct: string | { id?: string; vendor?: { id: string } }) => { distanceKm: number; distanceText: string; etaText: string };
  
  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  
  locationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;

  becomeSellerModalOpen: boolean;
  setBecomeSellerModalOpen: (open: boolean) => void;

  sellerLoginModalOpen: boolean;
  setSellerLoginModalOpen: (open: boolean) => void;

  sellerDashboardModalOpen: boolean;
  setSellerDashboardModalOpen: (open: boolean) => void;

  currentSeller: any | null;
  loginAsSeller: (payload: { identifier?: string; password?: string; vendor_id?: string }) => Promise<void>;
  logoutSeller: () => void;
  
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;

  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;

  refreshCart: () => Promise<void>;
}

export const VENDOR_LOCATIONS: Record<string, { name: string; lat: number; lng: number; area: string; baseMins: number }> = {
  'v-himalayan': { name: 'Himalayan Fresh Farms', lat: 27.6915, lng: 85.3420, area: 'New Baneshwor, Kathmandu', baseMins: 10 },
  'v-patan-bakery': { name: 'Patan Artisan Bakery & Dairy', lat: 27.6740, lng: 85.3180, area: 'Pulchowk, Lalitpur', baseMins: 12 },
  'v-everest-pantry': { name: 'Everest Organic & Dry Pantry', lat: 27.6780, lng: 85.3500, area: 'Koteshwor, Kathmandu', baseMins: 12 },
  'v-green-valley': { name: 'Green Valley Hydroponics', lat: 27.7150, lng: 85.3120, area: 'Thamel, Kathmandu', baseMins: 10 }
};

export function calculateDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
  const [currentCoordinates, setCurrentCoordinates] = useState<{ lat: number; lng: number }>({
    lat: 27.6915,
    lng: 85.3420 // New Baneshwor, Kathmandu (default)
  });
  const [wishlistIds, setWishlistIds] = useState<string[]>(['prod-sourdough', 'prod-cherry-tomatoes']);
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [becomeSellerModalOpen, setBecomeSellerModalOpen] = useState<boolean>(false);
  const [sellerLoginModalOpen, setSellerLoginModalOpen] = useState<boolean>(false);
  const [sellerDashboardModalOpen, setSellerDashboardModalOpen] = useState<boolean>(false);
  const [currentSeller, setCurrentSeller] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Theme Management (default to dark mode)
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('oyopasal_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark'; // Dark mode default as requested
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
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setTheme = useCallback((newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
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
        const defaultAddr = resp.results.find(a => a.is_default) || resp.results[0];
        setCurrentAddress(defaultAddr);
      }
    } catch (err) {
      console.error('Failed to load addresses', err);
    }
  }, []);

  // Initial data bootstrap
  useEffect(() => {
    const initApp = async () => {
      try {
        const [userData] = await Promise.all([
          api.getUser(),
          refreshCart(),
          refreshAddresses()
        ]);
        setUser(userData);
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    initApp();
  }, [refreshCart, refreshAddresses]);

  const addToCart = async (productId: string, quantity = 1, variantId?: string) => {
    try {
      setCartLoading(true);
      const updated = await api.addToCart(productId, quantity, variantId);
      setCart(updated);
      showToast('Item added to your basket', 'success');
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
      showToast('Item removed from basket', 'info');
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
      showToast('Basket cleared', 'info');
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
      showToast(`Coupon "${code.toUpperCase()}" applied successfully!`, 'success');
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
      showToast('Coupon removed', 'info');
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
        showToast('Saved to your Wishlist', 'success');
      } else {
        showToast('Removed from Wishlist', 'info');
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
      setAddresses(prev => [...prev, created]);
      if (created.is_default || !currentAddress) {
        setCurrentAddress(created);
      }
      showToast('New address saved', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save address';
      showToast(msg, 'error');
      throw err;
    }
  };

  const loginAsSeller = async (payload: { identifier?: string; password?: string; vendor_id?: string }) => {
    try {
      const res = await api.loginAsSeller(payload);
      setCurrentSeller(res.vendor);
      setSellerLoginModalOpen(false);
      setSellerDashboardModalOpen(true);
      showToast(`Welcome to Merchant Portal, ${res.vendor.name}!`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Seller login failed';
      showToast(msg, 'error');
      throw err;
    }
  };

  const logoutSeller = () => {
    setCurrentSeller(null);
    setSellerDashboardModalOpen(false);
    showToast('Signed out from Merchant Portal', 'info');
  };

  const getDistanceToVendor = useCallback((vendorIdOrProduct: string | { id?: string; vendor?: { id: string } }) => {
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

    const vendorLoc = VENDOR_LOCATIONS[vId] || VENDOR_LOCATIONS['v-himalayan'];
    const dist = calculateDistanceInKm(currentCoordinates.lat, currentCoordinates.lng, vendorLoc.lat, vendorLoc.lng);
    const roundedDist = Math.max(0.2, dist);
    const distanceText = `${roundedDist.toFixed(1)} km`;
    
    // Quick-commerce delivery speed estimate: ~2 mins per km + 8 mins packaging
    const estMins = Math.min(30, Math.max(9, Math.round(vendorLoc.baseMins + (roundedDist * 2.2))));
    const etaText = `${estMins}-${estMins + 3} mins`;

    return {
      distanceKm: roundedDist,
      distanceText,
      etaText
    };
  }, [currentCoordinates]);

  const setDeliveryLocationFromMap = useCallback((coords: { lat: number; lng: number }, areaName?: string, streetName?: string) => {
    setCurrentCoordinates(coords);
    const computedArea = areaName || 'Kathmandu Valley';
    const computedStreet = streetName || `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

    const mappedAddress: Address = {
      id: `addr-map-${Date.now()}`,
      title: 'Pinned Location',
      recipient_name: user?.full_name || 'Roshan Yadav',
      phone: user?.phone || '+977 9841234567',
      street: computedStreet,
      area: computedArea,
      city: 'Kathmandu',
      landmark: 'Selected via Google Geo Map',
      is_default: true,
      lat: coords.lat,
      lng: coords.lng
    };

    setCurrentAddress(mappedAddress);
    showToast(`Delivery location set to ${computedArea}`, 'success');
  }, [user, showToast]);

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
        toasts,
        showToast,
        dismissToast,
        refreshCart
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
