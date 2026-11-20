import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, MapPin, Store, Clock, Star, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vendor } from '../../types';
import { useLanguage } from '../../hooks';
import { translateDurationText } from '../../i18n';

interface VendorMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onSelectVendor?: (vendorId: string) => void;
}

function createVendorIcon(isHighlighted: boolean) {
  return L.divIcon({
    className: 'custom-vendor-pin',
    html: `
      <div style="position: relative; transform: translate(-50%, -100%); cursor: pointer;">
        <div style="
          width: ${isHighlighted ? '38px' : '32px'};
          height: ${isHighlighted ? '38px' : '32px'};
          background: ${isHighlighted ? '#059669' : '#ffffff'};
          color: ${isHighlighted ? '#ffffff' : '#0f172a'};
          border: 2.5px solid ${isHighlighted ? '#ffffff' : '#0f172a'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          transition: all 0.2s ease;
        ">
          <svg width="${isHighlighted ? '19' : '16'}" height="${isHighlighted ? '19' : '16'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
            <path d="M2 7h20"/>
            <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 10V7"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [isHighlighted ? 38 : 32, isHighlighted ? 38 : 32],
    iconAnchor: [isHighlighted ? 19 : 16, isHighlighted ? 38 : 32],
  });
}

export const VendorMapModal: React.FC<VendorMapModalProps> = ({
  isOpen,
  onClose,
  vendors,
  onSelectVendor,
}) => {
  const { t, language } = useLanguage();
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const defaultCenter = { lat: 27.698, lng: 85.33 };

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize and tear down Leaflet map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (mapRef.current) return;

    const firstWithCoords = vendors.find((v) => typeof v.lat === 'number' && typeof v.lng === 'number');
    const center = firstWithCoords
      ? { lat: firstWithCoords.lat!, lng: firstWithCoords.lng! }
      : defaultCenter;

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: 14,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    // Handle initial render container size
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [isOpen]);

  // Sync vendor markers onto Leaflet map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    vendors
      .filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number')
      .forEach((vendor) => {
        const isSelected = selectedVendor?.id === vendor.id;
        const marker = L.marker([vendor.lat!, vendor.lng!], {
          icon: createVendorIcon(isSelected),
          title: vendor.name,
        }).addTo(map);

        marker.on('click', () => {
          setSelectedVendor(vendor);
        });

        marker.bindTooltip(`<strong>${vendor.name}</strong>`, {
          direction: 'top',
          offset: [0, -32],
        });

        markersRef.current.set(vendor.id, marker);
        bounds.extend([vendor.lat!, vendor.lng!]);
      });

    if (bounds.isValid() && !selectedVendor) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [vendors, isOpen, selectedVendor?.id]);

  // Pan to selected vendor
  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    if (mapRef.current && typeof vendor.lat === 'number' && typeof vendor.lng === 'number') {
      mapRef.current.flyTo([vendor.lat, vendor.lng], 16, { duration: 0.8 });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none">
          {/* Backdrop with Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container with Spring Scale */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative bg-white dark:bg-[#111726] rounded-3xl shadow-2xl w-full max-w-4xl h-[650px] max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 z-10"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#111726] z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                  <Store className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white font-display">
                      {t('vmap.title')}
                    </h3>
                    <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {t('vmap.badge')}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {t('vmap.subtitle')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close vendor map"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-100 dark:bg-slate-900">
              <div ref={mapContainerRef} className="w-full h-full z-0" />

              {/* Selected Vendor Floating Info Card */}
              {selectedVendor && (
                <div className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-sm bg-white dark:bg-[#0f1422] p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-400 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedVendor.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{selectedVendor.location}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedVendor(null)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="Dismiss info card"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {selectedVendor.rating}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {translateDurationText(selectedVendor.delivery_time_mins, language)}
                    </span>
                  </div>

                  {onSelectVendor && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectVendor(selectedVendor.slug || selectedVendor.id);
                        onClose();
                      }}
                      className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{t('vmap.viewProducts')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Quick Vendor Drawer at Bottom */}
              <div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-lg flex items-center gap-3 overflow-x-auto no-scrollbar z-400">
                {vendors.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectVendor(v)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left shrink-0 transition-all cursor-pointer ${
                      selectedVendor?.id === v.id
                        ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/70 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 bg-white dark:bg-[#111726]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate max-w-[160px]">
                        {v.name}
                      </h5>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        {translateDurationText(v.delivery_time_mins, language)} • {v.distance_km}{' '}
                        {language === 'ne' ? 'कि.मि.' : 'km'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
