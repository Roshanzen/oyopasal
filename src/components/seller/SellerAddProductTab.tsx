import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Palette,
  Plus,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { translateCategoryName, TranslatorFn } from '../../i18n';
import { Category, Language, Product, Vendor } from '../../types';
import ProductImageUploadGrid from './ProductImageUploadGrid';

const PRESET_UNITS = ['250g', '500g', '1 kg', '2 kg', '1L', '500ml', 'Pack of 1', 'Pack of 2', '12 Pcs'];

const PRESET_COLORS = [
  { name: 'Black', code: '#0F172A' },
  { name: 'White', code: '#FFFFFF' },
  { name: 'Red', code: '#EF4444' },
  { name: 'Blue', code: '#3B82F6' },
  { name: 'Navy', code: '#1E3A8A' },
  { name: 'Green', code: '#10B981' },
  { name: 'Yellow', code: '#F59E0B' },
  { name: 'Gray', code: '#6B7280' },
  { name: 'Beige', code: '#F5F5DC' },
];

const PRESET_CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PRESET_SHOE_SIZES = ['38', '39', '40', '41', '42', '43', '44'];

export interface FormVariantItem {
  id?: string;
  color?: string;
  color_code?: string;
  size?: string;
  price?: number;
  original_price?: number;
  stock?: number;
  image_url?: string;
  is_active?: boolean;
}

