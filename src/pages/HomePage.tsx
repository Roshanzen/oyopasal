import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Product, Vendor, Category } from '../types';
import { useApp } from '../context/AppContext';
import PromotionalCarousel from '../components/PromotionalCarousel';
import ProductSection from '../components/ProductSection';
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
  MapPin
} from 'lucide-react';
import { motion } from 'motion/react';
import { VendorMapModal } from '../components/VendorMapModal';

export default function HomePage() {
  const navigate = useNavigate();
  const { setBecomeSellerModalOpen, getDistanceToVendor, currentAddress } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorMapOpen, setVendorMapOpen] = useState(false);

  useEffect(() => {
    async function loadHomeData() {
      try {
        setLoading(true);
        const [prodResult, vendorResult, catResult] = await Promise.allSettled([
          api.getProducts({ page_size: 30 }),
          api.getVendors(),
          api.getCategories()
        ]);

        if (prodResult.status === 'fulfilled') {
          setProducts(prodResult.value.results || []);
        } else {
          console.error('Failed to load products', prodResult.reason);
        }

        if (vendorResult.status === 'fulfilled') {
          setVendors(vendorResult.value.results || []);
        }

        if (catResult.status === 'fulfilled') {
          setCategories(catResult.value.results || []);
        }
      } catch (err) {
        console.error('Failed to load home data', err);
      } finally {
        setLoading(false);
      }
    }
    loadHomeData();
  }, []);

  // Filter products by section tags safely
  const bestSellersFiltered = products.filter(p => Array.isArray(p.sections) && p.sections.includes('best_sellers'));
  const trendingFiltered = products.filter(p => Array.isArray(p.sections) && p.sections.includes('trending'));
  const freshArrivalsFiltered = products.filter(p => Array.isArray(p.sections) && p.sections.includes('fresh_arrivals'));
  const recommendedFiltered = products.filter(p => Array.isArray(p.sections) && p.sections.includes('recommended'));
  const dailyEssentialsFiltered = products.filter(p => Array.isArray(p.sections) && p.sections.includes('daily_essentials'));
  const topDealsFiltered = products.filter(p => (Array.isArray(p.sections) && p.sections.includes('top_deals')) || (p.discount_percentage || 0) >= 20);

  // Fallbacks: ensure every section displays products reliably
  const bestSellers = bestSellersFiltered.length > 0 ? bestSellersFiltered : products.slice(0, 6);
  const trending = trendingFiltered.length > 0 ? trendingFiltered : products.slice(3, 9);
  const freshArrivals = freshArrivalsFiltered.length > 0 ? freshArrivalsFiltered : products.filter(p => p.category?.slug === 'fruits-vegetables' || p.category?.slug === 'dairy-bakery');
  const recommended = recommendedFiltered.length > 0 ? recommendedFiltered : products.slice(2, 8);
  const dailyEssentials = dailyEssentialsFiltered.length > 0 ? dailyEssentialsFiltered : products.filter(p => p.category?.slug === 'grocery' || p.category?.slug === 'dairy-bakery');
  const topDeals = topDealsFiltered.length > 0 ? topDealsFiltered : products.filter(p => (p.discount_percentage || 0) > 0);

  return (
    <div className="pb-16 md:pb-12">
      {/* Dynamic Promotional Banner Carousel */}
      <PromotionalCarousel />

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
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">10-15 Min Delivery</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">From local neighborhood hubs</p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">Local Multi-Vendor</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Kathmandu & Lalitpur artisans</p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">100% Fresh & Genuine</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Daily quality inspection</p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, transition: { duration: 0.18 } }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-2xs cursor-default"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">Free Delivery</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">On all orders above Rs. 499</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* 1. Best Sellers Section */}
      <ProductSection
        title="Best Sellers"
        subtitle="Most ordered fresh items in your neighborhood today"
        products={bestSellers}
        loading={loading}
        viewAllLink="/search?section=best_sellers"
      />

      {/* 2. Trending Products Section */}
      <ProductSection
        title="Trending Products"
        subtitle="Hot picks with high demand right now"
        products={trending}
        loading={loading}
        viewAllLink="/search?section=trending"
      />

      {/* 7. Shop by Category (Visual Grid) */}
      <section className="py-6 bg-slate-100/60 dark:bg-slate-900/40 border-y border-slate-200/70 dark:border-slate-800 my-2 select-none">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
                Shop by Category
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Explore our full department range
              </p>
            </div>
            <motion.div whileHover={{ x: 2 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/categories"
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                <span>All Categories</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {categories.map((cat) => (
              <motion.div
                key={cat.id}
                whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.18 } }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate(`/category/${cat.slug}`)}
                className="bg-white dark:bg-[#111726] rounded-2xl p-3.5 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-colors cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold mb-2 transition-colors">
                    <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                    {cat.description}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>{cat.item_count}+ items</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Fresh Arrivals Section */}
      <ProductSection
        title="Fresh Arrivals"
        subtitle="Harvested this morning, ready for quick delivery"
        products={freshArrivals}
        loading={loading}
        viewAllLink="/search?section=fresh_arrivals"
      />

      {/* 4. Recommended for You Section */}
      <ProductSection
        title="Recommended for You"
        subtitle="Curated picks tailored to your pantry"
        products={recommended}
        loading={loading}
        viewAllLink="/search?section=recommended"
      />

      {/* 5. Daily Essentials Section */}
      <ProductSection
        title="Daily Essentials"
        subtitle="Pantry staples, dairy & kitchen necessities"
        products={dailyEssentials}
        loading={loading}
        viewAllLink="/search?section=daily_essentials"
      />

      {/* 6. Top Deals Section */}
      <ProductSection
        title="Top Deals & Mega Discounts"
        subtitle="Save big with instant price drops"
        products={topDeals}
        loading={loading}
        viewAllLink="/search?section=top_deals"
      />

      {/* 8. Popular Nearby Vendors */}
      <section className="py-6 sm:py-8 bg-white dark:bg-[#0b0f19] border-t border-slate-200/80 dark:border-slate-800 transition-colors duration-200 select-none">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                <Store className="w-4 h-4" />
                <span>Hyperlocal Fulfilment</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white font-display">
                Popular Nearby Vendors
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authentic local bakeries, organic farms, and dairies near you
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setVendorMapOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer shadow-2xs"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Explore on Google Maps</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {vendors.map((vendor) => {
              const vDist = getDistanceToVendor(vendor.id);
              return (
                <motion.div
                  key={vendor.id}
                  whileHover={{ y: -4, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/search?vendor=${vendor.id}`)}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/60 p-4 transition-colors hover:shadow-lg cursor-pointer bg-slate-50/50 dark:bg-[#111726] hover:bg-white dark:hover:bg-slate-800/80 group"
                >
                  <div className="relative h-32 rounded-xl overflow-hidden mb-3 bg-slate-200 dark:bg-slate-800">
                    {vendor.image && (
                      <img
                        src={vendor.image}
                        alt={vendor.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                      />
                    )}
                    <div className="absolute top-2 right-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs text-slate-900 dark:text-white text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs border border-slate-100 dark:border-slate-800">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span>{vendor.rating}</span>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{vDist.etaText}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {vendor.name}
                    </h3>
                    {vendor.verified && (
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{vDist.distanceText} away from {currentAddress?.area ? currentAddress.area.split(',')[0] : 'you'}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mb-2.5">
                    {vendor.location}
                  </p>

                  {vendor.tags && (
                    <div className="flex flex-wrap gap-1">
                      {vendor.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md"
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

      {/* OyoPasal Guarantee Footer Strip */}
      <footer className="mt-8 border-t border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-[#060911] text-slate-300 dark:text-slate-400 py-10 transition-colors duration-200">
        <div className="w-full px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-base">
                  O
                </div>
                <span className="font-extrabold text-xl text-white font-display">
                  Oyo<span className="text-emerald-400">Pasal</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kathmandu's premium quick-commerce network. Delivering farm-fresh groceries, bakery delights, and daily necessities in 10-15 minutes.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Categories
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li><Link to="/category/fruits-vegetables" className="hover:text-emerald-400">Fruits & Vegetables</Link></li>
                <li><Link to="/category/dairy-bakery" className="hover:text-emerald-400">Dairy & Fresh Bakery</Link></li>
                <li><Link to="/category/grocery" className="hover:text-emerald-400">Grocery & Pantry Staples</Link></li>
                <li><Link to="/category/snacks" className="hover:text-emerald-400">Beverages & Munchies</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Customer Care
              </h4>
              <ul className="space-y-1.5 text-xs">
                <li><Link to="/account?tab=orders" className="hover:text-emerald-400">Track Active Orders</Link></li>
                <li><Link to="/account?tab=addresses" className="hover:text-emerald-400">Delivery Locations</Link></li>
                <li><span className="text-slate-400">Helpdesk: support@oyopasal.com</span></li>
                <li><span className="text-slate-400">Helpline: +977-1-4991234</span></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                Our Delivery Zones
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Currently operating across Baneshwor, Jhamsikhel, Patan, Thamel, Lazimpat, Koteshwor, Maharajgunj & Pulchowk.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>6:00 AM - 11:30 PM Daily</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>© 2026 OyoPasal Technologies Pvt. Ltd. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>·</span>
              <span>Terms of Service</span>
              <span>·</span>
              <button
                onClick={() => setBecomeSellerModalOpen(true)}
                className="hover:text-emerald-400 font-semibold cursor-pointer transition-colors"
              >
                Vendor Partner Portal (Become a Seller)
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
