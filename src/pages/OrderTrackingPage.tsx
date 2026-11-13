import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Address, Order } from '../types';
import { useApp, VENDOR_LOCATIONS, calculateDistanceInKm } from '../context/AppContext';
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
  Play,
  Pause,
  RotateCcw,
  Home,
  Briefcase,
  AlertTriangle,
  Compass
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

const NEIGHBORHOOD_COORDS: Record<string, LatLng> = {
  'new baneshwor': { lat: 27.6986, lng: 85.3292 },
  'baneshwor': { lat: 27.6915, lng: 85.3420 },
  'jhamsikhel': { lat: 27.6830, lng: 85.3090 },
  'pulchowk': { lat: 27.6740, lng: 85.3180 },
  'patan': { lat: 27.6725, lng: 85.3250 },
  'thamel': { lat: 27.7150, lng: 85.3120 },
  'lazimpat': { lat: 27.7210, lng: 85.3210 },
  'koteshwor': { lat: 27.6780, lng: 85.3500 },
  'baluwatar': { lat: 27.7280, lng: 85.3300 },
  'maharajgunj': { lat: 27.7380, lng: 85.3340 },
  'boudha': { lat: 27.7215, lng: 85.3620 }
};

function resolveAddressCoords(addr?: Address | null, fallback?: LatLng): LatLng {
  if (addr && typeof addr.lat === 'number' && typeof addr.lng === 'number') {
    return { lat: addr.lat, lng: addr.lng };
  }
  const area = (addr?.area || '').toLowerCase();
  for (const key of Object.keys(NEIGHBORHOOD_COORDS)) {
    if (area.includes(key)) {
      return NEIGHBORHOOD_COORDS[key];
    }
  }
  return fallback || { lat: 27.6986, lng: 85.3292 };
}

function buildFallbackRoadPath(origin: LatLng, destination: LatLng, steps = 40): LatLng[] {
  const points: LatLng[] = [];
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Slight realistic urban curve so route polyline feels natural along city blocks
    const wave = Math.sin(t * Math.PI) * 0.0014;
    points.push({
      lat: origin.lat + dLat * t + wave * (dLng >= 0 ? 1 : -1),
      lng: origin.lng + dLng * t - wave * 0.65 * (dLat >= 0 ? 1 : -1)
    });
  }
  return points;
}

function interpolateAlongPath(path: LatLng[], progress: number): { position: LatLng; index: number; bearing: number } {
  if (!path || path.length === 0) {
    return { position: { lat: 27.695, lng: 85.335 }, index: 0, bearing: 0 };
  }
  if (path.length === 1 || progress <= 0) {
    const next = path[1] || path[0];
    return { position: path[0], index: 0, bearing: calculateBearing(path[0], next) };
  }
  if (progress >= 1) {
    const prev = path[path.length - 2] || path[path.length - 1];
    return { position: path[path.length - 1], index: path.length - 1, bearing: calculateBearing(prev, path[path.length - 1]) };
  }

  const totalSegments = path.length - 1;
  const exactPos = progress * totalSegments;
  const segIndex = Math.min(totalSegments - 1, Math.floor(exactPos));
  const segT = exactPos - segIndex;
  const p1 = path[segIndex];
  const p2 = path[segIndex + 1];

  return {
    position: {
      lat: p1.lat + (p2.lat - p1.lat) * segT,
      lng: p1.lng + (p2.lng - p1.lng) * segT
    },
    index: segIndex,
    bearing: calculateBearing(p1, p2)
  };
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
  riderPosition: LatLng;
  riderSegmentIndex: number;
  followRider: boolean;
  fitTrigger: number;
  onRoutePathComputed: (path: LatLng[], distanceMeters?: number, durationMillis?: number) => void;
}

