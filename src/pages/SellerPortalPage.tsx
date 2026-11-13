import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp, VENDOR_LOCATIONS } from '../context/AppContext';
import { api } from '../services/api';
import { Product } from '../types';
import {
  Store,
  PlusCircle,
  Package,
  Layers,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Clock,
  ArrowRight,
  ExternalLink,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Image as ImageIcon,
  Sparkles,
  ShoppingBag,
  Tag,
  AlertCircle,
  ShieldCheck,
  Search,
  RefreshCw,
  LogOut,
  ChevronRight,
  ArrowLeft,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'motion/react';
import SellerVisualSummary from '../components/SellerVisualSummary';

// Preset local images to guarantee high quality and 0 broken images
const PRESET_IMAGES = [
  {
    label: 'Fresh Produce / Veggies',
    url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    category: 'fruits-vegetables'
  },
  {
    label: 'Organic Farm Harvest',
    url: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    category: 'organic-gourmet'
  },
  {
    label: 'Bakery & Fresh Dairy',
    url: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    category: 'dairy-bakery'
  },
  {
    label: 'Packaged Snacks & Drinks',
    url: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    category: 'snacks-munchies'
  }
];

const PRESET_UNITS = ['250g', '500g', '1 kg', '2 kg', '1L', '500ml', 'Pack of 1', 'Pack of 2', '12 Pcs'];

const DEMO_VENDORS = [
  {
    id: 'v-himalayan',
    name: 'Himalayan Fresh Farms',
    category: 'Fresh Farm Produce & Organics',
    area: 'New Baneshwor, Kathmandu',
    rating: 4.9,
    ordersToday: 42,
    revenueToday: 18450
  },
  {
    id: 'v-patan-bakery',
    name: 'Patan Artisan Bakery & Dairy',
    category: 'Breads, Pastries & Fresh Dairy',
    area: 'Pulchowk, Lalitpur',
    rating: 4.8,
    ordersToday: 35,
    revenueToday: 14200
  },
  {
    id: 'v-everest-pantry',
    name: 'Everest Organic & Dry Pantry',
    category: 'Grains, Spices & Organic Herbs',
    area: 'Koteshwor, Kathmandu',
    rating: 4.7,
    ordersToday: 29,
    revenueToday: 11900
  },
  {
    id: 'v-green-valley',
    name: 'Green Valley Hydroponics',
    category: 'Pesticide-Free Hydroponic Greens',
    area: 'Thamel, Kathmandu',
    rating: 4.9,
    ordersToday: 38,
    revenueToday: 16750
  }
];

export default function SellerPortalPage() {
  const navigate = useNavigate();
  const { currentSeller, loginAsSeller, logoutSeller, showToast, setBecomeSellerModalOpen } = useApp();

  const [activeTab, setActiveTab] = useState<'analytics' | 'add' | 'products' | 'orders'>('analytics');
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);

  // Login form state
  const [selectedDemoVendor, setSelectedDemoVendor] = useState('v-himalayan');
  const [customStoreId, setCustomStoreId] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // New Product Form State
  const [productName, setProductName] = useState('');
  const [categorySlug, setCategorySlug] = useState('fruits-vegetables');
  const [unit, setUnit] = useState('500g');
  const [originalPrice, setOriginalPrice] = useState<number | ''>(120);
  const [discountedPrice, setDiscountedPrice] = useState<number | ''>(95);
  const [stockCount, setStockCount] = useState<number | ''>(30);
  const [isOrganic, setIsOrganic] = useState(true);
  const [description, setDescription] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState(PRESET_IMAGES[0].url);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>(['fresh_arrivals', 'best_sellers']);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockingAll, setRestockingAll] = useState(false);
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'low' | 'healthy'>('all');

  // Fetch seller's products when logged in
  const loadSellerCatalog = async () => {
    if (!currentSeller?.id) return;
    setLoadingProducts(true);
    try {
      const res = await api.getSellerProducts(currentSeller.id);
      setSellerProducts(res.results || []);
    } catch (err) {
      console.error('Failed to load seller catalog', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (currentSeller?.id) {
      loadSellerCatalog();
    }
  }, [currentSeller?.id]);

  // Handle Quick Demo Login
  const handleQuickLogin = async (vendorId: string) => {
    setLoginLoading(true);
    try {
      await loginAsSeller({ vendor_id: vendorId });
    } catch {
      // toast handled in context
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Custom Credentials Login
  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStoreId) {
      showToast('Please enter your Merchant ID or phone number', 'error');
      return;
    }
    setLoginLoading(true);
    try {
      await loginAsSeller({ identifier: customStoreId, password: customPassword || 'merchant123' });
    } catch {
      // toast handled in context
    } finally {
      setLoginLoading(false);
    }
  };

  // Calculate discount percentage
  const orig = typeof originalPrice === 'number' ? originalPrice : 0;
  const disc = typeof discountedPrice === 'number' ? discountedPrice : 0;
  const discountPercent = orig > disc && orig > 0 ? Math.round(((orig - disc) / orig) * 100) : 0;

  // Toggle Section Placement
  const toggleSection = (section: string) => {
    setSelectedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // Submit New Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      showToast('Please enter a product name', 'error');
      return;
    }
    if (!discountedPrice || Number(discountedPrice) <= 0) {
      showToast('Please specify a valid discounted selling price', 'error');
      return;
    }
    if (!unit.trim()) {
      showToast('Please specify the product unit (e.g., 500g, 1 kg)', 'error');
      return;
    }

    setSubmittingProduct(true);
    try {
      const finalImage = customImageUrl.trim() || selectedImageUrl;
      const res = await api.createSellerProduct({
        vendor_id: currentSeller?.id,
        name: productName.trim(),
        category_slug: categorySlug,
        unit: unit.trim(),
        original_price: Number(originalPrice) || Number(discountedPrice),
        discounted_price: Number(discountedPrice),
        stock: Number(stockCount) || 25,
        is_organic: isOrganic,
        description: description.trim() || `${productName.trim()} sourced fresh by ${currentSeller?.name || 'Local Merchant'}.`,
        image_url: finalImage,
        sections: selectedSections.length > 0 ? selectedSections : ['fresh_arrivals', 'best_sellers']
      });

      if (res.success && res.product) {
        showToast(`🎉 "${res.product.name}" published! It is now live on customer pages.`, 'success');
        setLastAddedProduct(res.product);
        // Refresh catalog
        await loadSellerCatalog();
        // Reset form for next entry
        setProductName('');
        setDescription('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish product';
      showToast(msg, 'error');
    } finally {
      setSubmittingProduct(false);
    }
  };

  // Toggle Stock Status
  const handleToggleStock = async (productId: string) => {
    try {
      const res = await api.toggleProductStock(productId);
      if (res.success) {
        showToast(`Stock status updated: ${res.in_stock ? 'In Stock (25 units)' : 'Marked Out of Stock'}`, 'info');
        setSellerProducts(prev =>
          prev.map(p => (p.id === productId ? { ...p, in_stock: res.in_stock, stock: res.in_stock ? 25 : 0 } : p))
        );
      }
    } catch {
      showToast('Could not update product stock', 'error');
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from your catalog?`)) {
      return;
    }
    try {
      const res = await api.deleteProduct(productId);
      if (res.success) {
        showToast(`"${name}" removed from catalog`, 'info');
        setSellerProducts(prev => prev.filter(p => p.id !== productId));
        if (lastAddedProduct?.id === productId) {
          setLastAddedProduct(null);
        }
      }
    } catch {
      showToast('Could not delete product', 'error');
    }
  };

  // Quick Restock Product
  const handleRestock = async (productId: string, addQuantity = 25) => {
    setRestockingId(productId);
    try {
      const res = await api.restockProduct(productId, addQuantity);
      if (res.success) {
        showToast(`🎉 Restocked "${res.product.name}"! Current stock: ${res.stock} units.`, 'success');
        setSellerProducts(prev =>
          prev.map(p => (p.id === productId ? { ...p, stock: res.stock, in_stock: res.in_stock } : p))
        );
      }
    } catch {
      showToast('Could not restock product', 'error');
    } finally {
      setRestockingId(null);
    }
  };

  // Bulk Quick Restock All Low Stock Products
  const handleRestockAllLow = async () => {
    const lowItems = sellerProducts.filter(p => p.stock <= 5 || !p.in_stock);
    if (lowItems.length === 0) return;
    setRestockingAll(true);
    try {
      for (const item of lowItems) {
        await api.restockProduct(item.id, 25);
      }
      showToast(`🎉 Successfully restocked all ${lowItems.length} low inventory products (+25 units each)!`, 'success');
      await loadSellerCatalog();
    } catch {
      showToast('Failed to restock some items', 'error');
    } finally {
      setRestockingAll(false);
    }
  };

  // ----------------------------------------------------
  // VIEW: NOT LOGGED IN AS SELLER
  // ----------------------------------------------------
  if (!currentSeller) {
    return (
      <div className="min-h-screen w-full bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-10">
        <div className="w-full">
          {/* Breadcrumb / Top Bar */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-base text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Customer Store</span>
            </Link>
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60">
              <ShieldCheck className="w-4 h-4" />
              <span>OyoPasal Merchant Hub</span>
            </div>
          </div>

          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-900/30">
              <Store className="w-8 h-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Merchant Backend Portal
            </h1>
            <p className="mt-2 text-slate-400 max-w-lg mx-auto text-base">
              Sign in to manage your inventory, set instant delivery stock, and publish new products directly to customers across Kathmandu Valley.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Quick Demo Switcher */}
            <div className="bg-slate-800/90 rounded-2xl p-6 border border-slate-700 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>1-Click Merchant Login</span>
                </h2>
                <span className="text-sm text-slate-400">Demo Accounts</span>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Select any verified local vendor to instantly access their dashboard and publish products to the customer store:
              </p>

              <div className="space-y-3">
                {DEMO_VENDORS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleQuickLogin(v.id)}
                    disabled={loginLoading}
                    className="w-full text-left p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-emerald-500/60 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors">
                          {v.name}
                        </span>
                        <span className="text-xs bg-emerald-900/60 text-emerald-300 font-mono px-1.5 py-0.5 rounded">
                          ★ {v.rating}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{v.category}</p>
                      <p className="text-xs text-slate-500 mt-1">{v.area}</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Merchant ID Form */}
            <div className="bg-slate-800/90 rounded-2xl p-6 border border-slate-700 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">Merchant Account Login</h2>
              <p className="text-sm text-slate-400 mb-5">
                Log in with your registered merchant store ID or phone number.
              </p>

              <form onSubmit={handleCustomLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                    Store ID / Mobile Number
                  </label>
                  <input
                    type="text"
                    value={customStoreId}
                    onChange={e => setCustomStoreId(e.target.value)}
                    placeholder="e.g. v-himalayan or +977 9841234567"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                    Password / Secret PIN
                  </label>
                  <input
                    type="password"
                    value={customPassword}
                    onChange={e => setCustomPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-md shadow-emerald-950/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {loginLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Enter Seller Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-700/80 text-center">
                <p className="text-sm text-slate-400 mb-2">Want to sell your farm or bakery goods on OyoPasal?</p>
                <button
                  type="button"
                  onClick={() => setBecomeSellerModalOpen(true)}
                  className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Apply to Become a Partner Store →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW: LOGGED IN SELLER BACKEND DASHBOARD
  // ----------------------------------------------------
  const lowStockItems = sellerProducts.filter(p => p.stock <= 5 || !p.in_stock);
  const healthyItems = sellerProducts.filter(p => p.stock > 5 && p.in_stock);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="w-full">
        {/* Top Control Header */}
        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-md">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {currentSeller.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Verified Vendor
                  </span>
                  <span className="text-sm text-slate-400 font-mono">
                    ID: {currentSeller.id}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {currentSeller.location || 'Kathmandu Valley'} · Quick-Commerce 10-15 Min Dispatch
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Direct Link to Customer Store */}
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-semibold transition-colors"
                title="View how customer storefront appears"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span>View Customer Store</span>
              </Link>

              {/* Logout button */}
              <button
                onClick={logoutSeller}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-sm font-semibold transition-colors cursor-pointer"
                title="Sign out from this merchant account"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Live Catalog</span>
              <span className="text-xl font-bold text-white font-mono tabular-nums">
                {sellerProducts.length} Products
              </span>
            </div>

            {/* Low Inventory Alert KPI */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('products');
                setInventoryFilter('low');
              }}
              className={`rounded-xl p-3 border transition-all text-left cursor-pointer ${
                lowStockItems.length > 0
                  ? 'bg-red-950/50 border-red-700/80 hover:bg-red-950/80 ring-1 ring-red-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60'
              }`}
              title="Click to filter low stock items"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                  Low Stock
                </span>
                {lowStockItems.length > 0 && (
                  <span className="text-xs bg-red-600 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                    Alert
                  </span>
                )}
              </div>
              <span className={`text-xl font-bold font-mono tabular-nums ${
                lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'
              }`}>
                {lowStockItems.length} {lowStockItems.length === 1 ? 'Item' : 'Items'}
              </span>
            </button>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Today's Revenue</span>
              <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                Rs. 18,450
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Completed Orders</span>
              <span className="text-xl font-bold text-white font-mono tabular-nums">
                42 Dispatches
              </span>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">Avg Packing Time</span>
              <span className="text-xl font-bold text-amber-400 font-mono tabular-nums">
                4.8 mins
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Visual Summary & Charts</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'add'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'products'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catalog & Inventory ({sellerProducts.length})</span>
            {lowStockItems.length > 0 && (
              <span className="text-xs bg-red-600 text-white font-mono px-2 py-0.5 rounded-full font-bold ml-1 flex items-center gap-1 shadow-xs animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                <span>{lowStockItems.length} Low</span>
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Live Dispatch Orders</span>
          </button>
        </div>

        {/* ==================================================== */}
        {/* TAB 0: VISUAL SUMMARY & SALES CHARTS */}
        {/* ==================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <SellerVisualSummary vendorName={currentSeller.name} />

            {/* Quick action bar */}
            <div className="bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-white">Ready to expand your store catalog?</h4>
                <p className="text-sm text-slate-400">Publish high-margin produce or bakery products to capture more Kathmandu customer orders.</p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add New Product Now</span>
                </button>
                <Link
                  to="/"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm border border-slate-700 transition-colors"
                >
                  View Customer Store
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: ADD NEW PRODUCT */}
        {/* ==================================================== */}
        {activeTab === 'add' && (
          <div>
            {/* Live Publication Notice if a product was just published */}
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
                      Product Published to Customer Store!
                    </h3>
                    <p className="text-sm text-emerald-300">
                      "{lastAddedProduct.name}" (Rs. {lastAddedProduct.discounted_price}) is now live for search, homepage feeds, and cart checkout.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/product/${lastAddedProduct.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors"
                  >
                    <span>View Product Page</span>
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                  >
                    <span>Customer Home</span>
                  </Link>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Product Entry Form (7 cols on lg) */}
              <div className="lg:col-span-7 bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-white">Create New Catalog Product</h2>
                    <p className="text-sm text-slate-400">Fill in product details to syndicate immediately to customer app.</p>
                  </div>
                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                    Direct Sync
                  </span>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  {/* Product Title */}
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">
                      Product Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={productName}
                      onChange={e => setProductName(e.target.value)}
                      placeholder="e.g. Organic Red Fuji Apples, Fresh Paneer 500g"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Category & Pack Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        Category <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={categorySlug}
                        onChange={e => setCategorySlug(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      >
                        <option value="fruits-vegetables">Fruits & Vegetables</option>
                        <option value="dairy-bakery">Dairy, Bread & Eggs</option>
                        <option value="snacks-munchies">Snacks & Munchies</option>
                        <option value="beverages">Cold Drinks & Juices</option>
                        <option value="organic-gourmet">Organic & Gourmet</option>
                        <option value="household-cleaning">Household & Cleaning</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        Unit / Pack Size <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        placeholder="e.g. 500g, 1 kg, 1L"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      {/* Quick preset chips */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {PRESET_UNITS.map(u => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setUnit(u)}
                            className={`text-xs px-2.5 py-0.5 rounded cursor-pointer transition-colors ${
                              unit === u ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pricing: MRP & Selling Price */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        Selling Price (Rs.) <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm text-slate-500 font-bold">Rs.</span>
                        <input
                          type="number"
                          min="1"
                          required
                          value={discountedPrice}
                          onChange={e => setDiscountedPrice(e.target.value ? Number(e.target.value) : '')}
                          placeholder="95"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        MRP / Original (Rs.)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm text-slate-500 font-bold">Rs.</span>
                        <input
                          type="number"
                          min="1"
                          value={originalPrice}
                          onChange={e => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                          placeholder="120"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-1">
                        Stock Inventory
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={stockCount}
                        onChange={e => setStockCount(e.target.value ? Number(e.target.value) : '')}
                        placeholder="25"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Organic & Certified check */}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={isOrganic}
                        onChange={e => setIsOrganic(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-700 bg-slate-950"
                      />
                      <span>Certified Organic / Local Farm Fresh</span>
                    </label>
                  </div>

                  {/* Product Image Selection */}
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-2">
                      Product Image
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      {PRESET_IMAGES.map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSelectedImageUrl(img.url);
                            setCustomImageUrl('');
                          }}
                          className={`relative rounded-xl overflow-hidden border-2 text-left transition-all cursor-pointer ${
                            selectedImageUrl === img.url && !customImageUrl
                              ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                              : 'border-slate-700 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={img.url}
                            alt={img.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-16 object-cover"
                          />
                          <div className="p-1.5 bg-slate-950 text-xs text-slate-300 truncate">
                            {img.label}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={customImageUrl}
                        onChange={e => setCustomImageUrl(e.target.value)}
                        placeholder="Or enter custom image URL (https://...)"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Storefront Section Placements */}
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1.5">
                      Showcase Placement Sections
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'fresh_arrivals', label: 'Fresh Arrivals' },
                        { id: 'best_sellers', label: 'Best Sellers' },
                        { id: 'top_deals', label: 'Top Deals (Discount)' },
                        { id: 'trending', label: 'Trending in Valley' },
                        { id: 'recommended', label: 'Recommended For You' }
                      ].map(sec => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => toggleSection(sec.id)}
                          className={`px-3 py-2 rounded-xl text-sm font-semibold text-left transition-all border cursor-pointer flex items-center justify-between ${
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

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">
                      Product Description
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Brief notes on harvesting, freshness, storage recommendations..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingProduct}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-base shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submittingProduct ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Publishing to Customer Catalog...</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4" />
                          <span>Publish Product to Customer Store</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Live Customer Preview Card (5 cols on lg) */}
              <div className="lg:col-span-5 sticky top-36">
                <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Live Customer Card Preview
                    </span>
                    <span className="text-xs text-slate-500 font-mono">Realtime</span>
                  </div>

                  <p className="text-sm text-slate-400 mb-4">
                    This is exactly how customers in Kathmandu Valley will see your product card on the homepage and search results:
                  </p>

                  {/* Simulated Product Card */}
                  <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md max-w-sm mx-auto">
                    {/* Image Box */}
                    <div className="relative aspect-4/3 w-full bg-slate-800 overflow-hidden">
                      <img
                        src={customImageUrl.trim() || selectedImageUrl}
                        alt="Product Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {discountPercent > 0 && (
                        <div className="absolute top-2 left-2 bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded shadow-xs">
                          {discountPercent}% OFF
                        </div>
                      )}
                      {isOrganic && (
                        <div className="absolute bottom-2 left-2 bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          🌱 100% Organic
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-4">
                      {/* Distance & Vendor */}
                      <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
                        <span className="font-semibold truncate max-w-[160px]">{currentSeller.name}</span>
                        <span className="font-mono">⚡ 10-12 mins</span>
                      </div>

                      <h4 className="font-bold text-white text-base line-clamp-1">
                        {productName.trim() || 'Your Product Title'}
                      </h4>

                      <p className="text-sm text-slate-400 mt-0.5 font-medium">
                        {unit || '500g'}
                      </p>

                      {/* Pricing Row */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-extrabold text-white font-mono tabular-nums">
                              Rs. {disc || 95}
                            </span>
                            {orig > disc && (
                              <span className="text-sm text-slate-500 line-through font-mono tabular-nums">
                                Rs. {orig}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-xs hover:bg-emerald-500 transition-colors flex items-center gap-1"
                        >
                          <PlusCircle className="w-4 h-4" />
                          <span>ADD</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Tips */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <p className="flex items-center gap-1.5 text-slate-300 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Instant Syndication Guarantee
                    </p>
                    <p>
                      Products added here are immediately registered in the active catalog and available to all Kathmandu shoppers.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: MY PRODUCTS & INVENTORY */}
        {/* ==================================================== */}
        {activeTab === 'products' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
            {/* Low Inventory Alert Banner */}
            {lowStockItems.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/90 via-red-900/60 to-rose-950/90 border border-red-700/80 text-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-red-950/60">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                        Low Inventory Alert
                      </h3>
                      <span className="text-xs bg-red-800 text-red-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {lowStockItems.length} {lowStockItems.length === 1 ? 'Product Critical' : 'Products Critical'}
                      </span>
                    </div>
                    <p className="text-sm text-red-200 mt-1">
                      {lowStockItems.length} product{lowStockItems.length > 1 ? 's have' : ' has'} ≤ 5 units in stock. Items depleted to 0 units are automatically marked out-of-stock on customer quick-delivery storefronts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={handleRestockAllLow}
                    disabled={restockingAll}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-red-950 font-extrabold text-sm shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {restockingAll ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-red-700" />
                    ) : (
                      <PlusCircle className="w-4 h-4 text-red-700" />
                    )}
                    <span>Restock All Low Items (+25)</span>
                  </button>
                  <button
                    onClick={() => setInventoryFilter(inventoryFilter === 'low' ? 'all' : 'low')}
                    className="px-3.5 py-2.5 rounded-xl bg-red-900/80 hover:bg-red-800 text-white font-semibold text-sm border border-red-700/80 transition-colors cursor-pointer"
                  >
                    {inventoryFilter === 'low' ? 'Show All Products' : 'Filter Low Only'}
                  </button>
                </div>
              </div>
            )}

            {/* Inventory Header, Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-400" />
                  <span>Store Inventory & Catalog</span>
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Monitor live inventory levels, execute quick restocks, or modify availability status.
                </p>
              </div>

              {/* Search & Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchCatalogQuery}
                    onChange={e => setSearchCatalogQuery(e.target.value)}
                    placeholder="Search by product name..."
                    className="pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-52 sm:w-64"
                  />
                </div>
                <button
                  onClick={loadSellerCatalog}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title="Refresh catalog list"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Filter Segmented Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setInventoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  inventoryFilter === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white bg-slate-950/60'
                }`}
              >
                All Products ({sellerProducts.length})
              </button>

              <button
                onClick={() => setInventoryFilter('low')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  inventoryFilter === 'low'
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/50'
                    : lowStockItems.length > 0
                    ? 'bg-red-950/60 text-red-300 border border-red-800/80 hover:bg-red-900/40'
                    : 'text-slate-400 hover:text-white bg-slate-950/60'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>Low Inventory & Depleted ({lowStockItems.length})</span>
              </button>

              <button
                onClick={() => setInventoryFilter('healthy')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  inventoryFilter === 'healthy'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white bg-slate-950/60'
                }`}
              >
                Healthy Stock ({healthyItems.length})
              </button>
            </div>

            {loadingProducts ? (
              <div className="py-16 text-center text-slate-400 text-base flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Loading your store's live catalog...</span>
              </div>
            ) : (
              (() => {
                let filtered = sellerProducts.filter(p =>
                  p.name.toLowerCase().includes(searchCatalogQuery.toLowerCase()) ||
                  p.category.name.toLowerCase().includes(searchCatalogQuery.toLowerCase())
                );

                if (inventoryFilter === 'low') {
                  filtered = filtered.filter(p => p.stock <= 5 || !p.in_stock);
                } else if (inventoryFilter === 'healthy') {
                  filtered = filtered.filter(p => p.stock > 5 && p.in_stock);
                }

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center">
                      <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white">No products found</h3>
                      <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                        {inventoryFilter === 'low'
                          ? 'Great job! No products currently have critically low inventory.'
                          : searchCatalogQuery
                          ? 'No catalog items match your search term.'
                          : 'You have not added any products yet. Use the "Add New Product" tab to publish your first item.'}
                      </p>
                      {inventoryFilter !== 'all' ? (
                        <button
                          onClick={() => setInventoryFilter('all')}
                          className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                        >
                          View All Inventory
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveTab('add')}
                          className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors cursor-pointer"
                        >
                          Add First Product Now
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-xs">
                          <th className="pb-3 font-semibold">Product</th>
                          <th className="pb-3 font-semibold">Category</th>
                          <th className="pb-3 font-semibold">Price</th>
                          <th className="pb-3 font-semibold">Inventory Level</th>
                          <th className="pb-3 font-semibold">Quick Restock</th>
                          <th className="pb-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filtered.map(prod => {
                          const isLowStock = prod.stock <= 5 || !prod.in_stock;
                          const isOut = prod.stock === 0 || !prod.in_stock;

                          return (
                            <tr
                              key={prod.id}
                              className={`transition-colors ${
                                isLowStock
                                  ? 'bg-red-950/30 hover:bg-red-950/50 ring-1 ring-inset ring-red-500/40'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Product Info */}
                              <td className="py-3.5 pr-4 pl-3">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img
                                      src={prod.image_url}
                                      alt={prod.name}
                                      referrerPolicy="no-referrer"
                                      className={`w-12 h-12 rounded-lg object-cover bg-slate-800 shrink-0 border ${
                                        isLowStock ? 'border-red-600/80 ring-1 ring-red-500/30' : 'border-slate-700'
                                      }`}
                                    />
                                    {isLowStock && (
                                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-xs flex items-center justify-center font-bold">
                                        !
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <span className={`font-bold text-base block ${isLowStock ? 'text-red-100' : 'text-white'}`}>
                                      {prod.name}
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                      <span>{prod.unit}</span>
                                      {prod.is_organic && (
                                        <span className="text-emerald-400 font-semibold">· Organic</span>
                                      )}
                                      {isLowStock && (
                                        <span className="text-red-400 font-bold flex items-center gap-0.5">
                                          · ⚠️ Critical Stock
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Category */}
                              <td className="py-3.5 pr-4 text-slate-300">
                                {prod.category.name}
                              </td>

                              {/* Price */}
                              <td className="py-3.5 pr-4">
                                <div className="font-mono tabular-nums">
                                  <span className="font-bold text-white">Rs. {prod.discounted_price}</span>
                                  {prod.original_price > prod.discounted_price && (
                                    <span className="text-slate-500 line-through text-xs ml-1.5">
                                      Rs. {prod.original_price}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Stock Status Badge (Highlighted in Red for Low Inventory) */}
                              <td className="py-3.5 pr-4">
                                {isOut ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-700 shadow-2xs">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    <span>Out of Stock (0)</span>
                                  </div>
                                ) : isLowStock ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-950/90 text-red-300 border border-red-600 shadow-2xs">
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    <span>Low Stock: Only {prod.stock} left</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>In Stock ({prod.stock})</span>
                                  </div>
                                )}
                              </td>

                              {/* Quick Restock Action Button */}
                              <td className="py-3.5 pr-4 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleRestock(prod.id, 25)}
                                    disabled={restockingId === prod.id}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                      isLowStock
                                        ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-95 text-white shadow-red-950/60 ring-1 ring-red-400/40'
                                        : 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-300 hover:text-white border border-slate-700'
                                    }`}
                                    title="Quickly add 25 units to product inventory"
                                  >
                                    {restockingId === prod.id ? (
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <PlusCircle className="w-4 h-4" />
                                    )}
                                    <span>Quick Restock (+25)</span>
                                  </button>

                                  {/* Quick +50 Units Option */}
                                  <button
                                    onClick={() => handleRestock(prod.id, 50)}
                                    disabled={restockingId === prod.id}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-xs font-mono text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
                                    title="Add 50 units"
                                  >
                                    +50
                                  </button>
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleToggleStock(prod.id)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                    title={prod.in_stock ? "Mark as Out of Stock" : "Mark as In Stock"}
                                  >
                                    <ToggleRight className={`w-4 h-4 ${prod.in_stock ? 'text-emerald-400' : 'text-slate-500'}`} />
                                  </button>
                                  <Link
                                    to={`/product/${prod.id}`}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                    title="View on Customer Storefront"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                    className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 transition-colors cursor-pointer"
                                    title="Remove from Catalog"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: LIVE DISPATCH ORDERS */}
        {/* ==================================================== */}
        {activeTab === 'orders' && (
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Live Customer Order Dispatches</h2>
                <p className="text-sm text-slate-400">Incoming 10-minute grocery delivery orders requiring store packing.</p>
              </div>
              <span className="text-sm font-mono text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800">
                🟢 Live Dispatch Queue
              </span>
            </div>

            <div className="space-y-4">
              {[
                {
                  id: 'ORD-9842',
                  time: '3 mins ago',
                  customer: 'Anjali Sharma',
                  location: 'New Baneshwor, Kathmandu',
                  items: '2x Organic Red Apples 500g, 1x Fresh Cow Milk 1L',
                  total: 440,
                  status: 'Packing Now',
                  riderEta: '4 mins'
                },
                {
                  id: 'ORD-9839',
                  time: '8 mins ago',
                  customer: 'Roshan Yadav',
                  location: 'Thamel Chowk, Kathmandu',
                  items: '1x Artisan Sourdough Loaf, 1x Himalayan Honey 250g',
                  total: 780,
                  status: 'Rider Assigned',
                  riderEta: '2 mins'
                },
                {
                  id: 'ORD-9831',
                  time: '15 mins ago',
                  customer: 'Prakash Maharjan',
                  location: 'Pulchowk, Lalitpur',
                  items: '1x Hydroponic Spinach 250g, 2x Fresh Curd 500g',
                  total: 390,
                  status: 'Out for Delivery',
                  riderEta: 'On Bike'
                }
              ].map(ord => (
                <div
                  key={ord.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">{ord.id}</span>
                      <span className="text-xs text-slate-400 font-mono">· {ord.time}</span>
                      <span className="text-xs bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-semibold">
                        {ord.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 font-medium">{ord.items}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Customer: {ord.customer} · {ord.location}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <span className="font-bold text-emerald-400 text-base font-mono tabular-nums">
                      Rs. {ord.total}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      Rider: <strong className="text-slate-200">{ord.riderEta}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
