import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  BookOpen,
  PenTool,
  Palette,
  Zap,
  Apple,
  Milk,
  Package,
  Cookie,
  Shirt,
  HeartPulse,
  Home,
  Headphones,
  Laptop,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import { Category } from '../../types';
import { categoryService } from '../../services';
import { useApp } from '../../context';
import { translateCategoryName, translateCategoryDescription } from '../../i18n';
import { toNepaliDigits } from '../../utils';
import { getCategoryIcon } from '../../utils/categoryIcons';

interface ShopByCategorySectionProps {
  initialCategories?: Category[];
  initialLoading?: boolean;
}

export default function ShopByCategorySection({
  initialCategories,
  initialLoading,
}: ShopByCategorySectionProps) {
  const navigate = useNavigate();
  const { t, language } = useApp();

  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [loading, setLoading] = useState<boolean>(
    initialLoading !== undefined ? initialLoading : (initialCategories ? false : true)
  );
  const [error, setError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const markBrokenImage = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  const fetchCategories = useCallback(async (isInitial = false) => {
    try {
      if (!isInitial) setLoading(true);
      setError(null);
      const res = await categoryService.getCategories({ bypassCache: !isInitial });
      const rawResults = res.results || [];
      // Filter active parent categories, sorted by ordering
      const activeCats = rawResults
        .filter((cat) => cat.parent_id == null && (cat as any).is_active !== false)
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

  // Compute item count display string
  const formatItemCount = useCallback(
    (cat: Category) => {
      const count = cat.product_count !== undefined ? cat.product_count : (cat.item_count ?? 0);
      if (language === 'ne') {
        return `${toNepaliDigits(count)} सामानहरू`;
      }
      return `${count} ${count === 1 ? 'item' : 'items'}`;
    },
    [language]
  );

  return (
    <section
      data-testid="shop-by-category-section"
      className="py-6 bg-slate-100/60 dark:bg-slate-900/40 border-y border-slate-200/70 dark:border-slate-800 my-2 select-none"
    >
      <div className="w-full px-4 sm:px-6 lg:px-10">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
              {t('home.shopByCatTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('home.shopByCatSub')}
            </p>
          </div>
          <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
            <Link
              to="/categories"
              className="text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 group"
              title="Browse all categories"
            >
              <span>{t('home.allCategories')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Loading State: Clean Skeleton Cards */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`cat-skeleton-${idx}`}
                className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between animate-pulse min-h-[160px]"
              >
                <div>
                  <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-800 mb-2.5" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4 mb-1.5" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-1/2" />
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-16" />
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
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

        {/* Dynamic Categories Grid: Multi-column responsive layout */}
        {!loading && !error && categories.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {categories.map((cat) => {
              const imgKey = `cat-${cat.id}`;
              const hasValidImg = Boolean(cat.image_url) && !brokenImages[imgKey];
              const IconComponent = getCategoryIcon(cat);

              return (
                <motion.div
                  key={cat.id}
                  whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(cat.slug ? `/category/${cat.slug}` : `/category/${cat.id}`)}
                  className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Icon Badge: Distinct category icon or uploaded thumbnail */}
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold mb-2.5 overflow-hidden transition-colors shadow-2xs">
                      {hasValidImg ? (
                        <img
                          src={cat.image_url!}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          onError={() => markBrokenImage(imgKey)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <IconComponent className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>

                    {/* Live Category Title */}
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {translateCategoryName(cat.slug, cat.name, language)}
                    </h3>

                    {/* Category Description */}
                    <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                      {translateCategoryDescription(cat.slug, cat.description, language)}
                    </p>
                  </div>

                  {/* Live Item Count in Emerald Green (#00875A) with Right Arrow */}
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-[#00875A] dark:text-emerald-400 font-bold">
                    <span>{formatItemCount(cat)}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
