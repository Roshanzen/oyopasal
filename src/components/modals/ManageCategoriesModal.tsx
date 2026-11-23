import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  FolderPlus,
  Layers,
  CheckCircle2,
  AlertCircle,
  Hash,
  CornerDownRight,
  Search,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { categoryService, CreateCategoryPayload } from '../../services/categoryService';
import { Category } from '../../types';
import { translateCategoryName } from '../../i18n';
import { useLanguage } from '../../hooks';

export interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: (category: Category) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialParentSlug?: string;
}

function slugifyText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function ManageCategoriesModal({
  isOpen,
  onClose,
  onCategoryCreated,
  showToast,
  initialParentSlug,
}: ManageCategoriesModalProps) {
  const { language } = useLanguage();

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isManualSlug, setIsManualSlug] = useState(false);
  const [parentId, setParentId] = useState<string>('');
  const [ordering, setOrdering] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Categories list state for reference & deletion
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auto-generate slug when name changes unless user manually edited it
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isManualSlug) {
      setSlug(slugifyText(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualSlug(true);
    setSlug(slugifyText(e.target.value));
  };

  // Fetch live categories
  const fetchLiveCategories = async () => {
    try {
      setLoadingList(true);
      const res = await categoryService.getCategories({ bypassCache: true });
      const list = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : []);
      setCategories(list);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveCategories();
      setName('');
      setSlug('');
      setIsManualSlug(false);
      setParentId(initialParentSlug || '');
      setOrdering(0);
      setIsActive(true);
      setErrorMessage(null);
    }
  }, [isOpen, initialParentSlug]);

  // Filtered categories for browsing
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const q = searchTerm.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.subcategories?.some((sub) => sub.name.toLowerCase().includes(q) || sub.slug.toLowerCase().includes(q))
    );
  }, [categories, searchTerm]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Category name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload: CreateCategoryPayload = {
        name: trimmedName,
        slug: slug.trim() || slugifyText(trimmedName),
        parent_id: parentId.trim() ? parentId.trim() : null,
        ordering: Number(ordering) || 0,
        is_active: isActive,
      };

      const res = await categoryService.createCategory(payload);
      if (res.success && res.category) {
        if (showToast) {
          showToast(res.message || `Category '${res.category.name}' created successfully!`, 'success');
        }
        onCategoryCreated?.(res.category);
        // Refresh local list
        await fetchLiveCategories();
        // Reset form for next category or close
        setName('');
        setSlug('');
        setIsManualSlug(false);
        setOrdering((prev) => prev + 1);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create category';
      setErrorMessage(msg);
      if (showToast) {
        showToast(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDeleteCategory = async (cat: Category) => {
    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return;
    }
    try {
      setDeletingId(cat.id);
      await categoryService.deleteCategory(cat.slug || cat.id);
      if (showToast) {
        showToast(`Category '${cat.name}' removed`, 'info');
      }
      await fetchLiveCategories();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete category';
      if (showToast) showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[92vh] z-10"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Manage Categories</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    Live MySQL
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Create and organize store categories & subcategories across OyoPasal
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body: 2-Column Responsive Layout */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
            {/* Left Column: Create Form */}
            <div className="lg:col-span-6 p-6">
              <div className="flex items-center gap-2 mb-4 text-emerald-400 text-sm font-bold">
                <Plus className="w-4 h-4" />
                <span>Create New Category</span>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Category Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={handleNameChange}
                    placeholder="e.g. Organic Farm Produce, Sourdough Bakery"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Slug with Auto-Generation */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Unique URL Slug
                    </label>
                    <span className="text-xs text-slate-500">
                      {isManualSlug ? 'Custom Slug' : 'Auto-Generated'}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">
                      /category/
                    </span>
                    <input
                      type="text"
                      value={slug}
                      onChange={handleSlugChange}
                      placeholder="organic-farm-produce"
                      className="w-full pl-22 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Parent Category Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Parent Category
                  </label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">None — Top-Level Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id || cat.slug}>
                        📁 {translateCategoryName(cat.slug, cat.name, language)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecting a parent creates a nested subcategory (e.g. Apples under Fruits & Vegetables).
                  </p>
                </div>

                {/* Ordering & Active Toggle Grid */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Ordering Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Display Order
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <Hash className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={ordering}
                        onChange={(e) => setOrdering(Number(e.target.value))}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsActive((prev) => !prev)}
                      className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between text-sm font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-950/60 border-emerald-600/80 text-emerald-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400'
                      }`}
                    >
                      <span>{isActive ? 'Active' : 'Inactive'}</span>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                          isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isActive ? '✓' : '✕'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving to MySQL...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Save & Publish Category</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Existing Categories Browser */}
            <div className="lg:col-span-6 p-6 flex flex-col bg-slate-950/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-slate-300 text-sm font-bold">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Existing Categories ({categories.length})</span>
                </div>
                {loadingList && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-slate-500/30 border-t-slate-300 rounded-full animate-spin" />
                    Syncing...
                  </span>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search existing categories..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
                />
              </div>

              {/* Categories Tree View */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px]">
                {filteredCategories.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                    No categories found matching your query.
                  </div>
                ) : (
                  filteredCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-sm font-semibold text-white">
                            {translateCategoryName(cat.slug, cat.name, language)}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            (order: {cat.ordering ?? 0})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                            {cat.slug}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            disabled={deletingId === cat.id}
                            title="Delete category"
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Nested Subcategories */}
                      {cat.subcategories && cat.subcategories.length > 0 && (
                        <div className="mt-2 pl-4 border-l border-slate-800 space-y-1">
                          {cat.subcategories.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between text-xs py-1 text-slate-400"
                            >
                              <div className="flex items-center gap-1.5">
                                <CornerDownRight className="w-3 h-3 text-slate-600" />
                                <span>{translateCategoryName(sub.slug, sub.name, language)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-slate-600">{sub.slug}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(sub)}
                                  disabled={deletingId === sub.id}
                                  title="Delete subcategory"
                                  className="text-slate-600 hover:text-rose-400 cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Real-time Sync Active</span>
                </div>
                <span>Changes reflect live across all portals</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
