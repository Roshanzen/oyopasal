import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartService } from '../services';
import { CartSummary } from '../types';
import { useLanguageContext } from './LanguageContext';
import { useToastContext } from './ToastContext';

export interface CartContextType {
  cart: CartSummary | null;
  cartLoading: boolean;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number, variantId?: string, customToast?: string | null) => Promise<void>;
  updateCartQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeCartItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizeCart(data: unknown): CartSummary {
  const c =
    data && typeof data === 'object' && 'data' in data && (data as any).data && typeof (data as any).data === 'object'
      ? (data as any).data
      : (data as any);

  if (!c || !Array.isArray(c.items)) {
    return {
      items: [],
      item_count: 0,
      vendor_groups: [],
      subtotal: 0,
      delivery_fee: 0,
      free_delivery_threshold: 499,
      amount_needed_for_free_delivery: 499,
      handling_fee: 0,
      coupon: null,
      total: 0,
    };
  }

  const items = Array.isArray(c.items) ? c.items : [];
  const rawSubtotal = c.subtotal;
  const subtotal = typeof rawSubtotal === 'string' ? parseFloat(rawSubtotal) || 0 : (rawSubtotal ?? 0);
  const rawTotal = c.total;
  const total = typeof rawTotal === 'string' ? parseFloat(rawTotal) || 0 : (rawTotal ?? 0);
  const vendorGroups = Array.isArray(c.vendor_groups)
    ? c.vendor_groups
    : Array.isArray(c.grouped_by_vendor)
    ? c.grouped_by_vendor
    : [];

  return {
    ...c,
    items,
    item_count:
      typeof c.item_count === 'number'
        ? c.item_count
        : typeof c.total_items === 'number'
        ? c.total_items
        : items.length,
    vendor_groups: vendorGroups,
    subtotal,
    total,
    delivery_fee: typeof c.delivery_fee === 'number' ? c.delivery_fee : parseFloat(c.delivery_fee) || 0,
    free_delivery_threshold: c.free_delivery_threshold ?? 499,
    amount_needed_for_free_delivery: c.amount_needed_for_free_delivery ?? Math.max(0, 499 - subtotal),
    handling_fee: typeof c.handling_fee === 'number' ? c.handling_fee : parseFloat(c.handling_fee) || 0,
    tax_total: typeof c.tax_total === 'number' ? c.tax_total : parseFloat(c.tax_total || c.tax) || 0,
    tax: typeof c.tax === 'number' ? c.tax : parseFloat(c.tax || c.tax_total) || 0,
    coupon: c.coupon || null,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguageContext();
  const { showToast } = useToastContext();
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [cartLoading, setCartLoading] = useState<boolean>(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);

  const refreshCart = useCallback(async () => {
    try {
      setCartLoading(true);
      const data = await cartService.getCart();
      setCart(normalizeCart(data));
    } catch (err) {
      console.error('Failed to load cart', err);
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = useCallback(
    async (productId: string, quantity = 1, variantId?: string, customToast?: string | null) => {
      try {
        setCartLoading(true);
        const updated = await cartService.addToCart(productId, quantity, variantId);
        setCart(normalizeCart(updated));
        if (customToast !== null) {
          showToast(customToast || t('toast.addedToBasket'), 'success');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not add item to basket';
        showToast(msg, 'error');
        throw err;
      } finally {
        setCartLoading(false);
      }
    },
    [showToast, t]
  );

  const updateCartQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        setCartLoading(true);
        const updated = await cartService.updateCartItem(itemId, quantity);
        setCart(normalizeCart(updated));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not update item';
        showToast(msg, 'error');
      } finally {
        setCartLoading(false);
      }
    },
    [showToast]
  );

  const removeCartItem = useCallback(
    async (itemId: string) => {
      try {
        setCartLoading(true);
        const updated = await cartService.removeCartItem(itemId);
        setCart(normalizeCart(updated));
        showToast(t('toast.removedFromBasket'), 'info');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not remove item';
        showToast(msg, 'error');
      } finally {
        setCartLoading(false);
      }
    },
    [showToast, t]
  );

  const clearCart = useCallback(async () => {
    try {
      setCartLoading(true);
      const updated = await cartService.clearCart();
      setCart(normalizeCart(updated));
      showToast(t('toast.basketCleared'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not clear basket';
      showToast(msg, 'error');
    } finally {
      setCartLoading(false);
    }
  }, [showToast, t]);

  const applyCoupon = useCallback(
    async (code: string) => {
      try {
        const res = await cartService.applyCoupon(code);
        setCart(normalizeCart(res.cart));
        showToast(t('toast.couponApplied', { code: code.toUpperCase() }), 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid coupon code';
        showToast(msg, 'error');
        throw err;
      }
    },
    [showToast, t]
  );

  const removeCoupon = useCallback(async () => {
    try {
      const res = await cartService.removeCoupon();
      setCart(normalizeCart(res.cart));
      showToast(t('toast.couponRemoved'), 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not remove coupon';
      showToast(msg, 'error');
    }
  }, [showToast, t]);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartLoading,
        cartDrawerOpen,
        setCartDrawerOpen,
        refreshCart,
        addToCart,
        updateCartQuantity,
        removeCartItem,
        clearCart,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used within a CartProvider');
  return ctx;
}
