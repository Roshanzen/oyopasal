import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'motion/react';
import { useApp, calculateDistanceInKm } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { DeliveryZoneItem } from '../../shared/types';
import {
  X,
  MapPin,
  Check,
  Plus,
  Home,
  Briefcase,
  Compass,
  Store,
  CheckCircle2,
  Crosshair,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function LocationModal() {
  const {
    locationModalOpen,
    setLocationModalOpen,
    addresses,
    currentAddress,
    setCurrentAddress,
    currentCoordinates,
    setDeliveryLocationFromMap,
    addNewAddress,
    vendors,
    showToast,
    t,
    language
  } = useApp();

  const [activeTab, setActiveTab] = useState<'map' | 'saved' | 'manual'>('map');
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number }>(currentCoordinates);
  const [pickedAreaName, setPickedAreaName] = useState<string>(currentAddress?.area || 'Kathmandu Valley');
  const [gpsLoading, setGpsLoading] = useState(false);

  const [zones, setZones] = useState<DeliveryZoneItem[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);

  // Manual Form State
  const [title, setTitle] = useState('Home');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadZones = useCallback(async () => {
    setZonesLoading(true);
    setZonesError(null);
    try {
      const res = await api.getZones();
      setZones(res.results);
    } catch (err: any) {
      setZonesError(err?.message || 'Could not load delivery zones');
    } finally {
      setZonesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locationModalOpen) {
      loadZones();
      setPickedCoords(currentCoordinates);
      if (currentAddress?.area) {
        setPickedAreaName(currentAddress.area);
      }
    }
  }, [locationModalOpen, currentCoordinates, currentAddress, loadZones]);

  // Find closest active delivery zone from DB when coords change
  const estimateAreaName = useCallback(
    (lat: number, lng: number): string => {
      if (zones.length === 0) {
        return `(${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      }
      let closest = zones[0];
      let minDistance = Infinity;

      for (const zone of zones) {
        const dist = calculateDistanceInKm(lat, lng, zone.center_lat, zone.center_lng);
        if (dist < minDistance) {
          minDistance = dist;
          closest = zone;
        }
      }

      if (minDistance <= closest.radius_km) {
        return `${closest.name}, ${closest.city}`;
      }
      return `${closest.city} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    },
    [zones]
  );

  const handleMapClick = (e: any) => {
    if (e.detail?.latLng) {
      const newLat = e.detail.latLng.lat;
      const newLng = e.detail.latLng.lng;
      setPickedCoords({ lat: newLat, lng: newLng });
      setPickedAreaName(estimateAreaName(newLat, newLng));
    }
  };

  const handleMarkerDragEnd = (e: any) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setPickedCoords({ lat: newLat, lng: newLng });
      setPickedAreaName(estimateAreaName(newLat, newLng));
    }
  };

  const handleSelectZone = (zone: DeliveryZoneItem) => {
    setPickedCoords({ lat: zone.center_lat, lng: zone.center_lng });
    setPickedAreaName(`${zone.name}, ${zone.city}`);
  };

  const handleUseGPS = () => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by your browser', 'error');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setPickedCoords({ lat: userLat, lng: userLng });
        setPickedAreaName(estimateAreaName(userLat, userLng));
        setGpsLoading(false);
        showToast('Located your current position!', 'success');
      },
      (err) => {
        console.warn('GPS location error:', err);
        setGpsLoading(false);
        showToast('Could not fetch exact GPS location. Selected central Kathmandu.', 'info');
      },
      { timeout: 7000, enableHighAccuracy: true }
    );
  };

  const handleConfirmMapLocation = () => {
    setDeliveryLocationFromMap(pickedCoords, pickedAreaName);
    setLocationModalOpen(false);
  };

  const handleSelectSavedAddress = (addr: any) => {
    setCurrentAddress(addr);
    if (addr.lat && addr.lng) {
      setDeliveryLocationFromMap({ lat: addr.lat, lng: addr.lng }, addr.area, addr.street);
    }
    setLocationModalOpen(false);
  };

  const handleSaveManualAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim() || !area.trim()) return;

    setSubmitting(true);
    try {
      await addNewAddress({
        title,
        street: street.trim(),
        area: area.trim(),
        landmark: landmark.trim(),
        city: 'Kathmandu',
        is_default: addresses.length === 0,
        lat: pickedCoords.lat,
        lng: pickedCoords.lng
      });
      setLocationModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none">
          {/* Backdrop with Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLocationModalOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container with Spring Scale */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full max-w-2xl bg-white dark:bg-[#0f1422] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden z-10"
          >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#0f1422] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white font-display">
                {t('loc.title')}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t('loc.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocationModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-2 gap-2 bg-slate-50/60 dark:bg-slate-900/60 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-1.5 py-2.5 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'map'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-400 bg-white dark:bg-[#0f1422] rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('loc.tabMap')}</span>
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-1.5 py-2.5 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'saved'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-400 bg-white dark:bg-[#0f1422] rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Home className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>{t('loc.tabSaved', { count: addresses.length })}</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-1.5 py-2.5 px-4 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'manual'
                ? 'border-emerald-600 text-emerald-800 dark:text-emerald-400 bg-white dark:bg-[#0f1422] rounded-t-xl shadow-2xs'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>{t('loc.tabManual')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto">
          {/* TAB 1: GEO MAP PICKER */}
          {activeTab === 'map' && (
            <div className="flex flex-col">
              {/* Map Action Toolbar */}
              <div className="p-3 bg-white dark:bg-[#0f1422] flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="truncate max-w-[220px] sm:max-w-xs">{pickedAreaName}</span>
                </div>

                <button
                  type="button"
                  onClick={handleUseGPS}
                  disabled={gpsLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shrink-0"
                >
                  <Crosshair className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${gpsLoading ? 'animate-spin' : ''}`} />
                  <span>{gpsLoading ? t('loc.locating') : t('loc.useGps')}</span>
                </button>
              </div>

              {/* Interactive Google Map */}
              <div className="h-64 sm:h-80 w-full relative bg-slate-100 dark:bg-slate-900">
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
                  <Map
                    defaultCenter={pickedCoords}
                    center={pickedCoords}
                    defaultZoom={14}
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    className="w-full h-full"
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    onClick={handleMapClick}
                  >
                    {/* User's Delivery Destination Pin */}
                    <AdvancedMarker
                      position={pickedCoords}
                      draggable={true}
                      onDragEnd={handleMarkerDragEnd}
                      title="Your Delivery Destination (Drag to fine-tune)"
                    >
                      <Pin
                        background="#059669"
                        borderColor="#064e3b"
                        glyphColor="#ffffff"
                        scale={1.3}
                      />
                    </AdvancedMarker>

                    {/* Nearby Vendor Hub Pins from Database */}
                    {vendors
                      .filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number')
                      .map((vendor) => (
                        <AdvancedMarker
                          key={vendor.id}
                          position={{ lat: vendor.lat!, lng: vendor.lng! }}
                          title={`${vendor.name} (${calculateDistanceInKm(pickedCoords.lat, pickedCoords.lng, vendor.lat!, vendor.lng!)} km)`}
                        >
                          <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-700 dark:border-slate-400 shadow-md flex items-center justify-center text-slate-800 dark:text-slate-200">
                            <Store className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                          </div>
                        </AdvancedMarker>
                      ))}
                  </Map>
                </APIProvider>

                {/* Map Guidance Hint Overlay */}
                <div className="absolute top-2.5 left-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs text-xs font-medium text-slate-600 dark:text-slate-300 pointer-events-none flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('loc.dragHint')}</span>
                </div>
              </div>

              {/* Active Delivery Zones from PostgreSQL */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                  {t('loc.neighborhoodPrompt')}
                </span>
                {zonesLoading ? (
                  <div className="text-xs text-slate-500">Loading active delivery zones...</div>
                ) : zonesError ? (
                  <div className="flex items-center justify-between gap-2 text-xs text-rose-500">
                    <span className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {zonesError}</span>
                    <button type="button" onClick={loadZones} className="inline-flex items-center gap-1 font-bold underline cursor-pointer">
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                ) : zones.length === 0 ? (
                  <div className="text-xs text-slate-500">No active delivery zones configured yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {zones.map((zone) => (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => handleSelectZone(zone)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          pickedAreaName.includes(zone.name)
                            ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                            : 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {zone.name} · ~{zone.estimated_mins}m
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Distance preview to nearest local marts */}
              <div className="p-4 bg-white dark:bg-[#0f1422] border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    {t('loc.calcDistance')}
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded">
                    {t('loc.expressAvail')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {vendors.map((vendor) => {
                    const vLat = vendor.lat ?? pickedCoords.lat;
                    const vLng = vendor.lng ?? pickedCoords.lng;
                    const dist = calculateDistanceInKm(pickedCoords.lat, pickedCoords.lng, vLat, vLng);
                    const baseMins = parseInt(String(vendor.delivery_time_mins || '12'), 10) || 12;
                    return (
                      <div
                        key={vendor.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                      >
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={vendor.name}>
                          {vendor.name}
                        </span>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700 text-xs">
                          <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                            {dist.toFixed(1)} {language === 'ne' ? 'कि.मि.' : 'km'}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            ~{Math.round(baseMins + dist * 2)}{language === 'ne' ? 'मि' : 'm'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Primary Confirmation Button */}
                <button
                  type="button"
                  onClick={handleConfirmMapLocation}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-5 h-5 text-white" />
                  <span>{t('loc.deliverTo', { area: pickedAreaName })}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SAVED ADDRESSES */}
          {activeTab === 'saved' && (
            <div className="p-4 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                {t('loc.savedTitle')}
              </span>

              {addresses.map((addr) => {
                const isSelected = currentAddress?.id === addr.id;
                const IconComp = addr.title.toLowerCase().includes('office') ? Briefcase : Home;

                return (
                  <div
                    key={addr.id}
                    onClick={() => handleSelectSavedAddress(addr)}
                    className={`flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-2xs'
                        : 'bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            {addr.title}
                          </span>
                          {addr.is_default && (
                            <span className="text-xs bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-semibold">
                              {t('common.default')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                          {addr.street}, {addr.area}, {addr.city}
                        </p>
                        {addr.landmark && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {t('checkout.landmarkLabel', { landmark: addr.landmark })}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-1">
                        <Check className="w-3 h-3 stroke-3" />
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className="w-full mt-3 py-2.5 px-4 rounded-xl border border-dashed border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>{t('loc.pickNewOnMap')}</span>
              </button>
            </div>
          )}

          {/* TAB 3: MANUAL FORM */}
          {activeTab === 'manual' && (
            <form onSubmit={handleSaveManualAddress} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {t('loc.addressLabel')}
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'Home', label: t('loc.labelHome') },
                    { value: 'Office', label: t('loc.labelOffice') },
                    { value: 'Other', label: t('loc.labelOther') }
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setTitle(item.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        title === item.value
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {t('loc.streetLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. House #28, Maitidevi Road"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {t('loc.areaLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. New Baneshwor, Kathmandu"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {t('loc.landmarkInputLabel')}
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite Standard Chartered Bank"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !street.trim() || !area.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submitting ? t('loc.saving') : t('loc.saveDeliverHere')}
                </button>
              </div>
            </form>
          )}
        </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
