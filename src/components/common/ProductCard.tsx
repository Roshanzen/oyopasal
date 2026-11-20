import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Share2, ShoppingCart, Sparkles, Star, Store } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const {
    addToCart,
    isWishlisted,
    toggleWishlist,
    showToast,
    formatPrice,
    getDistanceToVendor,
  } = useApp();

  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [product.image_url]);

  const wishlisted = isWishlisted(product.id);

  // Stock check
  const isOutOfStock =
    product.stock === 0 ||
    product.in_stock === false ||
    (product as unknown as Record<string, unknown>).inStock === false;

  // Price & Discount calculation
  const origPrice = product.original_price || 0;
  const discPrice = product.discounted_price || product.price || 0;
  let discountPct = product.discount_percentage || 0;
  if (!discountPct && origPrice > discPrice && origPrice > 0) {
    discountPct = Math.round(((origPrice - discPrice) / origPrice) * 100);
  }

  // Distance computation
  const distObj = product.vendor
    ? getDistanceToVendor(product.vendor.id || product.vendor)
    : { distanceText: '2.4 km', etaText: '14 mins', distanceKm: 2.4 };

  const distanceText = distObj?.distanceText || '2.4 km';
  const travelTimeText = distObj?.etaText ? `(~${distObj.etaText})` : '(~14 mins)';
  const distanceKm = typeof distObj?.distanceKm === 'number' ? distObj.distanceKm : 2.4;
  const proximityProgress = Math.min(88, Math.max(28, Math.round(100 - distanceKm * 8)));

  // Rating and review count
  const ratingScore = Number(product.rating || (product.vendor as unknown as Record<string, unknown>)?.rating || 4.6).toFixed(1);
  const reviewsCount = product.reviews_count || (Math.round((product.original_price || 600) / 7) % 80) + 48;

  // Store attribution
  const storeName = product.vendor?.name || 'rocky Local Store';
  const storeSlug = (product.vendor as unknown as Record<string, unknown>)?.slug || product.vendor?.id || '';

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const productUrl = `${window.location.origin}/product/${product.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(productUrl);
      showToast('Product link copied to clipboard!', 'info');
    }
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product.id, 1);
    showToast(`Added 1 × ${product.name} to cart`, 'success');
  };

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  const handleStoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (storeSlug) {
      navigate(`/stores/${storeSlug}`);
    }
  };

  return (
    <motion.div
      onClick={handleCardClick}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.985 }}
      className="group bg-[#0F172A] rounded-2xl border border-slate-800 hover:border-emerald-500/60 p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer relative select-none h-full hover:shadow-xl hover:shadow-black/50"
    >
      {/* ====================================================================
          1. TOP SQUARE MEDIA CONTAINER (aspect-square, bg-black, rounded-xl)
         ==================================================================== */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black flex items-center justify-center">
        {/* Centered high-resolution product image */}
        {!imageError && product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-slate-500">
            <Sparkles className="w-8 h-8 text-emerald-500 mb-1" />
            <span className="text-xs font-semibold text-slate-400 line-clamp-1">
              {product.name}
            </span>
          </div>
        )}

        {/* Top-Left Discount Pill */}
        {discountPct > 0 && (
          <div className="absolute top-3 left-3 z-20">
            <span className="bg-[#FF1E56] text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md">
              -{discountPct}%
            </span>
          </div>
        )}

        {/* Top-Right Floating Action Stack */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
          {/* Wishlist Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={handleToggleWishlist}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="w-[34px] h-[34px] bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:border-emerald-500 hover:text-emerald-400 rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs shadow-md"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                wishlisted ? 'fill-[#FF1E56] text-[#FF1E56]' : 'text-slate-200 hover:text-[#FF1E56]'
              }`}
            />
          </motion.button>

          {/* Share Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={handleShare}
            aria-label="Share product"
            className="w-[34px] h-[34px] bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:border-emerald-500 hover:text-emerald-400 rounded-full flex items-center justify-center transition-colors cursor-pointer backdrop-blur-xs shadow-md"
          >
            <Share2 className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Out of Stock Overlay on Media */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-15 pointer-events-none">
            <span className="bg-slate-900/90 text-rose-400 border border-rose-500/40 text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
              Out of stock
            </span>
          </div>
        )}

        {/* Bottom Live Store-to-Customer Distance Overlay Bar */}
        <div className="absolute bottom-2.5 inset-x-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 z-10 shadow-lg pointer-events-none">
          {/* Top Row: Store | Distance + Travel Time | You */}
          <div className="flex items-center justify-between text-[11px] font-medium mb-1.5">
            <span className="text-slate-400">Store</span>
            <span className="flex items-center gap-1">
              <span className="text-[#10B981] font-bold">{distanceText}</span>
              <span className="text-slate-300 font-normal">{travelTimeText}</span>
            </span>
            <span className="text-[#EC4899] font-semibold">You</span>
          </div>

          {/* Bottom Progress Track */}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#EC4899]"
                style={{ width: `${proximityProgress}%` }}
              />
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899] shrink-0" />
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. CARD DETAILS BODY (pt-3, flex-col, flex-1)
         ==================================================================== */}
      <div className="pt-3 flex-1 flex flex-col justify-between">
        <div>
          {/* Rating Pill Badge */}
          <div className="inline-flex items-center gap-1 w-fit bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 text-xs mb-2">
            <Star className="w-3 h-3 fill-[#FBBF24] text-[#FBBF24]" />
            <span className="font-bold text-[#FBBF24]">{ratingScore}</span>
            <span className="text-slate-400 font-normal">({reviewsCount})</span>
          </div>

          {/* Product Title */}
          <h3 className="text-white font-bold text-base line-clamp-1 group-hover:text-emerald-400 transition-colors">
            {product.name}
          </h3>

          {/* Store Attribution Row */}
          <div
            onClick={handleStoreClick}
            className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 hover:text-emerald-400 transition-colors cursor-pointer w-fit group/store"
          >
            <Store className="w-3.5 h-3.5 text-slate-400 group-hover/store:text-emerald-400 shrink-0" />
            <span className="truncate font-medium group-hover/store:underline">
              {storeName}
            </span>
          </div>
        </div>

        {/* Subtle Horizontal Divider */}
        <div className="border-t border-slate-800 my-3" />

        {/* Bottom Price & Cart Row */}
        <div className="flex items-center justify-between mt-auto">
          {/* Left: Price Block */}
          <div className="flex items-baseline gap-2 whitespace-nowrap min-w-0">
            <span className="text-white font-extrabold text-xl tabular-nums">
              {formatPrice(discPrice)}
            </span>
            {origPrice > discPrice && (
              <span className="text-xs text-slate-500 line-through font-normal tabular-nums">
                {formatPrice(origPrice)}
              </span>
            )}
          </div>

          {/* Right: Square Rounded Cart Icon Button (38px × 38px) */}
          <motion.button
            whileHover={!isOutOfStock ? { scale: 1.08 } : undefined}
            whileTap={!isOutOfStock ? { scale: 0.92 } : undefined}
            type="button"
            disabled={isOutOfStock}
            onClick={handleAddToCartClick}
            aria-label={`Add ${product.name} to cart`}
            className={`w-[38px] h-[38px] rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
              isOutOfStock
                ? 'opacity-40 cursor-not-allowed bg-slate-800/50 border-slate-700 text-slate-500'
                : 'bg-slate-800/80 border-slate-700 hover:border-emerald-500 hover:bg-emerald-600 text-slate-200 hover:text-white cursor-pointer shadow-sm'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
