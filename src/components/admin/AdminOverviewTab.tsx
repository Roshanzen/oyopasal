import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminOverviewResponse } from '../../types';

interface AdminOverviewTabProps {
  overview: AdminOverviewResponse | null;
  loading: boolean;
  dateFrom: string;
  dateTo: string;
  onChangeDateFrom: (v: string) => void;
  onChangeDateTo: (v: string) => void;
  onClearDates: () => void;
  formatPrice: (n: number) => string;
}

export default function AdminOverviewTab({
  overview,
  loading,
  dateFrom,
  dateTo,
  onChangeDateFrom,
  onChangeDateTo,
  onClearDates,
  formatPrice,
}: AdminOverviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase text-slate-400">Date Range Filter</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onChangeDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
          />
          <span className="text-xs text-slate-500">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onChangeDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={onClearDates}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && !overview ? (
        <div className="p-12 text-center text-sm text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
          Loading platform overview metrics...
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Total GMV</span>
              <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
                {formatPrice(overview.kpis.total_gmv)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Total / Pending Orders</span>
              <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                {overview.kpis.total_orders}{' '}
                <span className="text-sm text-amber-400">({overview.kpis.pending_orders} live)</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Active Stores / Pending KYC</span>
              <p className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
                {overview.kpis.active_vendors} / {overview.kpis.pending_seller_approvals}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Platform Commission</span>
              <p className="text-2xl font-extrabold text-indigo-400 mt-1 font-mono">
                {formatPrice(overview.kpis.platform_commission ?? 0)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Pending Products / Low Stock</span>
              <p className="text-2xl font-extrabold text-sky-400 mt-1 font-mono">
                {overview.kpis.pending_products ?? 0} /{' '}
                <span className="text-rose-400">{overview.kpis.low_stock_products ?? 0}</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Total Users / Customers</span>
              <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                {overview.kpis.total_users ?? 0} / {overview.kpis.total_customers ?? 0}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Processed Refunds / Open</span>
              <p className="text-2xl font-extrabold text-rose-400 mt-1 font-mono">
                {formatPrice(overview.kpis.total_refunds ?? 0)} ({overview.kpis.pending_refunds})
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-bold">Fleet Riders (Avail/Busy/Total)</span>
              <p className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                {overview.kpis.delivery_agent_stats?.available ?? 0} /{' '}
                {overview.kpis.delivery_agent_stats?.busy ?? 0} /{' '}
                {overview.kpis.delivery_agent_stats?.total ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
            <h2 className="text-base font-bold text-white mb-4">Daily Order Revenue Trend (PostgreSQL)</h2>
            {overview.revenue_series?.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.revenue_series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-10 text-center">No non-cancelled orders recorded in this range.</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