function LiveRouteLayer({
  hubPosition,
  destinationPosition,
  riderPosition,
  riderSegmentIndex,
  followRider,
  fitTrigger,
  onRoutePathComputed
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
    bounds.extend(riderPosition);
    map.fitBounds(bounds, { top: 64, right: 64, bottom: 72, left: 64 });
  }, [map, coreLib, hubPosition, destinationPosition, riderPosition]);

  // Compute route via modern Google Maps Routes SDK (no legacy DirectionsService)
  useEffect(() => {
    const key = `${hubPosition.lat.toFixed(5)},${hubPosition.lng.toFixed(5)}->${destinationPosition.lat.toFixed(5)},${destinationPosition.lng.toFixed(5)}`;
    if (routeKeyRef.current === key && computedPath.length > 2) return;
    routeKeyRef.current = key;

    const fallback = buildFallbackRoadPath(hubPosition, destinationPosition);
    setComputedPath(fallback);
    onRoutePathComputed(fallback);

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
            onRoutePathComputed(normalized, primaryRoute.distanceMeters, primaryRoute.durationMillis);
          }
          if (primaryRoute.viewport) {
            map.fitBounds(primaryRoute.viewport, 60);
          }
        })
        .catch(() => {
          // Graceful fallback path already active
        });
    }

    return () => {
      cancelled = true;
    };
  }, [routesLib, map, hubPosition, destinationPosition, onRoutePathComputed]);

  // Fit bounds when requested or when route target changes
  useEffect(() => {
    fitFullRoute();
  }, [fitTrigger, hubPosition.lat, hubPosition.lng, destinationPosition.lat, destinationPosition.lng]);

  // Pan camera smoothly to follow delivery agent when Follow mode is enabled
  useEffect(() => {
    if (followRider && map) {
      map.panTo(riderPosition);
    }
  }, [followRider, map, riderPosition]);

  // Draw split polylines: Completed Trail (Hub -> Rider) and Remaining Route (Rider -> Saved Address)
  useEffect(() => {
    if (!map || !mapsLib || computedPath.length < 2) return;

    const completedPath = [
      ...computedPath.slice(0, Math.min(riderSegmentIndex + 1, computedPath.length)),
      riderPosition
    ];
    const remainingPath = [
      riderPosition,
      ...computedPath.slice(Math.min(riderSegmentIndex + 1, computedPath.length))
    ];

    if (completedLineRef.current) completedLineRef.current.setMap(null);
    if (remainingLineRef.current) remainingLineRef.current.setMap(null);

    const PolylineCtor = (mapsLib as any).Polyline || (window as any).google?.maps?.Polyline;
    if (!PolylineCtor) return;

    completedLineRef.current = new PolylineCtor({
      path: completedPath,
      geodesic: true,
      strokeColor: '#10b981',
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map
    });

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
  }, [map, mapsLib, computedPath, riderPosition, riderSegmentIndex]);

  return null;
}

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast, addresses, currentCoordinates } = useApp();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Live Delivery Map States
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string>('order');
  const [routePath, setRoutePath] = useState<LatLng[]>([]);
  const [routeMetrics, setRouteMetrics] = useState<{ distanceMeters?: number; durationMillis?: number }>({});
  const [progress, setProgress] = useState<number>(0.42);
  const [isLiveMoving, setIsLiveMoving] = useState<boolean>(true);
  const [followRider, setFollowRider] = useState<boolean>(false);
  const [fitTrigger, setFitTrigger] = useState<number>(0);
  const [activeMarkerInfo, setActiveMarkerInfo] = useState<'hub' | 'rider' | 'destination' | null>('rider');
  const [mapsQuotaError, setMapsQuotaError] = useState<boolean>(false);
  const [liveSpeedKmh, setLiveSpeedKmh] = useState<number>(27);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  // Monitor Google Maps quota / auth issues gracefully
  useEffect(() => {
    const handleQuota = () => setMapsQuotaError(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota as EventListener);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota as EventListener);
  }, []);

  useEffect(() => {
    async function loadOrder() {
      if (!id) return;
      try {
        setLoading(true);
        const res = await api.getOrderById(id);
        setOrder(res);
        if (res.status === 'DELIVERED') {
          setProgress(1);
          setIsLiveMoving(false);
        } else if (res.status === 'CANCELLED') {
          setProgress(0);
          setIsLiveMoving(false);
        } else if (res.status === 'ORDER_PLACED') {
          setProgress(0.12);
          setIsLiveMoving(true);
        } else if (res.status === 'PACKED_BY_VENDOR') {
          setProgress(0.24);
          setIsLiveMoving(true);
        } else {
          setProgress(0.42);
          setIsLiveMoving(true);
        }
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [id]);

  // Determine Fulfillment Hub Coordinates from primary vendor
  const hubInfo = useMemo(() => {
    const vendorId = order?.items_by_vendor?.[0]?.vendor?.id || 'v-himalayan';
    const vLoc = VENDOR_LOCATIONS[vendorId] || VENDOR_LOCATIONS['v-himalayan'];
    return {
      name: order?.items_by_vendor?.[0]?.vendor?.name || vLoc.name,
      area: vLoc.area,
      coords: { lat: vLoc.lat, lng: vLoc.lng }
    };
  }, [order]);

  // Determine Target Saved Address (order's saved address or user-selected saved address comparison)
  const targetSavedAddress: Address | null = useMemo(() => {
    if (!order) return null;
    if (selectedSavedAddressId === 'order') {
      return order.delivery_address;
    }
    const found = addresses.find((a) => a.id === selectedSavedAddressId);
    return found || order.delivery_address;
  }, [order, selectedSavedAddressId, addresses]);

  const destinationCoords = useMemo(
    () => resolveAddressCoords(targetSavedAddress, currentCoordinates),
    [targetSavedAddress, currentCoordinates]
  );

  // Initialize fallback path whenever hub/dest change
  useEffect(() => {
    const initialPath = buildFallbackRoadPath(hubInfo.coords, destinationCoords);
    setRoutePath(initialPath);
  }, [hubInfo.coords, destinationCoords]);

  const handleRoutePathComputed = useCallback(
    (path: LatLng[], distanceMeters?: number, durationMillis?: number) => {
      setRoutePath(path);
      if (distanceMeters || durationMillis) {
        setRouteMetrics({ distanceMeters, durationMillis });
      }
    },
    []
  );

  // Real-time courier movement loop
  useEffect(() => {
    if (!order || !isLiveMoving || order.status === 'CANCELLED') return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 0.995) {
          setIsLiveMoving(false);
          return 1;
        }
        return Math.min(1, prev + 0.012);
      });
      setLiveSpeedKmh(Math.round(24 + Math.random() * 9));
    }, 800);

    return () => clearInterval(timer);
  }, [order, isLiveMoving]);

  const riderTelemetry = useMemo(
    () => interpolateAlongPath(routePath, progress),
    [routePath, progress]
  );

  // Live distance & ETA relative to the saved address
  const totalRouteKm = useMemo(() => {
    if (routeMetrics.distanceMeters) {
      return Math.max(0.3, routeMetrics.distanceMeters / 1000);
    }
    return Math.max(0.3, calculateDistanceInKm(hubInfo.coords.lat, hubInfo.coords.lng, destinationCoords.lat, destinationCoords.lng));
  }, [routeMetrics.distanceMeters, hubInfo.coords, destinationCoords]);

  const remainingDistanceKm = useMemo(() => {
    if (progress >= 0.995) return 0;
    const direct = calculateDistanceInKm(
      riderTelemetry.position.lat,
      riderTelemetry.position.lng,
      destinationCoords.lat,
      destinationCoords.lng
    );
    return Math.max(0.05, direct);
  }, [riderTelemetry.position, destinationCoords, progress]);

  const etaDisplay = useMemo(() => {
    if (order?.status === 'CANCELLED') return 'Cancelled';
    if (progress >= 0.995) return 'Arrived at Doorstep';
    const remainingMinutesDecimal = (remainingDistanceKm / Math.max(15, liveSpeedKmh)) * 60 + 1.2;
    const mins = Math.floor(remainingMinutesDecimal);
    const secs = Math.floor((remainingMinutesDecimal - mins) * 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }, [order?.status, progress, remainingDistanceKm, liveSpeedKmh]);

  const handleReplaySimulation = () => {
    setProgress(0.05);
    setIsLiveMoving(true);
    setActiveMarkerInfo('rider');
    setFitTrigger((c) => c + 1);
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelling(true);
    try {
      const updated = await api.cancelOrder(order.id);
      setOrder(updated);
      setShowCancelModal(false);
      setIsLiveMoving(false);
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
      <div className="w-full py-24 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Order Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
          The requested order ID could not be retrieved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const isDelivered = order.status === 'DELIVERED' || (progress >= 0.995 && order.status !== 'CANCELLED');
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display">
                Order {order.order_number}
              </h1>
              <span
                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                  isDelivered
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                    : isCancelled
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300'
                }`}
              >
                {isDelivered && order.status !== 'DELIVERED' ? 'ARRIVED AT ADDRESS' : order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Placed on {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Real-Time Courier GPS Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!isCancelled && (
            <button
              onClick={handleReplaySimulation}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Live Route</span>
            </button>
          )}
          {!isDelivered && !isCancelled && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Main Full-Screen Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Live Map + Telemetry + Milestones */}
        <div className="xl:col-span-8 space-y-6">
          {/* Estimated Arrival Banner */}
          {!isDelivered && !isCancelled ? (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-100 font-bold uppercase tracking-wider mb-1">
                  <Clock className="w-4 h-4" />
                  <span>Live Estimated Arrival</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-display tabular-nums">
                  {etaDisplay} · {remainingDistanceKm.toFixed(2)} km away
                </h2>
                <p className="text-xs text-emerald-100 mt-1">
                  Delivery agent Ramesh Pandey is moving toward{' '}
                  <strong className="text-white">
                    {targetSavedAddress?.title} ({targetSavedAddress?.area})
                  </strong>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-[11px] uppercase tracking-wider text-emerald-200 block">Progress</span>
                  <span className="text-lg font-extrabold tabular-nums">{Math.round(progress * 100)}%</span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0">
                  <Truck className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          ) : isDelivered ? (
            <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Completed</span>
                </div>
                <h2 className="text-2xl font-extrabold font-display text-emerald-900 dark:text-white">
                  Delivered to {targetSavedAddress?.title || 'Saved Address'}!
                </h2>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Your delivery agent arrived at {targetSavedAddress?.street}, {targetSavedAddress?.area}. Click "Replay Live Route" anytime to watch the GPS path.
                </p>
              </div>
              <button
                onClick={handleReplaySimulation}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Simulate Live Rider</span>
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200">
              <h2 className="text-xl font-extrabold text-rose-900 dark:text-rose-200">Order Cancelled</h2>
              <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                This order was cancelled. Any pre-authorized charges will be refunded.
              </p>
            </div>
          )}

          {/* Interactive Google Maps Live Delivery Agent Tracking Card */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* Map Card Header + Controls */}
            <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${isLiveMoving ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`} />
                <div>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white block">
                    Live Delivery Agent Map (Google Maps)
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Real-time courier GPS relative to {targetSavedAddress?.title || 'Saved Address'} ({destinationCoords.lat.toFixed(4)}, {destinationCoords.lng.toFixed(4)})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => setIsLiveMoving((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isLiveMoving
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isLiveMoving ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isLiveMoving ? 'Live GPS On' : 'Resume GPS'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setFollowRider((v) => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    followRider
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{followRider ? 'Following Agent' : 'Center on Agent'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFollowRider(false);
                    setFitTrigger((c) => c + 1);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Fit Full Route</span>
                </button>
              </div>
            </div>

            {/* Quota / Missing API Key Warning Banner (Non-blocking) */}
            {(mapsQuotaError || !apiKey) && (
              <div className="px-4 py-2.5 bg-amber-950/60 border-b border-amber-800/70 text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {!apiKey
                    ? 'Google Maps API key is not set in this preview environment; telemetry coordinates remain active below.'
                    : 'Google Maps API quota exceeded or billing notice detected. Live route telemetry continues updating.'}
                </span>
              </div>
            )}

            {/* Live Map Canvas */}
            <div className="h-[380px] sm:h-[480px] lg:h-[520px] w-full relative bg-slate-900">
              <APIProvider apiKey={apiKey}>
                <GoogleMap
                  defaultCenter={riderTelemetry.position}
                  defaultZoom={15}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                  gestureHandling="greedy"
                >
                  <LiveRouteLayer
                    hubPosition={hubInfo.coords}
                    destinationPosition={destinationCoords}
                    riderPosition={riderTelemetry.position}
                    riderSegmentIndex={riderTelemetry.index}
                    followRider={followRider}
                    fitTrigger={fitTrigger}
                    onRoutePathComputed={handleRoutePathComputed}
                  />

                  {/* 1. Fulfillment Hub / Vendor Origin Marker */}
                  <AdvancedMarker
                    position={hubInfo.coords}
                    onClick={() => setActiveMarkerInfo('hub')}
                    title={hubInfo.name}
                  >
                    <div className="flex flex-col items-center cursor-pointer">
                      <div className="px-2 py-0.5 mb-1 rounded-md bg-slate-950/90 text-emerald-300 border border-emerald-500/60 text-[10px] font-bold whitespace-nowrap shadow-md">
                        {hubInfo.name}
                      </div>
                      <Pin background="#059669" borderColor="#064e3b" glyphColor="#ffffff" scale={1.1} />
                    </div>
                  </AdvancedMarker>

                  {/* 2. Live Delivery Agent Marker */}
                  {!isCancelled && (
                    <AdvancedMarker
                      position={riderTelemetry.position}
                      onClick={() => setActiveMarkerInfo('rider')}
                      title="Live Delivery Agent - Ramesh Pandey"
                      zIndex={50}
                    >
                      <div className="relative flex flex-col items-center cursor-pointer group">
                        <div className="px-2 py-0.5 mb-1 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow-lg border border-white/60 whitespace-nowrap flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          <span>Agent · {remainingDistanceKm === 0 ? 'Arrived' : `${remainingDistanceKm.toFixed(2)} km`}</span>
                        </div>
                        <div className="relative">
                          {isLiveMoving && (
                            <span className="absolute -inset-2 rounded-full bg-emerald-500/35 animate-ping" />
                          )}
                          <div
                            className="relative w-11 h-11 rounded-full bg-slate-950 border-2 border-emerald-400 shadow-xl flex items-center justify-center text-emerald-400 transition-transform duration-300"
                            style={{ transform: `rotate(${Math.round(riderTelemetry.bearing)}deg)` }}
                          >
                            <Navigation className="w-5 h-5 fill-emerald-400 text-emerald-300" />
                          </div>
                        </div>
                      </div>
                    </AdvancedMarker>
                  )}

                  {/* 3. User's Saved Delivery Address Marker */}
                  <AdvancedMarker
                    position={destinationCoords}
                    onClick={() => setActiveMarkerInfo('destination')}
                    title={`Saved Address: ${targetSavedAddress?.title || 'Home'}`}
                    zIndex={40}
                  >
                    <div className="flex flex-col items-center cursor-pointer">
                      <div className="px-2 py-0.5 mb-1 rounded-md bg-orange-600 text-white text-[10px] font-extrabold whitespace-nowrap shadow-md border border-white/40">
                        {targetSavedAddress?.title || 'Saved Address'} ({targetSavedAddress?.area})
                      </div>
                      <Pin background="#ea580c" borderColor="#9a3412" glyphColor="#ffffff" scale={1.25} />
                    </div>
                  </AdvancedMarker>

                  {/* Interactive Marker InfoWindows */}
                  {activeMarkerInfo === 'hub' && (
                    <InfoWindow
                      position={hubInfo.coords}
                      onCloseClick={() => setActiveMarkerInfo(null)}
                    >
                      <div className="p-1 text-slate-900 max-w-[220px]">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                          Fulfillment Hub
                        </p>
                        <h4 className="font-bold text-sm">{hubInfo.name}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{hubInfo.area}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Total route distance: {totalRouteKm.toFixed(2)} km
                        </p>
                      </div>
                    </InfoWindow>
                  )}

                  {activeMarkerInfo === 'rider' && !isCancelled && (
                    <InfoWindow
                      position={riderTelemetry.position}
                      onCloseClick={() => setActiveMarkerInfo(null)}
                    >
                      <div className="p-1.5 text-slate-900 max-w-[240px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                            Live Delivery Agent
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            {isLiveMoving ? `${liveSpeedKmh} km/h` : progress >= 1 ? 'Arrived' : 'Paused'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm mt-0.5">Ramesh Pandey</h4>
                        <p className="text-xs text-slate-600">EV Scooter · Ba 98 Pa 4412</p>
                        <div className="mt-2 pt-1.5 border-t border-slate-200 text-xs space-y-0.5">
                          <p>
                            Distance to <strong>{targetSavedAddress?.title || 'Saved Address'}</strong>:{' '}
                            <strong className="text-emerald-700">{remainingDistanceKm.toFixed(2)} km</strong>
                          </p>
                          <p>
                            Live ETA: <strong>{etaDisplay}</strong>
                          </p>
                        </div>
                      </div>
                    </InfoWindow>
                  )}

                  {activeMarkerInfo === 'destination' && (
                    <InfoWindow
                      position={destinationCoords}
                      onCloseClick={() => setActiveMarkerInfo(null)}
                    >
                      <div className="p-1.5 text-slate-900 max-w-[240px]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
                          User Saved Delivery Address
                        </span>
                        <h4 className="font-bold text-sm mt-0.5">
                          {targetSavedAddress?.title} · {targetSavedAddress?.recipient_name}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {targetSavedAddress?.street}, {targetSavedAddress?.area}, {targetSavedAddress?.city}
                        </p>
                        {targetSavedAddress?.landmark && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Landmark: {targetSavedAddress.landmark}
                          </p>
                        )}
                        <p className="text-[11px] font-bold text-emerald-700 mt-1.5">
                          Courier is {remainingDistanceKm.toFixed(2)} km away
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>

              {/* Floating Top-Left Route Legend */}
              <div className="absolute top-3 left-3 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-lg flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-800 dark:text-slate-200 pointer-events-none">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-emerald-500 inline-block" />
                  <span>Covered</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 rounded-full bg-sky-400 inline-block" />
                  <span>Remaining ({remainingDistanceKm.toFixed(2)} km)</span>
                </span>
              </div>
            </div>

            {/* Live Telemetry Footer Bar inside Map Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="p-3.5 sm:p-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                  Away From Saved Address
                </span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
                  {remainingDistanceKm === 0 ? '0.00 km (Here)' : `${remainingDistanceKm.toFixed(2)} km`}
                </span>
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                  Live ETA Countdown
                </span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 block">
                  {etaDisplay}
                </span>
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                  Courier Speed
                </span>
                <span className="text-base font-extrabold text-sky-600 dark:text-sky-400 tabular-nums mt-0.5 block">
                  {isLiveMoving ? `${liveSpeedKmh} km/h` : isDelivered ? '0 km/h (Arrived)' : 'Paused'}
                </span>
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                  Agent GPS Coordinates
                </span>
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums mt-1 block">
                  {riderTelemetry.position.lat.toFixed(4)}, {riderTelemetry.position.lng.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* Tracking Timeline */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide mb-5">
              Live Delivery Milestones
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
              {order.tracking_updates.map((step, idx) => (
                <div key={idx} className="relative">
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                      step.done || (isDelivered && idx === order.tracking_updates.length - 1)
                        ? 'bg-emerald-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    {step.done || (isDelivered && idx === order.tracking_updates.length - 1) ? (
                      <CheckCircle2 className="w-3.5 h-3.5 stroke-3" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{step.title}</h4>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {step.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Partner Details */}
          {!isCancelled && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-sm flex items-center justify-center shrink-0">
                  RP
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Ramesh Pandey (EV Courier Rider)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    NIU NQi EV Scooter · Ba 98 Pa 4412 · 4.9★ (1,240+ deliveries)
                  </p>
                </div>
              </div>

              <button
                onClick={() => showToast('Connecting secure voice bridge to rider Ramesh...', 'info')}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Call Rider</span>
              </button>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Saved Address Comparison + Destination + Receipt */}
        <div className="xl:col-span-4 space-y-6">
          {/* User's Saved Address Relative Tracking Switcher */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Track Relative to Saved Address</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full">
                Live GPS
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compare the delivery agent&apos;s real-time distance against your order destination or any saved address:
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedSavedAddressId('order');
                  setActiveMarkerInfo('destination');
                }}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  selectedSavedAddressId === 'order'
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/30'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Order Address ({order.delivery_address.title})
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                      {order.delivery_address.street}, {order.delivery_address.area}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
                  {(() => {
                    const c = resolveAddressCoords(order.delivery_address, currentCoordinates);
                    return `${calculateDistanceInKm(riderTelemetry.position.lat, riderTelemetry.position.lng, c.lat, c.lng).toFixed(2)} km`;
                  })()}
                </span>
              </button>

              {addresses.map((addr) => {
                const addrCoords = resolveAddressCoords(addr, currentCoordinates);
                const distFromRider = calculateDistanceInKm(
                  riderTelemetry.position.lat,
                  riderTelemetry.position.lng,
                  addrCoords.lat,
                  addrCoords.lng
                );
                const isSelected = selectedSavedAddressId === addr.id;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setSelectedSavedAddressId(addr.id);
                      setActiveMarkerInfo('destination');
                    }}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {addr.title.toLowerCase().includes('office') ? (
                        <Briefcase className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                      ) : (
                        <Home className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {addr.title}
                          </span>
                          {addr.is_default && (
                            <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-bold uppercase">
                              Default
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                          {addr.street}, {addr.area}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
                      {distFromRider.toFixed(2)} km
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination Details */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-2">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wide">
              Active Pin Destination
            </h3>
            <div className="flex items-start gap-2.5 pt-1">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {targetSavedAddress?.title} ({targetSavedAddress?.recipient_name})
                </p>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  {targetSavedAddress?.street}, {targetSavedAddress?.area}, {targetSavedAddress?.city}
                </p>
                {targetSavedAddress?.landmark && (
                  <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-0.5">
                    Landmark: {targetSavedAddress.landmark}
                  </p>
                )}
                <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-0.5">
                  Phone: {targetSavedAddress?.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Receipt */}
          <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-100 dark:border-slate-800">
              Order Receipt
            </h3>

            {order.items_by_vendor.map((vendorGroup, idx) => (
              <div key={idx} className="space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{vendorGroup.vendor.name}</span>
                </div>
                {vendorGroup.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-slate-600 dark:text-slate-400 pl-5">
                    <span className="truncate max-w-[200px]">
                      {item.quantity}x {item.product_name}
                    </span>
                    <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                      Rs. {item.total}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">Rs. {order.subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Delivery Charge</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">
                  {order.delivery_fee === 0 ? 'FREE' : `Rs. ${order.delivery_fee}`}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Handling Fee</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">Rs. {order.handling_fee}</span>
              </div>
              {order.coupon_discount > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Coupon Discount</span>
                  <span className="tabular-nums">- Rs. {order.coupon_discount}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-extrabold text-sm text-slate-900 dark:text-white">
                <span>Total Paid</span>
                <span className="text-base text-emerald-700 dark:text-emerald-400 tabular-nums">
                  Rs. {order.total_amount}
                </span>
              </div>
            </div>

            <div className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Payment: <strong className="text-slate-800 dark:text-slate-200">{order.payment_method.replace(/_/g, ' ')}</strong> ({order.payment_status})
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowCancelModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
          />
          <div className="relative bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full z-10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cancel this Order?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to cancel order {order.order_number}? Local sellers have already prepared your items.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
