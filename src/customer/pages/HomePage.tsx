import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../shared/services/api';
import { Advertisement, Category, Product, Vendor } from '../../shared/types';
import { useApp } from '../../shared/context/AppContext';
import PromotionalCarousel from '../components/PromotionalCarousel';
import ProductSection from '../components/ProductSection';
import { useBanners } from '../hooks/useBanners';
import {
  ShieldCheck,
  Zap,
  Store,
  Clock,
  Sparkles,
  ArrowRight,
  Star,
  CheckCircle,
  Truck,
  MapPin,
  AlertCircle,
  RefreshCw,
  Megaphone
} from 'lucide-react';
import { motion } from 'motion/react';
import { VendorMapModal } from '../components/VendorMapModal';
import { translateCategoryName, translateCategoryDescription } from '../../shared/i18n/translations';

export default function HomePage() {
  const navigate = useNavigate();
  const { setBecomeSellerModalOpen, getDistanceToVendor, currentAddress, publicSettings, t, language } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorMapOpen, setVendorMapOpen] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const {
    banners,
    loading: bannersLoading,
    error: bannersError,
    refetch: refetchBanners,
  } = useBanners();

  const loadHomeData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [prodResult, vendorResult, catResult, adResult] = await Promise.allSettled([
        api.getProducts({ page_size: 50 }),
        api.getVendors(),
        api.getCategories(),
        api.getAdvertisements()
      ]);

      const failures: string[] = [];

      if (prodResult.status === 'fulfilled') {
        setProducts(prodResult.value.results || []);
      } else {
        failures.push(prodResult.reason?.message || 'Products failed to load');
      }

      if (vendorResult.status === 'fulfilled') {
        setVendors(vendorResult.value.results || []);
      } else {
        failures.push(vendorResult.reason?.message || 'Vendors failed to load');
      }

      if (catResult.status === 'fulfilled') {
        setCategories(catResult.value.results || []);
      } else {
        failures.push(catResult.reason?.message || 'Categories failed to load');
      }

      if (adResult.status === 'fulfilled') {
        setAdvertisements(adResult.value.results || []);
      }

      if (failures.length >= 3) {
        setError(failures[0] || 'Unable to load storefront catalog from server.');
      } else if (prodResult.status === 'rejected') {
        setError(prodResult.reason?.message || 'Unable to load products.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load storefront data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const markBrokenImage = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  const handleAdClick = (ad: Advertisement) => {
    api.trackAdvertisementClick(ad.db_id).catch(() => {});
    const dest = ad.destination_url?.trim();
    if (!dest) return;
    if (/^https?:\/\//i.test(dest)) {
      window.location.href = dest;
    } else {
      navigate(dest);
    }
  };

  // Authoritative DB section tags (zero arbitrary slice fallbacks)
  const bestSellers = products.filter((p) => Array.isArray(p.sections) && p.sections.includes('best_sellers'));
  const trending = products.filter((p) => Array.isArray(p.sections) && p.sections.includes('trending'));
  const freshArrivals = products.filter((p) => Array.isArray(p.sections) && p.sections.includes('fresh_arrivals'));
  const recommended = products.filter((p) => Array.isArray(p.sections) && p.sections.includes('recommended'));
  const dailyEssentials = products.filter((p) => Array.isArray(p.sections) && p.sections.includes('daily_essentials'));
  const topDeals = products.filter(
    (p) => (Array.isArray(p.sections) && p.sections.includes('top_deals')) || (p.discount_percentage || 0) >= 20
  );

  const midAds = advertisements.filter((a) => a.placement === 'homepage_mid');
  const bottomAds = advertisements.filter((a) => a.placement === 'homepage_bottom');

  const supportInfo = publicSettings?.store_support;

  return (
    <div className="pb-16 md:pb-12">
      {/* Dynamic Promotional Banner Carousel */}
      <PromotionalCarousel
        banners={banners}
        loading={bannersLoading}
        error={bannersError}
        onRetry={refetchBanners}
      />

      {/* Error + Retry State */}
      {error && (
        <div className="w-full px-4 sm:px-6 lg:px-10 pt-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
            <button
              type="button"
              onClick={loadHomeData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Trust & Speed Highlights Strip */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="w-full px-4 sm:px-6 lg:px-10 pt-6 select-none"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('home.trustSpeedTitle')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('home.trustSpeedSub')}</p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('home.trustVendorTitle')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('home.trustVendorSub')}</p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('home.trustFreshTitle')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('home.trustFreshSub')}</p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('home.trustFreeTitle')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {publicSettings?.delivery_fees
                  ? `Free over Rs. ${publicSettings.delivery_fees.freeDeliveryThreshold}`
                  : t('home.trustFreeSub')}
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Empty Catalog State */}
      {!loading && !error && products.length === 0 && (
        <div className="w-full px-4 sm:px-6 lg:px-10 py-10">
          <div className="p-10 rounded-3xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No active products available</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Check back shortly or browse active categories once sellers publish items.
            </p>
          </div>
        </div>
      )}

      {/* 1. Best Sellers Section */}
      <ProductSection
        title={t('home.bestSellersTitle')}
        subtitle={t('home.bestSellersSub')}
        products={bestSellers}
        loading={loading}
        viewAllLink="/search?section=best_sellers"
      />

      {/* 2. Trending Products Section */}
      <ProductSection
        title={t('home.trendingTitle')}
        subtitle={t('home.trendingSub')}
        products={trending}
        loading={loading}
        viewAllLink="/search?section=trending"
      />

      {/* 7. Shop by Category (Visual Grid) */}
      <section className="py-6 bg-slate-100/60 dark:bg-slate-900/40 border-y border-slate-200/70 dark:border-slate-800 my-2 select-none">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
                {t('home.shopByCatTitle')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('home.shopByCatSub')}
              </p>
            </div>
            <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/categories"
                className="text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                <span>{t('home.allCategories')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {categories.map((cat) => {
              const imgKey = `cat-${cat.id}`;
              const hasValidImg = Boolean(cat.image_url) && !brokenImages[imgKey];
              return (
                <motion.div
                  key={cat.id}
                  whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => navigate(`/category/${cat.slug}`)}
                  className="bg-white dark:bg-[#111726] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-colors cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold mb-2.5 overflow-hidden transition-colors">
                      {hasValidImg ? (
                        <img
                          src={cat.image_url!}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          onError={() => markBrokenImage(imgKey)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                      {translateCategoryName(cat.slug, cat.name, language)}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                      {translateCategoryDescription(cat.slug, cat.description, language)}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                    <span>{t('home.itemsCountPlus', { count: cat.item_count })}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mid-page Dynamic Advertisements */}
      {midAds.length > 0 && (
        <section className="w-full px-4 sm:px-6 lg:px-10 py-4">
          <div className={`grid grid-cols-1 ${midAds.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
            {midAds.map((ad) => {
              const adKey = `ad-${ad.id}`;
              const titleText = language === 'ne' && ad.title_ne ? ad.title_ne : ad.title;
              const subText = language === 'ne' && ad.subtitle_ne ? ad.subtitle_ne : ad.subtitle;
              return (
                <motion.button
                  key={ad.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleAdClick(ad)}
                  className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-slate-900 text-left min-h-[150px] flex items-center p-6 group cursor-pointer shadow-sm"
                >
                  {ad.image_url && !brokenImages[adKey] && (
                    <img
                      src={ad.image_url}
                      alt={titleText}
                      referrerPolicy="no-referrer"
                      onError={() => markBrokenImage(adKey)}
                      className="absolute inset-0 w-full h-full object-cover opacity-35 group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                  <div className="relative z-10 max-w-lg">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full mb-2">
                      <Megaphone className="w-3 h-3" />
                      <span>Featured Spotlight</span>
                    </span>
                    <h3 className="text-lg sm:text-xl font-extrabold text-white">{titleText}</h3>
                    {subText && <p className="text-xs sm:text-sm text-slate-300 mt-1 line-clamp-2">{subText}</p>}
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 mt-3 group-hover:translate-x-0.5 transition-transform">
                      <span>Explore Offer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Fresh Arrivals Section */}
      <ProductSection
        title={t('home.freshArrivalsTitle')}
        subtitle={t('home.freshArrivalsSub')}
        products={freshArrivals}
        loading={loading}
        viewAllLink="/search?section=fresh_arrivals"
      />

      {/* 4. Recommended for You Section */}
      <ProductSection
        title={t('home.recommendedTitle')}
        subtitle={t('home.recommendedSub')}
        products={recommended}
        loading={loading}
        viewAllLink="/search?section=recommended"
      />

      {/* 5. Daily Essentials Section */}
      <ProductSection
        title={t('home.dailyEssentialsTitle')}
        subtitle={t('home.dailyEssentialsSub')}
        products={dailyEssentials}
        loading={loading}
        viewAllLink="/search?section=daily_essentials"
      />

      {/* 6. Top Deals Section */}
      <ProductSection
        title={t('home.topDealsTitle')}
        subtitle={t('home.topDealsSub')}
        products={topDeals}
        loading={loading}
        viewAllLink="/search?section=top_deals"
      />

      {/* Bottom Dynamic Advertisements */}
      {bottomAds.length > 0 && (
        <section className="w-full px-4 sm:px-6 lg:px-10 py-4">
          <div className="grid grid-cols-1 gap-4">
            {bottomAds.map((ad) => {
              const adKey = `ad-btm-${ad.id}`;
              const titleText = language === 'ne' && ad.title_ne ? ad.title_ne : ad.title;
              const subText = language === 'ne' && ad.subtitle_ne ? ad.subtitle_ne : ad.subtitle;
              return (
                <motion.button
                  key={ad.id}
                  type="button"
                  whileHover={{ y: -2 }}
                  onClick={() => handleAdClick(ad)}
                  className="relative overflow-hidden rounded-3xl border border-emerald-800/40 bg-emerald-950 text-left min-h-[130px] flex items-center justify-between p-6 sm:p-8 group cursor-pointer shadow-sm"
                >
                  {ad.image_url && !brokenImages[adKey] && (
                    <img
                      src={ad.image_url}
                      alt={titleText}
                      referrerPolicy="no-referrer"
                      onError={() => markBrokenImage(adKey)}
                      className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/85 to-transparent" />
                  <div className="relative z-10 max-w-2xl">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">{titleText}</h3>
                    {subText && <p className="text-sm text-emerald-100/90 mt-1">{subText}</p>}
                  </div>
                  <div className="relative z-10 hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-400 text-slate-950 font-extrabold text-sm shrink-0">
                    <span>Shop Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* 8. Popular Nearby Vendors */}
      <section className="py-6 sm:py-8 bg-white dark:bg-[#0b0f19] border-t border-slate-200/80 dark:border-slate-800 transition-colors duration-200 select-none">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Store className="w-4 h-4" />
                <span>{t('home.hyperlocalBadge')}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
                {t('home.nearbyVendorsTitle')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('home.nearbyVendorsSub')}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setVendorMapOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shadow-2xs"
            >
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('home.exploreMaps')}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vendors.map((vendor) => {
              const vDist = getDistanceToVendor(vendor.id);
              const vImgKey = `vendor-${vendor.id}`;
              return (
                <motion.div
                  key={vendor.id}
                  whileHover={{ y: -4, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/search?vendor=${vendor.id}`)}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/60 p-4 transition-colors hover:shadow-lg cursor-pointer bg-slate-50/50 dark:bg-[#111726] hover:bg-white dark:hover:bg-slate-800/80 group"
                >
                  <div className="relative h-36 rounded-xl overflow-hidden mb-3 bg-slate-200 dark:bg-slate-800">
                    {vendor.image && !brokenImages[vImgKey] ? (
                      <img
                        src={vendor.image}
                        alt={vendor.name}
                        referrerPolicy="no-referrer"
                        onError={() => markBrokenImage(vImgKey)}
                        className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-900/40 to-slate-800 flex items-center justify-center">
                        <Store className="w-8 h-8 text-emerald-400" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs text-slate-900 dark:text-white text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs border border-slate-100 dark:border-slate-800">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{vendor.rating}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{vDist.etaText}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {vendor.name}
                    </h3>
                    {vendor.verified && (
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {t('home.distanceAwayFrom', {
                        dist: vDist.distanceText,
                        area: currentAddress?.area ? currentAddress.area.split(',')[0] : t('home.you')
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mb-2.5">
                    {vendor.location || vendor.area}
                  </p>

                  {vendor.tags && (
                    <div className="flex flex-wrap gap-1.5">
                      {vendor.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* OyoPasal Guarantee Footer Strip (100% DB categories + platform_settings) */}
      <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-[#060911] text-slate-300 dark:text-slate-400 py-10 transition-colors duration-200">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-base">
                  O
                </div>
                <span className="font-extrabold text-xl text-white font-display">
                  {supportInfo?.brandName || 'OyoPasal'}
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {supportInfo?.tagline || t('home.footerTagline')}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                {t('home.footerCategories')}
              </h4>
              <ul className="space-y-2 text-sm">
                {categories.slice(0, 5).map((cat) => (
                  <li key={cat.id}>
                    <Link to={`/category/${cat.slug}`} className="hover:text-emerald-400">
                      {translateCategoryName(cat.slug, cat.name, language)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                {t('home.footerCustomerCare')}
              </h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/account?tab=orders" className="hover:text-emerald-400">{t('home.footerTrackOrders')}</Link></li>
                <li><Link to="/account?tab=addresses" className="hover:text-emerald-400">{t('home.footerDeliveryLocs')}</Link></li>
                {supportInfo?.email && (
                  <li><span className="text-slate-400">Helpdesk: {supportInfo.email}</span></li>
                )}
                {supportInfo?.phone && (
                  <li><span className="text-slate-400">Helpline: {supportInfo.phone}</span></li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
                {t('home.footerZones')}
              </h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                {supportInfo?.address || t('home.footerZonesDesc')}
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-400 font-bold">
                <Clock className="w-4 h-4" />
                <span>{supportInfo?.hours || t('home.footerHours')}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>{t('home.footerRights')}</span>
            <div className="flex items-center gap-4">
              <span>{t('home.footerPrivacy')}</span>
              <span>·</span>
              <span>{t('home.footerTerms')}</span>
              <span>·</span>
              <button
                onClick={() => setBecomeSellerModalOpen(true)}
                className="hover:text-emerald-400 font-semibold cursor-pointer transition-colors"
              >
                {t('home.footerSellerPortal')}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Google Maps Nearby Vendors Explorer */}
      <VendorMapModal
        isOpen={vendorMapOpen}
        onClose={() => setVendorMapOpen(false)}
        vendors={vendors}
        onSelectVendor={(vId) => navigate(`/search?vendor=${vId}`)}
      />
    </div>
  );
}

