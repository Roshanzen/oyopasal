import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Product, Category } from '../types';
import ProductCard from '../components/ProductCard';
import { ArrowLeft, Sparkles, Filter } from 'lucide-react';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // If no slug is provided, we are on /categories (view all categories)
  const isBrowseAll = !slug;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const catRes = await api.getCategories();
        setCategories(catRes.results || []);

        if (slug) {
          const found = catRes.results.find(c => c.slug === slug);
          setCurrentCategory(found || null);

          const prodRes = await api.getProducts({ category: slug, page_size: 40 });
          setProducts(prodRes.results || []);
        }
      } catch (err) {
        console.error('Failed to load category data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (isBrowseAll) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
            All Categories & Departments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose a department to browse freshly stocked quick-commerce items
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => navigate(`/category/${cat.slug}`)}
              className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {cat.description}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {cat.item_count}+ Items Available
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
      
      {/* Top Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-emerald-900 dark:bg-[#062519] border border-emerald-800/40 text-white mb-6 flex flex-col justify-between relative overflow-hidden shadow-md">
        <div className="relative z-10 max-w-xl">
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-white mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Departments</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display">
            {currentCategory ? currentCategory.name : 'Category'}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-md">
            {currentCategory ? currentCategory.description : 'Explore freshly stocked goods'}
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-emerald-700/40 to-transparent pointer-events-none" />
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No items available in this category</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Please check back soon as local vendors restock.</p>
        </div>
      )}

    </div>
  );
}
