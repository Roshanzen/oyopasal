import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { Category } from '../types';
import {
  Apple,
  Milk,
  Package,
  Cookie,
  Coffee,
  Sparkles,
  Home,
  Zap,
  Shirt,
  HeartPulse,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

const ICON_MAP: Record<string, React.ElementType> = {
  Apple,
  Milk,
  Package,
  Cookie,
  Coffee,
  Sparkles,
  Home,
  Zap,
  Shirt,
  HeartPulse
};

export default function CategoryBar() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        const res = await api.getCategories();
        setCategories(res.results);
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -260 : 260;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const currentPath = location.pathname;

  return (
    <div className="bg-white dark:bg-[#0b0f19] border-b border-slate-200/80 dark:border-slate-800 py-3 relative shadow-2xs transition-colors duration-200 select-none">
      <div className="w-full px-4 sm:px-6 lg:px-10 relative">
        
        {/* Scroll Left Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.88 }}
          onClick={() => scroll('left')}
          aria-label="Scroll categories left"
          className="hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>

        {/* Scrollable Container with Kinetic Feel */}
        <div
          ref={scrollRef}
          className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth px-1 py-0.5"
        >
          {/* All Stores Pill */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/')}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shrink-0 cursor-pointer ${
              currentPath === '/'
                ? 'text-white'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
            }`}
          >
            {currentPath === '/' && (
              <motion.div
                layoutId="activeCategoryPill"
                className="absolute inset-0 bg-slate-900 dark:bg-emerald-600 rounded-xl shadow-xs"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10">All Stores</span>
          </motion.button>

          {loading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse shrink-0"
              />
            ))
          ) : (
            categories.map((cat) => {
              const IconComp = ICON_MAP[cat.icon] || Package;
              const isActive = currentPath === `/category/${cat.slug}`;

              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryPill"
                      className="absolute inset-0 bg-emerald-600 rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <IconComp
                    className={`relative z-10 w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  />
                  <span className="relative z-10">{cat.name}</span>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Scroll Right Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.88 }}
          onClick={() => scroll('right')}
          aria-label="Scroll categories right"
          className="hidden md:flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>

      </div>
    </div>
  );
}
