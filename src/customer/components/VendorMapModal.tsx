import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { X, MapPin, Store, Clock, Star, Phone, Navigation, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Vendor } from '../../shared/types';
import { useApp } from '../../shared/context/AppContext';
import { translateDurationText } from '../../shared/i18n/translations';

interface VendorMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onSelectVendor?: (vendorId: string) => void;
}

export const VendorMapModal: React.FC<VendorMapModalProps> = ({
  isOpen,
  onClose,
  vendors,
  onSelectVendor
}) => {
  const { t, language } = useApp();
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const defaultCenter = { lat: 27.6980, lng: 85.3300 };

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
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-900">
          <APIProvider apiKey={apiKey}>
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={13}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
              gestureHandling="greedy"
              disableDefaultUI={false}
            >
              {vendors.map((vendor) => {
                const pos = {
                  lat: vendor.lat ?? defaultCenter.lat,
                  lng: vendor.lng ?? defaultCenter.lng,
                };
                return (
                  <AdvancedMarker
                    key={vendor.id}
                    position={pos}
                    onClick={() => setSelectedVendor(vendor)}
                    title={vendor.name}
                  >
                    <Pin
                      background="#059669"
                      borderColor="#064e3b"
                      glyphColor="#ffffff"
                      scale={1.2}
                    />
                  </AdvancedMarker>
                );
              })}

              {selectedVendor && (
                <InfoWindow
                  position={{
                    lat: selectedVendor.lat ?? defaultCenter.lat,
                    lng: selectedVendor.lng ?? defaultCenter.lng,
                  }}
                  onCloseClick={() => setSelectedVendor(null)}
                >
                  <div className="p-1 max-w-[240px] text-slate-800">
                    <h4 className="font-bold text-sm text-slate-900">{selectedVendor.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{selectedVendor.location}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {selectedVendor.rating}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        {translateDurationText(selectedVendor.delivery_time_mins, language)}
                      </span>
                    </div>
                    {onSelectVendor && (
                      <button
                        onClick={() => {
                          onSelectVendor(selectedVendor.id);
                          onClose();
                        }}
                        className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>{t('vmap.viewProducts')}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Quick Vendor Drawer at Bottom */}
          <div className="absolute bottom-4 left-4 right-4 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md rounded-2xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-lg flex items-center gap-3 overflow-x-auto no-scrollbar">
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVendor(v)}
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
                    {translateDurationText(v.delivery_time_mins, language)} • {v.distance_km} {language === 'ne' ? 'कि.मि.' : 'km'}
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
