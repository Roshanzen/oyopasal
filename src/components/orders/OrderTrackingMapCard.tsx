import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, Crosshair, Maximize2, Navigation } from 'lucide-react';
import { LatLng } from '../../hooks/useOrderTracking';
import { TranslatorFn } from '../../i18n';
import { Address, DeliveryTrackingTelemetry, Language } from '../../types';

interface OrderTrackingMapCardProps {
  apiKey?: string;
  mapsQuotaError?: boolean;
  isDelivered: boolean;
  isCancelled: boolean;
  assignment?: {
    id: string | number;
    agent?: {
      full_name: string;
      phone?: string;
      phone_number?: string;
      vehicle_type: string;
      vehicle_number: string;
    } | null;
  } | null;
  hubInfo: { name: string; area?: string; address?: string; coords: LatLng };
  destinationCoords: LatLng;
  targetSavedAddress?: Address | null;
  riderPosition: LatLng | null;
  riderBearing: number;
  totalRouteKm: number;
  remainingDistanceKm: number;
  speedKmh: number;
  etaDisplay: string;
  telemetry?: DeliveryTrackingTelemetry | null;
  followRider: boolean;
  fitTrigger: number;
  activeMarkerInfo: 'hub' | 'rider' | 'destination' | null;
  language: Language;
  t: TranslatorFn;
  onToggleFollowRider: () => void;
  onFitFullRoute: () => void;
  onSelectMarkerInfo: (info: 'hub' | 'rider' | 'destination' | null) => void;
  onRouteMetricsComputed?: (distanceMeters?: number, durationMillis?: number) => void;
}

function createHubIcon(hubName: string) {
  return L.divIcon({
    className: 'custom-hub-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          padding: 2px 8px;
          margin-bottom: 4px;
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.9);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.6);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${hubName}</div>
        <div style="
          width: 32px;
          height: 32px;
          background: #059669;
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(5, 150, 105, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  });
}

