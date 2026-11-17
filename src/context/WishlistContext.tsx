import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { wishlistService } from '../services';
import { useLanguageContext } from './LanguageContext';
import { useToastContext } from './ToastContext';

export interface WishlistContextType {
  wishlistIds: string[];
  toggleWishlist: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguageContext();
  const { showToast } = useToastContext();
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  const refreshWishlist = useCallback(async () => {
    try {
      const resp = await wishlistService.getWishlist();
      setWishlistIds(resp.results.map((p) => p.id));
    } catch {
      // ignore unauthenticated wishlist failures
    }
  }, []);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      try {
        const res = await wishlistService.toggleWishlist(productId);
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
    },
    [showToast, t]
  );

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.includes(productId),
    [wishlistIds]
  );

  return (
    <WishlistContext.Provider value={{ wishlistIds, toggleWishlist, isWishlisted, refreshWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlistContext(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlistContext must be used within a WishlistProvider');
  return ctx;
}
