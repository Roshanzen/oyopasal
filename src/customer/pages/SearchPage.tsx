import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../shared/services/api';
import { Product, Category, Vendor } from '../../shared/types';
import ProductCard from '../components/ProductCard';
import { useApp } from '../../shared/context/AppContext';
import { translateCategoryName, translateDurationText } from '../../shared/i18n/translations';
import {
  SlidersHorizontal,
  X,
  ArrowUpDown,
  PackageX,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, language } = useApp();

  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const vendorParam = searchParams.get('vendor') || '';
  const sectionParam = searchParams.get('section') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasNext, setHasNext] = useState<boolean>(false);
  const [hasPrevious, setHasPrevious] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState<string>('popularity');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedVendor, setSelectedVendor] = useState<string>(vendorParam);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  // Sync state with URL params
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedVendor(vendorParam);
    setPage(1);
  }, [categoryParam, vendorParam, query, sectionParam]);

  // Fetch filter metadata
  useEffect(() => {
    async function loadMeta() {
      try {
        const [catRes, vendorRes] = await Promise.all([
          api.getCategories(),
          api.getVendors()
        ]);
        setCategories(catRes.results || []);
        setVendors(vendorRes.results || []);
      } catch (err) {
        console.error('Meta load error', err);
      }
    }
    loadMeta();
  }, []);

  const performSearch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const minVal = minPrice ? Number(minPrice) : undefined;
      const maxVal = maxPrice ? Number(maxPrice) : undefined;
      const res = await api.getProducts({
        search: query || undefined,
        category: selectedCategory || undefined,
        vendor: selectedVendor || undefined,
        section: sectionParam || undefined,
        ordering: ordering !== 'popularity' ? ordering : undefined,
        in_stock: inStockOnly || undefined,
        min_price: minVal && !Number.isNaN(minVal) ? minVal : undefined,
        max_price: maxVal && !Number.isNaN(maxVal) ? maxVal : undefined,
        page,
        page_size: 24
      });
      setProducts(res.results || []);
      setTotalCount(res.count || 0);
      setHasNext(Boolean(res.next));
      setHasPrevious(Boolean(res.previous));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matching products');
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, selectedVendor, sectionParam, ordering, inStockOnly, minPrice, maxPrice, page]);

  useEffect(() => {
    performSearch();
  }, [performSearch]);

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSelectedVendor('');
    setInStockOnly(false);
    setMinPrice('');
    setMaxPrice('');
    setOrdering('popularity');
    setPage(1);
    setSearchParams(query ? { q: query } : {});
  };

  const hasActiveFilters = Boolean(
    selectedCategory || selectedVendor || inStockOnly || minPrice || maxPrice || ordering !== 'popularity'
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 pb-20">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            {query
              ? t('search.resultsFor', { q: query })
              : sectionParam
              ? t('search.browsingSection', { section: sectionParam.replace('_', ' ') })
              : t('search.catalogTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {loading ? t('search.searching') : t('search.foundItems', { count: totalCount || products.length })}
          </p>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-2xs">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={ordering}
              onChange={(e) => {
                setOrdering(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-sm font-semibold focus:outline-none cursor-pointer dark:bg-[#111726] dark:text-slate-200"
            >
              <option value="popularity">{t('search.sortFeatured')}</option>
              <option value="price_asc">{t('search.sortPriceAsc')}</option>
              <option value="price_desc">{t('search.sortPriceDesc')}</option>
              <option value="rating">{t('search.sortRating')}</option>
              <option value="discount">{t('search.sortDiscount')}</option>
            </select>
          </div>

          <label className="hidden sm:flex items-center gap-2 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-2xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span className="font-semibold">{t('search.inStockOnly')}</span>
          </label>
        </div>
      </div>

      {/* Main Layout: Filters Sidebar + Results */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pt-6">
        {/* Left Filter Sidebar */}
        <div className="hidden lg:block space-y-6">
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('search.filters')}</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  {t('common.reset')}
                </button>
              )}
            </div>

            {/* Price Range Filter */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Price Range (Rs.)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Min"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Max"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                {t('search.categoryLabel')}
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedCategory('');
                    setPage(1);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    !selectedCategory ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{t('search.allCategories')}</span>
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCategory(c.slug);
                      setPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      selectedCategory === c.slug ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{translateCategoryName(c.slug, c.name, language)}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">{c.item_count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor Filter */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                {t('search.fulfilledBy')}
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setSelectedVendor('');
                    setPage(1);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    !selectedVendor ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>{t('search.allVendors')}</span>
                </button>
                {vendors.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVendor(v.id);
                      setPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      selectedVendor === v.id ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{translateDurationText(v.delivery_time_mins, language)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Products Grid */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm text-slate-400 dark:text-slate-500 font-semibold mr-1">{t('search.active')}</span>
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  {t('search.categoryChip', {
                    name: translateCategoryName(
                      selectedCategory,
                      categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory,
                      language
                    )
                  })}
                  <button onClick={() => setSelectedCategory('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
              {selectedVendor && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  {t('search.storeChip', { name: vendors.find((v) => v.id === selectedVendor)?.name || selectedVendor })}
                  <button onClick={() => setSelectedVendor('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
              {(minPrice || maxPrice) && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  Rs. {minPrice || '0'} – {maxPrice || '∞'}
                  <button
                    onClick={() => {
                      setMinPrice('');
                      setMaxPrice('');
                    }}
                    className="cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  {t('search.inStockOnly')}
                  <button onClick={() => setInStockOnly(false)} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
            </div>
          )}

          {/* Error, Loading, Grid or Empty State */}
          {error ? (
            <div className="py-16 text-center bg-rose-50 dark:bg-rose-950/30 rounded-3xl border border-rose-200 dark:border-rose-900/60 p-8 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
              <button
                type="button"
                onClick={performSearch}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#111726] rounded-2xl p-3 h-64 border border-slate-100 dark:border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {(hasPrevious || hasNext) && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    type="button"
                    disabled={!hasPrevious}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111726] text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">Page {page}</span>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111726] text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <PackageX className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('search.emptyTitle')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  {t('search.emptySub')}
                </p>
              </div>
              <button
                onClick={handleClearFilters}
                className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 cursor-pointer"
              >
                {t('search.clearFilters')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

