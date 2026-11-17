import { ActiveCouponItem, CartSummary, Coupon } from '../types';
import { httpClient } from './httpClient';

export const cartService = {
  getCart(): Promise<CartSummary> {
    return httpClient.request<CartSummary>('/cart/');
  },

  addToCart(productId: string, quantity = 1, variantId?: string): Promise<CartSummary> {
    return httpClient.request<CartSummary>('/cart/items/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity, variant_id: variantId }),
    });
  },

  updateCartItem(itemId: string, quantity: number): Promise<CartSummary> {
    return httpClient.request<CartSummary>(`/cart/items/${itemId}/`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
    });
  },

  removeCartItem(itemId: string): Promise<CartSummary> {
    return httpClient.request<CartSummary>(`/cart/items/${itemId}/`, {
      method: 'DELETE',
    });
  },

  clearCart(): Promise<CartSummary> {
    return httpClient.request<CartSummary>('/cart/clear/', {
      method: 'DELETE',
    });
  },

  applyCoupon(code: string): Promise<{ success: boolean; coupon: Coupon; cart: CartSummary }> {
    return httpClient.request('/coupons/apply/', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  removeCoupon(): Promise<{ success: boolean; cart: CartSummary }> {
    return httpClient.request('/coupons/remove/', {
      method: 'DELETE',
    });
  },

  getActiveCoupons(): Promise<{ count: number; results: ActiveCouponItem[] }> {
    return httpClient.request('/coupons/active/');
  },
};
