import { Address, DeliveryZoneItem } from '../types';
import { httpClient } from './httpClient';

export const addressService = {
  getAddresses(): Promise<{ count: number; results: Address[] }> {
    return httpClient.request('/account/addresses/');
  },

  createAddress(address: Partial<Address>): Promise<Address> {
    return httpClient.request<Address>('/account/addresses/', {
      method: 'POST',
      body: JSON.stringify(address),
    });
  },

  updateAddress(id: string, address: Partial<Address>): Promise<Address> {
    return httpClient.request<Address>(`/account/addresses/${id}/`, {
      method: 'PUT',
      body: JSON.stringify(address),
    });
  },

  deleteAddress(id: string): Promise<{ success: boolean }> {
    return httpClient.request(`/account/addresses/${id}/`, {
      method: 'DELETE',
    });
  },

  setDefaultAddress(id: string, type: 'shipping' | 'billing' = 'shipping'): Promise<{ success: boolean; message: string }> {
    return httpClient.request(`/account/addresses/${id}/set-default/`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },

  getZones(): Promise<{ count: number; results: DeliveryZoneItem[] }> {
    return httpClient.request('/zones/');
  },
};
