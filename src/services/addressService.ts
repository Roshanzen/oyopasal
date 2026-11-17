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

  getZones(): Promise<{ count: number; results: DeliveryZoneItem[] }> {
    return httpClient.request('/zones/');
  },
};
