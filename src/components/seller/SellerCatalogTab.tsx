import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Package,
  PlusCircle,
  RefreshCw,
  Search,
  Sparkles,
  ToggleRight,
  Trash2,
} from 'lucide-react';
import { translateCategoryName, TranslatorFn } from '../../i18n';
import { Language, Product } from '../../types';

interface SellerCatalogTabProps {
  sellerProducts: Product[];
  lowStockItems: Product[];
  healthyItems: Product[];
  searchCatalogQuery: string;
  setSearchCatalogQuery: (q: string) => void;
  inventoryFilter: 'all' | 'low' | 'healthy';
  setInventoryFilter: (f: 'all' | 'low' | 'healthy') => void;
  loadingProducts: boolean;
  restockingId: string | null;
  restockingAll: boolean;
  language: Language;
  formatPrice: (n: number) => string;
  t: TranslatorFn;
  onRefresh: () => void;
  onRestock: (productId: string, addQty: number) => void;
  onRestockAllLow: () => void;
  onToggleStock: (productId: string) => void;
  onRequestDelete: (product: Product) => void;
  onOpenGallery: (product: Product) => void;
  onManageVariants?: (product: Product) => void;
}

export default function SellerCatalogTab({
  sellerProducts,
  lowStockItems,
  healthyItems,
  searchCatalogQuery,
  setSearchCatalogQuery,
  inventoryFilter,
  setInventoryFilter,
  loadingProducts,
  restockingId,
  restockingAll,
  language,
  formatPrice,
  t,
  onRefresh,
  onRestock,
  onRestockAllLow,
  onToggleStock,
  onRequestDelete,
  onOpenGallery,
  onManageVariants,
}: SellerCatalogTabProps) {
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  let filtered = sellerProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
      p.category.name.toLowerCase().includes(searchCatalogQuery.toLowerCase())
  );
  if (inventoryFilter === 'low') {
    filtered = filtered.filter((p) => p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock);
  } else if (inventoryFilter === 'healthy') {
    filtered = filtered.filter((p) => p.stock > (p.low_stock_threshold ?? 5) && p.in_stock);
  }

  return (
    <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
      {lowStockItems.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-rose-950/90 border border-red-700/80 text-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base sm:text-lg">{t('seller.lowAlertTitle')}</h3>
              <p className="text-sm text-red-200 mt-1">
                {lowStockItems.length}{' '}
                {language === 'ne'
                  ? 'सामान कम स्टक वा स्टक सकिएको अवस्थामा छ।'
                  : 'products are at critical stock or out of stock.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onRestockAllLow}
              disabled={restockingAll}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-red-950 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
            >
              {restockingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin text-red-700" />
              ) : (
                <PlusCircle className="w-4 h-4 text-red-700" />
              )}
              <span>{t('seller.restockAllLow')}</span>
            </button>
            <button
              onClick={() => setInventoryFilter(inventoryFilter === 'low' ? 'all' : 'low')}
              className="px-3.5 py-2.5 rounded-xl bg-red-900/80 hover:bg-red-800 text-white font-semibold text-sm border border-red-700/80 cursor-pointer"
            >
              {inventoryFilter === 'low' ? t('seller.showAllProducts') : t('seller.filterLowOnly')}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>{t('seller.inventoryTitle')}</span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">{t('seller.inventorySub')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchCatalogQuery}
              onChange={(e) => setSearchCatalogQuery(e.target.value)}
              placeholder={t('seller.searchCatalogPlaceholder')}
              className="pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-52 sm:w-64"
            />
          </div>
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setInventoryFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold cursor-pointer ${
            inventoryFilter === 'all' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 bg-slate-950/60'
          }`}
        >
          {t('seller.filterAll', { count: sellerProducts.length })}
        </button>
        <button
          onClick={() => setInventoryFilter('low')}
          className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold cursor-pointer ${
            inventoryFilter === 'low' ? 'bg-red-950 text-red-200 border border-red-800' : 'text-slate-400 bg-slate-950/60'
          }`}
        >
          {t('seller.filterLow', { count: lowStockItems.length })}
        </button>
        <button
          onClick={() => setInventoryFilter('healthy')}
          className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold cursor-pointer ${
            inventoryFilter === 'healthy' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 bg-slate-950/60'
          }`}
        >
          {t('seller.filterHealthy', { count: healthyItems.length })}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          {language === 'ne' ? 'कुनै सामान भेटिएन' : 'No matching catalog products found.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-xs">
                <th className="pb-3 font-semibold">{t('seller.colProduct')}</th>
                <th className="pb-3 font-semibold">{t('seller.colCategory')}</th>
                <th className="pb-3 font-semibold">{t('seller.colPrice')}</th>
                <th className="pb-3 font-semibold">{t('seller.colLevel')}</th>
                <th className="pb-3 font-semibold">{t('seller.colRestock')}</th>
                <th className="pb-3 font-semibold text-right">{t('seller.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((prod) => {
                const isLowStock = prod.stock <= (prod.low_stock_threshold ?? 5) || !prod.in_stock;
                const isOut = prod.stock === 0 || !prod.in_stock;
                const thumbBroken = brokenThumbs[prod.id] || !prod.image_url;
                return (
                  <tr
                    key={prod.id}
                    className={isLowStock ? 'bg-red-950/30 ring-1 ring-inset ring-red-500/40' : 'hover:bg-slate-800/40'}
                  >
                    <td className="py-3.5 pr-4 pl-3">
                      <div className="flex items-center gap-3">
                        {thumbBroken ? (
                          <div className="w-11 h-11 rounded-lg bg-slate-800 shrink-0 flex items-center justify-center text-slate-500">
                            <Sparkles className="w-5 h-5" />
                          </div>
                        ) : (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            onError={() => setBrokenThumbs((prev) => ({ ...prev, [prod.id]: true }))}
                            className="w-11 h-11 rounded-lg object-cover bg-slate-800 shrink-0"
                          />
                        )}
                        <div>
                          <span className={`font-bold text-base block ${isLowStock ? 'text-red-100' : 'text-white'}`}>
                            {prod.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">
                              {prod.unit} · {prod.gallery?.length || 1} photo{(prod.gallery?.length || 1) > 1 ? 's' : ''}
                            </span>
                            {/* Color & Size Indicators */}
                            {prod.has_variants && (
                              <button
                                type="button"
                                onClick={() => onManageVariants?.(prod)}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs font-semibold cursor-pointer hover:bg-emerald-900 transition-colors"
                              >
                                {prod.available_colors && prod.available_colors.length > 0 && (
                                  <span className="flex items-center -space-x-1">
                                    {prod.available_colors.slice(0, 4).map((c, i) => (
                                      <span
                                        key={i}
                                        className="w-2.5 h-2.5 rounded-full border border-slate-900"
                                        style={{ backgroundColor: typeof c === 'string' ? '#000000' : c.color_code || '#000000' }}
                                        title={typeof c === 'string' ? c : c.name}
                                      />
                                    ))}
                                  </span>
                                )}
                                <span>
                                  {prod.variants?.length || 0} variants
                                  {prod.available_sizes && prod.available_sizes.length > 0 && ` (${prod.available_sizes.join(', ')})`}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-slate-300">
                      {translateCategoryName(prod.category.slug || prod.category.name, prod.category.name, language)}
                    </td>
                    <td className="py-3.5 pr-4 font-mono tabular-nums font-bold text-white">
                      {formatPrice(prod.discounted_price)}
                    </td>
                    <td className="py-3.5 pr-4">
                      {isOut ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700">
                          <AlertCircle className="w-3.5 h-3.5" /> {t('common.outOfStock')} (0)
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-950/90 text-red-300 border border-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> {t('seller.lowStockOnlyLeft', { count: prod.stock })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.inStock')} ({prod.stock})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onRestock(prod.id, 25)}
                          disabled={restockingId === prod.id}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer ${
                            isLowStock
                              ? 'bg-red-600 hover:bg-red-500 text-white'
                              : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700'
                          }`}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>{t('seller.quickRestockBtn')}</span>
                        </button>
                        <button
                          onClick={() => onRestock(prod.id, 50)}
                          disabled={restockingId === prod.id}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
                        >
                          +50
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onManageVariants?.(prod)}
                          title="Manage Color & Size Variants"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>{prod.has_variants ? 'Variants' : '+ Variants'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenGallery(prod)}
                          title="Manage Product Gallery"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Photos</span>
                        </button>
                        <button
                          onClick={() => onToggleStock(prod.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
                        >
                          <ToggleRight className={`w-4 h-4 ${prod.in_stock ? 'text-emerald-400' : 'text-slate-500'}`} />
                        </button>
                        <button
                          onClick={() => onRequestDelete(prod)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
