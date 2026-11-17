import React from 'react';
import { AdminRiderItem, Order } from '../../types';

interface AdminOrdersDispatchTabProps {
  orders: Order[];
  riders: AdminRiderItem[];
  loading: boolean;
  selectedRiderByOrder: Record<string, number>;
  onSelectRider: (orderId: string, riderId: number) => void;
  onAssignRider: (orderId: string, orderNumber: string) => void;
  formatPrice: (n: number) => string;
}

export default function AdminOrdersDispatchTab({
  orders,
  riders,
  loading,
  selectedRiderByOrder,
  onSelectRider,
  onAssignRider,
  formatPrice,
}: AdminOrdersDispatchTabProps) {
  if (loading) {
    return <p className="text-center py-10 text-slate-400">Loading orders...</p>;
  }
  if (orders.length === 0) {
    return <p className="text-center py-10 text-slate-400">No orders placed yet.</p>;
  }

  return (
    <div className="space-y-3">
      {orders.map((ord) => (
        <div
          key={ord.id}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">{ord.order_number}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold">{ord.status}</span>
              <span className="text-xs text-emerald-400 font-mono">{formatPrice(ord.total_amount)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {ord.delivery_address?.recipient_name} · {ord.delivery_address?.street}, {ord.delivery_address?.area} ·{' '}
              {ord.payment_method} ({ord.payment_status})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedRiderByOrder[ord.id] || riders[0]?.id || ''}
              onChange={(e) => onSelectRider(ord.id, Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.vehicleNumber} · {r.availabilityStatus})
                </option>
              ))}
            </select>
            <button
              onClick={() => onAssignRider(ord.id, ord.order_number)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              Assign Rider
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
