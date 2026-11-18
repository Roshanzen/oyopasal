import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { APP_CONFIG } from '../config';
import { addressService, vendorService } from '../services';
import { httpClient } from '../services/httpClient';
import { Address, Coordinates, PublicSettings, Vendor } from '../types';
import { calculateDistanceInKm, estimateDeliveryMinutes } from '../utils';
import { useLanguageContext } from './LanguageContext';
import { useToastContext } from './ToastContext';

export interface LocationContextType {
  addresses: Address[];
  setAddresses: React.Dispatch<React.SetStateAction<Address[]>>;
  currentAddress: Address | null;
  setCurrentAddress: (addr: Address) => void;
  addNewAddress: (addr: Partial<Address>) => Promise<void>;
  refreshAddresses: () => Promise<void>;
  currentCoordinates: Coordinates;
  setCurrentCoordinates: (coords: Coordinates) => void;
  setDeliveryLocationFromMap: (
    coords: Coordinates,
    areaName?: string,
    streetName?: string,
    recipientFallback?: { full_name?: string; phone?: string }
  ) => void;
  getDistanceToVendor: (
    vendorIdOrProduct: string | { id?: string; vendor?: { id: string } }
  ) => { distanceKm: number; distanceText: string; etaText: string };
  locationModalOpen: boolean;
  setLocationModalOpen: (open: boolean) => void;
  vendors: Vendor[];
  publicSettings: PublicSettings | null;
  refreshVendors: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { language, t } = useLanguageContext();
  const { showToast } = useToastContext();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [currentAddress, setCurrentAddressState] = useState<Address | null>(null);
  const [currentCoordinates, setCurrentCoordinates] = useState<Coordinates>({
    lat: APP_CONFIG.DEFAULT_COORDINATES.lat,
    lng: APP_CONFIG.DEFAULT_COORDINATES.lng,
  });
  const [locationModalOpen, setLocationModalOpen] = useState<boolean>(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);

  const setCurrentAddress = useCallback((addr: Address) => {
    setCurrentAddressState(addr);
    if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
      setCurrentCoordinates({ lat: addr.lat, lng: addr.lng });
    }
  }, []);

  const refreshAddresses = useCallback(async () => {
    if (!httpClient.getToken()) {
      setAddresses([]);
      return;
    }
    try {
      const resp = await addressService.getAddresses();
      const list = Array.isArray(resp?.results) ? resp.results : (Array.isArray(resp) ? (resp as Address[]) : []);
      setAddresses(list);
      if (list.length > 0) {
        const defaultAddr = list.find((a) => a.is_default) || list[0];
        setCurrentAddressState(defaultAddr);
        if (typeof defaultAddr.lat === 'number' && typeof defaultAddr.lng === 'number') {
          setCurrentCoordinates({ lat: defaultAddr.lat, lng: defaultAddr.lng });
        }
      }
    } catch {
      // Unauthenticated guests or expired sessions receive empty address list
      setAddresses([]);
    }
  }, []);

  const refreshVendors = useCallback(async () => {
    try {
      const [vResp, settingsResp] = await Promise.all([
        vendorService.getVendors(),
        vendorService.getPublicSettings(),
      ]);
      setVendors(vResp.results);
      setPublicSettings(settingsResp);
    } catch (err) {
      console.error('Failed to load vendors/settings:', err);
    }
  }, []);

  useEffect(() => {
    refreshAddresses();
    refreshVendors();
  }, [refreshAddresses, refreshVendors]);

  const addNewAddress = useCallback(
    async (addr: Partial<Address>) => {
      try {
        const created = await addressService.createAddress(addr);
        setAddresses((prev) => [...prev, created]);
        if (created.is_default || !currentAddress) {
          setCurrentAddress(created);
        }
        showToast(t('toast.addressSaved'), 'success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Could not save address';
        showToast(msg, 'error');
        throw err;
      }
    },
    [currentAddress, setCurrentAddress, showToast, t]
  );

  const getDistanceToVendor = useCallback(
    (vendorIdOrProduct: string | { id?: string; vendor?: { id: string } }) => {
      let vId = '';
      if (typeof vendorIdOrProduct === 'string') {
        vId = vendorIdOrProduct;
      } else if (vendorIdOrProduct && typeof vendorIdOrProduct === 'object') {
        if (vendorIdOrProduct.vendor && typeof vendorIdOrProduct.vendor === 'object') {
          vId = vendorIdOrProduct.vendor.id || '';
        }
        if (!vId && vendorIdOrProduct.id) {
          vId = vendorIdOrProduct.id;
        }
      }

      const vendorRow = vendors.find((v) => v.id === vId || v.slug === vId) || vendors[0];
      const vLat = vendorRow?.lat ?? currentCoordinates.lat;
      const vLng = vendorRow?.lng ?? currentCoordinates.lng;
      const parsedMins = parseInt(String(vendorRow?.delivery_time_mins || ''), 10);
      const baseMins =
        !Number.isNaN(parsedMins) && parsedMins > 0
          ? parsedMins
          : publicSettings?.delivery_fees.defaultEtaMins ?? APP_CONFIG.DEFAULT_DELIVERY_DEFAULTS.defaultEtaMins;

      const dist = vendorRow
        ? calculateDistanceInKm(currentCoordinates.lat, currentCoordinates.lng, vLat, vLng)
        : 1.0;
      const roundedDist = Math.max(0.2, dist);
      const kmUnit = language === 'ne' ? 'कि.मि.' : 'km';
      const minsUnit = language === 'ne' ? 'मिनेट' : 'mins';
      const distanceText = `${roundedDist.toFixed(1)} ${kmUnit}`;

      const estMins = estimateDeliveryMinutes(roundedDist, baseMins);
      const etaText = `${estMins}-${estMins + 3} ${minsUnit}`;

      return { distanceKm: roundedDist, distanceText, etaText };
    },
    [currentCoordinates, language, vendors, publicSettings]
  );

  const setDeliveryLocationFromMap = useCallback(
    (
      coords: Coordinates,
      areaName?: string,
      streetName?: string,
      recipientFallback?: { full_name?: string; phone?: string }
    ) => {
      setCurrentCoordinates(coords);
      const computedArea = areaName || 'Kathmandu Valley';
      const computedStreet = streetName || `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;

      const mappedAddress: Address = {
        id: `addr-map-${Date.now()}`,
        title: 'Pinned Location',
        recipient_name: recipientFallback?.full_name || 'Guest Customer',
        phone: recipientFallback?.phone || '+977 9800000000',
        street: computedStreet,
        area: computedArea,
        city: 'Kathmandu',
        landmark: 'Selected via Google Geo Map',
        is_default: true,
        lat: coords.lat,
        lng: coords.lng,
      };

      setCurrentAddressState(mappedAddress);
      showToast(t('toast.locationSet', { area: computedArea }), 'success');
    },
    [showToast, t]
  );

  return (
    <LocationContext.Provider
      value={{
        addresses,
        setAddresses,
        currentAddress,
        setCurrentAddress,
        addNewAddress,
        refreshAddresses,
        currentCoordinates,
        setCurrentCoordinates,
        setDeliveryLocationFromMap,
        getDistanceToVendor,
        locationModalOpen,
        setLocationModalOpen,
        vendors,
        publicSettings,
        refreshVendors,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext(): LocationContextType {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within a LocationProvider');
  return ctx;
}
