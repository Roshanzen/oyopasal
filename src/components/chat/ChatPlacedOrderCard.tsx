import React from 'react';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { PendingGatewayPayment } from '../../hooks/useChatConcierge';
import { Language, Order } from '../../types';

interface ChatPlacedOrderCardProps {
  order: Order;
  language: Language;
  assignedLocationLabel: string;
  pendingPayment?: PendingGatewayPayment | null;
  paymentVerified?: boolean;
  isVerifying: boolean;
  formatPrice: (amount: number) => string;
  onVerifyPayment: () => void;
  onTrackOrder: () => void;
}

export default function ChatPlacedOrderCard({
  order,
  language,
  assignedLocationLabel,
  pendingPayment,
  paymentVerified,
  isVerifying,
  formatPrice,
  onVerifyPayment,
  onTrackOrder,
}: ChatPlacedOrderCardProps) {
  return (
    <div className="p-3 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-500/40 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>Order Confirmed: {order.order_number}</span>
        </div>
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
          {formatPrice(order.total_amount)}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Delivering to <strong>{order.delivery_address?.area || assignedLocationLabel}</strong> (
        {order.estimated_delivery_mins || 12} mins) · {order.payment_method}
      </p>

      {pendingPayment && !paymentVerified && (
        <button
          type="button"
          disabled={isVerifying}
          onClick={onVerifyPayment}
          className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{isVerifying ? 'Verifying...' : `Authorize ${pendingPayment.method} Payment`}</span>
        </button>
      )}

      <button
        type="button"
        onClick={onTrackOrder}
        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>{language === 'ne' ? 'लाइभ अर्डर ट्र्याक गर्नुहोस्' : 'Track Live Order'}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
