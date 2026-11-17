export type Language = 'en' | 'ne';
export type ThemeMode = 'dark' | 'light';

export interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

export interface PublicSettings {
  delivery_fees: {
    baseDeliveryFee: number;
    freeDeliveryThreshold: number;
    handlingFee: number;
    defaultEtaMins: number;
  };
  commission_policy: {
    defaultCommissionRate: number;
    newSellerZeroCommissionDays: number;
  };
  store_support: {
    brandName: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    hours: string;
  };
}

export interface DRFPaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AutocompleteSuggestion {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  unit: string;
}

export interface AutocompleteCategory {
  id: string;
  name: string;
  slug: string;
}

export interface DbStatusResponse {
  status: string;
  engine?: string;
  counts?: {
    products: number;
    categories: number;
    vendors: number;
    orders: number;
  };
}

