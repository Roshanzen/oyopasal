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
      setCart(data);
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
        setCart(updated);
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
        setCart(updated);
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
        setCart(updated);
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
      setCart(updated);
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
        setCart(res.cart);
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
      setCart(res.cart);
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
