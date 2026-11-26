import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import ProductCard from './ProductCard';
import { useLanguage } from '../../hooks';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  loading?: boolean;
  viewAllLink?: string;
}

export default function ProductSection({
  title,
  subtitle,
  products,
  loading = false,
  viewAllLink
}: ProductSectionProps) {
  const { t } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkScrollability();
    const el = scrollContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability, products, loading]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.75, 240);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // If not loading and no products provided, do not render empty section
  if (!loading && (!products || products.length === 0)) return null;

  return (
    <section className="py-5 sm:py-7">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        
        {/* Section Header */}
        <div className="flex items-end justify-between mb-4 sm:mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {viewAllLink && (
              <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to={viewAllLink}
                  className="text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1.5 group pb-0.5 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>{t('common.seeAll')}</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            )}

            {/* Desktop Navigation Arrows beside header */}
            <div className="hidden sm:flex items-center gap-1.5 pl-2">
              <button
                type="button"
                onClick={() => handleScroll('left')}
                disabled={!canScrollLeft}
                aria-label="Scroll left"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  canScrollLeft
                    ? 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500 cursor-pointer shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                disabled={!canScrollRight}
                aria-label="Scroll right"
                className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  canScrollRight
                    ? 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500 cursor-pointer shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Horizontal Carousel Track with Floating Navigation Arrows */}
        <div className="relative group/carousel">
          {/* Floating Left Arrow */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScroll('left')}
              aria-label="Scroll left"
              className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Floating Right Arrow */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScroll('right')}
              aria-label="Scroll right"
              className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Slidable Row */}
          <div
            ref={scrollContainerRef}
            className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-3 pt-1 px-1 -mx-1"
          >
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[170px] sm:w-[200px] md:w-[220px] lg:w-[230px] xl:w-[240px] shrink-0 snap-start flex flex-col"
                >
                  <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-100 dark:border-slate-800 p-3 h-72 animate-pulse space-y-3">
                    <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-sm w-3/4" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-sm w-1/2" />
                  </div>
                </div>
              ))
            ) : (
              products.map((product) => (
                <div
                  key={product.id}
                  className="w-[170px] sm:w-[200px] md:w-[220px] lg:w-[230px] xl:w-[240px] shrink-0 snap-start flex flex-col"
                >
                  <ProductCard product={product} />
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </section>
  );
}