interface SellerAddProductTabProps {
  effectiveVendor: Vendor;
  categories: Category[];
  loadingCategories: boolean;
  lastAddedProduct: Product | null;
  productName: string;
  setProductName: (v: string) => void;
  categorySlug: string;
  setCategorySlug: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  originalPrice: number | '';
  setOriginalPrice: (v: number | '') => void;
  discountedPrice: number | '';
  setDiscountedPrice: (v: number | '') => void;
  stockCount: number | '';
  setStockCount: (v: number | '') => void;
  isOrganic: boolean;
  setIsOrganic: (v: boolean) => void;
  hasVariants?: boolean;
  setHasVariants?: (v: boolean) => void;
  variantsList?: FormVariantItem[];
  setVariantsList?: React.Dispatch<React.SetStateAction<FormVariantItem[]>>;
  description: string;
  setDescription: (v: string) => void;
  customImageUrl: string;
  setCustomImageUrl: (v: string) => void;
  uploadingPrimaryImg: boolean;
  galleryUrls: string[];
  setGalleryUrls: React.Dispatch<React.SetStateAction<string[]>>;
  galleryUrlInput: string;
  setGalleryUrlInput: (v: string) => void;
  uploadingGalleryImg: boolean;
  selectedSections: string[];
  toggleSection: (section: string) => void;
  submittingProduct: boolean;
  language: Language;
  formatPrice: (n: number) => string;
  t: TranslatorFn;
  onPrimaryImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGalleryImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddGalleryUrl: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SellerAddProductTab({
  effectiveVendor,
  categories,
  loadingCategories,
  lastAddedProduct,
  productName,
  setProductName,
  categorySlug,
  setCategorySlug,
  unit,
  setUnit,
  originalPrice,
  setOriginalPrice,
  discountedPrice,
  setDiscountedPrice,
  stockCount,
  setStockCount,
  isOrganic,
  setIsOrganic,
  hasVariants = false,
  setHasVariants,
  variantsList = [],
  setVariantsList,
  description,
  setDescription,
  customImageUrl,
  setCustomImageUrl,
  uploadingPrimaryImg,
  galleryUrls,
  setGalleryUrls,
  galleryUrlInput,
  setGalleryUrlInput,
  uploadingGalleryImg,
  selectedSections,
  toggleSection,
  submittingProduct,
  language,
  formatPrice,
  t,
  onPrimaryImageUpload,
  onGalleryImageUpload,
  onAddGalleryUrl,
  onSubmit,
}: SellerAddProductTabProps) {
  const [previewImgError, setPreviewImgError] = useState(false);
  const [selectedBuilderColors, setSelectedBuilderColors] = useState<Array<{ name: string; code: string }>>([]);
  const [selectedBuilderSizes, setSelectedBuilderSizes] = useState<string[]>([]);
  const [customColorName, setCustomColorName] = useState('');
  const [customColorCode, setCustomColorCode] = useState('#059669');
  const [customSizeText, setCustomSizeText] = useState('');

  useEffect(() => {
    setPreviewImgError(false);
  }, [customImageUrl]);

  const toggleBuilderColor = (c: { name: string; code: string }) => {
    setSelectedBuilderColors((prev) =>
      prev.some((item) => item.name.toLowerCase() === c.name.toLowerCase())
        ? prev.filter((item) => item.name.toLowerCase() !== c.name.toLowerCase())
        : [...prev, c]
    );
  };

  const addCustomColor = () => {
    if (!customColorName.trim()) return;
    const newC = { name: customColorName.trim(), code: customColorCode || '#059669' };
    if (!selectedBuilderColors.some((item) => item.name.toLowerCase() === newC.name.toLowerCase())) {
      setSelectedBuilderColors((prev) => [...prev, newC]);
    }
    setCustomColorName('');
  };

  const toggleBuilderSize = (s: string) => {
    setSelectedBuilderSizes((prev) =>
      prev.includes(s) ? prev.filter((item) => item !== s) : [...prev, s]
    );
  };

  const addCustomSize = () => {
    if (!customSizeText.trim()) return;
    const s = customSizeText.trim();
    if (!selectedBuilderSizes.includes(s)) {
      setSelectedBuilderSizes((prev) => [...prev, s]);
    }
    setCustomSizeText('');
  };

  const generateCombinations = () => {
    if (!setVariantsList) return;
    const colors = selectedBuilderColors.length > 0 ? selectedBuilderColors : [{ name: '', code: '' }];
    const sizes = selectedBuilderSizes.length > 0 ? selectedBuilderSizes : [''];

    const newRows: FormVariantItem[] = [];
    colors.forEach((c) => {
      sizes.forEach((s) => {
        newRows.push({
          color: c.name || undefined,
          color_code: c.code || undefined,
          size: s || undefined,
          price: Number(discountedPrice) || 100,
          original_price: Number(originalPrice) || Number(discountedPrice) || 100,
          stock: Number(stockCount) || 20,
          is_active: true,
        });
      });
    });

    setVariantsList(newRows);
  };

  const updateVariantRow = (index: number, patch: Partial<FormVariantItem>) => {
    if (!setVariantsList) return;
    setVariantsList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const removeVariantRow = (index: number) => {
    if (!setVariantsList) return;
    setVariantsList((prev) => prev.filter((_, i) => i !== index));
  };

  const orig = typeof originalPrice === 'number' ? originalPrice : 0;
  const disc = typeof discountedPrice === 'number' ? discountedPrice : 0;
  const discountPercent = orig > disc && orig > 0 ? Math.round(((orig - disc) / orig) * 100) : 0;

  return (
    <div>
      {lastAddedProduct && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {language === 'ne' ? 'सामान ग्राहक पसलमा प्रकाशित भयो!' : 'Product Published to Customer Store!'}
              </h3>
              <p className="text-sm text-emerald-300">
                "{lastAddedProduct.name}" ({formatPrice(lastAddedProduct.discounted_price)})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/product/${lastAddedProduct.id}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
            >
              <span>{language === 'ne' ? 'सामान पृष्ठ हेर्नुहोस्' : 'View Product Page'}</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white">{t('seller.createTitle')}</h2>
              <p className="text-sm text-slate-400">{t('seller.createSub')}</p>
            </div>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
              {t('seller.directSync')}
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">
                {t('seller.productName')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={
                  language === 'ne' ? 'जस्तै: अर्गानिक फुजी स्याउ' : 'e.g. Premium Cotton T-Shirt, Running Shoes'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="product-category-select" className="block text-sm font-bold text-slate-300">
                    {t('seller.category')} <span className="text-red-400">*</span>
                  </label>
                  <span className="text-xs text-slate-400">
                    {language === 'ne' ? 'प्रशासक द्वारा निर्धारित' : 'Admin managed'}
                  </span>
                </div>
                <select
                  id="product-category-select"
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  disabled={loadingCategories && categories.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {categories.length === 0 ? (
                    <option value="">
                      {loadingCategories ? 'Loading categories...' : 'No categories available'}
                    </option>
                  ) : (
                    categories.map((cat) =>
                      cat.subcategories && cat.subcategories.length > 0 ? (
                        <optgroup key={cat.id} label={`📁 ${translateCategoryName(cat.slug, cat.name, language)}`}>
                          <option value={cat.slug}>
                            {translateCategoryName(cat.slug, cat.name, language)} (General / Main)
                          </option>
                          {cat.subcategories.map((sub: Category) => (
                            <option key={sub.id} value={sub.slug}>
                              &nbsp;&nbsp;&nbsp;&nbsp;↳ {translateCategoryName(sub.slug, sub.name, language)}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        <option key={cat.id} value={cat.slug}>
                          📁 {translateCategoryName(cat.slug, cat.name, language)}
                        </option>
                      )
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">
                  {t('seller.unitSize')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {PRESET_UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`text-xs px-2.5 py-0.5 rounded cursor-pointer ${unit === u ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">
                  {t('seller.sellingPrice')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={discountedPrice}
                  onChange={(e) => setDiscountedPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('seller.mrpPrice')}</label>
                <input
                  type="number"
                  min="1"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('seller.stockInventory')}</label>
                <input
                  type="number"
                  min="0"
                  value={stockCount}
                  onChange={(e) => setStockCount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Product Variants (Colors & Sizes) Builder Card */}
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {language === 'ne' ? 'रङ र साइजका प्रकारहरू थप्नुहोस् (वैकल्पिक)' : 'Product Variants (Colors & Sizes)'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {language === 'ne'
                        ? 'सामानमा विभिन्न रङ वा साइज भए यहाँबाट सजिलै व्यवस्थापन गर्नुहोस्'
                        : 'Enable if this product comes in different colors or sizes'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasVariants}
                    onChange={(e) => {
                      if (setHasVariants) setHasVariants(e.target.checked);
                      if (!e.target.checked && setVariantsList) setVariantsList([]);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {hasVariants && (
                <div className="pt-3 border-t border-slate-800/80 space-y-4">
                  {/* Step A: Colors Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
                      1. Available Colors ({selectedBuilderColors.length} selected)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((c) => {
                        const isChosen = selectedBuilderColors.some(
                          (item) => item.name.toLowerCase() === c.name.toLowerCase()
                        );
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => toggleBuilderColor(c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${isChosen
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                              }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: c.code }}
                            />
                            <span>{c.name}</span>
                            {isChosen && <Check className="w-3 h-3 text-emerald-400 ml-1" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Color Input */}
                    <div className="flex items-center gap-2 pt-1 max-w-sm">
                      <input
                        type="text"
                        placeholder="Custom color (e.g. Maroon)"
                        value={customColorName}
                        onChange={(e) => setCustomColorName(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="color"
                        value={customColorCode}
                        onChange={(e) => setCustomColorCode(e.target.value)}
                        className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer p-0.5 shrink-0"
                        title="Pick Color"
                      />
                      <button
                        type="button"
                        onClick={addCustomColor}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Step B: Sizes Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
                      2. Available Sizes ({selectedBuilderSizes.length} selected)
                    </label>

                    {/* Clothing Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-500 font-semibold mr-1">Apparel:</span>
                      {PRESET_CLOTHING_SIZES.map((sz) => {
                        const isChosen = selectedBuilderSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => toggleBuilderSize(sz)}
                            className={`min-w-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${isChosen
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                              }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>

                    {/* Shoes Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] text-slate-500 font-semibold mr-1">Shoes:</span>
                      {PRESET_SHOE_SIZES.map((sz) => {
                        const isChosen = selectedBuilderSizes.includes(sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => toggleBuilderSize(sz)}
                            className={`min-w-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${isChosen
                                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                              }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Size Input */}
                    <div className="flex items-center gap-2 pt-1 max-w-sm">
                      <input
                        type="text"
                        placeholder="Custom size (e.g. 500g, Free Size, 128GB)"
                        value={customSizeText}
                        onChange={(e) => setCustomSizeText(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={addCustomSize}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer shrink-0"
                      >
                        Add Size
                      </button>
                    </div>
                  </div>

                  {/* Step C: Generate Combinations Button */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={generateCombinations}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Generate Combinations</span>
                    </button>
                    <span className="text-xs text-slate-400 font-medium">
                      {(variantsList || []).length} variant row{(variantsList || []).length === 1 ? '' : 's'} configured
                    </span>
                  </div>

                  {/* Step D: Variant Table List */}
                    {
                      Array.isArray(variantsList) && variantsList.length > 0 && (
                        <div className="rounded-xl border border-slate-800 overflow-x-auto max-h-[300px] overflow-y-auto">
                          <table className="w-full text-xs text-left text-slate-300">
                            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800 sticky top-0 z-10">
                              <tr>
                                <th className="p-2.5">Variant</th>
                                <th className="p-2.5">Price (NPR)</th>
                                <th className="p-2.5">Stock</th>
                                <th className="p-2.5">Image URL (Optional)</th>
                                <th className="p-2.5 text-center">Active</th>
                                <th className="p-2.5 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80 bg-slate-950">
                              {variantsList.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-900/50">
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5">
                                      {row.color_code && (
                                        <span
                                          className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                                          style={{ backgroundColor: row.color_code }}
                                        />
                                      )}
                                      <span className="font-bold text-white">
                                        {[row.color, row.size].filter(Boolean).join(' / ') || `Variant #${idx + 1}`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-2.5">
                                    <input
                                      type="number"
                                      min="1"
                                      value={row.price || ''}
                                      onChange={(e) => updateVariantRow(idx, { price: Number(e.target.value) })}
                                      className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                  </td>
                                  <td className="p-2.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={row.stock ?? ''}
                                      onChange={(e) => updateVariantRow(idx, { stock: Number(e.target.value) })}
                                      className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                  </td>
                                  <td className="p-2.5">
                                    <input
                                      type="text"
                                      placeholder="https://..."
                                      value={row.image_url || ''}
                                      onChange={(e) => updateVariantRow(idx, { image_url: e.target.value })}
                                      className="w-32 sm:w-44 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-emerald-500"
                                    />
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={row.is_active !== false}
                                      onChange={(e) => updateVariantRow(idx, { is_active: e.target.checked })}
                                      className="w-3.5 h-3.5 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeVariantRow(idx)}
                                      className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                                      title="Delete variant"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    }
                </div>
              )}
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={isOrganic}
                onChange={(e) => setIsOrganic(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700"
              />
              <span>{t('seller.certifiedOrganic')}</span>
            </label>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
              <ProductImageUploadGrid
                images={[customImageUrl, ...galleryUrls].filter(Boolean)}
                onChange={(newImages) => {
                  setCustomImageUrl(newImages[0] || '');
                  setGalleryUrls(newImages.slice(1));
                }}
                maxImages={6}
                disabled={submittingProduct}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1.5">{t('seller.placementSections')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'fresh_arrivals', label: t('home.freshArrivalsTitle') },
                  { id: 'best_sellers', label: t('home.bestSellersTitle') },
                  { id: 'top_deals', label: language === 'ne' ? 'विशेष छुट' : 'Top Deals' },
                  { id: 'trending', label: t('home.trendingTitle') },
                  { id: 'recommended', label: t('home.recommendedTitle') },
                ].map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => toggleSection(sec.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold text-left border cursor-pointer flex items-center justify-between ${selectedSections.includes(sec.id)
                        ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                  >
                    <span>{sec.label}</span>
                    {selectedSections.includes(sec.id) && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-300 mb-1">{t('seller.productDesc')}</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingProduct}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {submittingProduct ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('seller.publishing')}</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('seller.publishBtn')}</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 sticky top-36">
          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {t('seller.livePreview')}
              </span>
              <span className="text-xs text-slate-500 font-mono">{t('seller.realtime')}</span>
            </div>

            <div className="space-y-4">
              <div className="aspect-square rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-4">
                {customImageUrl && !previewImgError ? (
                  <img
                    src={customImageUrl}
                    alt={productName || 'Preview'}
                    onError={() => setPreviewImgError(true)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-600">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">{t('seller.noImageYet')}</p>
                  </div>
                )}
              </div>

              <div>
                <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                  {categories.find((c) => c.slug === categorySlug)?.name || 'Produce'}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {productName || t('seller.previewFallbackName')}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {description || t('seller.previewFallbackDesc')}
                </p>
              </div>

              {hasVariants && variantsList.length > 0 && (
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                    Variants Preview ({variantsList.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {variantsList.slice(0, 6).map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[11px] border border-slate-800">
                        {v.color_code && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color_code }} />}
                        <span>{[v.color, v.size].filter(Boolean).join('/') || `V${i + 1}`}</span>
                      </span>
                    ))}
                    {variantsList.length > 6 && (
                      <span className="text-[11px] text-slate-500 py-0.5">+{variantsList.length - 6} more</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-baseline gap-2 pt-2 border-t border-slate-800">
                <span className="text-2xl font-extrabold text-white font-mono">
                  {formatPrice(disc || 0)}
                </span>
                {orig > disc && (
                  <span className="text-sm text-slate-500 line-through font-mono">
                    {formatPrice(orig)}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>
                  {t('seller.stock')}: <strong className="text-white font-mono">{stockCount || 0}</strong>
                </span>
                <span>
                  {t('seller.unit')}: <strong className="text-white">{unit}</strong>
                </span>
                {isOrganic && (
                  <span className="text-emerald-400 font-semibold">{t('seller.organicBadge')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
