import { DRFPaginatedResponse, Product } from '../types';
import { httpClient } from './httpClient';

export const wishlistService = {
  getWishlist(): Promise<DRFPaginatedResponse<Product>> {
    return httpClient.request<DRFPaginatedResponse<Product>>('/wishlist/');
  },

  toggleWishlist(productId: string): Promise<{ product_id: string; is_wishlisted: boolean; wishlist_ids: string[] }> {
    return httpClient.request('/wishlist/toggle/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId }),
    });
  },
};
