import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context';
import { orderService } from '../services';
import { Address, DeliveryTrackingTelemetry, Order } from '../types';
import { calculateDistanceInKm, extractCoordinates } from '../utils';

export interface LatLng {
  lat: number;
  lng: number;
}

export function resolveAddressCoords(addr?: unknown, fallback?: LatLng): LatLng {
  const extracted = extractCoordinates(addr);
  if (extracted) {
    return extracted;
  }
  const fallbackExtracted = extractCoordinates(fallback);
  return fallbackExtracted || { lat: 27.7172, lng: 85.324 };
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

export function formatEta(etaMinutes: number | null | undefined, language: string = 'en'): string {
  if (etaMinutes === null || etaMinutes === undefined || Number.isNaN(etaMinutes)) {
    return '--';
  }
  if (etaMinutes <= 0) {
    return language === 'ne' ? 'डेलिभर भयो' : 'Delivered';
  }
  const mins = Math.round(etaMinutes);
  if (mins < 60) {
    return language === 'ne' ? `${mins} मिनेट` : `${mins} mins`;
  }
  const hours = Math.floor(mins / 60);
  const remMinutes = mins % 60;
  if (remMinutes === 0) {
    if (language === 'ne') return `${hours} घण्टा`;
    return hours === 1 ? '1 hr' : `${hours} hrs`;
  }
  if (language === 'ne') {
    return `${hours} घण्टा ${remMinutes} मिनेट`;
  }
  return `${hours === 1 ? '1 hr' : `${hours} hrs`} ${remMinutes} mins`;
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

  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const orderStatusRef = useRef<string | undefined>(undefined);
  orderStatusRef.current = order?.status;

  const fetchOrderAndTracking = useCallback(
    async (showSpinner = false) => {
      if (!orderId || isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);
        setLoadError(null);

        const [ordResult, trackResult] = await Promise.allSettled([
          orderService.getOrderById(orderId, { signal: controller.signal }),
          orderService.getOrderTracking(orderId, { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;

        if (ordResult.status === 'fulfilled') {
          setOrder(ordResult.value);
        } else if (ordResult.reason?.name !== 'AbortError') {
          setLoadError(ordResult.reason instanceof Error ? ordResult.reason.message : 'Unable to load order tracking');
        }

        if (trackResult.status === 'fulfilled') {
          setTracking(trackResult.value);
        } else if (trackResult.reason?.name !== 'AbortError') {
          setTracking(null);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLoadError(err instanceof Error ? err.message : 'Unable to load order tracking');
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    fetchOrderAndTracking(true);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOrderAndTracking, user?.id]);

  // Non-overlapping adaptive polling while order is active
  useEffect(() => {
    if (!orderId) return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const pollLoop = async () => {
      if (isCancelled) return;
      const status = orderStatusRef.current;
      if (status === 'DELIVERED' || status === 'CANCELLED') return;

      if (document.visibilityState === 'visible') {
        await fetchOrderAndTracking(false);
      }

      if (!isCancelled) {
        const nextStatus = orderStatusRef.current;
        if (nextStatus !== 'DELIVERED' && nextStatus !== 'CANCELLED') {
          timerId = setTimeout(pollLoop, 8000);
        }
      }
    };

    timerId = setTimeout(pollLoop, 8000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const status = orderStatusRef.current;
        if (status !== 'DELIVERED' && status !== 'CANCELLED') {
          fetchOrderAndTracking(false);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [orderId, fetchOrderAndTracking]);

  const hubInfo = useMemo(() => {
    const vendorId = order?.items_by_vendor?.[0]?.vendor?.id;
    const dbVendor = vendors.find((v) => v.id === vendorId) || vendors[0];
    const pickupLat = tracking?.assignment?.pickup_lat ?? dbVendor?.lat ?? currentCoordinates.lat;
    const pickupLng = tracking?.assignment?.pickup_lng ?? dbVendor?.lng ?? currentCoordinates.lng;
    return {
      name: order?.items_by_vendor?.[0]?.vendor?.name || dbVendor?.name || 'Fulfillment Store',
      area: dbVendor?.area || dbVendor?.location || '',
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

  const courierSpeedKmh = assignment?.courier_speed_kmh ?? 22.0;
  const prepBufferMins = assignment?.prep_buffer_mins ?? (order?.status === 'OUT_FOR_DELIVERY' || order?.status === 'SHIPPED' ? 0 : 5);

  const remainingDistanceKm = useMemo(() => {
    if (order?.status === 'DELIVERED') return 0;
    if (assignment?.remaining_km !== null && assignment?.remaining_km !== undefined) {
      return assignment.remaining_km;
    }
    if (tracking?.remaining_km !== null && tracking?.remaining_km !== undefined) {
      return tracking.remaining_km;
    }
    if (!riderPosition) return totalRouteKm;
    return Math.max(
      0.02,
      calculateDistanceInKm(riderPosition.lat, riderPosition.lng, destinationCoords.lat, destinationCoords.lng)
    );
  }, [order?.status, assignment?.remaining_km, tracking?.remaining_km, riderPosition, destinationCoords, totalRouteKm]);

  const dynamicEtaMinutes = useMemo(() => {
    if (order?.status === 'CANCELLED') return null;
    if (order?.status === 'DELIVERED') return 0;
    if (assignment?.estimated_minutes !== null && assignment?.estimated_minutes !== undefined) {
      return assignment.estimated_minutes;
    }
    if (tracking?.estimated_minutes !== null && tracking?.estimated_minutes !== undefined) {
      return tracking.estimated_minutes;
    }
    if (assignment?.eta_minutes !== null && assignment?.eta_minutes !== undefined) {
      return assignment.eta_minutes;
    }
    return Math.max(
      5,
      Math.round((remainingDistanceKm / courierSpeedKmh) * 60) + prepBufferMins
    );
  }, [order?.status, assignment?.estimated_minutes, tracking?.estimated_minutes, assignment?.eta_minutes, remainingDistanceKm, courierSpeedKmh, prepBufferMins]);

  const speedKmh = assignment?.speed_kmh ?? (order?.status === 'OUT_FOR_DELIVERY' || order?.status === 'SHIPPED' ? 22 : 0);

  const etaDisplay = useMemo(() => {
    if (order?.status === 'CANCELLED') return language === 'ne' ? 'रद्द गरिएको' : 'Cancelled';
    if (order?.status === 'DELIVERED') return language === 'ne' ? 'डेलिभर भयो' : 'Arrived at Doorstep';
    return formatEta(dynamicEtaMinutes, language);
  }, [order?.status, dynamicEtaMinutes, language]);

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
    courierSpeedKmh,
    prepBufferMins,
    dynamicEtaMinutes,
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
