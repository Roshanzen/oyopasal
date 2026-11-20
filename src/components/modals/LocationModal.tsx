import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context';
import { calculateDistanceInKm } from '../../utils';
import { addressService } from '../../services';
import { geocodingService, GeocodedAddress } from '../../services/geocodingService';
import { useNativeGeolocation } from '../../hooks/useNativeGeolocation';
import { LeafletLocationPicker } from '../common/LeafletLocationPicker';
import { Address, Coordinates, DeliveryZoneItem } from '../../types';
import {
  X,
  MapPin,
  Check,
  Plus,
  Home,
  Briefcase,
  Compass,
  CheckCircle2,
  Crosshair,
  AlertCircle,
  RefreshCw,
  Edit3,
  Trash2,
  Loader2,
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
    deleteAddress,
    vendors,
    showToast,
    t,
    language,
    user,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'map' | 'saved' | 'manual'>('map');
  const [pickedCoords, setPickedCoords] = useState<Coordinates>(currentCoordinates);
  const [pickedAreaName, setPickedAreaName] = useState<string>(currentAddress?.area || 'Kathmandu Valley');
  const [geocodedAddress, setGeocodedAddress] = useState<GeocodedAddress | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Delivery Zones
  const [zones, setZones] = useState<DeliveryZoneItem[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);

  // Native Geolocation
  const {
    locating: gpsLoading,
    error: gpsError,
    detectLocation,
    clearError: clearGpsError,
  } = useNativeGeolocation();

  // Manual Form State
  const [title, setTitle] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [recipientName, setRecipientName] = useState(user?.full_name || '');
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Kathmandu');
  const [landmark, setLandmark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // AbortController for debouncing reverse geocode
  const geocodeAbortRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadZones = useCallback(async () => {
    setZonesLoading(true);
    setZonesError(null);
    try {
      const res = await addressService.getZones();
      setZones(res.results || []);
    } catch (err: unknown) {
      setZonesError(err instanceof Error ? err.message : 'Could not load delivery zones');
    } finally {
      setZonesLoading(false);
    }
  }, []);

  // Perform reverse geocode with debouncing
  const performReverseGeocode = useCallback((coords: Coordinates) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }

    setIsGeocoding(true);
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      geocodeAbortRef.current = controller;
      try {
        const result = await geocodingService.reverseGeocode(coords.lat, coords.lng, {
          signal: controller.signal,
        });
        setGeocodedAddress(result);
        setPickedAreaName(result.shortLabel || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
        // Pre-fill manual form fields if empty or unmodified
        if (result.street) setStreet(result.street);
        if (result.area) setArea(result.area);
        if (result.city) setCity(result.city);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Fallback area label
        setPickedAreaName(`Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
      } finally {
        setIsGeocoding(false);
      }
    }, 450);
  }, []);

  // Sync coords when modal opens
  useEffect(() => {
    if (locationModalOpen) {
      loadZones();
      setPickedCoords(currentCoordinates);
      if (currentAddress?.area) {
        setPickedAreaName(currentAddress.area);
        setArea(currentAddress.area);
      }
      if (currentAddress?.street) {
        setStreet(currentAddress.street);
      }
      if (currentAddress?.city) {
        setCity(currentAddress.city);
      }
      if (user?.full_name && !recipientName) {
        setRecipientName(user.full_name);
      }
      if (user?.phone && !recipientPhone) {
        setRecipientPhone(user.phone);
      }
      // Run initial reverse geocode
      performReverseGeocode(currentCoordinates);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (geocodeAbortRef.current) geocodeAbortRef.current.abort();
    };
  }, [locationModalOpen, currentCoordinates, currentAddress, loadZones, performReverseGeocode, user]);

  // Handle marker move or map click from LeafletLocationPicker
  const handleCoordsChange = (newCoords: Coordinates) => {
    setPickedCoords(newCoords);
    clearGpsError();
    performReverseGeocode(newCoords);
  };

  // Handle Use Current Location (Browser GPS)
  const handleUseGPS = async () => {
    clearGpsError();
    try {
      const userCoords = await detectLocation();
      setPickedCoords(userCoords);
      performReverseGeocode(userCoords);
      showToast('Located your current position!', 'success');
    } catch {
      // Error message is stored in gpsError from useNativeGeolocation
    }
  };

  // Select zone button
  const handleSelectZone = (zone: DeliveryZoneItem) => {
    const coords = { lat: zone.center_lat, lng: zone.center_lng };
    setPickedCoords(coords);
    setPickedAreaName(`${zone.name}, ${zone.city}`);
    setArea(zone.name);
    setCity(zone.city);
    clearGpsError();
    performReverseGeocode(coords);
  };

  // Confirm map location
  const handleConfirmMapLocation = () => {
    const finalStreet = geocodedAddress?.street || `Pin (${pickedCoords.lat.toFixed(4)}, ${pickedCoords.lng.toFixed(4)})`;
    setDeliveryLocationFromMap(pickedCoords, pickedAreaName, finalStreet);
    setLocationModalOpen(false);
  };

  // Select a saved address
  const handleSelectSavedAddress = (addr: Address) => {
    setCurrentAddress(addr);
    if (typeof addr.lat === 'number' && typeof addr.lng === 'number') {
      setDeliveryLocationFromMap({ lat: addr.lat, lng: addr.lng }, addr.area, addr.street);
    }
    setLocationModalOpen(false);
  };

  // Delete a saved address
  const handleDeleteAddress = async (e: React.MouseEvent, addrId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this delivery address?')) return;
    setDeletingId(addrId);
    try {
      await deleteAddress(addrId);
    } catch {
      // Toast already shown in context
    } finally {
      setDeletingId(null);
    }
  };

  // Save manual address form
  const handleSaveManualAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim() || !area.trim()) return;

    setSubmitting(true);
    try {
      await addNewAddress({
        title,
        recipient_name: recipientName.trim() || user?.full_name || 'Customer',
        phone: recipientPhone.trim() || user?.phone || '+977 9800000000',
        street: street.trim(),
        area: area.trim(),
        city: city.trim() || 'Kathmandu',
        landmark: landmark.trim(),
        is_default: addresses.length === 0,
        lat: pickedCoords.lat,
        lng: pickedCoords.lng,
      });
      setLocationModalOpen(false);
    } catch (err) {
      console.error('Save address error:', err);
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
                aria-label="Close location modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-2 gap-2 bg-slate-50/60 dark:bg-slate-900/60 shrink-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
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
                type="button"
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
                type="button"
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
              {/* TAB 1: INTERACTIVE LEAFLET / OPENSTREETMAP PICKER */}
              {activeTab === 'map' && (
                <div className="flex flex-col">
                  {/* GPS Permission / Service Warning Banner */}
                  {gpsError && (
                    <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-start justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">{gpsError}</p>
                          <p className="text-amber-600 dark:text-amber-300 mt-0.5">
                            You can tap anywhere on the OpenStreetMap below to place your delivery pin.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={clearGpsError}
                        className="text-amber-600 hover:text-amber-900 dark:hover:text-amber-100 font-bold shrink-0 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Map Action Toolbar */}
                  <div className="p-3 bg-white dark:bg-[#0f1422] flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 min-w-0">
                      <span className={`w-2 h-2 rounded-full ${isGeocoding ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                      <span className="truncate max-w-[200px] sm:max-w-xs font-bold">
                        {isGeocoding ? 'Detecting address...' : pickedAreaName}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleUseGPS}
                      disabled={gpsLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                      title="Detect location using device GPS"
                    >
                      {gpsLoading ? (
                        <Loader2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      ) : (
                        <Crosshair className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>{gpsLoading ? t('loc.locating') : t('loc.useGps')}</span>
                    </button>
                  </div>

                  {/* Interactive Leaflet OpenStreetMap Container */}
                  <div className="h-64 sm:h-80 w-full relative bg-slate-100 dark:bg-slate-900">
                    <LeafletLocationPicker
                      coords={pickedCoords}
                      onChangeCoords={handleCoordsChange}
                      vendors={vendors}
                      zones={zones}
                      className="w-full h-full"
                    />

                    {/* Drag Hint Overlay */}
                    <div className="absolute top-2.5 left-2.5 z-400 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs text-xs font-medium text-slate-600 dark:text-slate-300 pointer-events-none flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('loc.dragHint')}</span>
                    </div>
                  </div>

                  {/* Reverse-Geocoded Address Details Card */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Selected Delivery Location
                      </span>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {geocodedAddress?.formattedAddress || pickedAreaName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Coords: {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                        {geocodedAddress?.postalCode ? ` · Postcode: ${geocodedAddress.postalCode}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 cursor-pointer shrink-0 transition-colors"
                      title="Edit street, house number, or landmark"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  </div>

                  {/* Active Delivery Zones */}
                  <div className="p-3.5 bg-white dark:bg-[#0f1422] border-t border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                      {t('loc.neighborhoodPrompt')}
                    </span>
                    {zonesLoading ? (
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        <span>Loading active delivery zones...</span>
                      </div>
                    ) : zonesError ? (
                      <div className="flex items-center justify-between gap-2 text-xs text-rose-500">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> {zonesError}
                        </span>
                        <button
                          type="button"
                          onClick={loadZones}
                          className="inline-flex items-center gap-1 font-bold underline cursor-pointer"
                        >
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
                                : 'bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {zone.name} · ~{zone.estimated_mins}m
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Real-time Distance preview to nearest local marts */}
                  <div className="p-4 bg-slate-50/60 dark:bg-[#0f1422] border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        {t('loc.calcDistance')}
                      </span>
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded">
                        {t('loc.expressAvail')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {vendors.slice(0, 4).map((vendor) => {
                        const vLat = vendor.lat ?? pickedCoords.lat;
                        const vLng = vendor.lng ?? pickedCoords.lng;
                        const dist = calculateDistanceInKm(pickedCoords.lat, pickedCoords.lng, vLat, vLng);
                        const baseMins = parseInt(String(vendor.delivery_time_mins || '12'), 10) || 12;
                        return (
                          <div
                            key={vendor.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                          >
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate" title={vendor.name}>
                              {vendor.name}
                            </span>
                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/60 dark:border-slate-700 text-xs">
                              <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                                {dist.toFixed(1)} {language === 'ne' ? 'कि.मि.' : 'km'}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">
                                ~{Math.round(baseMins + dist * 2)}
                                {language === 'ne' ? 'मि' : 'm'}
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

                  {addresses.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-2">
                      <Home className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No saved addresses yet</p>
                      <p className="text-xs text-slate-500">Save your home, office, or favorite delivery locations for quick 1-click checkout.</p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('map')}
                        className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Pick Location on Map</span>
                      </button>
                    </div>
                  ) : (
                    addresses.map((addr) => {
                      const isSelected = currentAddress?.id === addr.id;
                      const IconComp = addr.title.toLowerCase().includes('office') ? Briefcase : Home;

                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectSavedAddress(addr)}
                          className={`group flex items-start justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-2xs'
                              : 'bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <IconComp className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-base text-slate-900 dark:text-white">
                                  {addr.title}
                                </span>
                                {addr.is_default && (
                                  <span className="text-xs bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-semibold">
                                    {t('common.default')}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                                {addr.street}, {addr.area}, {addr.city}
                              </p>
                              {addr.landmark && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                  {t('checkout.landmarkLabel', { landmark: addr.landmark })}
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                                {addr.recipient_name} · {addr.phone}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 stroke-3" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteAddress(e, addr.id)}
                              disabled={deletingId === addr.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete address"
                              aria-label="Delete address"
                            >
                              {deletingId === addr.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

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

              {/* TAB 3: MANUAL ADDRESS FORM */}
              {activeTab === 'manual' && (
                <form onSubmit={handleSaveManualAddress} className="p-5 space-y-4">
                  {/* Address Label Buttons */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1.5">
                      {t('loc.addressLabel')}
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'Home', label: t('loc.labelHome') },
                        { value: 'Office', label: t('loc.labelOffice') },
                        { value: 'Other', label: t('loc.labelOther') },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setTitle(item.value as 'Home' | 'Office' | 'Other')}
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

                  {/* Recipient Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Roshan Yadav"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="e.g. +977 9801234567"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Street & Area */}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        {t('loc.areaLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        placeholder="e.g. New Baneshwor"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        City / Municipality
                      </label>
                      <input
                        type="text"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Kathmandu"
                        className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Landmark */}
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      {t('loc.landmarkInputLabel')}
                    </label>
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Opposite Standard Chartered Bank, near Seto Pul"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Coordinates Reference */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        Pin: {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('map')}
                      className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      Adjust on map
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('map')}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !street.trim() || !area.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('loc.saving')}</span>
                        </>
                      ) : (
                        <span>{t('loc.saveDeliverHere')}</span>
                      )}
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
