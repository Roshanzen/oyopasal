import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { APP_CONFIG } from '../config';
import { authService, httpClient } from '../services';
import { CustomerLoginPayload, CustomerRegisterPayload, UserProfile } from '../types';
import { safeStorage } from '../utils';
import { useCartContext } from './CartContext';
import { useLanguageContext } from './LanguageContext';
import { useLocationContext } from './LocationContext';
import { useToastContext } from './ToastContext';
import { useWishlistContext } from './WishlistContext';

export interface AuthContextType {
  user: UserProfile | null;
  setUserDirect: (user: UserProfile | null) => void;
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
  loginCustomer: (payload: CustomerLoginPayload) => Promise<void>;
  registerCustomer: (payload: CustomerRegisterPayload) => Promise<void>;
  logoutCustomer: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguageContext();
  const { showToast } = useToastContext();
  const { refreshCart } = useCartContext();
  const { refreshWishlist } = useWishlistContext();
  const { refreshAddresses, setAddresses } = useLocationContext();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const restoreUser = async () => {
      const hasToken = Boolean(httpClient.getToken());
      if (!hasToken) return;
      try {
        const me = await authService.getUser();
        setUser(me);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
      } catch {
        httpClient.clearToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
        setUser(null);
      }
    };
    restoreUser();
  }, []);

  const setUserDirect = useCallback(
    (newUser: UserProfile | null) => {
      setUser(newUser);
      if (newUser) {
        if (newUser.token) httpClient.setToken(newUser.token);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
        refreshAddresses();
        refreshWishlist();
        refreshCart();
      } else {
        httpClient.clearToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
      }
    },
    [refreshAddresses, refreshWishlist, refreshCart]
  );

  const loginCustomer = useCallback(
    async (payload: CustomerLoginPayload) => {
      try {
        const res = await authService.loginCustomer(payload);
        if (res.token) {
          httpClient.setToken(res.token);
        }
        setUser(res.user);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
        setLoginModalOpen(false);
        await Promise.all([refreshAddresses(), refreshWishlist(), refreshCart()]);
        showToast(t('toast.welcomeCustomer', { name: res.user.full_name.split(' ')[0] }), 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Login failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [refreshAddresses, refreshCart, refreshWishlist, showToast, t]
  );

  const registerCustomer = useCallback(
    async (payload: CustomerRegisterPayload) => {
      try {
        const res = await authService.registerCustomer(payload);
        if (res.token) {
          httpClient.setToken(res.token);
        }
        setUser(res.user);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
        setLoginModalOpen(false);
        await Promise.all([refreshAddresses(), refreshWishlist(), refreshCart()]);
        showToast(t('toast.welcomeCustomer', { name: res.user.full_name.split(' ')[0] }), 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Registration failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [refreshAddresses, refreshCart, refreshWishlist, showToast, t]
  );

  const logoutCustomer = useCallback(() => {
    if (httpClient.getToken()) {
      authService.logoutCustomer().catch(() => {});
    }
    httpClient.clearToken();
    setUser(null);
    setAddresses([]);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
    refreshCart();
    refreshWishlist();
    showToast(t('toast.signedOutCustomer'), 'info');
  }, [refreshCart, refreshWishlist, setAddresses, showToast, t]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUserDirect,
        loginModalOpen,
        setLoginModalOpen,
        loginCustomer,
        registerCustomer,
        logoutCustomer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider');
  return ctx;
}
