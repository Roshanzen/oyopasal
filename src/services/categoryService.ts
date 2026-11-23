import { Category, DRFPaginatedResponse } from '../types';
import { httpClient, RequestOptions } from './httpClient';

export interface CreateCategoryPayload {
  name: string;
  slug?: string;
  parent_id?: string | null;
  ordering?: number;
  is_active?: boolean;
  description?: string;
  icon_url?: string;
  image_url?: string;
}

export const categoryService = {
  async getCategories(options?: RequestOptions): Promise<DRFPaginatedResponse<Category>> {
    const data = await httpClient.request<unknown>('/categories/', {
      cacheTtlMs: 30000,
      ...options,
    });
    if (Array.isArray(data)) {
      return {
        count: data.length,
        next: null,
        previous: null,
        results: data,
      };
    }
    const paginated = data as Partial<DRFPaginatedResponse<Category>> | undefined;
    return {
      count: paginated?.count ?? (paginated?.results?.length ?? 0),
      next: paginated?.next ?? null,
      previous: paginated?.previous ?? null,
      results: Array.isArray(paginated?.results) ? paginated.results : [],
    };
  },

  async createCategory(
    payload: CreateCategoryPayload,
    options?: RequestOptions
  ): Promise<{ success: boolean; category: Category; message?: string }> {
    const data = await httpClient.request<{ success: boolean; category: Category; message?: string }>(
      '/categories/',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        bypassCache: true,
        ...options,
      },
      false
    );
    httpClient.clearCache('/categories');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('categories:updated', { detail: data.category }));
    }
    return data;
  },

  async deleteCategory(
    idOrSlug: string,
    options?: RequestOptions
  ): Promise<{ success: boolean; message?: string }> {
    await httpClient.request(
      `/categories/${encodeURIComponent(idOrSlug)}/`,
      {
        method: 'DELETE',
        bypassCache: true,
        ...options,
      },
      false
    );
    httpClient.clearCache('/categories');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('categories:updated'));
    }
    return { success: true };
  },
};
