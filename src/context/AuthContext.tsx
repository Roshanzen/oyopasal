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
  loginCustomer: (payload: CustomerLoginPayload) => Promise<UserProfile>;
  registerCustomer: (payload: CustomerRegisterPayload) => Promise<UserProfile>;
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
        const roleStr = String(me.role || '').toUpperCase();
        const vendorRoles = ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SELLER'];
        const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'];
        if (vendorRoles.includes(roleStr) && !adminRoles.includes(roleStr)) {
          // Token in customer auth storage belongs to a vendor account! Purge customer token.
          httpClient.clearToken();
          safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
          setUser(null);
          return;
        }

        const profileUser: UserProfile = {
          ...me,
          vendor: (me as any)?.vendor || null,
          has_vendor_access: Boolean(
            (me as any)?.vendor ||
            (me as any)?.has_vendor_access
          ),
        };
        setUser(profileUser);
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
      if (newUser) {
        const roleStr = String(newUser.role || '').toUpperCase();
        const vendorRoles = ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SELLER'];
        const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'];
        if (vendorRoles.includes(roleStr) && !adminRoles.includes(roleStr)) {
          httpClient.clearToken();
          safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
          setUser(null);
          return;
        }
        setUser(newUser);
        if (newUser.token) httpClient.setToken(newUser.token);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
        refreshAddresses();
        refreshWishlist();
        refreshCart();
      } else {
        setUser(null);
        httpClient.clearToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
      }
    },
    [refreshAddresses, refreshWishlist, refreshCart]
  );

  const loginCustomer = useCallback(
    async (payload: CustomerLoginPayload): Promise<UserProfile> => {
      try {
        const res = await authService.loginCustomer(payload);
        const roleStr = String(res.user?.role || '').toUpperCase();
        const vendorRoles = ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SELLER'];
        const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN'];
        if (vendorRoles.includes(roleStr) && !adminRoles.includes(roleStr)) {
          httpClient.clearToken();
          safeStorage.remove(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN);
          throw new Error('This account is registered as a Merchant/Vendor. Please sign in via the Merchant Portal at /seller.');
        }

        if (res.token) {
          httpClient.setToken(res.token);
        }
        const profileUser: UserProfile = {
          ...res.user,
          vendor: (res.user as any)?.vendor || (res as any)?.vendor || null,
          has_vendor_access: Boolean(
            (res.user as any)?.vendor ||
            (res as any)?.vendor ||
            (res.user as any)?.has_vendor_access
          ),
        };
        setUser(profileUser);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
        setLoginModalOpen(false);
        await Promise.all([refreshAddresses(), refreshWishlist(), refreshCart()]);
        showToast(t('toast.welcomeCustomer', { name: res.user.full_name.split(' ')[0] }), 'success');
        return profileUser;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Login failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [refreshAddresses, refreshCart, refreshWishlist, showToast, t]
  );

  const registerCustomer = useCallback(
    async (payload: CustomerRegisterPayload): Promise<UserProfile> => {
      try {
        const res = await authService.registerCustomer(payload);
        if (res.token) {
          httpClient.setToken(res.token);
        }
        const profileUser: UserProfile = {
          ...res.user,
          vendor: (res.user as any)?.vendor || (res as any)?.vendor || null,
          has_vendor_access: Boolean(
            (res.user as any)?.vendor ||
            (res as any)?.vendor ||
            (res.user as any)?.has_vendor_access
          ),
        };
        setUser(profileUser);
        safeStorage.set(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'true');
        setLoginModalOpen(false);
        await Promise.all([refreshAddresses(), refreshWishlist(), refreshCart()]);
        showToast(t('toast.welcomeCustomer', { name: res.user.full_name.split(' ')[0] }), 'success');
        return profileUser;
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
