import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { httpClient } from '../services';
import { Coordinates } from '../types';
import { calculateDistanceInKm } from '../utils';
import { AuthProvider, useAuthContext } from './AuthContext';
import { CartProvider, useCartContext } from './CartContext';
import { LanguageProvider, useLanguageContext } from './LanguageContext';
import { LocationProvider, useLocationContext } from './LocationContext';
import { SellerProvider, useSellerContext } from './SellerContext';
import { ThemeProvider, useThemeContext } from './ThemeContext';
import { ToastProvider, useToastContext } from './ToastContext';
import { WishlistProvider, useWishlistContext } from './WishlistContext';

export { calculateDistanceInKm };

interface SearchStateContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const SearchStateContext = createContext<SearchStateContextType | undefined>(undefined);

function SearchStateProvider({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  return (
    <SearchStateContext.Provider value={{ searchQuery, setSearchQuery }}>
      {children}
    </SearchStateContext.Provider>
  );
}

function UnauthorizedSessionWatcher() {
  const { logoutCustomer } = useAuthContext();
  const { logoutSeller } = useSellerContext();

  useEffect(() => {
    httpClient.onUnauthorized((isSellerRequest) => {
      if (isSellerRequest && httpClient.getSellerToken()) {
        logoutSeller();
      } else if (!isSellerRequest && httpClient.getToken()) {
        logoutCustomer();
      }
    });
  }, [logoutCustomer, logoutSeller]);

  return null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ThemeProvider>
        <LanguageProvider>
          <CartProvider>
            <WishlistProvider>
              <LocationProvider>
                <AuthProvider>
                  <SellerProvider>
                    <SearchStateProvider>
                      <UnauthorizedSessionWatcher />
                      {children}
                    </SearchStateProvider>
                  </SellerProvider>
                </AuthProvider>
              </LocationProvider>
            </WishlistProvider>
          </CartProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ToastProvider>
  );
}

export function useApp() {
  const toastCtx = useToastContext();
  const themeCtx = useThemeContext();
  const langCtx = useLanguageContext();
  const cartCtx = useCartContext();
  const wishlistCtx = useWishlistContext();
  const locationCtx = useLocationContext();
  const authCtx = useAuthContext();
  const sellerCtx = useSellerContext();
  const searchCtx = useContext(SearchStateContext);

  if (!searchCtx) {
    throw new Error('useApp must be used within an AppProvider');
  }

  const setDeliveryLocationFromMap = useCallback(
    (coords: Coordinates, areaName?: string, streetName?: string) => {
      locationCtx.setDeliveryLocationFromMap(coords, areaName, streetName, authCtx.user || undefined);
    },
    [locationCtx, authCtx.user]
  );

  return {
    ...toastCtx,
    ...themeCtx,
    ...langCtx,
    ...cartCtx,
    ...wishlistCtx,
    ...locationCtx,
    setDeliveryLocationFromMap,
    ...authCtx,
    ...sellerCtx,
    ...searchCtx,
  };
}
