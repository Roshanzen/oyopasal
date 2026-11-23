import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ProductCard from '../../components/common/ProductCard';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { SkeletonCard } from '../../components/loaders/SkeletonCard';
import { Sparkles, Folder, Layers, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context';
import { useCategoryCatalog } from '../../hooks';
import { translateCategoryName, translateCategoryDescription } from '../../i18n';
import { Category } from '../../types';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, language } = useApp();

  const {
    categories,
    currentCategory,
    parentCategory,
    products,
    loading,
    error,
    reload: loadData,
  } = useCategoryCatalog(slug);

  const [brokenCatImgs, setBrokenCatImgs] = useState<Record<string, boolean>>({});
  const [activeSubcategorySlug, setActiveSubcategorySlug] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('best_match');

  // If no slug is provided, we are on /categories (view all departments/categories)
  const isBrowseAll = !slug;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  // Resolve effective category & subcategories
  const effectiveCategory = parentCategory || currentCategory;
  const subcategories: Category[] = useMemo(() => {
    if (!effectiveCategory) return [];
    return (effectiveCategory.subcategories || []).filter((s) => s.is_active !== false);
  }, [effectiveCategory]);

  const hasSubcategories = subcategories.length > 0;

  // Sync active subcategory when slug changes
  useEffect(() => {
    if (parentCategory && currentCategory) {
      setActiveSubcategorySlug(currentCategory.slug);
    } else {
      setActiveSubcategorySlug(null);
    }
  }, [slug, parentCategory, currentCategory]);

  const activeSubcategory = useMemo(() => {
    if (!activeSubcategorySlug) return null;
    return subcategories.find((s) => s.slug === activeSubcategorySlug) || null;
  }, [activeSubcategorySlug, subcategories]);

  const categoryTitle = useMemo(() => {
    if (!effectiveCategory) return t('cat.fallbackTitle') || 'Products';
    return translateCategoryName(effectiveCategory.slug, effectiveCategory.name, language);
  }, [effectiveCategory, language, t]);

  const categoryDesc = useMemo(() => {
    if (!effectiveCategory) return 'Explore top-rated items from verified local stores near you.';
    return (
      translateCategoryDescription(effectiveCategory.slug, effectiveCategory.description, language) ||
      'Explore top-rated items from verified local stores near you.'
    );
  }, [effectiveCategory, language]);

  // Filter & Sort Products
  const finalFilteredProducts = useMemo(() => {
    let list = [...products];

    // 1. Subcategory filtering
    if (activeSubcategorySlug) {
      list = list.filter((p) => {
        const catSlug = p.category?.slug || p.category_slug;
        const catId = p.category?.id;
        return (
          catSlug === activeSubcategorySlug ||
          (activeSubcategory && catId === activeSubcategory.id)
        );
      });
    }

    // 2. Price filtering
    if (priceFilter === 'under_500') {
      list = list.filter((p) => {
        const price = Number(p.discounted_price ?? p.price ?? 0);
        return price < 500;
      });
    } else if (priceFilter === '500_2000') {
      list = list.filter((p) => {
        const price = Number(p.discounted_price ?? p.price ?? 0);
        return price >= 500 && price <= 2000;
      });
    } else if (priceFilter === '2000_5000') {
      list = list.filter((p) => {
        const price = Number(p.discounted_price ?? p.price ?? 0);
        return price >= 2000 && price <= 5000;
      });
    } else if (priceFilter === 'over_5000') {
      list = list.filter((p) => {
        const price = Number(p.discounted_price ?? p.price ?? 0);
        return price > 5000;
      });
    }

    // 3. Sorting
    if (sortBy === 'newest') {
      list.sort((a, b) => {
        const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === 'price_asc') {
      list.sort((a, b) => {
        const priceA = Number(a.discounted_price ?? a.price ?? 0);
        const priceB = Number(b.discounted_price ?? b.price ?? 0);
        return priceA - priceB;
      });
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => {
        const priceA = Number(a.discounted_price ?? a.price ?? 0);
        const priceB = Number(b.discounted_price ?? b.price ?? 0);
        return priceB - priceA;
      });
    }

    return list;
  }, [products, activeSubcategorySlug, activeSubcategory, priceFilter, sortBy]);

  // Browse All Departments view (`/categories`)
  if (isBrowseAll) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            {t('cat.allTitle')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('cat.allSub')}
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} onRetry={loadData} />
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
    <div className="w-full">
      {/* 1. SOFT-MINT CATEGORY HEADER & SUBCATEGORY CAROUSEL STRIP */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-[#ECFDF5] border border-[#D1FAE5] rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-xs">
          {/* Left Column (Category Title & Breadcrumb) */}
          <div className={`${hasSubcategories ? 'lg:w-[30%]' : 'w-full'} shrink-0`}>
            <Link
              to="/categories"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
            >
              ← {t('cat.allDepartments') || 'All Departments'} / {categoryTitle}
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 font-display tracking-tight">
              {categoryTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
              {categoryDesc}
            </p>
          </div>

          {/* Right Column (Horizontal Visual Subcategory Cards) */}
          {hasSubcategories && (
            <div className="lg:w-[70%] w-full flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {/* All Items Card */}
              <button
                type="button"
                onClick={() => setActiveSubcategorySlug(null)}
                className={`min-w-[130px] max-w-[145px] bg-white rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col items-start shadow-xs shrink-0 select-none text-left ${
                  activeSubcategorySlug === null
                    ? 'border-2 border-[#059669] ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-[#059669]'
                }`}
              >
                <div className="w-full h-[84px] rounded-lg bg-emerald-50 overflow-hidden mb-2 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#059669]" />
                </div>
                <span className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                  All {categoryTitle}
                </span>
              </button>

              {/* Subcategories */}
              {subcategories.map((sub) => {
                const isSelected = activeSubcategorySlug === sub.slug;
                const hasImg = Boolean(sub.image_url) && !brokenCatImgs[sub.id];
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setActiveSubcategorySlug(isSelected ? null : sub.slug);
                    }}
                    className={`min-w-[130px] max-w-[145px] bg-white rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col items-start shadow-xs shrink-0 select-none text-left ${
                      isSelected
                        ? 'border-2 border-[#059669] ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-[#059669]'
                    }`}
                  >
                    <div className="w-full h-[84px] rounded-lg bg-slate-50 overflow-hidden mb-2 flex items-center justify-center">
                      {hasImg ? (
                        <img
                          src={sub.image_url!}
                          alt={sub.name}
                          referrerPolicy="no-referrer"
                          onError={() => setBrokenCatImgs((prev) => ({ ...prev, [sub.id]: true }))}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                          <Folder className="w-6 h-6 text-[#059669]" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                      {translateCategoryName(sub.slug, sub.name, language)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. SECTION TOOLBAR & PRODUCT GRID BELOW */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 pb-20">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70 mb-6">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              {activeSubcategory
                ? translateCategoryName(activeSubcategory.slug, activeSubcategory.name, language)
                : `All ${categoryTitle} Products`}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              ({finalFilteredProducts.length} {finalFilteredProducts.length === 1 ? 'item' : 'items'})
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter by: Price */}
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="filter-by-price" className="text-slate-500 font-medium hidden sm:inline">
                Filter by:
              </label>
              <select
                id="filter-by-price"
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium focus:outline-none focus:border-[#059669] cursor-pointer shadow-2xs"
              >
                <option value="all">All Prices</option>
                <option value="under_500">Under NPR 500</option>
                <option value="500_2000">NPR 500 - 2,000</option>
                <option value="2000_5000">NPR 2,000 - 5,000</option>
                <option value="over_5000">Over NPR 5,000</option>
              </select>
            </div>

            {/* Sort by */}
            <div className="flex items-center gap-1.5 text-xs">
              <label htmlFor="sort-by-filter" className="text-slate-500 font-medium hidden sm:inline">
                Sort by:
              </label>
              <select
                id="sort-by-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium focus:outline-none focus:border-[#059669] cursor-pointer shadow-2xs"
              >
                <option value="best_match">Best Match</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} onRetry={loadData} />
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : finalFilteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {finalFilteredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl py-12 px-6 text-center text-sm text-slate-500">
            <p className="font-medium">
              No products available in this subcategory yet — check back soon.
            </p>
            {activeSubcategorySlug && (
              <button
                type="button"
                onClick={() => setActiveSubcategorySlug(null)}
                className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 text-xs font-semibold text-emerald-700 transition-colors cursor-pointer"
              >
                View all {categoryTitle} products
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
