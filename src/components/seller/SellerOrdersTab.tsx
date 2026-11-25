import React, { useState } from 'react';
import { AlertCircle, Navigation, RefreshCw } from 'lucide-react';
import { translateOrderStatus, TranslatorFn } from '../../i18n';
import { Language, SellerFulfillmentItem } from '../../types';
import SellerOrderTrackingModal from './SellerOrderTrackingModal';

interface SellerOrdersTabProps {
  vendorName: string;
  sellerOrders: SellerFulfillmentItem[];
  loadingOrders: boolean;
  ordersError: string | null;
  orderStatusFilter: 'all' | 'pending' | 'packed' | 'dispatched';
  setOrderStatusFilter: (f: 'all' | 'pending' | 'packed' | 'dispatched') => void;
  updatingOrderId: string | number | null;
  language: Language;
  formatPrice: (n: number) => string;
  t: TranslatorFn;
  onRefresh: () => void;
  onSwitchStore: () => void;
  onUpdateStatus: (
    fulfillmentId: string | number,
    nextStatus: 'CONFIRMED_BY_VENDOR' | 'PACKED_BY_VENDOR' | 'READY_FOR_RIDER_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'REJECTED'
  ) => void;
}

export default function SellerOrdersTab({
  vendorName,
  sellerOrders = [],
  loadingOrders,
  ordersError,
  orderStatusFilter,
  setOrderStatusFilter,
  updatingOrderId,
  language,
  formatPrice,
  t,
  onRefresh,
  onSwitchStore,
  onUpdateStatus,
}: SellerOrdersTabProps) {
  const [trackingFulfillment, setTrackingFulfillment] = useState<SellerFulfillmentItem | null>(null);
  const safeOrders = Array.isArray(sellerOrders) ? sellerOrders : [];

  const filterOptions: { id: 'all' | 'pending' | 'packed' | 'dispatched'; label: string }[] = [
    { id: 'all', label: language === 'ne' ? `सबै (${safeOrders.length})` : `All Orders (${safeOrders.length})` },
    {
      id: 'pending',
      label:
        language === 'ne'
          ? `नयाँ / बाँकी (${safeOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'CONFIRMED', 'PENDING', 'PROCESSING'].includes(o.status)).length})`
      : `New / Pending (${safeOrders.filter((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'CONFIRMED', 'PENDING', 'PROCESSING'].includes(o.status)).length})`,
    },
{
  id: 'packed',
    label:
  language === 'ne'
          ? `प्याक तयार (${safeOrders.filter((o) => ['PACKED_BY_VENDOR', 'PACKED', 'READY_FOR_RIDER_PICKUP', 'READY_FOR_DISPATCH'].includes(o.status)).length})`
      : `Packed & Ready (${safeOrders.filter((o) => ['PACKED_BY_VENDOR', 'PACKED', 'READY_FOR_RIDER_PICKUP', 'READY_FOR_DISPATCH'].includes(o.status)).length})`,
    },
{
  id: 'dispatched',
    label:
  language === 'ne'
          ? `पठाइएको / सम्पन्न (${safeOrders.filter((o) => ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SHIPPED', 'CANCELLED', 'REJECTED'].includes(o.status)).length})`
      : `Dispatched / Done (${safeOrders.filter((o) => ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SHIPPED', 'CANCELLED', 'REJECTED'].includes(o.status)).length})`,
    },
  ];

  const filteredOrders = safeOrders.filter((ord) => {
    if (orderStatusFilter === 'pending') {
      return ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'CONFIRMED', 'PENDING', 'PROCESSING'].includes(ord.status);
    }
    if (orderStatusFilter === 'packed') {
      return ['PACKED_BY_VENDOR', 'PACKED', 'READY_FOR_RIDER_PICKUP', 'READY_FOR_DISPATCH'].includes(ord.status);
    }
    if (orderStatusFilter === 'dispatched') {
      return ['RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SHIPPED', 'CANCELLED', 'REJECTED'].includes(ord.status);
    }
    return true;
  });

  return (
    <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t('seller.liveDispatchTitle')}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-slate-700">
              {vendorName}
            </span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('seller.liveDispatchSub')}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
          <span>{language === 'ne' ? 'अर्डर रिफ्रेस' : 'Refresh Queue'}</span>
        </button>
      </div>

      {ordersError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>{ordersError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={onSwitchStore}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Switch Store
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {filterOptions.map((flt) => (
          <button
            key={flt.id}
            type="button"
            onClick={() => setOrderStatusFilter(flt.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              orderStatusFilter === flt.id
                ? 'bg-[#059669] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            {flt.label}
          </button>
        ))}
      </div>

        { loadingOrders && safeOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl space-y-2">
            <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ne'
                ? `"${vendorName}" को लागि हाल कुनै अर्डर भेटिएन।`
                : `No matching customer orders found for "${vendorName}".`}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {language === 'ne'
                ? 'अर्डरहरू ग्राहकले जुन पसलको सामान किनेका छन् त्यही पसलमा मात्र देखिन्छन्। यदि तपाईं अर्को पसलको अर्डर हेर्न चाहनुहुन्छ भने माथि "पसल बदल्नुहोस्" थिच्नुहोस्।'
                : 'Each customer order is routed to the store whose products were purchased. If you ordered from another store (e.g. Himalayan Fresh Farms vs Patan Artisan Bakery), click "Switch Store" above.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((ord) => (
              <div
                key={ord.fulfillment_id}
                className="p-4 sm:p-5 rounded-xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-base">{ord.order_number}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{new Date(ord.created_at).toLocaleString()}</span>
                    <span className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded font-semibold">
                      {translateOrderStatus(ord.status, language)}
                    </span>
                    <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                      {(ord.payment_method || 'COD').replace(/_/g, ' ')} · {ord.payment_status || 'UNPAID'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-800 dark:text-slate-100 font-semibold">
                  {Array.isArray(ord.items) && ord.items.length > 0
                      ? ord.items.map((i, idx) => (
                        <span key={i.id || idx} className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg">
                          <span>{i.quantity}x {i.product_name}</span>
                          {(i.color || i.size) && (
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
                              {[i.color, i.size].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 dark:text-slate-400">({i.unit})</span>
                        </span>
                      ))
                      : 'Order items attached'}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="text-slate-900 dark:text-slate-200 font-semibold">{ord.customer_name}</span>
                    {ord.customer_phone ? ` (${ord.customer_phone})` : ''} ·{' '}
                    {ord.delivery_address ? `${ord.delivery_address}, ` : ''}
                    {ord.customer_area}
                    {ord.delivery_city ? `, ${ord.delivery_city}` : ''}
                  </p>
                  {ord.notes && (
                    <p className="text-xs text-amber-800 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-2.5 py-1 inline-block">
                      Note: {ord.notes}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-emerald-600 dark:text-emerald-400">Net Payout: {formatPrice(ord.net_payout)}</strong> (Subtotal{' '}
                    {formatPrice(ord.subtotal)})
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {ord.status === 'ORDER_PLACED' && (
                    <>
                      <button
                        disabled={updatingOrderId === ord.fulfillment_id}
                        onClick={() => onUpdateStatus(ord.fulfillment_id, 'CONFIRMED_BY_VENDOR')}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                      >
                        {language === 'ne' ? 'पुष्टि गर्नुहोस्' : 'Confirm Order'}
                      </button>
                      <button
                        disabled={updatingOrderId === ord.fulfillment_id}
                        onClick={() => onUpdateStatus(ord.fulfillment_id, 'REJECTED')}
                        className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-bold cursor-pointer"
                      >
                        {language === 'ne' ? 'अस्वीकार' : 'Reject'}
                      </button>
                    </>
                  )}
                  {['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'CONFIRMED'].includes(ord.status) && (
                    <button
                      disabled={updatingOrderId === ord.fulfillment_id}
                      onClick={() => onUpdateStatus(ord.fulfillment_id, 'PACKED_BY_VENDOR')}
                      className="px-3 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'ne' ? 'प्याक तयार' : 'Mark Packed'}
                    </button>
                  )}
                  {['PACKED_BY_VENDOR', 'PACKED'].includes(ord.status) && (
                    <button
                      disabled={updatingOrderId === ord.fulfillment_id}
                      onClick={() => onUpdateStatus(ord.fulfillment_id, 'READY_FOR_RIDER_PICKUP')}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'ne' ? 'राइडर पिकअपको लागि तयार' : 'Ready for Rider Pickup'}
                    </button>
                  )}
                  {['READY_FOR_RIDER_PICKUP', 'READY_FOR_DISPATCH'].includes(ord.status) && (
                    <button
                      disabled={updatingOrderId === ord.fulfillment_id}
                      onClick={() => onUpdateStatus(ord.fulfillment_id, 'OUT_FOR_DELIVERY')}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'ne' ? 'डेलिभरीमा हिँड्यो' : 'Hand over to Rider / Out for Delivery'}
                    </button>
                  )}
                  {['OUT_FOR_DELIVERY', 'SHIPPED'].includes(ord.status) && (
                    <button
                      disabled={updatingOrderId === ord.fulfillment_id}
                      onClick={() => onUpdateStatus(ord.fulfillment_id, 'DELIVERED')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      {language === 'ne' ? 'डेलिभर भयो' : 'Mark Delivered'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTrackingFulfillment(ord)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="View Live GPS Tracking"
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'ne' ? 'लाइभ ट्र्याकिङ' : 'Live Tracking'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {trackingFulfillment && (
        <SellerOrderTrackingModal
          fulfillment={trackingFulfillment}
          vendorName={vendorName}
          language={language}
          formatPrice={formatPrice}
          onClose={() => setTrackingFulfillment(null)}
          onUpdateStatus={onUpdateStatus}
          updatingOrderId={updatingOrderId}
        />
      )}
    </div>
  );
}
