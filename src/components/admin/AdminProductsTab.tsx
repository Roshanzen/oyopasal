import React from 'react';
import { AdminProductItem } from '../../types';

interface AdminProductsTabProps {
  products: AdminProductItem[];
  loading: boolean;
  formatPrice: (n: number) => string;
  onToggleActive: (productId: number, isActive: boolean) => void;
}

export default function AdminProductsTab({
  products,
  loading,
  formatPrice,
  onToggleActive,
}: AdminProductsTabProps) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
      {loading ? (
        <p className="text-center py-10 text-slate-400">Loading products...</p>
      ) : (
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
              <th className="pb-2">Product</th>
              <th className="pb-2">Vendor</th>
              <th className="pb-2">Price / Stock</th>
              <th className="pb-2">Status</th>
              <th className="pb-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="py-2.5 font-semibold text-white">{p.name}</td>
                <td className="py-2.5 text-slate-400">{p.vendorName}</td>
                <td className="py-2.5 font-mono">
                  {formatPrice(p.price)} · {p.stockCount}
                </td>
                <td className="py-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      p.isActive ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                    }`}
                  >
                    {p.isActive ? p.approvalStatus : 'inactive'}
                  </span>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => onToggleActive(p.id, p.isActive)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {p.isActive ? 'Deactivate' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
