import React from 'react';
import { Briefcase, Home, MapPin, Store } from 'lucide-react';
import { LatLng, resolveAddressCoords } from '../../hooks/useOrderTracking';
import { TranslatorFn } from '../../i18n';
import { Address, Order } from '../../types';
import { calculateDistanceInKm } from '../../utils';

interface OrderReceiptSidebarProps {
  order: Order;
  addresses: Address[];
  selectedSavedAddressId: string;
  targetSavedAddress: Address | null;
  riderPosition: LatLng | null;
  hubCoords: LatLng;
  currentCoordinates: LatLng;
  t: TranslatorFn;
  formatPrice: (n: number) => string;
  onSelectAddress: (id: string) => void;
}

export default function OrderReceiptSidebar({
  order,
  addresses,
  selectedSavedAddressId,
  targetSavedAddress,
  riderPosition,
  hubCoords,
  currentCoordinates,
  t,
  formatPrice,
  onSelectAddress,
}: OrderReceiptSidebarProps) {
  const refPos = riderPosition || hubCoords;
  const deliveryAddr = order?.delivery_address || {
    id: 'addr-order',
    title: 'Order Address',
    street: '',
    area: '',
    city: 'Kathmandu',
    phone: '',
    recipient_name: 'Customer',
    is_default: true,
  };
  const orderAddrCoords = resolveAddressCoords(order?.delivery_address, currentCoordinates);
  const orderAddrDist = calculateDistanceInKm(refPos.lat, refPos.lng, orderAddrCoords.lat, orderAddrCoords.lng);

  return (
    <div className="xl:col-span-4 space-y-6">
      <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide">
          {t('track.relativeTitle')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('track.relativeSub')}</p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onSelectAddress('order')}
            className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              selectedSavedAddressId === 'order'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500'
                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  Order Address ({deliveryAddr.title || 'Selected Pin'})
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                  {deliveryAddr.street || ''}{deliveryAddr.area ? `, ${deliveryAddr.area}` : ''}
                </span>
              </div>
            </div>
            <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
              {orderAddrDist.toFixed(2)} km
            </span>
          </button>

          {(addresses || []).map((addr) => {
            const addrCoords = resolveAddressCoords(addr, currentCoordinates);
            const distFromRef = calculateDistanceInKm(refPos.lat, refPos.lng, addrCoords.lat, addrCoords.lng);
            return (
              <button
                key={addr.id}
                type="button"
                onClick={() => onSelectAddress(addr.id)}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  selectedSavedAddressId === addr.id
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {addr.title?.toLowerCase().includes('office') ? (
                    <Briefcase className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  ) : (
                    <Home className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{addr.title || 'Saved Location'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                      {addr.street || ''}{addr.area ? `, ${addr.area}` : ''}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0 ml-2">
                  {distFromRef.toFixed(2)} km
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-2">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide">{t('track.activePinDest')}</h3>
        <div className="flex items-start gap-2.5 pt-1">
          <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              {targetSavedAddress?.title} ({targetSavedAddress?.recipient_name})
            </p>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              {targetSavedAddress?.street}, {targetSavedAddress?.area}, {targetSavedAddress?.city}
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
              {t('track.phoneLabel', { phone: targetSavedAddress?.phone || '' })}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-100 dark:border-slate-800">
          {t('track.orderReceipt')}
        </h3>
        {(order.items_by_vendor || []).map((vendorGroup, idx) => (
          <div key={idx} className="space-y-2 text-sm">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
              <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{vendorGroup?.vendor?.name || 'Local Store'}</span>
            </div>
            {(vendorGroup?.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-slate-600 dark:text-slate-400 pl-5">
                <span className="truncate max-w-[200px]">
                  {item.quantity}x {item.product_name}
                </span>
                <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                  {formatPrice(item.total)}
                </span>
              </div>
            ))}
          </div>
        ))}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{t('track.subtotal')}</span>
            <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{t('track.deliveryCharge')}</span>
            <span className="tabular-nums text-slate-800 dark:text-slate-200">
              {order.delivery_fee === 0 ? t('common.free') : formatPrice(order.delivery_fee)}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>{t('track.handlingFee')}</span>
            <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatPrice(order.handling_fee)}</span>
          </div>
          {order.coupon_discount > 0 && (
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
              <span>{t('track.couponDiscount')}</span>
              <span className="tabular-nums">- {formatPrice(order.coupon_discount)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-extrabold text-base text-slate-900 dark:text-white">
            <span>{t('track.totalPaid')}</span>
            <span className="text-lg text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatPrice(order.total_amount)}
            </span>
          </div>
        </div>
        <div className="pt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('track.paymentLabel')}{' '}
          <strong className="text-slate-800 dark:text-slate-200">{(order?.payment_method || 'COD').replace(/_/g, ' ')}</strong> (
          {order?.payment_status || 'PENDING'})
        </div>
      </div>
    </div>
  );
}
