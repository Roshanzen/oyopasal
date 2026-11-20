import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Coordinates, DeliveryZoneItem, Vendor } from '../../types';

interface LeafletLocationPickerProps {
  coords: Coordinates;
  onChangeCoords: (coords: Coordinates) => void;
  vendors?: Vendor[];
  zones?: DeliveryZoneItem[];
  className?: string;
  zoom?: number;
  interactive?: boolean;
}

// Custom SVG Pin for Selected Delivery Location
function createDeliveryIcon() {
  return L.divIcon({
    className: 'custom-delivery-pin',
    html: `
      <div style="position: relative; width: 36px; height: 44px; transform: translate(-50%, -100%);">
        <!-- Pulse Radar Circle -->
        <div style="
          position: absolute;
          bottom: 0px;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 10px;
          background: rgba(16, 185, 129, 0.4);
          border-radius: 50%;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <!-- Shadow -->
        <div style="
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 6px;
          background: rgba(15, 23, 42, 0.35);
          border-radius: 50%;
          filter: blur(1px);
        "></div>
        <!-- Pin Teardrop -->
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          border: 2.5px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(5, 150, 105, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <!-- Pin Center Target Dot -->
          <div style="
            width: 11px;
            height: 11px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
          "></div>
        </div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  });
}

// Custom Store Pin for Nearby Vendors
function createVendorIcon(vendorName: string) {
  return L.divIcon({
    className: 'custom-vendor-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%);" title="${vendorName}">
        <div style="
          width: 28px;
          height: 28px;
          background: #ffffff;
          border: 2px solid #0f172a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
          color: #0f172a;
        ">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <path d="M2 7h20"/>
            <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 10V7"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

export const LeafletLocationPicker: React.FC<LeafletLocationPickerProps> = ({
  coords,
  onChangeCoords,
  vendors = [],
  zones = [],
  className = 'h-64 sm:h-80 w-full',
  zoom = 15,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const vendorLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);
  const onChangeCoordsRef = useRef(onChangeCoords);
  onChangeCoordsRef.current = onChangeCoords;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [coords.lat, coords.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
    });

    // Add Zoom Control at bottom right for clean layout
    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(map);

    // Standard OpenStreetMap Tile Layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Delivery Destination Movable Marker
    const marker = L.marker([coords.lat, coords.lng], {
      icon: createDeliveryIcon(),
      draggable: interactive,
      autoPan: true,
      title: 'Your Delivery Location (Drag or tap to adjust)',
    }).addTo(map);

    if (interactive) {
      // Drag event handler
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChangeCoordsRef.current({ lat: pos.lat, lng: pos.lng });
      });

      // Map tap/click event handler
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        onChangeCoordsRef.current({ lat, lng });
      });
    }

    const vendorGroup = L.layerGroup().addTo(map);
    const zoneGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    vendorLayerRef.current = vendorGroup;
    zoneLayerRef.current = zoneGroup;

    // Handle container resizing / animations
    const invalidateTimer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(invalidateTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      vendorLayerRef.current = null;
      zoneLayerRef.current = null;
    };
  }, []); // Run once on mount

  // Sync coords updates (e.g. from GPS or search)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const currentPos = markerRef.current.getLatLng();
    const isSame =
      Math.abs(currentPos.lat - coords.lat) < 0.00001 &&
      Math.abs(currentPos.lng - coords.lng) < 0.00001;

    if (!isSame) {
      markerRef.current.setLatLng([coords.lat, coords.lng]);
      mapRef.current.panTo([coords.lat, coords.lng], {
        animate: true,
        duration: 0.6,
      });
    }
  }, [coords.lat, coords.lng]);

  // Update nearby vendor markers
  useEffect(() => {
    if (!vendorLayerRef.current) return;
    vendorLayerRef.current.clearLayers();

    vendors
      .filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number')
      .forEach((vendor) => {
        const vMarker = L.marker([vendor.lat!, vendor.lng!], {
          icon: createVendorIcon(vendor.name),
          title: vendor.name,
        });
        vMarker.bindTooltip(
          `<strong>${vendor.name}</strong><br/><span style="color:#059669">${vendor.delivery_time_mins || '12-15'} mins delivery</span>`,
          { direction: 'top', offset: [0, -28] }
        );
        vendorLayerRef.current?.addLayer(vMarker);
      });
  }, [vendors]);

  // Update delivery zone circles
  useEffect(() => {
    if (!zoneLayerRef.current) return;
    zoneLayerRef.current.clearLayers();

    zones.forEach((zone) => {
      if (typeof zone.center_lat === 'number' && typeof zone.center_lng === 'number') {
        const circle = L.circle([zone.center_lat, zone.center_lng], {
          radius: (zone.radius_km || 3) * 1000,
          color: '#059669',
          weight: 1.5,
          opacity: 0.5,
          fillColor: '#10b981',
          fillOpacity: 0.08,
          interactive: false,
        });
        zoneLayerRef.current?.addLayer(circle);
      }
    });
  }, [zones]);

  // Trigger invalidateSize whenever component size might shift
  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  });

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full z-0" tabIndex={0} aria-label="Interactive OpenStreetMap for delivery location selection" />
    </div>
  );
};
