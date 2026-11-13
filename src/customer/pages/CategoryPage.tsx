import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../shared/services/api';
import { Product, Category } from '../../shared/types';
import ProductCard from '../components/ProductCard';
import { AlertCircle, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { useApp } from '../../shared/context/AppContext';
import { translateCategoryName, translateCategoryDescription } from '../../shared/i18n/translations';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, language } = useApp();

  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenCatImgs, setBrokenCatImgs] = useState<Record<string, boolean>>({});

  // If no slug is provided, we are on /categories (view all categories)
  const isBrowseAll = !slug;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const catRes = await api.getCategories();
      setCategories(catRes.results || []);

      if (slug) {
        const found = catRes.results.find((c) => c.slug === slug);
        setCurrentCategory(found || null);

        const prodRes = await api.getProducts({ category: slug, page_size: 40 });
        setProducts(prodRes.results || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category data');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [loadData]);

  if (isBrowseAll) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-10 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            {t('cat.allTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('cat.allSub')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </span>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {categories.map((cat) => {
              const hasImg = Boolean(cat.image_url) && !brokenCatImgs[cat.id];
              return (
                <div
                  key={cat.id}
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold mb-3 overflow-hidden group-hover:scale-105 transition-transform">
                      {hasImg ? (
                        <img
                          src={cat.image_url!}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenCatImgs((prev) => ({ ...prev, [cat.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {translateCategoryName(cat.slug, cat.name, language)}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {translateCategoryDescription(cat.slug, cat.description, language)}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {t('cat.itemsAvailable', { count: cat.item_count })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 pb-20">
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-emerald-900 dark:bg-[#062519] border border-emerald-800/40 text-white mb-6 flex flex-col justify-between relative overflow-hidden shadow-md">
        <div className="relative z-10 max-w-xl">
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300 hover:text-white mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('cat.allDepartments')}</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display">
            {currentCategory
              ? translateCategoryName(currentCategory.slug, currentCategory.name, language)
              : t('cat.fallbackTitle')}
          </h1>
          <p className="text-sm sm:text-base text-emerald-200/90 mt-1 max-w-md">
            {currentCategory
              ? translateCategoryDescription(currentCategory.slug, currentCategory.description, language)
              : t('cat.fallbackDesc')}
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-emerald-700/40 to-transparent pointer-events-none" />
      </div>

      {error ? (
        <div className="py-14 px-6 text-center bg-rose-50 dark:bg-rose-950/30 rounded-3xl border border-rose-200 dark:border-rose-900/60 space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('cat.emptyTitle')}</h3>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{t('cat.emptySub')}</p>
        </div>
      )}
    </div>
  );
}

