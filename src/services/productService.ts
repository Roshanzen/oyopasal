import { DRFPaginatedResponse, Product, ReviewItem } from '../types';
import { httpClient } from './httpClient';

export interface ProductQueryParams {
  category?: string;
  vendor?: string;
  section?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
  in_stock?: boolean;
}

export const productService = {
  getProducts(params?: ProductQueryParams): Promise<DRFPaginatedResponse<Product>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return httpClient.request<DRFPaginatedResponse<Product>>(`/products/${qs}`);
  },

  getProductById(id: string): Promise<Product> {
    return httpClient.request<Product>(`/products/${id}/`);
  },

  getSimilarProducts(id: string): Promise<DRFPaginatedResponse<Product>> {
    return httpClient.request<DRFPaginatedResponse<Product>>(`/products/${id}/similar/`);
  },

  getProductReviews(id: string): Promise<{ count: number; average_rating: number; results: ReviewItem[] }> {
    return httpClient.request(`/products/${id}/reviews/`);
  },

  submitProductReview(
    id: string,
    payload: { rating: number; title?: string; comment: string }
  ): Promise<{ success: boolean; review: ReviewItem }> {
    return httpClient.request(`/products/${id}/reviews/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAutocomplete(query: string): Promise<{
    suggestions: { id: string; name: string; category: string; price: number; image_url: string; unit: string }[];
    categories: { id: string; name: string; slug: string }[];
  }> {
    return httpClient.request(`/products/autocomplete/?q=${encodeURIComponent(query)}`);
  },
};
