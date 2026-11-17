import React from 'react';
import { CreditCard, Minus, Plus, RefreshCw, Zap } from 'lucide-react';
import { ChatOrderPreview, Language } from '../../types';

interface ChatDirectOrderCardProps {
  preview: ChatOrderPreview;
  language: Language;
  assignedLocationLabel: string;
  isAuthenticated: boolean;
  isPlacing: boolean;
  formatPrice: (amount: number) => string;
  onUpdatePreview: (updater: (prev: ChatOrderPreview) => ChatOrderPreview) => void;
  onConfirmPurchase: () => void;
}

export default function ChatDirectOrderCard({
  preview,
  language,
  assignedLocationLabel,
  isAuthenticated,
  isPlacing,
  formatPrice,
  onUpdatePreview,
  onConfirmPurchase,
}: ChatDirectOrderCardProps) {
  return (
    <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300/70 dark:border-emerald-800/80 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>{language === 'ne' ? 'तुरुन्तै अर्डर सारांश' : 'Direct Purchase to Assigned Address'}</span>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
          ~{preview.estimated_mins} mins
        </span>
      </div>

      <div className="space-y-1.5">
        {preview.items.map((item) => (
          <div
            key={item.product_id}
            className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-800"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {item.vendor_name} · {formatPrice(item.unit_price)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onUpdatePreview((prev) => ({
                    ...prev,
                    items: prev.items.map((it) =>
                      it.product_id === item.product_id
                        ? {
                            ...it,
                            quantity: Math.max(1, it.quantity - 1),
                            line_total: it.unit_price * Math.max(1, it.quantity - 1),
                          }
                        : it
                    ),
                  }))
                }
                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-extrabold w-4 text-center">{item.quantity}</span>
              <button
                type="button"
                onClick={() =>
                  onUpdatePreview((prev) => ({
                    ...prev,
                    items: prev.items.map((it) =>
                      it.product_id === item.product_id
                        ? {
                            ...it,
                            quantity: Math.min(it.stock, it.quantity + 1),
                            line_total: it.unit_price * Math.min(it.stock, it.quantity + 1),
                          }
                        : it
                    ),
                  }))
                }
                className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[11px]">
        {(['CASH_ON_DELIVERY', 'ESEWA', 'KHALTI'] as const).map((pm) => {
          const active = preview.payment_method === pm;
          return (
            <button
              key={pm}
              type="button"
              onClick={() => onUpdatePreview((prev) => ({ ...prev, payment_method: pm }))}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {pm === 'CASH_ON_DELIVERY' ? 'COD' : pm === 'ESEWA' ? 'eSewa' : 'Khalti'}
            </button>
          );
        })}
      </div>

      <div className="text-xs space-y-1 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/60">
        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>{language === 'ne' ? 'डेलिभरी ठेगाना' : 'Assigned Delivery'}</span>
          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[180px]">
            {assignedLocationLabel}
          </span>
        </div>
        <div className="flex justify-between text-slate-600 dark:text-slate-300">
          <span>{language === 'ne' ? 'डेलिभरी शुल्क' : 'Delivery Fee'}</span>
          <span className="font-semibold">
            {preview.delivery_fee === 0 ? 'FREE' : formatPrice(preview.delivery_fee)}
          </span>
        </div>
        {preview.discount > 0 && (
          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
            <span>Coupon ({preview.coupon_code})</span>
            <span>-{formatPrice(preview.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-1">
          <span>{language === 'ne' ? 'कुल जम्मा' : 'Total Payable'}</span>
          <span className="text-emerald-700 dark:text-emerald-400">{formatPrice(preview.total_amount)}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={isPlacing}
        onClick={onConfirmPurchase}
        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
      >
        {isPlacing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
        <span>
          {isPlacing
            ? language === 'ne'
              ? 'अर्डर राखिँदैछ...'
              : 'Placing Order...'
            : !isAuthenticated
            ? language === 'ne'
              ? 'साइन इन गरी तुरुन्तै किन्नुहोस्'
              : `Sign in & Order • ${formatPrice(preview.total_amount)}`
            : language === 'ne'
            ? `अर्डर पक्का गर्नुहोस् • ${formatPrice(preview.total_amount)}`
            : `Confirm & Buy Now • ${formatPrice(preview.total_amount)}`}
        </span>
      </button>
    </div>
  );
}
