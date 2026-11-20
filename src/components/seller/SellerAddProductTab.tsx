import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { motion } from 'motion/react';
import { translateCategoryName, TranslatorFn } from '../../i18n';
import { Category, Language, Product, Vendor } from '../../types';
import ProductImageUploadGrid from './ProductImageUploadGrid';

const PRESET_UNITS = ['250g', '500g', '1 kg', '2 kg', '1L', '500ml', 'Pack of 1', 'Pack of 2', '12 Pcs'];

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

  useEffect(() => {
    setPreviewImgError(false);
  }, [customImageUrl]);

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
                  language === 'ne' ? 'जस्तै: अर्गानिक फुजी स्याउ' : 'e.g. Organic Red Fuji Apples, Fresh Paneer 500g'
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">
                  {t('seller.category')} <span className="text-red-400">*</span>
                </label>
                <select
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  disabled={loadingCategories && categories.length === 0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {categories.length === 0 ? (
                    <option value={categorySlug}>
                      {loadingCategories ? 'Loading categories...' : 'Fruits & Vegetables'}
                    </option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {translateCategoryName(cat.slug, cat.name, language)}
                      </option>
                    ))
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
                      className={`text-xs px-2.5 py-0.5 rounded cursor-pointer ${
                        unit === u ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
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
                    className={`px-3 py-2 rounded-xl text-sm font-semibold text-left border cursor-pointer flex items-center justify-between ${
                      selectedSections.includes(sec.id)
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

            <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md max-w-sm mx-auto">
              <div className="relative aspect-4/3 w-full bg-slate-800 overflow-hidden flex items-center justify-center">
                {customImageUrl.trim() && !previewImgError ? (
                  <img
                    src={customImageUrl.trim()}
                    alt="Product Preview"
                    onError={() => setPreviewImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <ImageIcon className="w-9 h-9 opacity-60" />
                    <span className="text-xs">Upload or enter image URL to preview</span>
                  </div>
                )}
                {discountPercent > 0 && (
                  <div className="absolute top-2 left-2 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                    {t('pdp.offBadge', { pct: discountPercent })}
                  </div>
                )}
              </div>

              {/* Gallery Mini-strip in preview */}
              {galleryUrls.length > 0 && (
                <div className="flex items-center gap-1.5 p-2 bg-slate-900 border-t border-slate-800/80 overflow-x-auto">
                  {[customImageUrl, ...galleryUrls].filter(Boolean).map((img, i) => (
                    <div
                      key={i}
                      className={`w-9 h-9 rounded-md overflow-hidden border shrink-0 bg-slate-950 ${
                        i === 0 ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-800'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
                  <span className="font-semibold truncate max-w-[160px]">{effectiveVendor.name}</span>
                  <span className="font-mono">⚡ {effectiveVendor.delivery_time_mins || '10-12 mins'}</span>
                </div>
                <h4 className="font-bold text-white text-base line-clamp-1">
                  {productName.trim() || (language === 'ne' ? 'तपाईंको सामानको नाम' : 'Your Product Title')}
                </h4>
                <p className="text-sm text-slate-400 mt-0.5">{unit || '500g'}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-extrabold text-white font-mono tabular-nums">
                      {formatPrice(disc || 95)}
                    </span>
                    {orig > disc && (
                      <span className="text-sm text-slate-500 line-through font-mono tabular-nums">
                        {formatPrice(orig)}
                      </span>
                    )}
                  </div>
                  <span className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-sm">
                    {t('common.add')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
