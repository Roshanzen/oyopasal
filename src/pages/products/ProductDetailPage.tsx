import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context';
import { useProductDetail } from '../../hooks';
import ProductCard from '../../components/common/ProductCard';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { translateCategoryName } from '../../i18n';
import {
  Star,
  Clock,
  ShieldCheck,
  Store,
  Heart,
  Plus,
  Minus,
  ArrowLeft,
  Truck,
  Share2,
  MapPin,
  CheckCircle2,
  MessageSquarePlus,
  Sparkles,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  RotateCcw,
  Wallet,
  Tag,
  ShoppingCart,
  ShoppingBag,
  ExternalLink,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    cart,
    user,
    setLoginModalOpen,
    addToCart,
    updateCartQuantity,
    isWishlisted,
    toggleWishlist,
    showToast,
    getDistanceToVendor,
    currentAddress,
    t,
    formatPrice,
    language
  } = useApp();

  const {
    product,
    similarProducts,
    reviews,
    avgRating,
    loading,
    error,
    reviewsError,
    reload: loadProductAndReviews,
    submitReview,
  } = useProductDetail(id);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mainImgError, setMainImgError] = useState(false);
  const [brokenThumbIdx, setBrokenThumbIdx] = useState<Record<number, boolean>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setSelectedImageIndex(0);
    setMainImgError(false);
    setBrokenThumbIdx({});
    if (product?.variants && product.variants.length > 0) {
      setSelectedVariantId(product.variants[0].id);
    } else {
      setSelectedVariantId('');
    }
    setBuyQuantity(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product?.id, product?.variants]);

  useEffect(() => {
    setMainImgError(false);
  }, [selectedImageIndex, product?.id]);

  const galleryList = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.gallery) && product.gallery.length > 0) {
      return product.gallery;
    }
    return product.image_url ? [product.image_url] : [];
  }, [product]);

  const activeImage = galleryList[selectedImageIndex] || product?.image_url || '';

  const selectedVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;
    return product.variants.find((v) => v.id === selectedVariantId) || product.variants[0] || null;
  }, [product, selectedVariantId]);

  // Only explicitly out of stock if stock is strictly 0 or in_stock/inStock is explicitly false
  const isOutOfStock = useMemo(() => {
    if (!product) return false;
    if (product.stock === 0) return true;
    if (product.in_stock === false) return true;
    if ((product as unknown as Record<string, unknown>).inStock === false) return true;
    return false;
  }, [product]);

  const currentPrice = selectedVariant ? selectedVariant.price : (product?.discounted_price || 0);
  const originalPrice = selectedVariant ? selectedVariant.original_price : (product?.original_price || currentPrice);
  const savingsAmount = originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const discountPct = originalPrice > currentPrice && originalPrice > 0
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : (product?.discount_percentage || 0);

  const distanceInfo = product?.vendor ? getDistanceToVendor(product) : { etaText: '10-15 mins', distanceText: '1.2 km' };

  const cartItem = cart?.items.find(
    (item) => item.product_id === product?.id && item.selected_variant_id === (selectedVariantId || undefined)
  );
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const wishlisted = product ? isWishlisted(product.id) : false;

  const handleAddToCart = async () => {
    if (!product || isOutOfStock) return;
    try {
      const variantToUse = selectedVariant?.id || selectedVariantId || undefined;
      await addToCart(
        product.id,
        buyQuantity,
        variantToUse,
        `Added ${buyQuantity} × ${product.name} to cart`
      );
    } catch {
      // Error is caught and surfaced in addToCart
    }
  };

  const handleBuyNow = async () => {
    if (!product || isOutOfStock) return;
    try {
      const variantToUse = selectedVariant?.id || selectedVariantId || undefined;
      await addToCart(product.id, buyQuantity, variantToUse, null);
      navigate('/checkout');
    } catch {
      // Error is caught and surfaced in addToCart
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast(t('pdp.linkCopied'), 'info');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!user) {
      showToast(language === 'ne' ? 'समीक्षा लेख्न लगइन गर्नुहोस्' : 'Please sign in to submit a review', 'info');
      setLoginModalOpen(true);
      return;
    }
    if (!reviewComment.trim()) {
      showToast('Please write a review comment', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await submitReview({
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim()
      });
      if (res.success) {
        showToast(language === 'ne' ? 'तपाईंको समीक्षा प्रकाशित भयो!' : 'Thank you! Your review has been published.', 'success');
        setReviewTitle('');
        setReviewComment('');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Vendor contact info for WhatsApp & Phone
  const vendorPhone = product?.vendor?.phone || '9800000000';
  const cleanPhone = vendorPhone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/977${cleanPhone.slice(-10)}?text=${encodeURIComponent(
    `Namaste! I am interested in purchasing "${product?.name || 'this item'}" from OyoPasal.`
  )}`;

  // Dynamic estimated delivery date
  const deliveryEstimateDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayName = tomorrow.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = tomorrow.toLocaleDateString('en-US', { month: 'short' });
    const dateNum = tomorrow.getDate();
    return `Tomorrow – ${dayName}, ${monthName} ${dateNum}`;
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
          <div className="lg:col-span-7 flex flex-col md:flex-row gap-4">
            <div className="hidden md:flex flex-col gap-3 w-[72px]">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-[72px] h-[72px] rounded-xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
            <div className="flex-1 aspect-square rounded-2xl bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="h-10 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-12 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-44 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            <div className="h-44 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-20 px-4 space-y-4">
        <ErrorAlert message={error} onRetry={loadProductAndReviews} />
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer hover:bg-slate-300 transition-colors"
          >
            {t('pdp.returnMarketplace')}
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('pdp.notFoundTitle')}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">{t('pdp.notFoundSub')}</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer hover:bg-emerald-700 transition-colors"
        >
          {t('pdp.returnMarketplace')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#FAFAFA] dark:bg-[#090D16] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('common.back')}</span>
          </button>
          <span>/</span>
          <Link to="/" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
            {t('common.home')}
          </Link>
          <span>/</span>
          <Link
            to={`/category/${product.category?.slug || 'all'}`}
            className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            {translateCategoryName(product.category?.slug || 'all', product.category?.name || 'General', language)}
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-bold truncate max-w-[200px] sm:max-w-[320px]">
            {product.name}
          </span>
        </nav>

        {/* Two-Column Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* ====================================================================
              LEFT COLUMN (60% width on desktop: lg:col-span-7)
              Product Media Gallery & Specifications
             ==================================================================== */}
          <div className="lg:col-span-7 space-y-8">
            {/* Media Gallery Section */}
            <div className="flex flex-col-reverse md:flex-row gap-4">
              {/* Vertical Thumbnail Strip (Left, 72px wide) */}
              {galleryList.length > 1 && (
                <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto max-h-[500px] w-full md:w-[72px] shrink-0 py-1 md:py-0 no-scrollbar">
                  {galleryList.map((img, idx) => {
                    const isActive = selectedImageIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-16 h-16 md:w-[72px] md:h-[72px] rounded-xl overflow-hidden bg-white dark:bg-[#111726] border-2 transition-all duration-150 cursor-pointer shrink-0 p-1 flex items-center justify-center ${
                          isActive
                            ? 'border-[#059669] shadow-sm ring-1 ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {!brokenThumbIdx[idx] && img ? (
                          <img
                            src={img}
                            alt={`${product.name} thumbnail ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            onError={() => setBrokenThumbIdx((prev) => ({ ...prev, [idx]: true }))}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Main Image Showcase Card (Right) */}
              <div className="relative flex-1 aspect-square rounded-2xl bg-white dark:bg-[#111726] border border-[#E2E8F0] dark:border-slate-800 shadow-sm overflow-hidden flex items-center justify-center p-6 sm:p-10 group">
                {!mainImgError && activeImage ? (
                  <img
                    src={activeImage}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    onError={() => setMainImgError(true)}
                    className="w-full h-full object-contain max-h-[460px] transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-50 dark:from-slate-800 to-slate-100 dark:to-slate-900 rounded-xl flex flex-col items-center justify-center p-6 text-center">
                    <Sparkles className="w-12 h-12 text-emerald-600 mb-3" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{product.name}</span>
                  </div>
                )}

                {/* Top-Right Floating Action Stack */}
                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-label="Save to Wishlist"
                    className="w-9 h-9 rounded-full bg-white/95 dark:bg-[#0b0f19]/95 shadow-md border border-slate-200/80 dark:border-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <Heart className={`w-4.5 h-4.5 transition-colors ${wishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-500 hover:text-rose-500'}`} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={handleShare}
                    aria-label="Share product"
                    className="w-9 h-9 rounded-full bg-white/95 dark:bg-[#0b0f19]/95 shadow-md border border-slate-200/80 dark:border-slate-700 flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors"
                  >
                    <Share2 className="w-4.5 h-4.5" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    aria-label="View fullscreen image"
                    className="w-9 h-9 rounded-full bg-white/95 dark:bg-[#0b0f19]/95 shadow-md border border-slate-200/80 dark:border-slate-700 flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors"
                  >
                    <Maximize2 className="w-4.5 h-4.5" />
                  </motion.button>
                </div>

                {/* Bottom-Center Carousel Pill */}
                {galleryList.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-sm flex items-center gap-1.5">
                    {galleryList.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedImageIndex(idx)}
                        aria-label={`Show slide ${idx + 1}`}
                        className="p-0.5 cursor-pointer focus:outline-none"
                      >
                        <span
                          className={`block h-1.5 rounded-full transition-all duration-200 ${
                            idx === selectedImageIndex ? 'w-5 bg-[#059669]' : 'w-1.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Product Details Tabs (Below Gallery) */}
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Tab Header Bar */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('description')}
                  className={`pb-3.5 pt-3 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer mr-6 flex items-center gap-2 ${
                    activeTab === 'description'
                      ? 'border-[#059669] text-[#059669] dark:text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Description & Specifications</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-3.5 pt-3 px-2 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'reviews'
                      ? 'border-[#059669] text-[#059669] dark:text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Customer Reviews</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {reviews.length}
                  </span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'description' ? (
                  <div className="space-y-6">
                    {/* Editorial Description */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">About this product</h3>
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {product.description || 'No detailed description provided for this item.'}
                      </p>
                    </div>

                    {/* Structured Key-Value Specification Table */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Specifications</h3>
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/30">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Brand / Merchant</span>
                          <Link
                            to={`/stores/${product.vendor?.slug || product.vendor?.id || ''}`}
                            className="font-bold text-[#059669] dark:text-emerald-400 hover:underline flex items-center gap-1.5 mt-1 sm:mt-0"
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>{product.vendor?.name || 'Verified Merchant'}</span>
                          </Link>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-[#111726]">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Category</span>
                          <span className="font-semibold text-slate-900 dark:text-white mt-1 sm:mt-0">
                            {translateCategoryName(product.category?.slug || '', product.category?.name || '', language)}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/30">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Product Unit / Pack</span>
                          <span className="font-semibold text-slate-900 dark:text-white mt-1 sm:mt-0">
                            {selectedVariant ? selectedVariant.unit : (product.unit || 'Standard Unit')}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-[#111726]">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Origin</span>
                          <span className="font-semibold text-slate-900 dark:text-white mt-1 sm:mt-0">
                            {product.origin || 'Kathmandu, Nepal'}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/30">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Warranty & Guarantee</span>
                          <span className="font-semibold text-slate-900 dark:text-white mt-1 sm:mt-0">
                            100% Genuine • 7 Days Return Guarantee
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-[#111726]">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Key Features</span>
                          <div className="flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                            {product.is_organic && (
                              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                                100% Organic
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              Fast Hyperlocal Delivery
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              Direct from Farmer / Maker
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Reviews Tab Content */
                  <div className="space-y-8">
                    {/* Review Form */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquarePlus className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {language === 'ne' ? 'तपाईंको समीक्षा थप्नुहोस्' : 'Write a Customer Review'}
                        </h4>
                      </div>

                      <form onSubmit={handleSubmitReview} className="space-y-3.5">
                        <div>
                          <label className="text-xs font-bold uppercase text-slate-500 block mb-1.5">Rating</label>
                          <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewRating(star)}
                                className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                              >
                                <Star
                                  className={`w-5 h-5 ${
                                    star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={reviewTitle}
                          onChange={(e) => setReviewTitle(e.target.value)}
                          placeholder={language === 'ne' ? 'शीर्षक (ऐच्छिक)' : 'Headline (optional)'}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <textarea
                          rows={3}
                          required
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder={
                            language === 'ne'
                              ? 'गुणस्तर र ताजापन बारे लेख्नुहोस्...'
                              : 'Share feedback about freshness, quality, and packaging...'
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {submittingReview ? 'Submitting...' : language === 'ne' ? 'समीक्षा पठाउनुहोस्' : 'Submit Review'}
                        </button>
                      </form>
                    </div>

                    {/* Review List */}
                    <div className="space-y-3">
                      {reviewsError && <ErrorAlert message={reviewsError} onRetry={loadProductAndReviews} />}

                      {reviews.length === 0 ? (
                        <div className="p-8 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
                          {language === 'ne'
                            ? 'अझै कुनै समीक्षा छैन। पहिलो समीक्षा लेख्नुहोस्!'
                            : 'No written reviews yet. Be the first to review this item!'}
                        </div>
                      ) : (
                        reviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">{rev.author_name}</span>
                                {rev.is_verified_purchase && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                                <Star className="w-3.5 h-3.5 fill-amber-400" />
                                <span>{rev.rating}.0</span>
                              </div>
                            </div>
                            {rev.title && <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{rev.title}</p>}
                            <p className="text-sm text-slate-600 dark:text-slate-300">{rev.comment}</p>
                            <p className="text-xs text-slate-400">{new Date(rev.created_at).toLocaleDateString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ====================================================================
              RIGHT COLUMN (40% width on desktop: lg:col-span-5, sticky on scroll)
              Product Summary, Purchase Actions & Logistics
             ==================================================================== */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24 h-fit">
            {/* Brand & Title Header Card */}
            <div className="space-y-3">
              {/* Verified Store Pill Badge */}
              <Link
                to={`/stores/${product.vendor?.slug || product.vendor?.id || ''}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:border-emerald-500 transition-colors cursor-pointer group/badge"
              >
                <Store className="w-3.5 h-3.5 text-[#059669]" />
                <span className="font-extrabold group-hover/badge:underline">{product.vendor?.name || 'Verified Merchant'}</span>
                <span className="inline-flex items-center gap-0.5 text-[#059669] dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded font-semibold text-[11px]">
                  <Check className="w-3 h-3 stroke-[3]" /> Brand store
                </span>
              </Link>

              {/* Product Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-snug font-display">
                {product.name}
              </h1>

              {/* Rating & Review Counter */}
              <div className="flex items-center gap-2.5 text-sm">
                <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-lg font-bold text-xs">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{avgRating}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className="text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer underline"
                >
                  {reviews.length} customer ratings
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedVariant ? selectedVariant.unit : (product.unit || 'Standard')}
                </span>
              </div>

              {/* Pricing Row */}
              <div className="pt-2">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] dark:text-white tabular-nums tracking-tight font-display">
                    {formatPrice(currentPrice)}
                  </span>
                  {originalPrice > currentPrice && (
                    <span className="text-lg text-slate-400 line-through tabular-nums font-semibold">
                      {formatPrice(originalPrice)}
                    </span>
                  )}
                  {discountPct > 0 && (
                    <span className="bg-rose-500 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-md shadow-2xs">
                      -{discountPct}%
                    </span>
                  )}
                </div>

                {savingsAmount > 0 && (
                  <p className="text-xs font-bold text-[#059669] dark:text-emerald-400 mt-1">
                    You save {formatPrice(savingsAmount)}
                  </p>
                )}
              </div>
            </div>

            {/* Product Variants (if applicable) */}
            {product.variants && product.variants.length > 0 && (
              <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                  Select Size / Option
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariantId === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`px-3.5 py-2 rounded-xl border text-left cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#ECFDF5] dark:bg-emerald-950/70 border-[#059669] text-emerald-900 dark:text-emerald-200 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <p className="text-xs font-bold">{v.name}</p>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                          {formatPrice(v.price)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================================================================
                PURCHASE ACTION CARD
                Rounded-2xl white card with 2px emerald top accent border
               ================================================================ */}
            <div className="relative rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 p-5 shadow-sm overflow-hidden before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-[#059669]">
              {/* Quantity Row */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Quantity
                </span>

                <div className="flex items-center gap-3">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                    <button
                      type="button"
                      disabled={buyQuantity <= 1 || isOutOfStock}
                      onClick={() => setBuyQuantity((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-extrabold text-sm tabular-nums text-slate-900 dark:text-white">
                      {buyQuantity}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock || (typeof product.stock === 'number' && product.stock > 0 ? buyQuantity >= product.stock : false)}
                      onClick={() => setBuyQuantity((q) => q + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Stock Status Indicator */}
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {isOutOfStock ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-rose-600 dark:text-rose-400">Out of stock</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse" />
                        <span className="text-[#059669] dark:text-emerald-400">In stock</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary CTA Row (2-column grid) */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                {/* Outlined Emerald Button: Add to Cart */}
                <motion.button
                  whileHover={!isOutOfStock ? { scale: 1.02 } : undefined}
                  whileTap={!isOutOfStock ? { scale: 0.98 } : undefined}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={handleAddToCart}
                  style={{ borderWidth: '1.5px', borderStyle: 'solid', borderColor: isOutOfStock ? '#CBD5E1' : '#059669' }}
                  className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-2xs ${
                    isOutOfStock
                      ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-50 dark:bg-slate-900/50'
                      : 'text-[#059669] dark:text-emerald-400 bg-white dark:bg-[#111726] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer'
                  }`}
                >
                  <ShoppingCart className={`w-4 h-4 ${isOutOfStock ? 'text-slate-400' : 'text-[#059669] dark:text-emerald-400'}`} />
                  <span>Add to Cart</span>
                </motion.button>

                {/* Solid Emerald Button: Buy Now */}
                <motion.button
                  whileHover={!isOutOfStock ? { scale: 1.02 } : undefined}
                  whileTap={!isOutOfStock ? { scale: 0.98 } : undefined}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={handleBuyNow}
                  className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-950/20 ${
                    isOutOfStock
                      ? 'opacity-40 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500'
                      : 'bg-[#059669] hover:bg-emerald-700 text-white cursor-pointer'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <span>Buy Now</span>
                </motion.button>
              </div>

              {/* Direct Order Divider Row */}
              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <span className="relative bg-white dark:bg-[#111726] px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Or order directly
                </span>
              </div>

              {/* WhatsApp & Call Direct Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={`tel:${vendorPhone}`}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>Call Store</span>
                </a>
              </div>
            </div>

            {/* ================================================================
                DELIVERY & SERVICE CARD
                Rounded-2xl white card with 2x2 Info Tile Grid
               ================================================================ */}
            <div className="rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              {/* Header Row */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Delivery & service
                </h3>
                <span className="text-xs font-bold text-[#059669] dark:text-emerald-400 hover:underline cursor-pointer">
                  Shipping policy
                </span>
              </div>

              {/* 2x2 Info Tile Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Tile 1: ESTIMATED DELIVERY */}
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Truck className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Estimated Delivery</span>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                      {deliveryEstimateDate}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Kathmandu Valley
                    </p>
                  </div>
                </div>

                {/* Tile 2: PAYMENT */}
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Wallet className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Payment</span>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                      Cash • eSewa • Khalti
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Paid to the seller
                    </p>
                  </div>
                </div>

                {/* Tile 3: RETURNS */}
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <RotateCcw className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Returns</span>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                      Within 7 days
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Returns policy
                    </p>
                  </div>
                </div>

                {/* Tile 4: DELIVERY CHARGE */}
                <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                    <Tag className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Delivery Charge</span>
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                      Rs 150 • free over Rs 5,000
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      OyoPasal standard delivery
                    </p>
                  </div>
                </div>
              </div>

              {/* Card Footer Note */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 leading-relaxed border-t border-slate-100 dark:border-slate-800">
                Outside the Valley: 3–5 days to major cities, 5–10 days elsewhere in Nepal.
              </p>
            </div>
          </div>
        </div>

        {/* Similar Products Recommendation Grid */}
        {similarProducts.length > 0 && (
          <div className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
                  {t('pdp.similarTitle')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Customers who viewed this item also explored these products
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {similarProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal for Fullscreen Image Preview */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Prev Image */}
            {galleryList.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedImageIndex((idx) => (idx === 0 ? galleryList.length - 1 : idx - 1))
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Main Lightbox Image */}
            <div className="max-w-4xl max-h-[85vh] flex items-center justify-center">
              <img
                src={activeImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Next Image */}
            {galleryList.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedImageIndex((idx) => (idx === galleryList.length - 1 ? 0 : idx + 1))
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Bottom Caption */}
            <div className="absolute bottom-5 text-center text-xs text-white/70">
              {product.name} ({selectedImageIndex + 1} of {galleryList.length})
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
