import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, RotateCcw, Store } from 'lucide-react';
import { translateOrderStatus, TranslatorFn } from '../../i18n';
import { Language, Order, UserProfile } from '../../types';

interface OrdersTabProps {
  user: UserProfile | null;
  orders: Order[];
  loadingOrders: boolean;
  reorderingId: string | null;
  language: Language;
  t: TranslatorFn;
  formatPrice: (n: number) => string;
  onOpenLogin: () => void;
  onReorder: (orderId: string) => void;
  onRequestRefund: (order: Order) => void;
}

export default function OrdersTab({
  user,
  orders,
  loadingOrders,
  reorderingId,
  language,
  t,
  formatPrice,
  onOpenLogin,
  onReorder,
  onRequestRefund,
}: OrdersTabProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{t('account.pastOrdersTitle')}</h2>
      {!user ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-sm text-slate-500">Please sign in to inspect your order history.</p>
          <button
            onClick={onOpenLogin}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm cursor-pointer"
          >
            {t('header.signIn')}
          </button>
        </div>
      ) : loadingOrders ? (
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
      ) : orders.length > 0 ? (
        orders.map((o) => (
          <div
            key={o.id}
            className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-slate-900 dark:text-white">{o.order_number}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                    {translateOrderStatus(o.status, language)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('account.placedAt', {
                    date: new Date(o.created_at).toLocaleDateString(),
                    time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  })}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => onReorder(o.id)}
                  disabled={reorderingId === o.id}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'ne' ? 'फेरि अर्डर' : 'Reorder'}</span>
                </button>
                {o.status !== 'CANCELLED' && (
                  <button
                    onClick={() => onRequestRefund(o)}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold cursor-pointer"
                  >
                    {language === 'ne' ? 'फिर्ता अनुरोध' : 'Request Refund'}
                  </button>
                )}
                <Link
                  to={`/orders/${o.id}`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5"
                >
                  <span>{t('account.liveTracking')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {o.items_by_vendor.map((vg, idx) => (
                <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{vg.vendor.name}:</span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    {vg.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-500">
                {t('account.totalPaid')}{' '}
                <strong className="text-slate-900 dark:text-white font-bold">{formatPrice(o.total_amount)}</strong> (
                {o.payment_method.replace(/_/g, ' ')} · {o.payment_status})
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('account.noOrdersTitle')}</h3>
          <p className="text-sm text-slate-400">{t('account.noOrdersSub')}</p>
        </div>
      )}
    </div>
  );
}
