import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
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
  CheckCircle,
  Share2,
  Package,
  MapPin
} from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { cart, addToCart, updateCartQuantity, isWishlisted, toggleWishlist, showToast, getDistanceToVendor, currentAddress } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [buyQuantity, setBuyQuantity] = useState(1);

  useEffect(() => {
    async function loadProduct() {
      if (!id) return;
      try {
        setLoading(true);
        const prod = await api.getProductById(id);
        setProduct(prod);
        if (prod.variants && prod.variants.length > 0) {
          setSelectedVariantId(prod.variants[0].id);
        }
        const sim = await api.getSimilarProducts(id);
        setSimilarProducts(sim.results || []);
      } catch (err) {
        console.error('Failed to load product detail', err);
      } finally {
        setLoading(false);
      }
    }
    loadProduct();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
          <div className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-3xl" />
          <div className="space-y-4">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-3/4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/2" />
            <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3" />
            <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Product Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
          The requested product may have been moved or is currently unavailable.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  const selectedVariant = product.variants?.find((v) => v.id === selectedVariantId) || null;
  const currentPrice = selectedVariant ? selectedVariant.price : product.discounted_price;
  const originalPrice = selectedVariant ? selectedVariant.original_price : product.original_price;
  const distanceInfo = getDistanceToVendor(product);

  // Cart status
  const cartItem = cart?.items.find((item) => item.product_id === product.id && item.selected_variant_id === (selectedVariantId || undefined));
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const wishlisted = isWishlisted(product.id);

  const handleAddToCart = () => {
    addToCart(product.id, buyQuantity, selectedVariantId || undefined);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast('Product link copied to clipboard!', 'info');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
      
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 mr-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span>/</span>
        <Link to="/" className="hover:text-emerald-700 dark:hover:text-emerald-400">Home</Link>
        <span>/</span>
        <Link to={`/category/${product.category.slug}`} className="hover:text-emerald-700 dark:hover:text-emerald-400">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-bold truncate max-w-[200px]">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        
        {/* Left: Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-square rounded-3xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs flex items-center justify-center p-4">
            <img
              src={product.gallery[selectedImageIndex] || product.image_url}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain max-h-[460px]"
            />

            <button
              onClick={() => toggleWishlist(product.id)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-xs shadow-md border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <Heart
                className={`w-5 h-5 ${wishlisted ? 'fill-rose-500 text-rose-500' : 'text-slate-400 dark:text-slate-400'}`}
              />
            </button>
          </div>

          {/* Thumbnails */}
          {product.gallery && product.gallery.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {product.gallery.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-20 h-20 rounded-2xl border-2 overflow-hidden bg-white dark:bg-[#111726] shrink-0 transition-all cursor-pointer ${
                    selectedImageIndex === idx
                      ? 'border-emerald-600 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Guarantee Badges */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>OyoPasal Freshness Promise: 100% money back if not fresh</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200 font-bold">
              <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Express delivery from neighborhood hub in 10-15 minutes</span>
            </div>
          </div>
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="flex flex-col justify-between">
          <div className="space-y-5">
            {/* Vendor & Rating */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {product.category.name}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                  {product.origin}
                </span>
              </div>
              <button
                onClick={handleShare}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Share product"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight leading-tight">
              {product.name}
            </h1>

            {/* Rating & Reviews */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg font-bold text-xs">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{product.rating}</span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Based on {product.reviews_count} verified buyer ratings
              </span>
            </div>

            {/* Price section */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white tabular-nums font-display">
                  Rs. {currentPrice}
                </span>
                {originalPrice > currentPrice && (
                  <span className="text-base text-slate-400 dark:text-slate-500 line-through tabular-nums">
                    Rs. {originalPrice}
                  </span>
                )}
                {product.discount_percentage > 0 && (
                  <span className="bg-emerald-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-md">
                    {product.discount_percentage}% OFF
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800 mt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Unit: {selectedVariant ? selectedVariant.unit : product.unit}
                </span>
                <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{distanceInfo.distanceText} away from {currentAddress?.area || 'Kathmandu'}</span>
                </span>
              </div>
            </div>

            {/* Variants Selector */}
            {product.variants && product.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  Select Pack Size / Weight
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selectedVariantId === v.id
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 text-emerald-900 dark:text-emerald-200 shadow-2xs'
                          : 'bg-white dark:bg-[#111726] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold">{v.name}</p>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                        Rs. {v.price}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock status & distance */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400">In Stock</span>
                <span className="text-slate-400 dark:text-slate-500">· Ready to dispatch from nearest hub</span>
              </div>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{distanceInfo.etaText} ETA</span>
            </div>

            {/* Vendor Details Card */}
            <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Sold by: {product.vendor.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded">
                  <Clock className="w-3 h-3" />
                  <span>{distanceInfo.etaText} ({distanceInfo.distanceText})</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fulfillment store located in {product.origin || 'Kathmandu'}. Express 10-15 min dispatch directly to your chosen delivery pin.
              </p>
            </div>

            {/* Description */}
            <div className="pt-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                Product Details
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {product.description}
              </p>
            </div>

          </div>

          {/* Action Button Strip */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 mt-6">
            {quantityInCart > 0 ? (
              <div className="flex-1 flex items-center justify-between bg-emerald-600 text-white p-2.5 rounded-2xl shadow-md">
                <button
                  onClick={() => updateCartQuantity(cartItem!.id, quantityInCart - 1)}
                  className="p-2 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <span className="text-xs font-medium text-emerald-100 block">Quantity in Basket</span>
                  <span className="text-base font-extrabold tabular-nums">{quantityInCart}</span>
                </div>
                <button
                  onClick={() => updateCartQuantity(cartItem!.id, quantityInCart + 1)}
                  className="p-2 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-1">
                  <button
                    onClick={() => setBuyQuantity(Math.max(1, buyQuantity - 1))}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                    {buyQuantity}
                  </span>
                  <button
                    onClick={() => setBuyQuantity(buyQuantity + 1)}
                    className="p-2 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add to Basket · Rs. {currentPrice * buyQuantity}</span>
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Similar Products Shelf */}
      {similarProducts.length > 0 && (
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display mb-4">
            Frequently Bought Together & Similar Items
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
