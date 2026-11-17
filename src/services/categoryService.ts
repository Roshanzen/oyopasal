import { Category, DRFPaginatedResponse } from '../types';
import { httpClient } from './httpClient';

export const categoryService = {
  getCategories(): Promise<DRFPaginatedResponse<Category>> {
    return httpClient.request<DRFPaginatedResponse<Category>>('/categories/');
  },
};
