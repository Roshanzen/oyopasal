import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Navigation,
  RefreshCw,
  ExternalLink,
  Phone,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  Package,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import { translateOrderStatus } from '../../i18n';
import { Language, SellerFulfillmentItem } from '../../types';
import OrderTrackingMapCard from '../orders/OrderTrackingMapCard';
import OrderTrackingTimeline from '../orders/OrderTrackingTimeline';

interface SellerOrderTrackingModalProps {
  fulfillment: SellerFulfillmentItem | null;
  vendorName: string;
  language: Language;
  formatPrice: (n: number) => string;
  onClose: () => void;
  onUpdateStatus?: (
    fulfillmentId: string | number,
    nextStatus: 'CONFIRMED_BY_VENDOR' | 'PACKED_BY_VENDOR' | 'READY_FOR_RIDER_PICKUP' | 'REJECTED'
  ) => Promise<void> | void;
  updatingOrderId?: string | number | null;
}

export default function SellerOrderTrackingModal({
  fulfillment,
  vendorName,
  language,
  formatPrice,
  onClose,
  onUpdateStatus,
  updatingOrderId,
}: SellerOrderTrackingModalProps) {
  const navigate = useNavigate();

  // Prefer order_id, fallback to fulfillment_id
  const targetId = fulfillment ? String(fulfillment.order_id || fulfillment.fulfillment_id) : undefined;
  const track = useOrderTracking(targetId);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!fulfillment) return null;

  const currentStatus = track.order?.status || fulfillment.status;
  const isDelivered = currentStatus === 'DELIVERED';
  const isCancelled = currentStatus === 'CANCELLED';

  const handleOpenFullPage = () => {
    onClose();
    navigate(`/orders/${targetId}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-10 my-4 max-h-[92vh] flex flex-col overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    {language === 'ne' ? 'लाइभ अर्डर डिस्प्याच र जीपीएस' : 'Live Order Tracking & GPS'}
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {fulfillment.order_number}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {translateOrderStatus(currentStatus, language)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {vendorName} · {language === 'ne' ? 'वास्तविक समय राइडर टेलिमेट्री' : 'Real-time rider telemetry'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => track.fetchOrderAndTracking(false)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Refresh GPS Telemetry"
              >
                <RefreshCw className={`w-4 h-4 ${track.refreshing ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">{language === 'ne' ? 'रिफ्रेस' : 'Refresh GPS'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFullPage}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Open Dedicated Tracking Page"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">{language === 'ne' ? 'पूरा पृष्ठ' : 'Full Page'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* ETA / Dispatch Progress Banner */}
            {!isDelivered && !isCancelled ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-900/80 to-teal-900/80 border border-emerald-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {track.assignment
                        ? language === 'ne' ? 'राइडर बाटोमा छ' : 'Rider En Route'
                        : language === 'ne' ? 'पसलबाट प्याकिङ र डिस्प्याच बाँकी' : 'Awaiting Store Packing & Rider Pickup'}
                    </span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-black text-white font-display">
                    {track.etaDisplay} · {track.remainingDistanceKm.toFixed(2)} {language === 'ne' ? 'कि.मि.' : 'km'}
                  </h4>
                  <p className="text-xs text-emerald-200">
                    {track.assignment?.agent ? (
                      <>
                        <strong>{track.assignment.agent.full_name}</strong> ({track.assignment.agent.vehicle_number}) →{' '}
                        {fulfillment.customer_name} ({fulfillment.customer_area})
                      </>
                    ) : (
                      <>Destination: <strong>{fulfillment.customer_area}</strong> ({fulfillment.delivery_address || 'Kathmandu'})</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {onUpdateStatus && ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'CONFIRMED'].includes(currentStatus) && (
                    <button
                      disabled={updatingOrderId === fulfillment.fulfillment_id}
                      onClick={() => onUpdateStatus(fulfillment.fulfillment_id, 'PACKED_BY_VENDOR')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Package className="w-4 h-4" />
                      <span>{language === 'ne' ? 'सामान प्याक भयो' : 'Mark Packed'}</span>
                    </button>
                  )}
                  {onUpdateStatus && ['PACKED_BY_VENDOR', 'PACKED'].includes(currentStatus) && (
                    <button
                      disabled={updatingOrderId === fulfillment.fulfillment_id}
                      onClick={() => onUpdateStatus(fulfillment.fulfillment_id, 'READY_FOR_RIDER_PICKUP')}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <Truck className="w-4 h-4" />
                      <span>{language === 'ne' ? 'राइडरलाई दिन तयार' : 'Ready for Rider Pickup'}</span>
                    </button>
                  )}
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                    <Truck className="w-6 h-6" />
                  </div>
                </div>
              </div>
            ) : isDelivered ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-white">{language === 'ne' ? 'अर्डर ग्राहकलाई डेलिभर भयो' : 'Order Delivered Successfully'}</h4>
                  <p className="text-xs text-emerald-300/80">{fulfillment.delivery_address || fulfillment.customer_area}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-200 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-white">{language === 'ne' ? 'अर्डर रद्द गरियो' : 'Order Cancelled'}</h4>
                  <p className="text-xs text-rose-300/80">{fulfillment.notes || 'Order was cancelled'}</p>
                </div>
              </div>
            )}

            {/* Split Grid: Interactive Map + Telemetry Details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Live OpenStreetMap */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                  <OrderTrackingMapCard
                    mapsQuotaError={track.mapsQuotaError}
                    isDelivered={isDelivered}
                    isCancelled={isCancelled}
                    assignment={track.assignment}
                    hubInfo={track.hubInfo}
                    destinationCoords={track.destinationCoords}
                    targetSavedAddress={track.targetSavedAddress}
                    riderPosition={track.riderPosition}
                    riderBearing={track.riderBearing}
                    totalRouteKm={track.totalRouteKm}
                    remainingDistanceKm={track.remainingDistanceKm}
                    speedKmh={track.speedKmh}
                    etaDisplay={track.etaDisplay}
                    followRider={track.followRider}
                    fitTrigger={track.fitTrigger}
                    activeMarkerInfo={track.activeMarkerInfo}
                    language={language}
                    t={track.t}
                    onToggleFollowRider={() => track.setFollowRider((v) => !v)}
                    onFitFullRoute={() => {
                      track.setFollowRider(false);
                      track.setFitTrigger((c) => c + 1);
                    }}
                    onSelectMarkerInfo={track.setActiveMarkerInfo}
                    onRouteMetricsComputed={track.handleRouteMetricsComputed}
                  />
                </div>
              </div>

              {/* Right Column: Customer Info, Items & Timeline */}
              <div className="lg:col-span-5 space-y-4">
                {/* Customer & Destination Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{language === 'ne' ? 'ग्राहक तथा डेलिभरी ठेगाना' : 'Delivery Destination'}</span>
                  </h5>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-white">{fulfillment.customer_name}</p>
                      {fulfillment.customer_phone && (
                        <a
                          href={`tel:${fulfillment.customer_phone}`}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold flex items-center gap-1 hover:bg-emerald-900 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{fulfillment.customer_phone}</span>
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {fulfillment.delivery_address ? `${fulfillment.delivery_address}, ` : ''}
                      {fulfillment.customer_area}
                      {fulfillment.delivery_city ? `, ${fulfillment.delivery_city}` : ''}
                    </p>
                    {fulfillment.notes && (
                      <p className="text-xs text-amber-300 mt-2 p-2 rounded-lg bg-amber-950/40 border border-amber-900/60">
                        <strong>Note:</strong> {fulfillment.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items & Payout Card */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {language === 'ne' ? 'सामान सूची' : 'Items to Dispatch'} ({fulfillment.items_count ?? fulfillment.items?.length ?? 0})
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      Net Payout: {formatPrice(fulfillment.net_payout)}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {fulfillment.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-200">
                          <strong>{it.quantity}x</strong> {it.product_name}{' '}
                          <span className="text-slate-400">({it.unit})</span>
                        </span>
                        <span className="text-slate-300 font-mono">{formatPrice(it.total ?? it.total_price ?? (it.unit_price * it.quantity))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking Milestones Timeline */}
                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4">
                  <OrderTrackingTimeline
                    steps={track.order?.tracking_updates || []}
                    assignment={track.assignment}
                    isCancelled={isCancelled}
                    t={track.t}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
