import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import ProductCard from './ProductCard';
import { ArrowRight } from 'lucide-react';
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
  // If not loading and no products provided, do not render empty section
  if (!loading && (!products || products.length === 0)) return null;

  return (
    <section className="py-5 sm:py-7">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {subtitle}
              </p>
            )}
          </div>

          {viewAllLink && (
            <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
              <Link
                to={viewAllLink}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 group pb-0.5 cursor-pointer"
              >
                <span>See All</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          )}
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-100 dark:border-slate-800 p-3 h-64 animate-pulse space-y-3"
              >
                <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-sm w-3/4" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-sm w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
