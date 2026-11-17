import React from 'react';
import { Download } from 'lucide-react';
import { adminService } from '../../services';
import {
  AdminPaymentItem,
  AdminRefundItem,
  AdminSettlementItem,
  AdminVendorBalance,
} from '../../types';

interface AdminPaymentsTabProps {
  paymentsList: AdminPaymentItem[];
  loading: boolean;
  formatPrice: (n: number) => string;
}

export function AdminPaymentsTab({ paymentsList, loading, formatPrice }: AdminPaymentsTabProps) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
      {loading ? (
        <p className="text-center py-10 text-slate-400">Loading payment transactions...</p>
      ) : paymentsList.length === 0 ? (
        <p className="text-center py-10 text-slate-400">No payment transactions recorded yet.</p>
      ) : (
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
              <th className="pb-2">Order</th>
              <th className="pb-2">Customer</th>
              <th className="pb-2">Method</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Gateway Ref</th>
              <th className="pb-2">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {paymentsList.map((pay) => (
              <tr key={pay.id}>
                <td className="py-2.5 font-bold text-white">{pay.order_number}</td>
                <td className="py-2.5 text-slate-300">{pay.customer_name}</td>
                <td className="py-2.5 font-mono text-indigo-300">{pay.method}</td>
                <td className="py-2.5 font-mono font-bold text-emerald-400">{formatPrice(pay.amount)}</td>
                <td className="py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      pay.status === 'paid'
                        ? 'bg-emerald-950 text-emerald-300'
                        : pay.status === 'refunded'
                        ? 'bg-rose-950 text-rose-300'
                        : 'bg-amber-950 text-amber-300'
                    }`}
                  >
                    {pay.status}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-xs text-slate-400">{pay.gateway_ref_id || '-'}</td>
                <td className="py-2.5 text-xs text-slate-500">
                  {pay.created_at ? new Date(pay.created_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface AdminRefundsTabProps {
  refunds: AdminRefundItem[];
  formatPrice: (n: number) => string;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminRefundsTab({ refunds, formatPrice, onRefresh, showToast }: AdminRefundsTabProps) {
  return (
    <div className="space-y-3">
      {refunds.length === 0 ? (
        <p className="text-center py-10 text-slate-400">No refund requests submitted.</p>
      ) : (
        refunds.map((rf) => (
          <div
            key={rf.id}
            className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <span className="font-bold text-white">
                {rf.order_number} · {formatPrice(rf.amount)}
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                {rf.customer_name} — {rf.reason}
              </p>
              <span className="text-xs uppercase font-bold text-amber-400">Status: {rf.status}</span>
            </div>
            {rf.status === 'requested' && (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await adminService.updateAdminRefund(rf.id, 'processed', 'Approved & processed by Admin');
                    showToast('Refund processed', 'success');
                    onRefresh();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                >
                  Approve & Process
                </button>
                <button
                  onClick={async () => {
                    await adminService.updateAdminRefund(rf.id, 'rejected', 'Rejected after review');
                    showToast('Refund rejected', 'info');
                    onRefresh();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold cursor-pointer"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

interface AdminSettlementsTabProps {
  vendorBalances: AdminVendorBalance[];
  settlements: AdminSettlementItem[];
  formatPrice: (n: number) => string;
  onExportCsv: () => void;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function AdminSettlementsTab({
  vendorBalances,
  settlements,
  formatPrice,
  onExportCsv,
  onRefresh,
  showToast,
}: AdminSettlementsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Vendor Balances & Settlement Payouts</h2>
        <button
          onClick={onExportCsv}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vendorBalances.map((vb) => (
          <div key={vb.vendor_id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">{vb.vendor_name}</span>
              <span className="text-xs text-slate-400">
                Gross {formatPrice(vb.gross_sales)} · Commission ({vb.commission_rate}%) {formatPrice(vb.commission)}
              </span>
              <span className="text-sm font-bold text-emerald-400 block mt-1">
                Unsettled Balance: {formatPrice(vb.net_balance)}
              </span>
            </div>
            <button
              disabled={vb.net_balance <= 0}
              onClick={async () => {
                await adminService.generateSettlement(vb.vendor_id);
                showToast(`Settlement generated for ${vb.vendor_name}`, 'success');
                onRefresh();
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
            >
              Generate Payout
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {settlements.map((s) => (
          <div key={s.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-sm">
            <div>
              <span className="font-bold text-white">
                {s.vendor_name} · Net {formatPrice(s.netPayout)}
              </span>
              <span className="text-xs text-slate-400 block">
                Status: {s.status} {s.payoutReference ? `· Ref: ${s.payoutReference}` : ''}
              </span>
            </div>
            {s.status === 'pending' && (
              <button
                onClick={async () => {
                  await adminService.paySettlement(s.id);
                  showToast('Settlement marked PAID & ledger updated', 'success');
                  onRefresh();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                Mark Paid
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
