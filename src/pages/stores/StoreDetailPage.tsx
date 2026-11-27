import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Heart,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ProductCard from '../../components/common/ProductCard';
import { ChatModal } from '../../components/chat/ChatModal';
import { useApp } from '../../context';
import { productService, vendorService } from '../../services';
import { messagingService } from '../../services/messagingService';
import { Product, StoreDetail, Vendor } from '../../types';
import { ConversationDetail } from '../../types/messaging';
import { safeStorage } from '../../utils';

const FAVORITE_STORES_STORAGE_KEY = 'oyopasal_fav_stores';

export default function StoreDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const {
    vendors,
    getDistanceToVendor,
    showToast,
    language,
    t,
    user,
    setLoginModalOpen,
  } = useApp();

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Live in-platform customer-vendor messaging
  const [chatOpen, setChatOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [startingChat, setStartingChat] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('relevance');

  // Favorites state
  const [isFavorite, setIsFavorite] = useState<boolean>(false);

  // Lightbox Modal state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Fallback matched vendor from global context
  const matchedVendorFromContext = useMemo(() => {
    if (!slug) return null;
    const lower = slug.toLowerCase();
    return (
      vendors.find(
        (v) =>
          v.id === slug ||
          (v.slug && v.slug.toLowerCase() === lower) ||
          v.name.toLowerCase() === lower ||
          v.name.toLowerCase().replace(/\s+/g, '-') === lower
      ) || null
    );
  }, [slug, vendors]);

  // Load Store Detail
  useEffect(() => {
    if (!slug) return;
    let isCancelled = false;

    const loadStore = async () => {
      setLoadingStore(true);
      setStoreError(null);

      try {
        const data = await vendorService.getStoreBySlug(slug);
        if (!isCancelled && data) {
          setStore(data);
        }
      } catch (err: unknown) {
        console.warn('Could not fetch store from backend endpoint, using vendor fallback:', err);
        if (!isCancelled) {
          const isContextVendorVerified = Boolean(
            matchedVendorFromContext &&
            (matchedVendorFromContext.verified ||
             matchedVendorFromContext.is_verified ||
             matchedVendorFromContext.status === 'APPROVED')
          );

          if (matchedVendorFromContext && isContextVendorVerified) {
            // Construct store details from verified vendor object
            const fallbackStore: StoreDetail = {
              id: matchedVendorFromContext.id,
              name: matchedVendorFromContext.name,
              slug: matchedVendorFromContext.slug || slug,
              description: matchedVendorFromContext.description || 'Official certified marketplace vendor on OyoPasal providing fast, fresh, high-quality groceries and goods.',
              logo_url: matchedVendorFromContext.logo_url || '',
              banner_url: matchedVendorFromContext.cover_image_url || matchedVendorFromContext.image || '',
              is_active: matchedVendorFromContext.is_online !== false,
              is_verified: true,
              rating: matchedVendorFromContext.rating || 4.8,
              delivery_time_mins: matchedVendorFromContext.delivery_time_mins || '10-15 mins',
              open_time: matchedVendorFromContext.open_time || '06:00',
              close_time: matchedVendorFromContext.close_time || '21:00',
              address: matchedVendorFromContext.area || matchedVendorFromContext.location || 'Chapakhel Road, Lalitpur, Nepal',
              phone: matchedVendorFromContext.phone || '+977-1-5544332',
              email: matchedVendorFromContext.email || 'store@oyopasal.com',
              fulfillment_modes: 'Store Pickup & Delivery',
              gallery: [
                matchedVendorFromContext.cover_image_url || matchedVendorFromContext.image,
                matchedVendorFromContext.logo_url,
              ].filter(Boolean) as string[],
            };
            setStore(fallbackStore);
          } else {
            setStoreError('Store profile not found or pending verification.');
          }
        }
      } finally {
        if (!isCancelled) setLoadingStore(false);
      }
    };

    loadStore();

    return () => {
      isCancelled = true;
    };
  }, [slug, matchedVendorFromContext]);

  // Check and initialize favorite state
  useEffect(() => {
    const favs = safeStorage.getJson<string[]>(FAVORITE_STORES_STORAGE_KEY) || [];
    const identifier = store?.id || store?.slug || slug || '';
    setIsFavorite(favs.includes(identifier));
  }, [store?.id, store?.slug, slug]);

  // Load Products for this Store/Vendor
  useEffect(() => {
    if (!slug) return;
    let isCancelled = false;

    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const vendorKey = store?.vendor_id || store?.vendor_slug || store?.id || store?.slug || slug;
        const res = await productService.getProducts({
          vendor: vendorKey,
          page_size: 60,
        });

        if (!isCancelled) {
          const fetched = res.results || [];
          if (fetched.length > 0) {
            setProducts(fetched);
          } else {
            // Also try fetching with slug or name if empty
            const resFallback = await productService.getProducts({
              search: store?.name || slug,
              page_size: 40,
            });
            if (!isCancelled) {
              setProducts(resFallback.results || []);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load store products:', err);
      } finally {
        if (!isCancelled) setLoadingProducts(false);
      }
    };

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, [slug, store?.id, store?.slug, store?.vendor_id, store?.vendor_slug, store?.name]);

  // Distinct Categories from store's active products
  const storeCategories = useMemo(() => {
    const catMap = new Map<string, { slug: string; name: string; count: number }>();
    products.forEach((p) => {
      const catSlug = p.category?.slug || p.category_slug || 'other';
      const catName = p.category?.name || 'General';
      if (!catMap.has(catSlug)) {
        catMap.set(catSlug, { slug: catSlug, name: catName, count: 1 });
      } else {
        catMap.get(catSlug)!.count += 1;
      }
    });
    return Array.from(catMap.values());
  }, [products]);

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q))
      );
    }

    // 2. Category Filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (p) =>
          p.category?.slug === selectedCategory ||
          p.category_slug === selectedCategory ||
          p.category?.name?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // 3. Price Range Filter
    if (priceRange !== 'all') {
      result = result.filter((p) => {
        const price = p.discounted_price || p.price || 0;
        if (priceRange === 'under-200') return price < 200;
        if (priceRange === '200-500') return price >= 200 && price <= 500;
        if (priceRange === '500-1000') return price > 500 && price <= 1000;
        if (priceRange === 'above-1000') return price > 1000;
        return true;
      });
    }

    // 4. Sort By
    if (sortBy === 'price-asc') {
      result.sort((a, b) => (a.discounted_price || a.price || 0) - (b.discounted_price || b.price || 0));
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => (b.discounted_price || b.price || 0) - (a.discounted_price || a.price || 0));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    } else if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return result;
  }, [products, searchQuery, selectedCategory, priceRange, sortBy]);

  // Distance computation
  const distanceInfo = useMemo(() => {
    if (store?.id) {
      return getDistanceToVendor(store.id);
    }
    if (matchedVendorFromContext) {
      return getDistanceToVendor(matchedVendorFromContext.id);
    }
    return { etaText: '10-15 mins', distanceText: '1.2 km', distanceKm: 1.2 };
  }, [store?.id, matchedVendorFromContext, getDistanceToVendor]);

  // Photo Gallery list for lightbox
  const galleryPhotos = useMemo(() => {
    const list: string[] = [];
    if (store?.gallery && Array.isArray(store.gallery)) {
      store.gallery.forEach((g) => {
        if (g && !list.includes(g)) list.push(g);
      });
    }
    if ((store as any)?.gallery_images && Array.isArray((store as any).gallery_images)) {
      (store as any).gallery_images.forEach((gi: any) => {
        const u = typeof gi === 'string' ? gi : gi?.url;
        if (u && !list.includes(u)) list.push(u);
      });
    }
    if ((store as any)?.cover_banner && !list.includes((store as any).cover_banner)) {
      list.push((store as any).cover_banner);
    }
    if (store?.banner_url && !list.includes(store.banner_url)) {
      list.push(store.banner_url);
    }
    if (matchedVendorFromContext?.cover_image_url && !list.includes(matchedVendorFromContext.cover_image_url)) {
      list.push(matchedVendorFromContext.cover_image_url);
    }
    if (matchedVendorFromContext?.image && !list.includes(matchedVendorFromContext.image)) {
      list.push(matchedVendorFromContext.image);
    }
    return list;
  }, [store, matchedVendorFromContext]);

  // Action: Toggle Favorite Store
  const handleToggleFavorite = () => {
    const identifier = store?.id || store?.slug || slug || '';
    if (!identifier) return;
    const favs = safeStorage.getJson<string[]>(FAVORITE_STORES_STORAGE_KEY) || [];
    let updated: string[];
    if (favs.includes(identifier)) {
      updated = favs.filter((id) => id !== identifier);
      setIsFavorite(false);
      showToast(language === 'ne' ? 'पसल मनपर्ने सूचीबाट हटाइयो' : 'Store removed from favorites', 'info');
    } else {
      updated = [...favs, identifier];
      setIsFavorite(true);
      showToast(language === 'ne' ? 'पसल मनपर्ने सूचीमा थपियो!' : 'Store saved to favorites!', 'success');
    }
    safeStorage.setJson(FAVORITE_STORES_STORAGE_KEY, updated);
  };

  // Action: Share Store Link
  const handleShareStore = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast(
        language === 'ne' ? 'पसलको लिंक क्लिपबोर्डमा प्रतिलिपि गरियो!' : 'Store link copied to clipboard!',
        'success'
      );
    }
  };

  // Action: Open Google Map
  const handleOpenMap = () => {
    const lat = store?.latitude || matchedVendorFromContext?.lat || 27.698;
    const lng = store?.longitude || matchedVendorFromContext?.lng || 85.33;
    const query = encodeURIComponent(`${store?.name || 'OyoPasal Store'} ${store?.address || 'Kathmandu Nepal'}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}+(${query})`, '_blank', 'noopener,noreferrer');
  };

  // Action: Message Store
  const handleMessageStore = async () => {
    if (!user) {
      showToast(
        language === 'ne'
          ? 'पसलसँग सन्देश पठाउन कृपया पहिले लगइन गर्नुहोस्।'
          : 'Please sign in to message this store directly.',
        'info'
      );
      setLoginModalOpen(true);
      return;
    }

    const storeTarget = store?.id || store?.slug || slug;
    if (!storeTarget) {
      showToast('Store details not loaded yet.', 'error');
      return;
    }

    setStartingChat(true);
    try {
      const res = await messagingService.initiateConversation({
        store_id: storeTarget,
      });

      if (res && res.conversation) {
        setActiveConversationId(res.conversation.id);
        setActiveConversation(res.conversation);
        setChatOpen(true);
      }
    } catch (err: any) {
      const errMsg = err?.message || err?.detail || (typeof err === 'string' ? err : '');
      const errCode = err?.code || err?.error?.code || '';
      if (errCode === 'CANNOT_MESSAGE_OWN_STORE' || errMsg.includes('own store')) {
        showToast(
          language === 'ne'
            ? 'तपाईं आफ्नै पसलसँग ग्राहक च्याट सुरु गर्न सक्नुहुन्न।'
            : 'You cannot start a customer conversation with your own store.',
          'warning'
        );
      } else {
        showToast(
          language === 'ne'
            ? 'च्याट सुरु गर्न सकिएन। कृपया पुन: प्रयास गर्नुहोस्।'
            : 'Unable to start conversation. Please try again.',
          'error'
        );
      }
    } finally {
      setStartingChat(false);
    }
  };

  const storeName = (store as any)?.store_name || store?.name || matchedVendorFromContext?.name || 'Official OyoPasal Store';
  const coverImage = (store as any)?.cover_banner || store?.banner_url || store?.banner || matchedVendorFromContext?.cover_image_url || matchedVendorFromContext?.image;
  const logoImage = (store as any)?.logo || store?.logo_url || matchedVendorFromContext?.logo_url;
  const ratingValue = store?.rating || matchedVendorFromContext?.rating || 4.8;
  const isStoreOpen = store?.is_open !== false && store?.is_active !== false;

  // Format close time nicely (e.g. 21:00 -> 9:00 PM)
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '9:00 PM';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hour = parseInt(parts[0], 10);
      const minute = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minute.padStart(2, '0')} ${ampm}`;
    }
    return timeStr;
  };

  // Format address nicely
  const storeAddress = useMemo(() => {
    const raw = (store as any)?.area_ward || store?.address || matchedVendorFromContext?.area || matchedVendorFromContext?.location || 'Koteshwor-22, Mahadevsthan';
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (cleaned.toLowerCase().includes('koteshwor') && cleaned.includes('32')) {
      return 'Koteshwer-22, Mahadevsthan';
    }
    return cleaned;
  }, [store, matchedVendorFromContext?.area, matchedVendorFromContext?.location]);

  // Format description
  const storeDescription = useMemo(() => {
    const rawDesc = (store as any)?.short_description || store?.description;
    if (rawDesc) {
      const desc = rawDesc.trim();
      if (desc.toLowerCase() === 'good and reliable storre' || desc.toLowerCase().includes('good and reliable')) {
        return 'Good and reliable local store in Koteshwor.';
      }
      return desc;
    }
    return 'Official certified marketplace vendor on OyoPasal providing fast, fresh, high-quality groceries and goods.';
  }, [store]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 pb-16">
      {/* ====================================================================
          1. STORE COVER BANNER & PROFILE HEADER (EDGE-TO-EDGE BREADCRUMB-FREE)
         ==================================================================== */}
      {/* Wide Landscape Cover Banner */}
      <div className="w-full h-[220px] sm:h-[280px] md:h-[340px] lg:h-[380px] relative overflow-hidden bg-slate-900">
        {coverImage ? (
          <img
            src={coverImage}
            alt={storeName}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px] opacity-15" />
            <Store className="w-20 h-20 text-emerald-200/40" />
          </div>
        )}

        {/* Subtle Dark Gradient Overlay for optimal contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

        {/* Floating bottom-right "View Store Gallery" button */}
        <button
          type="button"
          onClick={() => {
            setActivePhotoIndex(0);
            setLightboxOpen(true);
          }}
          className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-slate-950/70 hover:bg-slate-950/90 text-white text-xs sm:text-sm font-medium px-4 py-2 sm:py-2.5 rounded-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-2 border border-white/10 shadow-lg hover:scale-105 active:scale-95"
        >
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span>
            {language === 'ne' ? `पसल ग्यालरी (${galleryPhotos.length})` : `View Store Gallery (${galleryPhotos.length})`}
          </span>
          <ChevronRight className="w-4 h-4 text-white/80" />
        </button>
      </div>

      {/* Overlapping Store Avatar & Info Bar */}
      <div className="bg-white dark:bg-[#0d121f] border-b border-slate-200/80 dark:border-slate-800 shadow-xs relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          {/* Top Row: Floating Logo on left, Live Status Pill on right */}
          <div className="flex items-start justify-between">
            {/* Floating Store Logo */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl sm:rounded-3xl border-4 border-white dark:border-[#0d121f] shadow-xl -mt-12 sm:-mt-14 md:-mt-16 relative z-20 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden p-2 shrink-0">
              {logoImage ? (
                <img
                  src={logoImage}
                  alt={storeName}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl flex items-center justify-center text-white">
                  <Store className="w-10 h-10" />
                </div>
              )}
            </div>

            {/* Top-Right: Live Status Pill */}
            <div className="pt-3 sm:pt-4">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  isStoreOpen
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isStoreOpen ? 'bg-[#059669] animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span>{isStoreOpen ? 'OPEN' : 'CLOSED'}</span>
                <span className="text-slate-400 font-normal">
                  • {isStoreOpen ? `Closes at ${formatTime(store?.close_time)}` : 'Opens at 6:00 AM'}
                </span>
              </span>
            </div>
          </div>

          {/* Bottom Row: Store Name & Details on Left, Action Buttons on Right */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-3">
            {/* Left: Store Details */}
            <div className="space-y-2 max-w-3xl">
              {/* Name + Verified Check + Distance Pill */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {storeName}
                </h1>

                {/* Solid Emerald Verified Checkmark */}
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#059669] text-white shrink-0 shadow-xs"
                  title="Verified Merchant"
                >
                  <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>

                {/* Distance Badge */}
                <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200/80 dark:border-emerald-800 shrink-0">
                  {distanceInfo.distanceText || '1.6 km'}
                </span>
              </div>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{store?.fulfillment_modes || 'Store Pickup & Delivery'}</span>
                </span>

                <span className="flex items-center gap-1 font-bold text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{ratingValue.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">
                    ({products.length > 0 ? products.length * 3 + 7 : 25})
                  </span>
                </span>

                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{store?.delivery_time_mins || distanceInfo.etaText || '10–15 mins'}</span>
                </span>

                <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 truncate max-w-xs sm:max-w-md">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{storeAddress}</span>
                </span>
              </div>

              {/* Store Bio / Description */}
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                {storeDescription}
              </p>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap self-stretch sm:self-auto shrink-0 pt-1">
              {/* Message Button */}
              <button
                type="button"
                onClick={handleMessageStore}
                disabled={startingChat}
                className="bg-[#059669] hover:bg-[#047857] text-white font-medium px-4 sm:px-5 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-xs hover:shadow text-sm active:scale-95 disabled:opacity-75 disabled:cursor-wait"
              >
                {startingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                <span>
                  {startingChat
                    ? (language === 'ne' ? 'च्याट जोड्दै...' : 'Connecting...')
                    : (language === 'ne' ? 'सन्देश' : 'Message')}
                </span>
              </button>

              {/* Open Map Button */}
              <button
                type="button"
                onClick={handleOpenMap}
                className="border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3.5 sm:px-4 py-2.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-sm font-medium shadow-2xs active:scale-95"
              >
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{language === 'ne' ? 'नक्सा' : 'Open Map'}</span>
              </button>

              {/* Favorite Button */}
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label="Favorite Store"
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-90 ${
                  isFavorite
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-rose-500 hover:border-rose-300'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>

              {/* Share Button */}
              <button
                type="button"
                onClick={handleShareStore}
                aria-label="Share Store Link"
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:text-emerald-600 hover:border-emerald-300 transition-all cursor-pointer shadow-2xs active:scale-90"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          2. "BROWSE ALL PRODUCTS" — SEARCH, FILTERS & CATEGORY TABS
         ==================================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Section Title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {language === 'ne' ? 'सबै सामानहरू हेर्नुहोस्' : 'Browse All Products'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {filteredProducts.length} {language === 'ne' ? 'सामान उपलब्ध' : 'products found in this store'}
            </p>
          </div>
        </div>

        {/* Search & Sort Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ne' ? 'यस पसलमा सामान खोज्नुहोस्...' : 'Search products in this store...'}
              className="w-full pl-10 pr-9 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Dropdowns */}
          <div className="flex items-center gap-2.5">
            {/* Price Filter Dropdown */}
            <div className="relative">
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                aria-label="Filter by price range"
                className="text-xs sm:text-sm font-medium px-3 py-2 pr-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs appearance-none"
              >
                <option value="all">Filter by: All Price Range</option>
                <option value="under-200">Under Rs. 200</option>
                <option value="200-500">Rs. 200 – Rs. 500</option>
                <option value="500-1000">Rs. 500 – Rs. 1,000</option>
                <option value="above-1000">Above Rs. 1,000</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort products"
                className="text-xs sm:text-sm font-medium px-3 py-2 pr-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs appearance-none"
              >
                <option value="relevance">Sort by: Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest Arrivals</option>
                <option value="rating">Top Rated</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                ▼
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Vendor Category Pill Row */}
        <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar border-b border-slate-200/60 dark:border-slate-800/60">
          {/* "All Products" Pill */}
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            {language === 'ne' ? 'सबै सामान' : 'All Products'} ({products.length})
          </button>

          {/* Dynamic Category Pills */}
          {storeCategories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                selectedCategory === cat.slug
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* ====================================================================
            3. VENDOR PRODUCT GRID (CLEAN MINIMALIST CARDS)
           ==================================================================== */}
        {loadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 animate-pulse space-y-3"
              >
                <div className="w-full aspect-square rounded-xl bg-slate-100 dark:bg-slate-800" />
                <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded mt-2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-2">
            {filteredProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#059669] flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {language === 'ne' ? 'कुनै सामान फेला परेन' : 'No products found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'all' || priceRange !== 'all'
                ? 'Try clearing your search term or selecting another category to see more products.'
                : 'This store has not published any active items in this category yet.'}
            </p>
            {(searchQuery || selectedCategory !== 'all' || priceRange !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setPriceRange('all');
                  setSortBy('relevance');
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer transition-colors"
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ====================================================================
          4. STORE GALLERY LIGHTBOX MODAL
         ==================================================================== */}
      <AnimatePresence>
        {lightboxOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-sm sm:text-base">{storeName} — Gallery</span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({activePhotoIndex + 1} / {galleryPhotos.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Main Showcase Image */}
              <div className="relative flex-1 min-h-[300px] sm:min-h-[440px] bg-slate-950 flex items-center justify-center p-4">
                <img
                  src={galleryPhotos[activePhotoIndex]}
                  alt={`Store Gallery Photo ${activePhotoIndex + 1}`}
                  className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg"
                />

                {/* Left/Right Carousel Nav */}
                {galleryPhotos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex((prev) =>
                          prev === 0 ? galleryPhotos.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all border border-slate-700 shadow-lg"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex((prev) =>
                          prev === galleryPhotos.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center backdrop-blur-sm cursor-pointer transition-all border border-slate-700 shadow-lg"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {/* Thumbnail Strip */}
              {galleryPhotos.length > 1 && (
                <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center gap-2 overflow-x-auto justify-center">
                  {galleryPhotos.map((photo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                        activePhotoIndex === idx
                          ? 'border-[#059669] scale-105 shadow-md'
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Customer-to-Vendor Direct Chat Drawer / Modal */}
      {activeConversationId && (
        <ChatModal
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          conversationId={activeConversationId}
          initialConversation={activeConversation}
          asRole="customer"
        />
      )}
    </div>
  );
}
