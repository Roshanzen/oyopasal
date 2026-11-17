import React from 'react';
import { AdminSellerItem } from '../../types';

interface AdminSellersTabProps {
  sellers: AdminSellerItem[];
  loading: boolean;
  onApprove: (vendorDbId: number, vendorName: string, status: 'approved' | 'suspended') => void;
  onToggleCommission: (vendorDbId: number, currentRate: number) => void;
}

export default function AdminSellersTab({
  sellers,
  loading,
  onApprove,
  onToggleCommission,
}: AdminSellersTabProps) {
  if (loading) {
    return <p className="text-center py-10 text-slate-400">Loading sellers...</p>;
  }
  if (sellers.length === 0) {
    return <p className="text-center py-10 text-slate-400">No sellers registered yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sellers.map((v) => (
        <div
          key={v.db_id || v.id}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-white">{v.name}</span>
              <span
                className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                  v.approval_status === 'approved'
                    ? 'bg-emerald-950 text-emerald-300'
                    : v.approval_status === 'pending'
                    ? 'bg-amber-950 text-amber-300'
                    : 'bg-rose-950 text-rose-300'
                }`}
              >
                {v.approval_status}
              </span>
              <span className="text-xs font-mono text-slate-400">Commission: {v.commission_rate ?? 10}%</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {v.area} · {v.email} · {v.phone}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {v.approval_status !== 'approved' && (
              <button
                onClick={() => onApprove(v.db_id, v.name, 'approved')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Approve Store
              </button>
            )}
            {v.approval_status !== 'suspended' && (
              <button
                onClick={() => onApprove(v.db_id, v.name, 'suspended')}
                className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold cursor-pointer"
              >
                Suspend
              </button>
            )}
            <button
              onClick={() => onToggleCommission(v.db_id, v.commission_rate ?? 10)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer"
            >
              Toggle Rate (10%/12%)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
