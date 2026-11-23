import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { APP_CONFIG } from '../config';
import { ApiRequestError, authService, httpClient, sellerService } from '../services';
import { SellerLoginPayload, Vendor } from '../types';
import { safeStorage } from '../utils';
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
  const [currentSeller, setCurrentSeller] = useState<Vendor | null>(() =>
    safeStorage.getJson<Vendor>(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION)
  );

  const refreshSellerSession = useCallback(async () => {
    const savedSeller = safeStorage.getJson<Vendor>(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
    if (!savedSeller) return;

    try {
      const storeRes = await sellerService.getSellerStore(savedSeller?.id, {
        bypassCache: true,
        headers: { 'Cache-Control': 'no-cache, no-store' },
      });
      if (storeRes?.vendor) {
        setCurrentSeller(storeRes.vendor);
        safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, storeRes.vendor);
      }
    } catch (err: unknown) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        httpClient.clearSellerToken();
        safeStorage.remove(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION);
        setCurrentSeller(null);
      }
    }
  }, []);

  const updateCurrentSeller = useCallback((vendor: Vendor) => {
    setCurrentSeller(vendor);
    safeStorage.setJson(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, vendor);
  }, []);

  useEffect(() => {
    refreshSellerSession();
  }, [user?.role, refreshSellerSession]);

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
        setSellerDashboardModalOpen(true);
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
