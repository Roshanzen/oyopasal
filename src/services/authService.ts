import {
  CustomerLoginPayload,
  CustomerRegisterPayload,
  SellerLoginPayload,
  UserProfile,
  Vendor,
  VendorRegisterPayload,
} from '../types';
import { httpClient } from './httpClient';

export const authService = {
  registerCustomer(data: CustomerRegisterPayload): Promise<{ success: boolean; token: string; user: UserProfile }> {
    return httpClient.request('/auth/register-customer/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  registerVendor(data: VendorRegisterPayload): Promise<{ success: boolean; message: string; user?: UserProfile; vendor?: Vendor }> {
    return httpClient.request('/auth/register-vendor/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  loginCustomer(data: CustomerLoginPayload): Promise<{ success?: boolean; token: string; user: UserProfile }> {
    return httpClient.request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  firebaseLogin(data: {
    id_token: string;
    full_name?: string;
    phone?: string;
  }): Promise<{ success: boolean; token: string; user: UserProfile }> {
    return httpClient.request('/auth/firebase-login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logoutCustomer(): Promise<{ success: boolean }> {
    return httpClient.request('/auth/logout/', { method: 'POST' });
  },

  getUser(): Promise<UserProfile> {
    return httpClient.request<UserProfile>('/auth/user/');
  },

  updateUser(data: Partial<UserProfile>): Promise<UserProfile> {
    return httpClient.request<UserProfile>('/auth/user/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  loginAsSeller(data: SellerLoginPayload): Promise<{ success: boolean; token: string; user: UserProfile; vendor: Vendor }> {
    return httpClient.request('/auth/login-vendor/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  },

  loginVendor(data: SellerLoginPayload): Promise<{ success: boolean; token: string; user: UserProfile; vendor: Vendor }> {
    return httpClient.request('/auth/login-vendor/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  },
};
