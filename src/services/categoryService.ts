import { Category, DRFPaginatedResponse } from '../types';
import { httpClient } from './httpClient';

export const categoryService = {
  async getCategories(): Promise<DRFPaginatedResponse<Category>> {
    const data = await httpClient.request<unknown>('/categories/');
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
};
