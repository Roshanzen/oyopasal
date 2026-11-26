import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, RefreshCw, Truck, XCircle } from 'lucide-react';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import { translateOrderStatus } from '../../i18n';
import OrderTrackingMapCard from '../../components/orders/OrderTrackingMapCard';
import OrderTrackingTimeline from '../../components/orders/OrderTrackingTimeline';
import OrderReceiptSidebar from '../../components/orders/OrderReceiptSidebar';

export default function OrderTrackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const track = useOrderTracking(id);

  if (track.loading) {
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

  if (!track.order) {
    return (
      <div className="w-full py-24 px-4 text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{track.t('track.notFoundTitle')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {track.loadError
            ? track.loadError
            : !track.user
            ? track.language === 'ne'
              ? 'अर्डर ट्र्याक हेर्न कृपया लगइन गर्नुहोस्।'
              : 'Please sign in to access your private order tracking telemetry.'
            : track.t('track.notFoundSub')}
        </p>
        <div className="flex items-center justify-center gap-3">
          {track.loadError && (
            <button
              type="button"
              onClick={() => track.fetchOrderAndTracking(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          )}
          {!track.user && (
            <button
              onClick={() => track.setLoginModalOpen(true)}
              className="px-6 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm cursor-pointer"
            >
              {track.t('header.signIn')}
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm cursor-pointer"
          >
            {track.t('track.returnHome')}
          </button>
        </div>
      </div>
    );
  }

  const order = track.order;
  const isDelivered = order.status === 'DELIVERED';
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/account?tab=orders');
              }
            }}
            className="p-2.5 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
                {track.t('track.orderPrefix', { number: order.order_number })}
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
                {translateOrderStatus(order.status, track.language)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {track.t('track.placedGpsActive', {
                time: new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => track.fetchOrderAndTracking(false)}
            className="text-sm font-bold text-emerald-700 dark:text-emerald-300 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${track.refreshing ? 'animate-spin' : ''}`} />
            <span>{track.language === 'ne' ? 'लाइभ रिफ्रेस' : 'Refresh GPS'}</span>
          </button>

          {!isDelivered && !isCancelled && !['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY'].includes(order.status) && (
            <button
              onClick={() => track.setShowCancelModal(true)}
              className="text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              {track.t('track.cancelOrder')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          {!isDelivered && !isCancelled ? (
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-sm text-emerald-100 font-bold uppercase tracking-wider mb-1">
                  <Clock className="w-4 h-4" />
                  <span>
                    {track.assignment
                      ? track.t('track.liveEta')
                      : track.language === 'ne'
                      ? 'राइडर खटाइने प्रतीक्षामा'
                      : 'Awaiting Store Packing & Rider Dispatch'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold font-display tabular-nums">
                  {track.etaDisplay} · {track.remainingDistanceKm.toFixed(2)}{' '}
                  {track.language === 'ne' ? 'कि.मि.' : 'km'}
                </h2>
                <p className="text-sm text-emerald-100 mt-1">
                  {track.assignment?.agent
                    ? `${track.assignment.agent.full_name} (${track.assignment.agent.vehicle_number}) → `
                    : `${track.t('track.agentMovingTo')} `}
                  <strong className="text-white">
                    {track.targetSavedAddress?.title} ({track.targetSavedAddress?.area})
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
                <span>{track.t('track.completed')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-900 dark:text-white">
                {track.t('track.deliveredToTitle', { title: track.targetSavedAddress?.title || 'Saved Address' })}
              </h2>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                {track.t('track.deliveredSub', {
                  street: track.targetSavedAddress?.street || '',
                  area: track.targetSavedAddress?.area || '',
                })}
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200">
              <h2 className="text-2xl font-extrabold text-rose-900 dark:text-rose-200">
                {track.t('track.cancelledTitle')}
              </h2>
              <p className="text-sm text-rose-700 dark:text-rose-300 mt-1">{track.t('track.cancelledSub')}</p>
            </div>
          )}

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
            language={track.language}
            t={track.t}
            onToggleFollowRider={() => track.setFollowRider((v) => !v)}
            onFitFullRoute={() => {
              track.setFollowRider(false);
              track.setFitTrigger((c) => c + 1);
            }}
            onSelectMarkerInfo={track.setActiveMarkerInfo}
            onRouteMetricsComputed={track.handleRouteMetricsComputed}
          />

          <OrderTrackingTimeline
            steps={order.tracking_updates || []}
            assignment={track.assignment}
            isCancelled={isCancelled}
            t={track.t}
            order={order}
          />
        </div>

        <OrderReceiptSidebar
          order={order}
          addresses={track.addresses}
          selectedSavedAddressId={track.selectedSavedAddressId}
          targetSavedAddress={track.targetSavedAddress}
          riderPosition={track.riderPosition}
          hubCoords={track.hubInfo.coords}
          currentCoordinates={track.currentCoordinates}
          t={track.t}
          formatPrice={track.formatPrice}
          onSelectAddress={(addrId) => {
            track.setSelectedSavedAddressId(addrId);
            track.setActiveMarkerInfo('destination');
          }}
        />
      </div>

      {track.showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => track.setShowCancelModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
          <div className="relative bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full z-10 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{track.t('track.cancelModalTitle')}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {track.t('track.cancelModalSub', { number: order.order_number })}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => track.setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm cursor-pointer"
              >
                {track.t('track.keepOrder')}
              </button>
              <button
                onClick={track.handleCancelOrder}
                disabled={track.cancelling}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer"
              >
                {track.cancelling ? track.t('track.cancelling') : track.t('track.yesCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
