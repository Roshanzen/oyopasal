import React from 'react';
import { InventoryMovementItem, Language } from '../../types';

interface SellerLedgerTabProps {
  movements: InventoryMovementItem[];
  language: Language;
  onRefresh: () => void;
}

export default function SellerLedgerTab({ movements, language, onRefresh }: SellerLedgerTabProps) {
  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white">
            {language === 'ne' ? 'स्टक भित्र/बाहिर खाता (Audit Ledger)' : 'Stock Movement Audit Ledger'}
          </h2>
          <p className="text-sm text-slate-400">
            {language === 'ne'
              ? 'अर्डर कट्टी र रिस्टकको वास्तविक PostgreSQL अभिलेख'
              : 'Immutable PostgreSQL record of order deductions and restocks'}
          </p>
        </div>
        <button onClick={onRefresh} className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 cursor-pointer">
          {language === 'ne' ? 'रिफ्रेस' : 'Refresh'}
        </button>
      </div>

      {movements.length === 0 ? (
        <p className="py-10 text-center text-slate-400">
          {language === 'ne' ? 'कुनै स्टक गतिविधि रेकर्ड छैन।' : 'No inventory movements recorded yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">Reason</th>
                <th className="pb-2">Delta</th>
                <th className="pb-2">Stock Change</th>
                <th className="pb-2">Note</th>
                <th className="pb-2">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5 font-semibold text-white">{m.product_name}</td>
                  <td className="py-2.5 text-xs uppercase text-slate-300">{m.reason}</td>
                  <td className={`py-2.5 font-mono font-bold ${m.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {m.delta >= 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="py-2.5 font-mono text-slate-300">
                    {m.previous_stock} → {m.new_stock}
                  </td>
                  <td className="py-2.5 text-xs text-slate-400">{m.note || m.reference_id || '-'}</td>
                  <td className="py-2.5 text-xs text-slate-500">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
