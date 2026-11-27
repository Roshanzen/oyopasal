import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertCircle, Folder, Package } from 'lucide-react';
import { Category } from '../../types';
import { categoryService } from '../../services';
import { useApp } from '../../context';
import { translateCategoryName } from '../../i18n';
import { resolveCategoryImageUrl } from '../../utils';

interface ShopByCategorySectionProps {
  initialCategories?: Category[];
  initialLoading?: boolean;
}

export default function ShopByCategorySection({
  initialCategories,
  initialLoading,
}: ShopByCategorySectionProps) {
  const navigate = useNavigate();
  const { language } = useApp();

  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState<boolean>(
    initialLoading !== undefined ? initialLoading : (initialCategories ? false : true)
  );
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const fetchCategories = useCallback(async (isInitial = false) => {
    try {
      if (!isInitial) setLoading(true);
      setError(null);
      const res = await categoryService.getCategories({ bypassCache: !isInitial });
      const rawResults = res.results || [];
      // Filter active parent categories, sorted by ordering
      const activeCats = rawResults
        .filter((cat) => (cat.parent_id == null && cat.parent == null) && (cat as any).is_active !== false)
        .sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0));

      // Deduplicate categories by normalized name: cat.name.trim().toLowerCase()
      const seenNames = new Set<string>();
      const uniqueCats: Category[] = [];
      for (const cat of activeCats) {
        if (!cat) continue;
        const norm = (cat.name || '').trim().toLowerCase();
        if (norm) {
          if (!seenNames.has(norm)) {
            seenNames.add(norm);
            uniqueCats.push(cat);
          }
        } else {
          uniqueCats.push(cat);
        }
      }

      setCategories(uniqueCats.length > 0 ? uniqueCats : rawResults);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Failed to load categories');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount if initialCategories not supplied
  useEffect(() => {
    if (!initialCategories || initialCategories.length === 0) {
      fetchCategories(true);
    } else {
      setCategories(initialCategories);
      if (initialLoading !== undefined) setLoading(initialLoading);
    }
  }, [initialCategories, initialLoading, fetchCategories]);

  // Listen for real-time category updates (e.g. from admin actions)
  useEffect(() => {
    const handleUpdated = () => {
      fetchCategories(false);
    };
    window.addEventListener('categories:updated', handleUpdated);
    return () => {
      window.removeEventListener('categories:updated', handleUpdated);
    };
  }, [fetchCategories]);

  return (
    <section
      data-testid="shop-by-category-section"
      className="py-6 bg-transparent my-2 select-none"
    >
      <div className="w-full px-4 sm:px-6 lg:px-10">
        {/* Section Header: Left Title + Right Link */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
            Popular Categories
          </h2>
          <Link
            to="/categories"
            className="text-sm font-semibold text-[#059669] hover:text-[#047857] inline-flex items-center gap-1 transition-colors"
            title="Explore All Categories"
          >
            <span>Explore All Categories</span>
            <span aria-hidden="true">&rsaquo;</span>
          </Link>
        </div>

        {/* Loading State: Square Skeleton Tiles */}
        {loading && (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3.5">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div key={`cat-skeleton-${idx}`} className="flex flex-col items-center">
                <div className="w-full aspect-square rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="w-16 h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md mt-2 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Error State with Graceful Fallback & Retry */}
        {!loading && error && (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#111726] border border-rose-200 dark:border-rose-900/60 text-center flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchCategories(false)}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && categories.length === 0 && (
          <div className="p-8 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center">
            <Folder className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No categories found</p>
            <p className="text-xs text-slate-400 mt-0.5">Active categories will appear here once configured.</p>
          </div>
        )}

        {/* Popular Categories Grid: Compact Square-Tile Layout */}
        {!loading && !error && categories.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3.5">
            {categories.map((cat) => {
              const uploadedSrc = resolveCategoryImageUrl(cat);
              const isBroken = Boolean(failedImages[cat.id]);
              const hasValidImage = Boolean(uploadedSrc) && !isBroken;

              const displayName = translateCategoryName(cat.slug, cat.name, language);

              const handleNavigate = () => {
                navigate(cat.slug ? `/category/${cat.slug}` : `/category/${cat.id}`);
              };

              return (
                <div
                  key={cat.id}
                  role="link"
                  tabIndex={0}
                  onClick={handleNavigate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNavigate();
                    }
                  }}
                  className="group flex flex-col items-center text-center cursor-pointer select-none"
                >
                  {/* Square Image Tile */}
                  <div className="w-full aspect-square rounded-2xl bg-[#F3F4F6] dark:bg-slate-800/80 p-3 flex items-center justify-center overflow-hidden border border-transparent group-hover:border-emerald-200 dark:group-hover:border-emerald-800 group-hover:bg-emerald-50/40 dark:group-hover:bg-slate-800 transition-all">
                    {hasValidImage ? (
                      <img
                        src={uploadedSrc!}
                        alt={displayName || cat.name || 'Category'}
                        loading="lazy"
                        onError={() => {
                          setFailedImages((prev) => ({
                            ...prev,
                            [cat.id]: true,
                          }));
                        }}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                        <Package className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
                      </div>
                    )}
                  </div>

                  {/* Centered Category Title */}
                  <span className="mt-2 text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#059669] leading-snug line-clamp-2 max-w-[115px]">
                    {displayName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
