import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  History,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Package,
  PlusCircle,
  RefreshCw,
  Settings,
  Star,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import ProductGalleryModal from '../../components/seller/ProductGalleryModal';
import SellerAddProductTab from '../../components/seller/SellerAddProductTab';
import SellerAuthView from '../../components/seller/SellerAuthView';
import SellerCatalogTab from '../../components/seller/SellerCatalogTab';
import SellerLedgerTab from '../../components/seller/SellerLedgerTab';
import { SellerMessagesTab } from '../../components/seller/SellerMessagesTab';
import SellerOrdersTab from '../../components/seller/SellerOrdersTab';
import SellerReviewsTab from '../../components/seller/SellerReviewsTab';
import SellerSettingsTab from '../../components/seller/SellerSettingsTab';
import StoreProfileSetupTab from '../../components/seller/StoreProfileSetupTab';
import SellerVariantsModal from '../../components/seller/SellerVariantsModal';
import SellerVisualSummary from '../../components/seller/SellerVisualSummary';
import { messagingService } from '../../services/messagingService';
import { SellerTab, useSellerPortal } from '../../hooks/useSellerPortal';

export default function SellerPortalPage() {
  const navigate = useNavigate();
  const s = useSellerPortal();
  const [variantsModalProduct, setVariantsModalProduct] = useState<any>(null);
  const [vendorUnreadCount, setVendorUnreadCount] = useState<number>(0);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [syncCount, setSyncCount] = useState<number>(0);

  useEffect(() => {
    if (!s.currentSeller?.id) return;
    messagingService
      .getUnreadCount('vendor')
      .then((res) => {
        setVendorUnreadCount(res?.vendor_unread ?? 0);
      })
      .catch(() => {});
  }, [s.currentSeller?.id, s.activeTab === 'messages']);

  if (!s.currentSeller) {
    return (
      <SellerAuthView
        loginLoading={s.loginLoading}
        customStoreId={s.customStoreId}
        customPassword={s.customPassword}
        customLoginError={s.customLoginError}
        customLoginErrorCode={s.customLoginErrorCode}
        language={s.language}
        t={s.t}
        onCustomLogin={s.handleCustomLogin}
        onChangeStoreId={s.setCustomStoreId}
        onChangePassword={s.setCustomPassword}
        onOpenBecomeSeller={() => navigate('/become-seller')}
      />
    );
  }

  const effectiveVendor = s.storeProfile || s.currentSeller;
  const isApproved = Boolean(
    effectiveVendor.is_verified ||
    effectiveVendor.verified ||
    effectiveVendor.is_approved ||
    String(effectiveVendor.status).toUpperCase() === 'APPROVED' ||
    String(effectiveVendor.approval_status).toLowerCase() === 'approved'
  );
  const approvalStatus = isApproved ? 'approved' : String(effectiveVendor.approval_status || effectiveVendor.status || 'pending').toLowerCase();
  const safeProducts = Array.isArray(s.sellerProducts) ? s.sellerProducts : [];
  const safeOrders = Array.isArray(s.sellerOrders) ? s.sellerOrders : [];
  const safeReviews = Array.isArray(s.sellerReviews) ? s.sellerReviews : [];

  const lowStockItems = safeProducts.filter((p) => p && (p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock));
  const healthyItems = safeProducts.filter((p) => p && (p.stock > (p.low_stock_threshold ?? 5) && p.in_stock));
  const activeOrdersList = safeOrders.filter((o) =>
    o && ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)
  );
  const newestActiveOrder = activeOrdersList[0];

  const storeFirstLetter = (effectiveVendor.name || 'S').trim().charAt(0).toUpperCase();
  const customerStoreUrl = effectiveVendor.slug
    ? `/stores/${effectiveVendor.slug}`
    : effectiveVendor.id
      ? `/stores/${effectiveVendor.id}`
      : '/';

  const handleSync = async () => {
    setSyncCount((c) => c + 1);
    await s.syncAllSellerData();
    messagingService
      .getUnreadCount()
      .then((res) => {
        setVendorUnreadCount(res.vendor_unread || 0);
      })
      .catch(() => { });
  };

  const navItems: {
    id: SellerTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: React.ReactNode;
  }[] = [
      {
        id: 'analytics',
        label: s.language === 'ne' ? 'भिजुअल सारांश र चार्ट' : 'Visual Summary & Charts',
        icon: BarChart3,
      },
      {
        id: 'add',
        label: s.language === 'ne' ? 'नयाँ सामान थप्नुहोस्' : 'Add New Product',
        icon: PlusCircle,
      },
      {
        id: 'products',
        label: s.language === 'ne' ? 'क्याटलग र मौज्दात' : 'Catalog & Inventory',
        icon: Package,
        badge: lowStockItems.length > 0 ? (
          <span className="text-[11px] bg-red-600 text-white font-mono px-1.5 py-0.5 rounded-full font-bold">
            {lowStockItems.length}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            {safeProducts.length}
          </span>
        ),
      },
      {
        id: 'orders',
        label: s.language === 'ne' ? 'प्रत्यक्ष अर्डरहरू' : 'Live Dispatch Orders',
        icon: Truck,
        badge: activeOrdersList.length > 0 ? (
          <span className="text-[11px] bg-amber-500 text-slate-950 font-mono px-2 py-0.5 rounded-full font-extrabold">
            {activeOrdersList.length}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            {safeOrders.length}
          </span>
        ),
      },
      {
        id: 'messages',
        label: s.language === 'ne' ? 'ग्राहक सन्देश' : 'Messages',
        icon: MessageSquare,
        badge: vendorUnreadCount > 0 ? (
          <span className="text-[11px] bg-[#059669] text-white font-mono px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span>{vendorUnreadCount}</span>
          </span>
        ) : null,
      },
      {
        id: 'reviews',
        label: s.language === 'ne' ? 'ग्राहक समीक्षा' : 'Reviews',
        icon: Star,
        badge: safeReviews.length > 0 ? (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            {safeReviews.length}
          </span>
        ) : null,
      },
      {
        id: 'profile',
        label: s.language === 'ne' ? 'पसल प्रोफाइल सेटअप' : 'Store Profile Setup',
        icon: Store,
      },
      {
        id: 'ledger',
        label: s.language === 'ne' ? 'मौज्दात लेजर' : 'Inventory Ledger',
        icon: ClipboardList,
      },
      {
        id: 'settings',
        label: s.language === 'ne' ? 'भुक्तानी र सेटिङ' : 'Payouts & Settings',
        icon: Settings,
      },
    ];

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Top Store Identity Card */}
        <div className="bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white font-extrabold text-lg flex items-center justify-center shrink-0 shadow-xs">
              {storeFirstLetter}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={effectiveVendor.name}>
                {effectiveVendor.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{isApproved ? (s.language === 'ne' ? 'प्रमाणित विक्रेता' : 'Verified Vendor') : approvalStatus.toUpperCase()}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
            <span className={`w-2 h-2 rounded-full ${s.storeOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>
              {s.storeOnline
                ? (s.language === 'ne' ? 'पसल अनलाइन छ' : 'Store Online')
                : (s.language === 'ne' ? 'पसल रोकिएको' : 'Store Paused')}
            </span>
          </div>
        </div>

        {/* Back to Customer Marketplace Navigation */}
        <div className="mb-3">
          <Link
            to="/"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>{s.language === 'ne' ? 'किनमेलमा फर्कनुहोस्' : 'Customer Shopping'}</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-950 dark:text-emerald-100 font-extrabold">
              Market
            </span>
          </Link>
        </div>

        {/* Vertical Navigation Menu */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = s.activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  s.setActiveTab(item.id);
                  if (isMobile) setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left ${isActive
                  ? 'bg-[#059669] text-white font-semibold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sidebar Quick Actions */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 shrink-0 mt-4">
        <Link
          to={customerStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="truncate">{s.t('seller.viewCustomerStore')}</span>
        </Link>

        <button
          type="button"
          onClick={handleSync}
          className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 ${s.loadingProducts ? 'animate-spin' : ''}`} />
          <span>{s.language === 'ne' ? 'डाटा सिंक गर्नुहोस्' : 'Sync'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            s.logoutSeller();
            navigate('/');
          }}
          className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>{s.t('header.signOut')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Mobile Top Navigation Bar (screens < lg) */}
      <div className="lg:hidden sticky top-16 z-30 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#0B1120] border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
            {storeFirstLetter}
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {effectiveVendor.name}
            </h2>
            <span className="text-[11px] font-semibold text-[#059669] block truncate">
              {navItems.find((i) => i.id === s.activeTab)?.label || 'Dashboard'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/"
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-emerald-600" />
            <span>Shop</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            aria-label="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[270px] max-w-[85vw] bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800 p-4 z-50 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {s.language === 'ne' ? 'विक्रेता मेनु' : 'Vendor Portal'}
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderSidebarContent(true)}
            </div>
          </div>
        </div>
      )}

      {/* Two-Column App Shell */}
      <div className="flex flex-1 w-full">
        {/* Left Vertical Sidebar (Desktop) */}
        <aside className="w-[250px] shrink-0 bg-white dark:bg-[#0B1120] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-4 sticky top-16 h-[calc(100vh-64px)] hidden lg:flex">
          {renderSidebarContent(false)}
        </aside>

        {/* Right Main Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {s.dashboardError && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{s.dashboardError}</span>
              </div>
              <button
                type="button"
                onClick={handleSync}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {!isApproved && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-700/80 text-amber-900 dark:text-amber-100 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                  {s.language === 'ne'
                    ? `पसल स्थिति: ${approvalStatus.toUpperCase()} — एडमिन स्वीकृति बाँकी छ`
                    : `Store Status: ${approvalStatus.toUpperCase()} — Admin Approval Required`}
                </h3>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1">
                  {s.language === 'ne'
                    ? 'ग्राहक पसलमा नयाँ सामान प्रकाशित गर्न र अर्डर व्यवस्थापन गर्न सुपर एडमिन कन्सोल (/admin) बाट स्वीकृति आवश्यक छ।'
                    : 'Publishing new products and updating live fulfillments require approval from the Admin Console (/admin).'}
                </p>
              </div>
            </div>
          )}

          {/* Compact Top Action Banner */}
          {s.activeTab !== 'orders' && activeOrdersList.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-emerald-950 dark:text-white">
                    {s.language === 'ne'
                      ? `${activeOrdersList.length} नयाँ ग्राहक अर्डर प्राप्त भयो`
                      : `${activeOrdersList.length} Active Customer Order(s) Ready for Action`}
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-800 dark:text-emerald-200/90 mt-0.5">
                    {newestActiveOrder
                      ? `Latest: ${newestActiveOrder.order_number} · ${newestActiveOrder.customer_name} (${newestActiveOrder.customer_area}) · ${Array.isArray(newestActiveOrder.items) ? newestActiveOrder.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ') : ''}`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => s.setActiveTab('orders')}
                className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-extrabold text-xs sm:text-sm transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
              >
                <span>{s.language === 'ne' ? 'अर्डर हेर्नुहोस्' : 'View & Pack Orders'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {s.activeTab === 'analytics' && (
            <div className="space-y-6">
              <SellerVisualSummary vendorId={effectiveVendor.id} vendorName={effectiveVendor.name} />
              <div className="bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-bold text-white">{s.t('seller.readyExpand')}</h4>
                  <p className="text-sm text-slate-400">{s.t('seller.readyExpandSub')}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => s.setActiveTab('add')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{s.t('seller.addNow')}</span>
                  </button>
                  <Link
                    to="/"
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm border border-slate-700 transition-colors"
                  >
                    {s.t('seller.viewCustomerStore')}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {s.activeTab === 'add' && (
            <SellerAddProductTab
              effectiveVendor={effectiveVendor}
              categories={s.categories}
              loadingCategories={s.loadingCategories}
              lastAddedProduct={s.lastAddedProduct}
              productName={s.productName}
              setProductName={s.setProductName}
              categorySlug={s.categorySlug}
              setCategorySlug={s.setCategorySlug}
              unit={s.unit}
              setUnit={s.setUnit}
              originalPrice={s.originalPrice}
              setOriginalPrice={s.setOriginalPrice}
              discountedPrice={s.discountedPrice}
              setDiscountedPrice={s.setDiscountedPrice}
              stockCount={s.stockCount}
              setStockCount={s.setStockCount}
              isOrganic={s.isOrganic}
              setIsOrganic={s.setIsOrganic}
              hasVariants={s.hasVariants}
              setHasVariants={s.setHasVariants}
              variantsList={s.variantsList}
              setVariantsList={s.setVariantsList}
              description={s.description}
              setDescription={s.setDescription}
              customImageUrl={s.customImageUrl}
              setCustomImageUrl={s.setCustomImageUrl}
              uploadingPrimaryImg={s.uploadingPrimaryImg}
              galleryUrls={s.galleryUrls}
              setGalleryUrls={s.setGalleryUrls}
              galleryUrlInput={s.galleryUrlInput}
              setGalleryUrlInput={s.setGalleryUrlInput}
              uploadingGalleryImg={s.uploadingGalleryImg}
              selectedSections={s.selectedSections}
              toggleSection={s.toggleSection}
              submittingProduct={s.submittingProduct}
              language={s.language}
              formatPrice={s.formatPrice}
              t={s.t}
              onPrimaryImageUpload={s.handlePrimaryImageUpload}
              onGalleryImageUpload={s.handleGalleryImageUpload}
              onAddGalleryUrl={s.handleAddGalleryUrl}
              onSubmit={s.handleCreateProduct}
            />
          )}

          {s.activeTab === 'products' && (
            <SellerCatalogTab
              sellerProducts={s.sellerProducts}
              lowStockItems={lowStockItems}
              healthyItems={healthyItems}
              searchCatalogQuery={s.searchCatalogQuery}
              setSearchCatalogQuery={s.setSearchCatalogQuery}
              inventoryFilter={s.inventoryFilter}
              setInventoryFilter={s.setInventoryFilter}
              loadingProducts={s.loadingProducts}
              restockingId={s.restockingId}
              restockingAll={s.restockingAll}
              language={s.language}
              formatPrice={s.formatPrice}
              t={s.t}
              onRefresh={s.loadSellerDashboard}
              onRestock={s.handleRestock}
              onRestockAllLow={s.handleRestockAllLow}
              onToggleStock={s.handleToggleStock}
              onRequestDelete={(prod) => s.setDeleteTarget({ id: prod.id, name: prod.name })}
              onOpenGallery={(prod) => s.setGalleryModalProduct(prod)}
              onManageVariants={(prod) => setVariantsModalProduct(prod)}
            />
          )}

          {s.activeTab === 'orders' && (
            <SellerOrdersTab
              vendorName={effectiveVendor.name}
              sellerOrders={s.sellerOrders}
              loadingOrders={s.loadingOrders}
              ordersError={s.ordersError}
              orderStatusFilter={s.orderStatusFilter}
              setOrderStatusFilter={s.setOrderStatusFilter}
              updatingOrderId={s.updatingOrderId}
              language={s.language}
              formatPrice={s.formatPrice}
              t={s.t}
              onRefresh={() => s.loadSellerOrders()}
              onSwitchStore={() => {
                s.logoutSeller();
                navigate('/seller');
              }}
              onUpdateStatus={s.handleFulfillmentUpdate}
            />
          )}

          {s.activeTab === 'messages' && (
            <SellerMessagesTab
              vendorId={effectiveVendor.id}
              vendorName={effectiveVendor.name}
              syncTrigger={syncCount}
            />
          )}

          {s.activeTab === 'reviews' && (
            <SellerReviewsTab
              sellerReviews={s.sellerReviews}
              reviewsAvg={s.reviewsAvg}
              reviewsLoading={s.reviewsLoading}
              reviewsError={s.reviewsError}
              language={s.language}
              t={s.t}
              onRefresh={s.loadSellerReviews}
            />
          )}

          {s.activeTab === 'ledger' && (
            <SellerLedgerTab
              movements={s.movements}
              language={s.language}
              onRefresh={s.loadMovementsAndStore}
            />
          )}

          {s.activeTab === 'profile' && (
            <StoreProfileSetupTab />
          )}

          {s.activeTab === 'settings' && (
            <SellerSettingsTab
              effectiveVendor={effectiveVendor}
              dashboardStats={s.dashboardStats}
              settlements={s.settlements}
              storeOnline={s.storeOnline}
              setStoreOnline={s.setStoreOnline}
              openTime={s.openTime}
              setOpenTime={s.setOpenTime}
              closeTime={s.closeTime}
              setCloseTime={s.setCloseTime}
              storeEta={s.storeEta}
              setStoreEta={s.setStoreEta}
              storeDesc={s.storeDesc}
              setStoreDesc={s.setStoreDesc}
              storeLogoUrl={s.storeLogoUrl}
              storeCoverUrl={s.storeCoverUrl}
              uploadingStoreLogo={s.uploadingStoreLogo}
              uploadingStoreCover={s.uploadingStoreCover}
              savingStore={s.savingStore}
              language={s.language}
              formatPrice={s.formatPrice}
              onLogoUpload={s.handleStoreLogoUpload}
              onCoverUpload={s.handleStoreCoverUpload}
              onSaveStore={s.handleSaveStoreSettings}
            />
          )}
        </main>
      </div>

      <ProductGalleryModal
        product={s.galleryModalProduct}
        onClose={() => s.setGalleryModalProduct(null)}
        onProductUpdated={(updated) => {
          s.updateLocalProduct(updated);
          s.setGalleryModalProduct(null);
        }}
      />

      {variantsModalProduct && (
        <SellerVariantsModal
          product={variantsModalProduct}
          isOpen={Boolean(variantsModalProduct)}
          onClose={() => setVariantsModalProduct(null)}
          onProductUpdated={(updated) => {
            s.updateLocalProduct(updated);
            setVariantsModalProduct(updated);
          }}
          formatPrice={s.formatPrice}
          showToast={s.showToast}
        />
      )}

      <ConfirmDialog
        open={Boolean(s.deleteTarget)}
        title={s.language === 'ne' ? 'सामान हटाउने पुष्टि गर्नुहोस्' : 'Remove Catalog Product'}
        message={
          s.deleteTarget
            ? s.language === 'ne'
              ? `के तपाईं "${s.deleteTarget.name}" लाई आफ्नो सूचीबाट हटाउन चाहनुहुन्छ?`
              : `Are you sure you want to remove "${s.deleteTarget.name}" from your store catalog?`
            : ''
        }
        confirmLabel={s.language === 'ne' ? 'हटाउनुहोस्' : 'Remove Product'}
        cancelLabel={s.language === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
        destructive
        loading={s.deletingProduct}
        onConfirm={s.confirmDeleteProduct}
        onCancel={() => s.setDeleteTarget(null)}
      />
    </div>
  );
}
