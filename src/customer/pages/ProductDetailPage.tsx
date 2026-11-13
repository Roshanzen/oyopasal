import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../../shared/services/api';
import { Product, ReviewItem } from '../../shared/types';
import { useApp } from '../../shared/context/AppContext';
import ProductCard from '../components/ProductCard';
import { translateCategoryName } from '../../shared/i18n/translations';
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
  AlertCircle,
  RefreshCw
} from 'lucide-react';

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

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [avgRating, setAvgRating] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [mainImgError, setMainImgError] = useState(false);
  const [brokenThumbIdx, setBrokenThumbIdx] = useState<Record<number, boolean>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [buyQuantity, setBuyQuantity] = useState(1);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadProductAndReviews = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setReviewsError(null);
      setMainImgError(false);
      setBrokenThumbIdx({});

      const prod = await api.getProductById(id);
      setProduct(prod);
      setSelectedImageIndex(0);
      if (prod.variants && prod.variants.length > 0) {
        setSelectedVariantId(prod.variants[0].id);
      }

      const [simRes, revRes] = await Promise.allSettled([
        api.getSimilarProducts(id),
        api.getProductReviews(id)
      ]);
      if (simRes.status === 'fulfilled') {
        setSimilarProducts(simRes.value.results || []);
      }
      if (revRes.status === 'fulfilled') {
        setReviews(revRes.value.results || []);
        setAvgRating(revRes.value.average_rating || prod.rating || 5);
      } else {
        setReviewsError('Unable to load customer reviews right now.');
        setAvgRating(prod.rating || 5);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProductAndReviews();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [loadProductAndReviews]);

  useEffect(() => {
    setMainImgError(false);
  }, [selectedImageIndex, product?.id]);

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
      const res = await api.submitProductReview(id, {
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim()
      });
      if (res.success) {
        showToast(language === 'ne' ? 'तपाईंको समीक्षा प्रकाशित भयो!' : 'Thank you! Your review has been published.', 'success');
        setReviewTitle('');
        setReviewComment('');
        const revRes = await api.getProductReviews(id);
        setReviews(revRes.results || []);
        setAvgRating(revRes.average_rating || reviewRating);
      }
    } catch (err: any) {
      showToast(err?.message || 'Could not submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
          <div className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-3/4" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Could not load product</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadProductAndReviews}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
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
          className="px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
        >
          {t('pdp.returnMarketplace')}
        </button>
      </div>
    );
  }

  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId) || null;
  const currentPrice = selectedVariant ? selectedVariant.price : product.discounted_price;
  const originalPrice = selectedVariant ? selectedVariant.original_price : product.original_price;
  const distanceInfo = getDistanceToVendor(product);

  const cartItem = cart?.items.find((item) => item.product_id === product.id && item.selected_variant_id === (selectedVariantId || undefined));
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const wishlisted = isWishlisted(product.id);

  const handleAddToCart = () => {
    addToCart(product.id, buyQuantity, selectedVariantId || undefined);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast(t('pdp.linkCopied'), 'info');
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-6 pb-20">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-700 mr-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.back')}</span>
        </button>
        <span>/</span>
        <Link to="/" className="hover:text-emerald-700">{t('common.home')}</Link>
        <span>/</span>
        <Link to={`/category/${product.category.slug}`} className="hover:text-emerald-700">
          {translateCategoryName(product.category.slug, product.category.name, language)}
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-bold truncate max-w-[260px]">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="relative aspect-square rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs flex items-center justify-center p-4">
            {!mainImgError && (product.gallery[selectedImageIndex] || product.image_url) ? (
              <img
                src={product.gallery[selectedImageIndex] || product.image_url}
                alt={product.name}
                referrerPolicy="no-referrer"
                onError={() => setMainImgError(true)}
                className="w-full h-full object-contain max-h-[460px]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-50 dark:from-slate-800 to-slate-100 dark:to-slate-900 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                <Sparkles className="w-10 h-10 text-emerald-500 mb-2" />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{product.name}</span>
              </div>
            )}
            <button
              onClick={() => toggleWishlist(product.id)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 dark:bg-[#0b0f19]/90 shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${wishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
            </button>
          </div>

          {product.gallery && product.gallery.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-20 h-20 rounded-2xl border-2 overflow-hidden bg-white dark:bg-[#111726] shrink-0 cursor-pointer flex items-center justify-center ${
                    selectedImageIndex === idx ? 'border-emerald-600' : 'border-slate-200 dark:border-slate-700 opacity-70'
                  }`}
                >
                  {!brokenThumbIdx[idx] && img ? (
                    <img
                      src={img}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setBrokenThumbIdx((prev) => ({ ...prev, [idx]: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-emerald-900 dark:text-emerald-200 font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{t('pdp.freshPromise')}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-emerald-900 dark:text-emerald-200 font-bold">
              <Truck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{t('pdp.expressPromise')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {translateCategoryName(product.category.slug, product.category.name, language)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                  {product.origin}
                </span>
              </div>
              <button onClick={handleShare} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer">
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-lg font-bold text-sm">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{avgRating}</span>
              </div>
              <span className="text-sm text-slate-400">{t('pdp.ratingsCount', { count: Math.max(reviews.length, product.reviews_count) })}</span>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums font-display">
                  {formatPrice(currentPrice)}
                </span>
                {originalPrice > currentPrice && (
                  <span className="text-lg text-slate-400 line-through tabular-nums">{formatPrice(originalPrice)}</span>
                )}
                {product.discount_percentage > 0 && (
                  <span className="bg-emerald-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-md">
                    {t('pdp.offBadge', { pct: product.discount_percentage })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 mt-2.5 text-sm">
                <span className="text-slate-500">{t('pdp.unitLabel', { unit: selectedVariant ? selectedVariant.unit : product.unit })}</span>
                <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2.5 py-1 rounded-md text-xs">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t('pdp.distanceAway', { dist: distanceInfo.distanceText, area: currentAddress?.area || 'Kathmandu' })}</span>
                </span>
              </div>
            </div>

            {product.variants && product.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  {t('pdp.selectVariant')}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-4 py-2.5 rounded-xl border text-left cursor-pointer ${
                        selectedVariantId === v.id
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 text-emerald-900 dark:text-emerald-200'
                          : 'bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <p className="text-sm font-bold">{v.name}</p>
                      <p className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">{formatPrice(v.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${product.in_stock && product.stock > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className={`font-bold ${product.in_stock && product.stock > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {product.in_stock && product.stock > 0 ? `${t('common.inStock')} (${product.stock})` : t('common.outOfStock')}
                </span>
              </div>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('pdp.etaLabel', { eta: distanceInfo.etaText })}</span>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{t('pdp.soldBy', { name: product.vendor.name })}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2.5 py-1 rounded shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{distanceInfo.etaText} ({distanceInfo.distanceText})</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('pdp.fulfilmentNote', { origin: product.origin || 'Kathmandu' })}
              </p>
            </div>

            <div className="pt-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">{t('pdp.productDetails')}</h3>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{product.description}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 mt-6">
            {quantityInCart > 0 ? (
              <div className="flex-1 flex items-center justify-between bg-emerald-600 text-white p-3 rounded-2xl shadow-md">
                <button onClick={() => updateCartQuantity(cartItem!.id, quantityInCart - 1)} className="p-2 hover:bg-emerald-700 rounded-xl cursor-pointer">
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <span className="text-xs font-medium text-emerald-100 block">{t('pdp.qtyInBasket')}</span>
                  <span className="text-lg font-extrabold tabular-nums">{quantityInCart}</span>
                </div>
                <button onClick={() => updateCartQuantity(cartItem!.id, quantityInCart + 1)} className="p-2 hover:bg-emerald-700 rounded-xl cursor-pointer">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-1">
                  <button onClick={() => setBuyQuantity(Math.max(1, buyQuantity - 1))} className="p-2.5 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{buyQuantity}</span>
                  <button onClick={() => setBuyQuantity(buyQuantity + 1)} className="p-2.5 rounded-xl text-slate-700 dark:text-slate-200 cursor-pointer">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  disabled={!product.in_stock || product.stock <= 0}
                  onClick={handleAddToCart}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-base shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>{t('pdp.addToBasket', { amount: formatPrice(currentPrice * buyQuantity) })}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Reviews & Ratings Section */}
      <div className="mt-14 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {language === 'ne' ? 'तपाईंको समीक्षा थप्नुहोस्' : 'Write a Customer Review'}
            </h2>
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
                    className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 cursor-pointer"
                  >
                    <Star className={`w-5 h-5 ${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={reviewTitle}
              onChange={(e) => setReviewTitle(e.target.value)}
              placeholder={language === 'ne' ? 'शीर्षक (ऐच्छिक)' : 'Headline (optional)'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
            <textarea
              rows={3}
              required
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder={language === 'ne' ? 'गुणस्तर र ताजापन बारे लेख्नुहोस्...' : 'Share feedback about freshness, quality, and packaging...'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
            >
              {submittingReview ? 'Submitting...' : (language === 'ne' ? 'समीक्षा पठाउनुहोस्' : 'Submit Review')}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {language === 'ne' ? `ग्राहक समीक्षाहरू (${reviews.length})` : `Verified Customer Reviews (${reviews.length})`}
          </h2>
          {reviewsError ? (
            <div className="p-6 rounded-3xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">{reviewsError}</span>
              <button
                type="button"
                onClick={loadProductAndReviews}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              {language === 'ne' ? 'अझै कुनै समीक्षा छैन। पहिलो समीक्षा लेख्नुहोस्!' : 'No written reviews yet. Be the first to review this item!'}
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{rev.author_name}</span>
                      {rev.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full">
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
              ))}
            </div>
          )}
        </div>
      </div>

      {similarProducts.length > 0 && (
        <div className="mt-14 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-display mb-4">{t('pdp.similarTitle')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
