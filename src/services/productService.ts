import {
  AutocompleteCategory,
  AutocompleteSuggestion,
  DbStatusResponse,
  DRFPaginatedResponse,
  Product,
  ReviewItem,
} from '../types';
import { httpClient, RequestOptions } from './httpClient';

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
  getDbStatus(options?: RequestOptions): Promise<DbStatusResponse> {
    return httpClient.request<DbStatusResponse>('/db/status/', options);
  },

  getProducts(params?: ProductQueryParams, options?: RequestOptions): Promise<DRFPaginatedResponse<Product>> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      });
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    return httpClient.request<DRFPaginatedResponse<Product>>(`/products/${qs}`, options);
  },

  getProductById(id: string, options?: RequestOptions): Promise<Product> {
    return httpClient.request<Product>(`/products/${id}/`, options);
  },

  getSimilarProducts(id: string, options?: RequestOptions): Promise<DRFPaginatedResponse<Product>> {
    return httpClient.request<DRFPaginatedResponse<Product>>(`/products/${id}/similar/`, options);
  },

  getProductReviews(id: string, options?: RequestOptions): Promise<{ count: number; average_rating: number; results: ReviewItem[] }> {
    return httpClient.request(`/products/${id}/reviews/`, options);
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
    suggestions: AutocompleteSuggestion[];
    categories: AutocompleteCategory[];
  }> {
    return httpClient.request(`/products/autocomplete/?q=${encodeURIComponent(query)}`);
  },
};
