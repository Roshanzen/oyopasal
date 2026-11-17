import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context';
import { orderService } from '../services';
import { Address, DeliveryTrackingTelemetry, Order } from '../types';
import { calculateDistanceInKm } from '../utils';

export interface LatLng {
  lat: number;
  lng: number;
}

export function resolveAddressCoords(addr?: Address | null, fallback?: LatLng): LatLng {
  if (
    addr &&
    typeof addr.lat === 'number' &&
    typeof addr.lng === 'number' &&
    !Number.isNaN(addr.lat) &&
    !Number.isNaN(addr.lng)
  ) {
    return { lat: addr.lat, lng: addr.lng };
  }
  return fallback || { lat: 27.7172, lng: 85.324 };
}

export function calculateBearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export function useOrderTracking(orderId?: string) {
  const { showToast, addresses, currentCoordinates, vendors, t, formatPrice, language, user, setLoginModalOpen } = useApp();

  const [order, setOrder] = useState<Order | null>(null);
  const [tracking, setTracking] = useState<DeliveryTrackingTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>('order');
  const [routeMetrics, setRouteMetrics] = useState<{ distanceMeters?: number; durationMillis?: number }>({});
  const [followRider, setFollowRider] = useState<boolean>(false);
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [activeMarkerInfo, setActiveMarkerInfo] = useState<'hub' | 'rider' | 'destination' | null>('rider');
  const [mapsQuotaError, setMapsQuotaError] = useState<boolean>(false);

  useEffect(() => {
    const handleQuota = () => setMapsQuotaError(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota as EventListener);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota as EventListener);
  }, []);

  const fetchOrderAndTracking = useCallback(
    async (showSpinner = false) => {
      if (!orderId) return;
      try {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);
        setLoadError(null);

        const ordRes = await orderService.getOrderById(orderId);
        setOrder(ordRes);

        try {
          const trackRes = await orderService.getOrderTracking(orderId);
          setTracking(trackRes);
        } catch {
          setTracking(null);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Unable to load order tracking');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    fetchOrderAndTracking(true);
  }, [fetchOrderAndTracking, user?.id]);

  // Real 5-second server polling while order is active
  useEffect(() => {
    if (!order || order.status === 'DELIVERED' || order.status === 'CANCELLED') return;
    const poll = setInterval(() => {
      fetchOrderAndTracking(false);
    }, 5000);
    return () => clearInterval(poll);
  }, [order, fetchOrderAndTracking]);

  const hubInfo = useMemo(() => {
    const vendorId = order?.items_by_vendor?.[0]?.vendor?.id;
    const dbVendor = vendors.find((v) => v.id === vendorId) || vendors[0];
    const pickupLat = tracking?.assignment?.pickup_lat ?? dbVendor?.lat ?? currentCoordinates.lat;
    const pickupLng = tracking?.assignment?.pickup_lng ?? dbVendor?.lng ?? currentCoordinates.lng;
    return {
      name: order?.items_by_vendor?.[0]?.vendor?.name || dbVendor?.name || 'Fulfillment Store',
      area: dbVendor?.area || dbVendor?.location || 'Kathmandu Valley',
      coords: { lat: pickupLat, lng: pickupLng },
    };
  }, [order, tracking, vendors, currentCoordinates]);

  const targetSavedAddress: Address | null = useMemo(() => {
    if (!order) return null;
    if (selectedSavedAddressId === 'order') return order.delivery_address;
    const found = addresses.find((a) => a.id === selectedSavedAddressId);
    return found || order.delivery_address;
  }, [order, selectedSavedAddressId, addresses]);

  const destinationCoords = useMemo(() => {
    if (
      selectedSavedAddressId === 'order' &&
      tracking?.assignment?.dropoff_lat != null &&
      tracking?.assignment?.dropoff_lng != null
    ) {
      return { lat: tracking.assignment.dropoff_lat, lng: tracking.assignment.dropoff_lng };
    }
    return resolveAddressCoords(targetSavedAddress, currentCoordinates);
  }, [
    selectedSavedAddressId,
    tracking?.assignment?.dropoff_lat,
    tracking?.assignment?.dropoff_lng,
    targetSavedAddress,
    currentCoordinates,
  ]);

  const assignment = tracking?.assignment || null;
  const riderPosition: LatLng | null = useMemo(() => {
    if (!assignment || assignment.current_lat === null || assignment.current_lng === null) {
      return null;
    }
    return { lat: assignment.current_lat, lng: assignment.current_lng };
  }, [assignment]);

  const riderBearing = useMemo(() => {
    if (!riderPosition) return 0;
    return calculateBearing(riderPosition, destinationCoords);
  }, [riderPosition, destinationCoords]);

  const handleRouteMetricsComputed = useCallback((distanceMeters?: number, durationMillis?: number) => {
    if (distanceMeters || durationMillis) {
      setRouteMetrics({ distanceMeters, durationMillis });
    }
  }, []);

  const totalRouteKm = useMemo(() => {
    if (routeMetrics.distanceMeters) return Math.max(0.2, routeMetrics.distanceMeters / 1000);
    return Math.max(
      0.2,
      calculateDistanceInKm(hubInfo.coords.lat, hubInfo.coords.lng, destinationCoords.lat, destinationCoords.lng)
    );
  }, [routeMetrics.distanceMeters, hubInfo.coords, destinationCoords]);

  const remainingDistanceKm = useMemo(() => {
    if (order?.status === 'DELIVERED') return 0;
    if (!riderPosition) return totalRouteKm;
    return Math.max(
      0.02,
      calculateDistanceInKm(riderPosition.lat, riderPosition.lng, destinationCoords.lat, destinationCoords.lng)
    );
  }, [order?.status, riderPosition, destinationCoords, totalRouteKm]);

  const speedKmh = assignment?.speed_kmh ?? 0;
  const etaDisplay = useMemo(() => {
    if (order?.status === 'CANCELLED') return language === 'ne' ? 'रद्द गरिएको' : 'Cancelled';
    if (order?.status === 'DELIVERED') return language === 'ne' ? 'डेलिभर भयो' : 'Arrived at Doorstep';
    if (!assignment) return `${order?.estimated_delivery_mins || 14} ${t('common.mins')}`;
    if (assignment.eta_minutes !== null && assignment.eta_minutes !== undefined) {
      return `${assignment.eta_minutes} ${t('common.mins')}`;
    }
    const mins = Math.max(2, Math.round((remainingDistanceKm / Math.max(18, speedKmh || 24)) * 60));
    return `${mins} ${t('common.mins')}`;
  }, [order, assignment, remainingDistanceKm, speedKmh, language, t]);

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const updated = await orderService.cancelOrder(order.id);
      setOrder(updated);
      setShowCancelModal(false);
      showToast('Order cancelled successfully', 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not cancel order';
      showToast(msg, 'error');
    } finally {
      setCancelling(false);
    }
  };

  return {
    order,
    tracking,
    assignment,
    loading,
    loadError,
    refreshing,
    cancelling,
    showCancelModal,
    setShowCancelModal,
    selectedSavedAddressId,
    setSelectedSavedAddressId,
    followRider,
    setFollowRider,
    fitTrigger,
    setFitTrigger,
    activeMarkerInfo,
    setActiveMarkerInfo,
    mapsQuotaError,
    hubInfo,
    targetSavedAddress,
    destinationCoords,
    riderPosition,
    riderBearing,
    totalRouteKm,
    remainingDistanceKm,
    speedKmh,
    etaDisplay,
    addresses,
    currentCoordinates,
    user,
    language,
    t,
    formatPrice,
    setLoginModalOpen,
    fetchOrderAndTracking,
    handleRouteMetricsComputed,
    handleCancelOrder,
  };
}
