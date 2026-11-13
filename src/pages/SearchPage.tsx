import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Product, Category, Vendor } from '../types';
import ProductCard from '../components/ProductCard';
import {
  Search,
  Filter,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Tag,
  PackageX,
  Sparkles
} from 'lucide-react';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const vendorParam = searchParams.get('vendor') || '';
  const sectionParam = searchParams.get('section') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [ordering, setOrdering] = useState<string>('popularity');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedVendor, setSelectedVendor] = useState<string>(vendorParam);

  // Sync state with URL params
  useEffect(() => {
    setSelectedCategory(categoryParam);
    setSelectedVendor(vendorParam);
  }, [categoryParam, vendorParam]);

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

  // Fetch search results from Django REST Framework API
  useEffect(() => {
    async function performSearch() {
      try {
        setLoading(true);
        const res = await api.getProducts({
          search: query || undefined,
          category: selectedCategory || undefined,
          vendor: selectedVendor || undefined,
          section: sectionParam || undefined,
          ordering: ordering !== 'popularity' ? ordering : undefined,
          in_stock: inStockOnly || undefined,
          page_size: 30
        });
        setProducts(res.results || []);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    }
    performSearch();
  }, [query, selectedCategory, selectedVendor, sectionParam, ordering, inStockOnly]);

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSelectedVendor('');
    setInStockOnly(false);
    setOrdering('popularity');
    setSearchParams(query ? { q: query } : {});
  };

  const hasActiveFilters = Boolean(selectedCategory || selectedVendor || inStockOnly || ordering !== 'popularity');

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 pb-20">
      
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            {query ? `Search results for "${query}"` : sectionParam ? `Browsing ${sectionParam.replace('_', ' ')}` : 'Product Catalog'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {loading ? 'Searching marketplace...' : `Found ${products.length} matching items`}
          </p>
        </div>

        {/* Sort & Filter Controls */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-2xs">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              className="bg-transparent border-none text-sm font-semibold focus:outline-none cursor-pointer dark:bg-[#111726] dark:text-slate-200"
            >
              <option value="popularity">Featured & Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Top Customer Rated</option>
              <option value="discount">Biggest Discounts</option>
            </select>
          </div>

          <label className="hidden sm:flex items-center gap-2 bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-2xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
            />
            <span className="font-semibold">In Stock Only</span>
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
                <span>Filters</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Category
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    !selectedCategory ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>All Categories</span>
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      selectedCategory === c.slug ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">{c.item_count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor Filter */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Fulfilled By Store
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedVendor('')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                    !selectedVendor ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span>All Vendors</span>
                </button>
                {vendors.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVendor(v.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      selectedVendor === v.id ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{v.delivery_time_mins}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Right: Products Grid */}
        <div className="lg:col-span-4">
          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 mb-4">
              <span className="text-sm text-slate-400 dark:text-slate-500 font-semibold mr-1">Active:</span>
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  Category: {categories.find(c => c.slug === selectedCategory)?.name || selectedCategory}
                  <button onClick={() => setSelectedCategory('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
              {selectedVendor && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  Store: {vendors.find(v => v.id === selectedVendor)?.name || selectedVendor}
                  <button onClick={() => setSelectedVendor('')} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
              {inStockOnly && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-lg font-bold">
                  In Stock Only
                  <button onClick={() => setInStockOnly(false)} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </span>
              )}
            </div>
          )}

          {/* Grid or Empty State */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#111726] rounded-2xl p-3 h-64 border border-slate-100 dark:border-slate-800 animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <PackageX className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No products match your criteria</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Try adjusting filters, clearing search keywords, or browse our daily fresh arrivals.
                </p>
              </div>
              <button
                onClick={handleClearFilters}
                className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
