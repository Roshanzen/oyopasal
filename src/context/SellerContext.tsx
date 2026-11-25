import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../config';
import { ApiRequestError, authService, httpClient, sellerService } from '../services';
import { SellerLoginPayload, Vendor } from '../types';
import { isUserVendor, safeStorage } from '../utils';
import { useAuthContext } from './AuthContext';
import { useLanguageContext } from './LanguageContext';
import { useToastContext } from './ToastContext';

export interface SellerContextType {
  becomeSellerModalOpen: boolean;
  setBecomeSellerModalOpen: (open: boolean) => void;
  sellerLoginModalOpen: boolean;
  setSellerLoginModalOpen: (open: boolean) => void;
  sellerDashboardModalOpen: boolean;
  setSellerDashboardModalOpen: (open: boolean) => void;
  currentSeller: Vendor | null;
  loginAsSeller: (payload: SellerLoginPayload) => Promise<void>;
  logoutSeller: () => void;
  updateCurrentSeller: (vendor: Vendor) => void;
  refreshSellerSession: () => Promise<void>;
}

const SellerContext = createContext<SellerContextType | undefined>(undefined);

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const { t } = useLanguageContext();
  const { showToast } = useToastContext();

  const [becomeSellerModalOpen, setBecomeSellerModalOpen] = useState<boolean>(false);
  const [sellerLoginModalOpen, setSellerLoginModalOpen] = useState<boolean>(false);
  const [sellerDashboardModalOpen, setSellerDashboardModalOpen] = useState<boolean>(false);
  const [currentSeller, setCurrentSeller] = useState<Vendor | null>(() => {
    // Only restore seller session on load if an explicit seller token exists
    if (httpClient.getSellerToken()) {
      return safeStorage.getJson<Vendor>(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
    }
    return null;
  });

  const currentSellerRef = useRef<Vendor | null>(currentSeller);
  currentSellerRef.current = currentSeller;
  const inFlightRefreshRef = useRef(false);

  const refreshSellerSession = useCallback(async () => {
    // If user is logged in but has no vendor access, never load or retain seller session
    if (user && !isUserVendor(user)) {
      if (currentSellerRef.current || safeStorage.get(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION)) {
        httpClient.clearSellerToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
        setCurrentSeller(null);
      }
      return;
    }

    if (inFlightRefreshRef.current) return;

    const savedSeller = (user?.vendor as Vendor) || safeStorage.getJson<Vendor>(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
    if (!savedSeller || !savedSeller.id) return;

    inFlightRefreshRef.current = true;
    try {
      const storeRes = await sellerService.getSellerStore(savedSeller.id, {
        bypassCache: true,
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (storeRes?.vendor) {
        const cur = currentSellerRef.current;
        const changed =
          !cur ||
          cur.id !== storeRes.vendor.id ||
          cur.status !== storeRes.vendor.status ||
          cur.is_verified !== storeRes.vendor.is_verified ||
          cur.is_online !== storeRes.vendor.is_online ||
          cur.name !== storeRes.vendor.name ||
          cur.logo_url !== storeRes.vendor.logo_url;
        if (changed) {
          setCurrentSeller(storeRes.vendor);
        }
        safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, storeRes.vendor);
      }
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        httpClient.clearSellerToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
        setCurrentSeller(null);
      }
    } finally {
      inFlightRefreshRef.current = false;
    }
  }, [user?.id, user?.role]);

  const updateCurrentSeller = useCallback((vendor: Vendor) => {
    const cur = currentSellerRef.current;
    if (!cur || cur.id !== vendor.id || cur.status !== vendor.status || cur.name !== vendor.name) {
      setCurrentSeller(vendor);
    }
    safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, vendor);
  }, []);

  useEffect(() => {
    if (user) {
      if (isUserVendor(user)) {
        if (user.vendor) {
          const userVendor = user.vendor as Vendor;
          if (!currentSellerRef.current || currentSellerRef.current.id !== userVendor.id) {
            setCurrentSeller(userVendor);
            safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, userVendor);
          }
        }
      } else {
        // Pure customer or non-vendor account logged in: strictly purge stale seller sessions
        setCurrentSeller(null);
        httpClient.clearSellerToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
      }
    } else {
      // No user logged in: ensure no unauthenticated seller session lingers without seller token
      if (!httpClient.getSellerToken() && currentSellerRef.current) {
        setCurrentSeller(null);
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user ? isUserVendor(user) : Boolean(httpClient.getSellerToken())) {
      refreshSellerSession();
    }
  }, [user?.id, user?.role, refreshSellerSession]);

  const loginAsSeller = useCallback(
    async (payload: SellerLoginPayload) => {
      try {
        const res = await authService.loginAsSeller(payload);
        if (res.token) {
          httpClient.setSellerToken(res.token);
        }
        setCurrentSeller(res.vendor);
        safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, res.vendor);
        setSellerLoginModalOpen(false);
        setSellerDashboardModalOpen(false);
        showToast(t('toast.welcomeSeller', { name: res.vendor.name }), 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Seller login failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [showToast, t]
  );

  const logoutSeller = useCallback(() => {
    httpClient.clearSellerToken();
    setCurrentSeller(null);
    safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
    setSellerDashboardModalOpen(false);
    showToast(t('toast.signedOutSeller'), 'info');
  }, [showToast, t]);

  return (
    <SellerContext.Provider
      value={{
        becomeSellerModalOpen,
        setBecomeSellerModalOpen,
        sellerLoginModalOpen,
        setSellerLoginModalOpen,
        sellerDashboardModalOpen,
        setSellerDashboardModalOpen,
        currentSeller,
        loginAsSeller,
        logoutSeller,
        updateCurrentSeller,
        refreshSellerSession,
      }}
    >
      {children}
    </SellerContext.Provider>
  );
}

export function useSellerContext(): SellerContextType {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSellerContext must be used within a SellerProvider');
  return ctx;
}
