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
