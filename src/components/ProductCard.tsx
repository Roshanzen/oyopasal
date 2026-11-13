import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { Plus, Minus, Heart, Star, Clock, Sparkles, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { cart, addToCart, updateCartQuantity, isWishlisted, toggleWishlist, getDistanceToVendor } = useApp();
  const [imageError, setImageError] = useState(false);
  const distanceInfo = getDistanceToVendor(product);

  // Find if this product is in cart
  const cartItem = cart?.items.find((item) => item.product_id === product.id);
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const wishlisted = isWishlisted(product.id);

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateCartQuantity(cartItem.id, quantityInCart + 1);
    } else {
      addToCart(product.id, 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cartItem) {
      updateCartQuantity(cartItem.id, quantityInCart - 1);
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  return (
    <motion.div
      onClick={handleCardClick}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.985 }}
      className="group bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800/90 hover:border-emerald-300 dark:hover:border-emerald-500/60 p-3 sm:p-3.5 flex flex-col justify-between transition-colors duration-200 hover:shadow-lg dark:hover:shadow-emerald-950/20 cursor-pointer relative select-none"
    >
      {/* Top badges & Wishlist */}
      <div className="flex items-center justify-between absolute top-4 left-4 right-4 z-10 pointer-events-none">
        <div className="flex flex-col gap-1 items-start">
          {(product.discount_percentage || 0) > 0 && (
            <span className="bg-emerald-600 text-white font-extrabold text-xs tracking-tight px-2.5 py-0.5 rounded-md shadow-xs">
              {product.discount_percentage}% OFF
            </span>
          )}
          {product.is_organic && (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs px-2 py-0.5 rounded-md">
              Organic
            </span>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.75 }}
          onClick={handleToggleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          className="pointer-events-auto w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs shadow-xs border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
        >
          <motion.div
            animate={wishlisted ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Heart
              className={`w-4 h-4 ${
                wishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-400'
              }`}
            />
          </motion.div>
        </motion.button>
      </div>

      {/* Product Image */}
      <div className="relative w-full aspect-square bg-slate-50 dark:bg-slate-900/60 rounded-xl overflow-hidden mb-3 flex items-center justify-center">
        {!imageError ? (
          <img
            src={product.image_url}
            alt={product.name}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-50 dark:from-slate-800 to-slate-100 dark:to-slate-900 flex flex-col items-center justify-center p-3 text-center">
            <Sparkles className="w-6 h-6 text-emerald-500 mb-1" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{product.name}</span>
          </div>
        )}

        {/* Quick speed label */}
        <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1">
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>{distanceInfo?.etaText || '10-15 mins'}</span>
        </div>
      </div>

      {/* Product Information */}
      <div className="flex-1 flex flex-col">
        {/* Unit & Vendor */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="font-semibold text-slate-600 dark:text-slate-300 shrink-0">{product.unit || 'Standard'}</span>
          <span className="text-xs flex-1 min-w-0 truncate text-right" title={product.vendor?.name || 'Local Mart'}>
            {product.vendor?.name || 'Local Mart'}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors mb-2">
          {product.name}
        </h3>

        {/* Rating and Reviews */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-sm font-bold text-xs">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>{product.rating || 4.8}</span>
          </div>
          <span className="text-slate-400 dark:text-slate-500">({product.reviews_count || 12})</span>
        </div>

        {/* Price & Add to Cart Container */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                Rs. {product.discounted_price}
              </span>
              {(product.original_price || 0) > (product.discounted_price || 0) && (
                <span className="text-sm text-slate-400 dark:text-slate-500 line-through tabular-nums">
                  Rs. {product.original_price}
                </span>
              )}
            </div>

            {/* Distance from chosen location */}
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{distanceInfo?.distanceText || '0.8 km'} away</span>
            </div>

            {product.stock <= 5 && product.stock > 0 && (
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                Only {product.stock} left!
              </span>
            )}
            {!product.in_stock && (
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                Out of Stock
              </span>
            )}
          </div>

          {/* Stepper or Add Button with Spring Taps */}
          <div className="shrink-0">
            {!product.in_stock ? (
              <button
                disabled
                className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed"
              >
                Sold Out
              </button>
            ) : quantityInCart > 0 ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center bg-emerald-600 text-white rounded-xl shadow-xs overflow-hidden"
              >
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={handleDecrement}
                  aria-label="Decrease quantity"
                  className="p-2 px-2.5 hover:bg-emerald-700 active:bg-emerald-800 transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </motion.button>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={quantityInCart}
                    initial={{ y: -6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="px-2 text-sm font-extrabold tabular-nums select-none min-w-[22px] text-center"
                  >
                    {quantityInCart}
                  </motion.span>
                </AnimatePresence>
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  onClick={handleIncrement}
                  aria-label="Increase quantity"
                  className="p-2 px-2.5 hover:bg-emerald-700 active:bg-emerald-800 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleIncrement}
                className="px-4 py-2 rounded-xl border border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold text-sm bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-600 dark:hover:bg-emerald-600 hover:text-white transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ADD</span>
              </motion.button>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
}
