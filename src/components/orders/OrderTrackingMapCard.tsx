import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, Crosshair, Maximize2, Navigation } from 'lucide-react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { LatLng } from '../../hooks/useOrderTracking';
import { TranslatorFn } from '../../i18n';
import { Address, DeliveryTrackingTelemetry, Language } from '../../types';

function buildFallbackRoadPath(origin: LatLng, destination: LatLng, steps = 20): LatLng[] {
  const points: LatLng[] = [];
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: origin.lat + dLat * t,
      lng: origin.lng + dLng * t,
    });
  }
  return points;
}

interface GoogleBoundsLike {
  extend: (latLng: LatLng) => void;
}

interface GoogleMapsGlobal {
  maps?: {
    LatLngBounds?: new () => GoogleBoundsLike;
    Polyline?: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void };
  };
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
  onRouteMetricsComputed,
}: LiveRouteLayerProps) {
  const map = useMap();
  const coreLib = useMapsLibrary('core') as unknown as { LatLngBounds?: new () => GoogleBoundsLike } | null;
  const routesLib = useMapsLibrary('routes') as unknown as {
    Route?: {
      computeRoutes?: (req: Record<string, unknown>) => Promise<{
        routes?: Array<{
          path?: Array<{ lat: number | (() => number); lng: number | (() => number) }>;
          distanceMeters?: number;
          durationMillis?: number;
          viewport?: unknown;
        }>;
      }>;
    };
  } | null;
  const mapsLib = useMapsLibrary('maps') as unknown as {
    Polyline?: new (opts: Record<string, unknown>) => { setMap: (m: unknown) => void };
  } | null;

  const [computedPath, setComputedPath] = useState<LatLng[]>(() =>
    buildFallbackRoadPath(hubPosition, destinationPosition)
  );
  const completedLineRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const remainingLineRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const routeKeyRef = useRef<string>('');

  const fitFullRoute = useCallback(() => {
    const googleWindow = (window as unknown as { google?: GoogleMapsGlobal }).google;
    const LatLngBoundsCtor = coreLib?.LatLngBounds || googleWindow?.maps?.LatLngBounds;
    if (!map || !LatLngBoundsCtor) return;
    const bounds = new LatLngBoundsCtor();
    bounds.extend(hubPosition);
    bounds.extend(destinationPosition);
    if (riderPosition) bounds.extend(riderPosition);
    map.fitBounds(bounds as unknown as Parameters<typeof map.fitBounds>[0], { top: 64, right: 64, bottom: 72, left: 64 });
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
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    const routeClass = routesLib.Route;
    if (routeClass && typeof routeClass.computeRoutes === 'function') {
      routeClass
        .computeRoutes(request)
        .then(({ routes }) => {
          if (cancelled || !routes || routes.length === 0) return;
          const primaryRoute = routes[0];
          const rawPath = primaryRoute.path;
          if (Array.isArray(rawPath) && rawPath.length >= 2) {
            const normalized: LatLng[] = rawPath.map((pt) => ({
              lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
              lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng,
            }));
            setComputedPath(normalized);
          }
          onRouteMetricsComputed(primaryRoute.distanceMeters, primaryRoute.durationMillis);
          if (primaryRoute.viewport) {
            map.fitBounds(primaryRoute.viewport as Parameters<typeof map.fitBounds>[0], 60);
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [routesLib, map, hubPosition, destinationPosition, onRouteMetricsComputed, computedPath.length]);

  useEffect(() => {
    fitFullRoute();
  }, [fitTrigger, fitFullRoute, hubPosition.lat, hubPosition.lng, destinationPosition.lat, destinationPosition.lng]);

  useEffect(() => {
    if (followRider && map && riderPosition) {
      map.panTo(riderPosition);
    }
  }, [followRider, map, riderPosition]);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (completedLineRef.current) completedLineRef.current.setMap(null);
    if (remainingLineRef.current) remainingLineRef.current.setMap(null);

    const googleWindow = (window as unknown as { google?: GoogleMapsGlobal }).google;
    const PolylineCtor = mapsLib.Polyline || googleWindow?.maps?.Polyline;
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
        map,
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
            scale: 3.5,
          },
          offset: '0',
          repeat: '14px',
        },
      ],
      map,
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

interface OrderTrackingMapCardProps {
  apiKey: string;
  mapsQuotaError: boolean;
  isDelivered: boolean;
  isCancelled: boolean;
  assignment: DeliveryTrackingTelemetry['assignment'];
  hubInfo: { name: string; area: string; coords: LatLng };
  destinationCoords: LatLng;
  targetSavedAddress: Address | null;
  riderPosition: LatLng | null;
  riderBearing: number;
  totalRouteKm: number;
  remainingDistanceKm: number;
  speedKmh: number;
  etaDisplay: string;
  followRider: boolean;
  fitTrigger: number;
  activeMarkerInfo: 'hub' | 'rider' | 'destination' | null;
  language: Language;
  t: TranslatorFn;
  onToggleFollowRider: () => void;
  onFitFullRoute: () => void;
  onSelectMarkerInfo: (info: 'hub' | 'rider' | 'destination' | null) => void;
  onRouteMetricsComputed: (distanceMeters?: number, durationMillis?: number) => void;
}

export default function OrderTrackingMapCard({
  apiKey,
  mapsQuotaError,
  isDelivered,
  isCancelled,
  assignment,
  hubInfo,
  destinationCoords,
  targetSavedAddress,
  riderPosition,
  riderBearing,
  totalRouteKm,
  remainingDistanceKm,
  speedKmh,
  etaDisplay,
  followRider,
  fitTrigger,
  activeMarkerInfo,
  language,
  t,
  onToggleFollowRider,
  onFitFullRoute,
  onSelectMarkerInfo,
  onRouteMetricsComputed,
}: OrderTrackingMapCardProps) {
  return (
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
                coords: `${destinationCoords.lat.toFixed(4)}, ${destinationCoords.lng.toFixed(4)}`,
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {riderPosition && (
            <button
              type="button"
              onClick={onToggleFollowRider}
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
            onClick={onFitFullRoute}
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
              onRouteMetricsComputed={onRouteMetricsComputed}
            />

            <AdvancedMarker
              position={hubInfo.coords}
              onClick={() => onSelectMarkerInfo('hub')}
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
                onClick={() => onSelectMarkerInfo('rider')}
                title={assignment?.agent?.full_name || 'Delivery Rider'}
                zIndex={50}
              >
                <div className="relative flex flex-col items-center cursor-pointer">
                  <div className="px-2.5 py-0.5 mb-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold shadow-lg border border-white/60 whitespace-nowrap flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    <span>
                      {assignment?.agent?.full_name?.split(' ')[0] || 'Rider'} · {remainingDistanceKm.toFixed(2)} km
                    </span>
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
              onClick={() => onSelectMarkerInfo('destination')}
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
              <InfoWindow position={hubInfo.coords} onCloseClick={() => onSelectMarkerInfo(null)}>
                <div className="p-1.5 text-slate-900">
                  <p className="text-xs font-extrabold uppercase text-emerald-700">Fulfillment Hub</p>
                  <h4 className="font-bold text-base">{hubInfo.name}</h4>
                  <p className="text-xs text-slate-500">Total distance: {totalRouteKm.toFixed(2)} km</p>
                </div>
              </InfoWindow>
            )}

            {activeMarkerInfo === 'rider' && riderPosition && !isCancelled && (
              <InfoWindow position={riderPosition} onCloseClick={() => onSelectMarkerInfo(null)}>
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
              <InfoWindow position={destinationCoords} onCloseClick={() => onSelectMarkerInfo(null)}>
                <div className="p-1.5 text-slate-900">
                  <span className="text-xs font-extrabold uppercase text-orange-700">Delivery Address</span>
                  <h4 className="font-bold text-base mt-0.5">
                    {targetSavedAddress?.title} · {targetSavedAddress?.recipient_name}
                  </h4>
                  <p className="text-xs text-slate-600">
                    {targetSavedAddress?.street}, {targetSavedAddress?.area}
                  </p>
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
            {riderPosition ? `${speedKmh} km/h` : language === 'ne' ? 'प्रतीक्षामा' : 'Standby'}
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
  );
}