function createDestinationIcon(title: string) {
  return L.divIcon({
    className: 'custom-destination-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          padding: 2px 8px;
          margin-bottom: 4px;
          border-radius: 6px;
          background: #ea580c;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${title}</div>
        <div style="
          width: 34px;
          height: 34px;
          background: #ea580c;
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(234, 88, 12, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
  });
}

function createRiderIcon(agentName: string, distanceKm: number, bearing: number) {
  return L.divIcon({
    className: 'custom-rider-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="
          padding: 3px 8px;
          margin-bottom: 4px;
          border-radius: 9999px;
          background: #059669;
          color: #ffffff;
          border: 1.5px solid rgba(255, 255, 255, 0.8);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></span>
          <span>${agentName} · ${distanceKm.toFixed(2)} km</span>
        </div>
        <div style="
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #0f172a;
          border: 2.5px solid #10b981;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #34d399;
          transform: rotate(${Math.round(bearing)}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
  });
}

export default function OrderTrackingMapCard({
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
  telemetry,
  followRider,
  fitTrigger,
  activeMarkerInfo,
  language,
  t,
  onToggleFollowRider,
  onFitFullRoute,
  onSelectMarkerInfo,
}: OrderTrackingMapCardProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hubMarkerRef = useRef<L.Marker | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const riderMarkerRef = useRef<L.Marker | null>(null);
  const coveredLineRef = useRef<L.Polyline | null>(null);
  const remainingLineRef = useRef<L.Polyline | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const initialCenter = riderPosition || destinationCoords;
    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Hub Marker
    const hubMarker = L.marker([hubInfo.coords.lat, hubInfo.coords.lng], {
      icon: createHubIcon(hubInfo.name),
      title: hubInfo.name,
    }).addTo(map);

    hubMarker.bindTooltip(
      `<strong>${hubInfo.name}</strong><br/>Fulfillment Center`,
      { direction: 'top', offset: [0, -38] }
    );
    hubMarker.on('click', () => onSelectMarkerInfo('hub'));
    hubMarkerRef.current = hubMarker;

    // Destination Marker
    const destTitle = targetSavedAddress?.title || 'Delivery Destination';
    const destMarker = L.marker([destinationCoords.lat, destinationCoords.lng], {
      icon: createDestinationIcon(destTitle),
      title: destTitle,
    }).addTo(map);

    destMarker.bindTooltip(
      `<strong>${destTitle}</strong><br/>${targetSavedAddress?.area || 'Delivery Destination'}`,
      { direction: 'top', offset: [0, -40] }
    );
    destMarker.on('click', () => onSelectMarkerInfo('destination'));
    destinationMarkerRef.current = destMarker;

    // Route Polylines
    coveredLineRef.current = L.polyline([], {
      color: '#059669',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);

    remainingLineRef.current = L.polyline([], {
      color: '#38bdf8',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.85,
    }).addTo(map);

    mapRef.current = map;

    // Initial fit bounds
    const bounds = L.latLngBounds([
      [hubInfo.coords.lat, hubInfo.coords.lng],
      [destinationCoords.lat, destinationCoords.lng],
    ]);
    if (riderPosition) {
      bounds.extend([riderPosition.lat, riderPosition.lng]);
    }
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      hubMarkerRef.current = null;
      destinationMarkerRef.current = null;
      riderMarkerRef.current = null;
      coveredLineRef.current = null;
      remainingLineRef.current = null;
    };
  }, []);

  // Update Rider Marker, Routes, and Telemetry
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Update Destination position
    destinationMarkerRef.current?.setLatLng([destinationCoords.lat, destinationCoords.lng]);
    hubMarkerRef.current?.setLatLng([hubInfo.coords.lat, hubInfo.coords.lng]);

    // Handle Rider Position
    if (riderPosition && !isCancelled) {
      const riderName = assignment?.agent?.full_name?.split(' ')[0] || 'Rider';
      if (!riderMarkerRef.current) {
        const marker = L.marker([riderPosition.lat, riderPosition.lng], {
          icon: createRiderIcon(riderName, remainingDistanceKm, riderBearing),
          zIndexOffset: 100,
          title: `Delivery Rider: ${riderName}`,
        }).addTo(map);
        marker.on('click', () => onSelectMarkerInfo('rider'));
        riderMarkerRef.current = marker;
      } else {
        riderMarkerRef.current.setLatLng([riderPosition.lat, riderPosition.lng]);
        riderMarkerRef.current.setIcon(
          createRiderIcon(riderName, remainingDistanceKm, riderBearing)
        );
      }

      // Route lines: Hub -> Rider (covered), Rider -> Destination (remaining)
      coveredLineRef.current?.setLatLngs([
        [hubInfo.coords.lat, hubInfo.coords.lng],
        [riderPosition.lat, riderPosition.lng],
      ]);
      remainingLineRef.current?.setLatLngs([
        [riderPosition.lat, riderPosition.lng],
        [destinationCoords.lat, destinationCoords.lng],
      ]);

      if (followRider) {
        map.panTo([riderPosition.lat, riderPosition.lng], { animate: true, duration: 0.6 });
      }
    } else {
      // No active rider: line direct from hub to destination
      if (riderMarkerRef.current) {
        riderMarkerRef.current.remove();
        riderMarkerRef.current = null;
      }
      coveredLineRef.current?.setLatLngs([]);
      remainingLineRef.current?.setLatLngs([
        [hubInfo.coords.lat, hubInfo.coords.lng],
        [destinationCoords.lat, destinationCoords.lng],
      ]);
    }
  }, [
    riderPosition,
    riderBearing,
    remainingDistanceKm,
    assignment,
    isCancelled,
    followRider,
    destinationCoords,
    hubInfo.coords,
  ]);

  // Handle Fit Route Trigger
  useEffect(() => {
    if (!mapRef.current) return;
    const bounds = L.latLngBounds([
      [hubInfo.coords.lat, hubInfo.coords.lng],
      [destinationCoords.lat, destinationCoords.lng],
    ]);
    if (riderPosition) {
      bounds.extend([riderPosition.lat, riderPosition.lng]);
    }
    mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [fitTrigger]);

  return (
    <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              riderPosition && !isDelivered ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
            }`}
          />
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

      {/* Leaflet OpenStreetMap Container */}
      <div className="h-[380px] sm:h-[460px] w-full relative bg-slate-900">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Legend Overlay */}
        <div className="absolute top-3 left-3 z-400 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200/90 dark:border-slate-700 shadow-lg flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-800 dark:text-slate-200 pointer-events-none">
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
        <div className="p-3.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {t('track.liveEta')}
          </span>
          <span className="text-base sm:text-lg font-extrabold text-emerald-800 dark:text-emerald-400 block mt-0.5">
            {isDelivered ? 'Delivered' : isCancelled ? 'Cancelled' : etaDisplay}
          </span>
        </div>

        <div className="p-3.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {t('track.awayFromAddress')}
          </span>
          <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white block mt-0.5 tabular-nums">
            {remainingDistanceKm.toFixed(2)} km
          </span>
        </div>

        <div className="p-3.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {t('track.courierSpeed')}
          </span>
          <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white block mt-0.5 tabular-nums">
            {speedKmh > 0 ? `${speedKmh.toFixed(0)} km/h` : '18 km/h'}
          </span>
        </div>

        <div className="p-3.5">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {language === 'ne' ? 'डेलिभरी सवारी' : 'Delivery Vehicle'}
          </span>
          <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white block mt-0.5 truncate">
            {assignment?.agent?.vehicle_number || assignment?.agent?.vehicle_type || 'Super Soco CPx'}
          </span>
        </div>
      </div>
    </div>
  );
}
