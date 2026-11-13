import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../shared/services/api';
import { Address, DeliveryTrackingTelemetry, Order } from '../../shared/types';
import { useApp, calculateDistanceInKm } from '../../shared/context/AppContext';
import { translateOrderStatus } from '../../shared/i18n/translations';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Store,
  Phone,
  ArrowLeft,
  XCircle,
  Truck,
  Navigation,
  Crosshair,
  Maximize2,
  RefreshCw,
  Home,
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';

interface LatLng {
  lat: number;
  lng: number;
}

function resolveAddressCoords(addr?: Address | null, fallback?: LatLng): LatLng {
  if (addr && typeof addr.lat === 'number' && typeof addr.lng === 'number' && !Number.isNaN(addr.lat) && !Number.isNaN(addr.lng)) {
    return { lat: addr.lat, lng: addr.lng };
  }
  return fallback || { lat: 27.7172, lng: 85.3240 };
}

function buildFallbackRoadPath(origin: LatLng, destination: LatLng, steps = 20): LatLng[] {
  const points: LatLng[] = [];
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: origin.lat + dLat * t,
      lng: origin.lng + dLng * t
    });
  }
  return points;
}

function calculateBearing(from: LatLng, to: LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

interface LiveRouteLayerProps {
  hubPosition: LatLng;
  destinationPosition: LatLng;
  riderPosition: LatLng | null;
  followRider: boolean;
  fitTrigger: number;
  onRouteMetricsComputed: (distanceMeters?: number, durationMillis?: number) => void;
}

function LiveRouteLayer({
  hubPosition,
  destinationPosition,
  riderPosition,
  followRider,
  fitTrigger,
  onRouteMetricsComputed
}: LiveRouteLayerProps) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');

  const [computedPath, setComputedPath] = useState<LatLng[]>(() =>
    buildFallbackRoadPath(hubPosition, destinationPosition)
  );
  const completedLineRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const remainingLineRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const routeKeyRef = useRef<string>('');

  const fitFullRoute = useCallback(() => {
    const LatLngBoundsCtor = (coreLib as any)?.LatLngBounds || (window as any).google?.maps?.LatLngBounds;
    if (!map || !LatLngBoundsCtor) return;
    const bounds = new LatLngBoundsCtor();
    bounds.extend(hubPosition);
    bounds.extend(destinationPosition);
    if (riderPosition) bounds.extend(riderPosition);
    map.fitBounds(bounds, { top: 64, right: 64, bottom: 72, left: 64 });
  }, [map, coreLib, hubPosition, destinationPosition, riderPosition]);

  useEffect(() => {
    const key = `${hubPosition.lat.toFixed(5)},${hubPosition.lng.toFixed(5)}->${destinationPosition.lat.toFixed(5)},${destinationPosition.lng.toFixed(5)}`;
    if (routeKeyRef.current === key && computedPath.length > 2) return;
    routeKeyRef.current = key;

    const fallback = buildFallbackRoadPath(hubPosition, destinationPosition);
    setComputedPath(fallback);

    if (!routesLib || !map) return;
    let cancelled = false;
    const request = {
      origin: hubPosition,
      destination: destinationPosition,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport']
    };

    const routeClass = (routesLib as any).Route;
    if (routeClass && typeof routeClass.computeRoutes === 'function') {
      routeClass
        .computeRoutes(request)
        .then(({ routes }: { routes?: any[] }) => {
          if (cancelled || !routes || routes.length === 0) return;
          const primaryRoute = routes[0];
          const rawPath = primaryRoute.path;
          if (Array.isArray(rawPath) && rawPath.length >= 2) {
            const normalized: LatLng[] = rawPath.map((pt: any) => ({
              lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
              lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng
            }));
            setComputedPath(normalized);
          }
          onRouteMetricsComputed(primaryRoute.distanceMeters, primaryRoute.durationMillis);
          if (primaryRoute.viewport) {
            map.fitBounds(primaryRoute.viewport, 60);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [routesLib, map, hubPosition, destinationPosition, onRouteMetricsComputed]);

  useEffect(() => {
    fitFullRoute();
  }, [fitTrigger, hubPosition.lat, hubPosition.lng, destinationPosition.lat, destinationPosition.lng]);

  useEffect(() => {
    if (followRider && map && riderPosition) {
      map.panTo(riderPosition);
    }
  }, [followRider, map, riderPosition]);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (completedLineRef.current) completedLineRef.current.setMap(null);
    if (remainingLineRef.current) remainingLineRef.current.setMap(null);

    const PolylineCtor = (mapsLib as any).Polyline || (window as any).google?.maps?.Polyline;
    if (!PolylineCtor) return;

    const completedPath = riderPosition ? [hubPosition, riderPosition] : [hubPosition];
    const remainingPath = riderPosition ? [riderPosition, destinationPosition] : computedPath;

    if (completedPath.length >= 2) {
      completedLineRef.current = new PolylineCtor({
        path: completedPath,
        geodesic: true,
        strokeColor: '#10b981',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        map
      });
    }

    remainingLineRef.current = new PolylineCtor({
      path: remainingPath,
      geodesic: true,
      strokeColor: '#38bdf8',
      strokeOpacity: 0,
      icons: [
        {
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.95,
            strokeColor: '#38bdf8',
            scale: 3.5
          },
          offset: '0',
          repeat: '14px'
        }
      ],
      map
    });

    return () => {
      if (completedLineRef.current) {
        completedLineRef.current.setMap(null);
        completedLineRef.current = null;
      }
      if (remainingLineRef.current) {
        remainingLineRef.current.setMap(null);
        remainingLineRef.current = null;
      }
    };
  }, [map, mapsLib, computedPath, hubPosition, destinationPosition, riderPosition]);

  return null;
}

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    const handleQuota = () => setMapsQuotaError(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota as EventListener);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota as EventListener);
  }, []);

  const fetchOrderAndTracking = useCallback(async (showSpinner = false) => {
    if (!id) return;
    try {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setLoadError(null);

      const ordRes = await api.getOrderById(id);
      setOrder(ordRes);

      try {
        const trackRes = await api.getOrderTracking(id);
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
  }, [id]);

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
      coords: { lat: pickupLat, lng: pickupLng }
    };
  }, [order, tracking, vendors, currentCoordinates]);

  const targetSavedAddress: Address | null = useMemo(() => {
    if (!order) return null;
    if (selectedSavedAddressId === 'order') return order.delivery_address;
    const found = addresses.find((a) => a.id === selectedSavedAddressId);
    return found || order.delivery_address;
  }, [order, selectedSavedAddressId, addresses]);

  const destinationCoords = useMemo(() => {
    if (selectedSavedAddressId === 'order' && tracking?.assignment?.dropoff_lat != null && tracking?.assignment?.dropoff_lng != null) {
      return { lat: tracking.assignment.dropoff_lat, lng: tracking.assignment.dropoff_lng };
    }
    return resolveAddressCoords(targetSavedAddress, currentCoordinates);
  }, [selectedSavedAddressId, tracking?.assignment?.dropoff_lat, tracking?.assignment?.dropoff_lng, targetSavedAddress, currentCoordinates]);

  // Authoritative rider GPS position from PostgreSQL delivery_assignments
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
    return Math.max(0.2, calculateDistanceInKm(hubInfo.coords.lat, hubInfo.coords.lng, destinationCoords.lat, destinationCoords.lng));
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
      const updated = await api.cancelOrder(order.id);
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

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-10 py-10 animate-pulse space-y-5">
        <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 h-[500px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          <div className="xl:col-span-4 h-[500px] bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="w-full py-24 px-4 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('track.notFoundTitle')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {loadError
            ? loadError
            : !user
            ? (language === 'ne' ? 'अर्डर ट्र्याक हेर्न कृपया लगइन गर्नुहोस्।' : 'Please sign in to access your private order tracking telemetry.')
            : t('track.notFoundSub')}
        </p>
        <div className="flex items-center justify-center gap-3">
          {loadError && (
            <button
              type="button"
              onClick={() => fetchOrderAndTracking(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          )}
          {!user && (
            <button
              onClick={() => setLoginModalOpen(true)}
              className="px-6 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm cursor-pointer"
            >
              {t('header.signIn')}
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm cursor-pointer"
          >
            {t('track.returnHome')}
          </button>
        </div>
      </div>
    );
  }

  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 pb-24">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/account?tab=orders"
            className="p-2.5 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
                {t('track.orderPrefix', { number: order.order_number })}
              </h1>
              <span
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-md ${
                  isDelivered
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                    : isCancelled
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300'
                }`}
              >
                {translateOrderStatus(order.status, language)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('track.placedGpsActive', {
                time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchOrderAndTracking(false)}
            className="text-sm font-bold text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{language === 'ne' ? 'लाइभ रिफ्रेस' : 'Refresh GPS'}</span>
          </button>

          {!isDelivered && !isCancelled && !['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY'].includes(order.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              {t('track.cancelOrder')}
            </button>
          )}
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          {!isDelivered && !isCancelled ? (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-sm text-emerald-100 font-bold uppercase tracking-wider mb-1">
                  <Clock className="w-4 h-4" />
                  <span>{assignment ? t('track.liveEta') : (language === 'ne' ? 'राइडर खटाइने प्रतीक्षामा' : 'Awaiting Store Packing & Rider Dispatch')}</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold font-display tabular-nums">
                  {etaDisplay} · {remainingDistanceKm.toFixed(2)} {language === 'ne' ? 'कि.मि.' : 'km'}
                </h2>
                <p className="text-sm text-emerald-100 mt-1">
                  {assignment?.agent
                    ? `${assignment.agent.full_name} (${assignment.agent.vehicle_number}) → `
                    : `${t('track.agentMovingTo')} `}
                  <strong className="text-white">
                    {targetSavedAddress?.title} ({targetSavedAddress?.area})
                  </strong>
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0">
                <Truck className="w-7 h-7 text-white" />
              </div>
            </div>
          ) : isDelivered ? (
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('track.completed')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-900 dark:text-white">
                {t('track.deliveredToTitle', { title: targetSavedAddress?.title || 'Saved Address' })}
              </h2>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                {t('track.deliveredSub', { street: targetSavedAddress?.street || '', area: targetSavedAddress?.area || '' })}
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200">
              <h2 className="text-2xl font-extrabold text-rose-900 dark:text-rose-200">{t('track.cancelledTitle')}</h2>
              <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">{t('track.cancelledSub')}</p>
            </div>
          )}

          {/* Google Map Card */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${riderPosition && !isDelivered ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <div>
                  <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white block">
                    {t('track.mapHeader')}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('track.mapSub', {
                      title: targetSavedAddress?.title || 'Saved Address',
                      coords: `${destinationCoords.lat.toFixed(4)}, ${destinationCoords.lng.toFixed(4)}`
                    })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {riderPosition && (
                  <button
                    type="button"
                    onClick={() => setFollowRider((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      followRider
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Crosshair className="w-4 h-4" />
                    <span>{followRider ? t('track.followingAgent') : t('track.centerOnAgent')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFollowRider(false);
                    setFitTrigger((c) => c + 1);
                  }}
                  className="px-3 py-1.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('track.fitFullRoute')}</span>
                </button>
              </div>
            </div>

            {!assignment && !isCancelled && !isDelivered && (
              <div className="px-4 py-2.5 bg-sky-950/60 border-b border-sky-800/60 text-sky-200 text-xs sm:text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  {language === 'ne'
                    ? 'पसलले अर्डर प्याक गर्दैछ। एडमिन/राइडरले पिकअप स्वीकार गरेपछि राइडरको लाइभ GPS यहाँ देखिनेछ।'
                    : 'Your store is preparing your items. Live rider GPS coordinates appear automatically once a courier accepts pickup.'}
                </span>
              </div>
            )}

            {(mapsQuotaError || !apiKey) && (
              <div className="px-4 py-2.5 bg-amber-950/60 border-b border-amber-800/70 text-amber-200 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {!apiKey
                    ? 'Google Maps API key is not configured; live DB telemetry coordinates remain active below.'
                    : 'Google Maps API notice detected. Live telemetry coordinates continue updating.'}
                </span>
              </div>
            )}

            <div className="h-[380px] sm:h-[460px] w-full relative bg-slate-900">
              <APIProvider apiKey={apiKey}>
                <GoogleMap
                  defaultCenter={riderPosition || destinationCoords}
                  defaultZoom={14}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                  gestureHandling="greedy"
                >
                  <LiveRouteLayer
                    hubPosition={hubInfo.coords}
                    destinationPosition={destinationCoords}
                    riderPosition={riderPosition}
                    followRider={followRider}
                    fitTrigger={fitTrigger}
                    onRouteMetricsComputed={handleRouteMetricsComputed}
                  />

                  <AdvancedMarker
                    position={hubInfo.coords}
                    onClick={() => setActiveMarkerInfo('hub')}
                    title={hubInfo.name}
                  >
                    <div className="flex flex-col items-center cursor-pointer">
                      <div className="px-2.5 py-0.5 mb-1 rounded-md bg-slate-950/90 text-emerald-300 border border-emerald-500/60 text-xs font-bold whitespace-nowrap shadow-md">
                        {hubInfo.name}
                      </div>
                      <Pin background="#059669" borderColor="#064e3b" glyphColor="#ffffff" scale={1.1} />
                    </div>
                  </AdvancedMarker>

                  {riderPosition && !isCancelled && (
                    <AdvancedMarker
                      position={riderPosition}
                      onClick={() => setActiveMarkerInfo('rider')}
                      title={assignment?.agent?.full_name || 'Delivery Rider'}
                      zIndex={50}
                    >
                      <div className="relative flex flex-col items-center cursor-pointer">
                        <div className="px-2.5 py-0.5 mb-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold shadow-lg border border-white/60 whitespace-nowrap flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>{assignment?.agent?.full_name?.split(' ')[0] || 'Rider'} · {remainingDistanceKm.toFixed(2)} km</span>
                        </div>
                        <div
                          className="relative w-11 h-11 rounded-full bg-slate-950 border-2 border-emerald-400 shadow-xl flex items-center justify-center text-emerald-400"
                          style={{ transform: `rotate(${Math.round(riderBearing)}deg)` }}
                        >
                          <Navigation className="w-5 h-5 fill-emerald-400 text-emerald-300" />
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  <AdvancedMarker
                    position={destinationCoords}
                    onClick={() => setActiveMarkerInfo('destination')}
                    title={targetSavedAddress?.title || 'Destination'}
                    zIndex={40}
                  >
                    <div className="flex flex-col items-center cursor-pointer">
                      <div className="px-2.5 py-0.5 mb-1 rounded-md bg-orange-600 text-white text-xs font-extrabold whitespace-nowrap shadow-md border border-white/40">
                        {targetSavedAddress?.title || 'Saved Address'} ({targetSavedAddress?.area})
                      </div>
                      <Pin background="#ea580c" borderColor="#9a3412" glyphColor="#ffffff" scale={1.25} />
                    </div>
                  </AdvancedMarker>

                  {activeMarkerInfo === 'hub' && (
                    <InfoWindow position={hubInfo.coords} onCloseClick={() => setActiveMarkerInfo(null)}>
                      <div className="p-1.5 text-slate-900">
                        <p className="text-xs font-extrabold uppercase text-emerald-700">Fulfillment Hub</p>
                        <h4 className="font-bold text-base">{hubInfo.name}</h4>
                        <p className="text-xs text-slate-500">Total distance: {totalRouteKm.toFixed(2)} km</p>
                      </div>
                    </InfoWindow>
                  )}

                  {activeMarkerInfo === 'rider' && riderPosition && !isCancelled && (
                    <InfoWindow position={riderPosition} onCloseClick={() => setActiveMarkerInfo(null)}>
                      <div className="p-1.5 text-slate-900">
                        <span className="text-xs font-extrabold uppercase text-emerald-700">Live Delivery Agent</span>
                        <h4 className="font-bold text-base mt-0.5">{assignment?.agent?.full_name || 'Assigned Rider'}</h4>
                        <p className="text-xs text-slate-600">
                          {assignment?.agent?.vehicle_type || 'EV'} · {assignment?.agent?.vehicle_number || ''}
                        </p>
                        <p className="text-xs font-bold text-emerald-700 mt-1">
                          {remainingDistanceKm.toFixed(2)} km away · ETA {etaDisplay}
                        </p>
                      </div>
                    </InfoWindow>
                  )}

                  {activeMarkerInfo === 'destination' && (
                    <InfoWindow position={destinationCoords} onCloseClick={() => setActiveMarkerInfo(null)}>
                      <div className="p-1.5 text-slate-900">
                        <span className="text-xs font-extrabold uppercase text-orange-700">Delivery Address</span>
                        <h4 className="font-bold text-base mt-0.5">{targetSavedAddress?.title} · {targetSavedAddress?.recipient_name}</h4>
                        <p className="text-xs text-slate-600">{targetSavedAddress?.street}, {targetSavedAddress?.area}</p>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>

              <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-lg flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-200 pointer-events-none">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-emerald-500 inline-block" />
                  <span>{t('track.covered')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-sky-400 inline-block" />
                  <span>{t('track.remaining', { dist: remainingDistanceKm.toFixed(2) })}</span>
                </span>
              </div>
            </div>

            {/* Live DB Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="p-3.5 sm:p-4">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">{t('track.awayFromAddress')}</span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                  {remainingDistanceKm === 0 ? t('track.here') : `${remainingDistanceKm.toFixed(2)} km`}
                </span>
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">{t('track.liveEtaCountdown')}</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 block">{etaDisplay}</span>
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">{t('track.courierSpeed')}</span>
                <span className="text-lg font-extrabold text-sky-600 dark:text-sky-400 tabular-nums mt-0.5 block">
                  {riderPosition ? `${speedKmh} km/h` : (language === 'ne' ? 'प्रतीक्षामा' : 'Standby')}
                </span>
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block">{t('track.agentGpsCoords')}</span>
                <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums mt-1 block">
                  {riderPosition ? `${riderPosition.lat.toFixed(4)}, ${riderPosition.lng.toFixed(4)}` : 'Not Dispatched'}
                </span>
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide mb-5">
              {t('track.milestonesTitle')}
            </h3>
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {order.tracking_updates.map((step, idx) => (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                      step.done ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="w-3.5 h-3.5 stroke-3" /> : <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</h4>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{step.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Delivery Partner Card */}
          {assignment?.agent && !isCancelled && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-base flex items-center justify-center shrink-0">
                  {assignment.agent.full_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{assignment.agent.full_name}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {assignment.agent.vehicle_type} · {assignment.agent.vehicle_number} · ★ {assignment.agent.rating}
                  </p>
                </div>
              </div>
              <a
                href={`tel:${assignment.agent.phone}`}
                className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800"
              >
                <Phone className="w-4 h-4" />
                <span>{assignment.agent.phone}</span>
              </a>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Saved Address Comparison + Destination + Receipt */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
              {t('track.relativeTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('track.relativeSub')}</p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedSavedAddressId('order');
                  setActiveMarkerInfo('destination');
                }}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  selectedSavedAddressId === 'order'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      Order Address ({order.delivery_address.title})
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                      {order.delivery_address.street}, {order.delivery_address.area}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
                  {(() => {
                    const refPos = riderPosition || hubInfo.coords;
                    const c = resolveAddressCoords(order.delivery_address, currentCoordinates);
                    return `${calculateDistanceInKm(refPos.lat, refPos.lng, c.lat, c.lng).toFixed(2)} km`;
                  })()}
                </span>
              </button>

              {addresses.map((addr) => {
                const refPos = riderPosition || hubInfo.coords;
                const addrCoords = resolveAddressCoords(addr, currentCoordinates);
                const distFromRef = calculateDistanceInKm(refPos.lat, refPos.lng, addrCoords.lat, addrCoords.lng);
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setSelectedSavedAddressId(addr.id);
                      setActiveMarkerInfo('destination');
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      selectedSavedAddressId === addr.id
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {addr.title.toLowerCase().includes('office') ? (
                        <Briefcase className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                      ) : (
                        <Home className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{addr.title}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                          {addr.street}, {addr.area}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
                      {distFromRef.toFixed(2)} km
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-2">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide">{t('track.activePinDest')}</h3>
            <div className="flex items-start gap-2.5 pt-1">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {targetSavedAddress?.title} ({targetSavedAddress?.recipient_name})
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  {targetSavedAddress?.street}, {targetSavedAddress?.area}, {targetSavedAddress?.city}
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
                  {t('track.phoneLabel', { phone: targetSavedAddress?.phone || '' })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-100 dark:border-slate-800">
              {t('track.orderReceipt')}
            </h3>
            {order.items_by_vendor.map((vendorGroup, idx) => (
              <div key={idx} className="space-y-2 text-sm">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{vendorGroup.vendor.name}</span>
                </div>
                {vendorGroup.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-slate-600 dark:text-slate-400 pl-5">
                    <span className="truncate max-w-[200px]">{item.quantity}x {item.product_name}</span>
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{formatPrice(item.total)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>{t('track.subtotal')}</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>{t('track.deliveryCharge')}</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">
                  {order.delivery_fee === 0 ? t('common.free') : formatPrice(order.delivery_fee)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>{t('track.handlingFee')}</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatPrice(order.handling_fee)}</span>
              </div>
              {order.coupon_discount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>{t('track.couponDiscount')}</span>
                  <span className="tabular-nums">- {formatPrice(order.coupon_discount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-extrabold text-base text-slate-900 dark:text-white">
                <span>{t('track.totalPaid')}</span>
                <span className="text-lg text-emerald-700 dark:text-emerald-400 tabular-nums">{formatPrice(order.total_amount)}</span>
              </div>
            </div>
            <div className="pt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('track.paymentLabel')} <strong className="text-slate-800 dark:text-slate-200">{order.payment_method.replace(/_/g, ' ')}</strong> ({order.payment_status})
            </div>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowCancelModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
          <div className="relative bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full z-10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('track.cancelModalTitle')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('track.cancelModalSub', { number: order.order_number })}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer"
              >
                {t('track.keepOrder')}
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer"
              >
                {cancelling ? t('track.cancelling') : t('track.yesCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
