import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  History,
  LogOut,
  MessageSquare,
  Package,
  PlusCircle,
  RefreshCw,
  Settings,
  Store,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import ProductGalleryModal from '../../components/seller/ProductGalleryModal';
import SellerAddProductTab from '../../components/seller/SellerAddProductTab';
import SellerAuthView from '../../components/seller/SellerAuthView';
import SellerCatalogTab from '../../components/seller/SellerCatalogTab';
import SellerLedgerTab from '../../components/seller/SellerLedgerTab';
import SellerOrdersTab from '../../components/seller/SellerOrdersTab';
import SellerReviewsTab from '../../components/seller/SellerReviewsTab';
import SellerSettingsTab from '../../components/seller/SellerSettingsTab';
import SellerVariantsModal from '../../components/seller/SellerVariantsModal';
import SellerVisualSummary from '../../components/seller/SellerVisualSummary';
import { useSellerPortal } from '../../hooks/useSellerPortal';

export default function SellerPortalPage() {
  const navigate = useNavigate();
  const s = useSellerPortal();
  const [variantsModalProduct, setVariantsModalProduct] = React.useState<any>(null);

  if (!s.currentSeller) {
    return (
      <SellerAuthView
        vendors={s.vendors}
        vendorsRefreshing={s.vendorsRefreshing}
        loginLoading={s.loginLoading}
        customStoreId={s.customStoreId}
        customPassword={s.customPassword}
        language={s.language}
        t={s.t}
        onRefreshVendors={s.handleRefreshVendors}
        onQuickLogin={s.handleQuickLogin}
        onCustomLogin={s.handleCustomLogin}
        onChangeStoreId={s.setCustomStoreId}
        onChangePassword={s.setCustomPassword}
        onOpenBecomeSeller={() => s.setBecomeSellerModalOpen(true)}
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
  const lowStockItems = s.sellerProducts.filter((p) => p.stock <= (p.low_stock_threshold ?? 5) || !p.in_stock);
  const healthyItems = s.sellerProducts.filter((p) => p.stock > (p.low_stock_threshold ?? 5) && p.in_stock);
  const activeOrdersList = s.sellerOrders.filter((o) =>
    ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(o.status)
  );
  const newestActiveOrder = activeOrdersList[0];

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="w-full">
        {s.dashboardError && (
          <div className="mb-5 p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{s.dashboardError}</span>
            </div>
            <button
              type="button"
              onClick={s.syncAllSellerData}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {!isApproved && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-950/70 border border-amber-700/80 text-amber-100 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm text-amber-200">
                {s.language === 'ne'
                  ? `पसल स्थिति: ${approvalStatus.toUpperCase()} — एडमिन स्वीकृति बाँकी छ`
                  : `Store Status: ${approvalStatus.toUpperCase()} — Admin Approval Required`}
              </h3>
              <p className="text-xs text-amber-300/90 mt-1">
                {s.language === 'ne'
                  ? 'ग्राहक पसलमा नयाँ सामान प्रकाशित गर्न र अर्डर व्यवस्थापन गर्न सुपर एडमिन कन्सोल (/admin) बाट स्वीकृति आवश्यक छ।'
                  : 'Publishing new products and updating live fulfillments require approval from the Admin Console (/admin).'}
              </p>
            </div>
          </div>
        )}

        <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-6 border border-slate-800 shadow-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-md overflow-hidden">
                {effectiveVendor.logo_url ? (
                  <img src={effectiveVendor.logo_url} alt={effectiveVendor.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{effectiveVendor.name}</h1>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${isApproved
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                        : 'bg-amber-950 text-amber-300 border-amber-800/80'
                      }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`} />
                    {isApproved ? s.t('seller.verifiedVendor') : approvalStatus.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-400 font-mono">ID: {effectiveVendor.id}</span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {effectiveVendor.location ||
                    effectiveVendor.area ||
                    (s.language === 'ne' ? 'काठमाडौं उपत्यका' : 'Kathmandu Valley')}{' '}
                  · {s.storeOnline ? (s.language === 'ne' ? 'पसल अनलाइन छ' : 'Store Online') : s.language === 'ne' ? 'पसल रोकिएको' : 'Store Paused'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={s.syncAllSellerData}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${s.loadingProducts ? 'animate-spin' : ''}`} />
                <span>{s.language === 'ne' ? 'रिफ्रेस' : 'Sync'}</span>
              </button>

              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span>{s.t('seller.viewCustomerStore')}</span>
              </Link>

              <button
                onClick={() => {
                  s.logoutSeller();
                  navigate('/seller');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>{s.language === 'ne' ? 'पसल बदल्नुहोस्' : 'Switch Store'}</span>
              </button>

              <button
                onClick={() => {
                  s.logoutSeller();
                  navigate('/seller');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-sm font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{s.t('header.signOut')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-800">
            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">{s.t('seller.liveCatalog')}</span>
              <span className="text-xl font-bold text-white font-mono tabular-nums">
                {s.dashboardStats?.total_products ?? s.sellerProducts.length}{' '}
                {s.language === 'ne' ? 'सामान' : 'Products'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                s.setActiveTab('products');
                s.setInventoryFilter('low');
              }}
              className={`rounded-xl p-3 border transition-all text-left cursor-pointer ${lowStockItems.length > 0
                  ? 'bg-red-950/50 border-red-700/80 hover:bg-red-950/80 ring-1 ring-red-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                  {s.t('seller.lowStock')}
                </span>
                {lowStockItems.length > 0 && (
                  <span className="text-xs bg-red-600 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                    {s.t('seller.alert')}
                  </span>
                )}
              </div>
              <span
                className={`text-xl font-bold font-mono tabular-nums ${lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'
                  }`}
              >
                {lowStockItems.length} {lowStockItems.length === 1 ? s.t('common.item') : s.t('common.items')}
              </span>
            </button>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                {s.language === 'ne' ? 'कुल बिक्री (DB)' : 'Gross Sales (DB)'}
              </span>
              <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                {s.formatPrice(s.dashboardStats?.total_revenue ?? 0)}
              </span>
            </div>

            <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
              <span className="text-xs text-slate-400 uppercase tracking-wider block">
                {s.language === 'ne' ? 'खुद आम्दानी' : 'Net Earnings'}
              </span>
              <span className="text-xl font-bold text-sky-400 font-mono tabular-nums">
                {s.formatPrice(s.dashboardStats?.net_earnings ?? 0)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => s.setActiveTab('orders')}
              className={`rounded-xl p-3 border transition-all text-left cursor-pointer ${(s.dashboardStats?.pending_orders ?? activeOrdersList.length) > 0
                  ? 'bg-amber-950/40 border-amber-700/80 hover:bg-amber-950/70 ring-1 ring-amber-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/60'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">
                  {s.language === 'ne' ? 'बाँकी / कुल अर्डर' : 'Pending / Total Orders'}
                </span>
                {s.sellerOrders.some((o) => ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(o.status)) && (
                  <span className="text-[11px] bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.5 rounded uppercase">
                    NEW
                  </span>
                )}
              </div>
              <span className="text-xl font-bold text-amber-400 font-mono tabular-nums">
                {s.dashboardStats?.pending_orders ?? activeOrdersList.length} /{' '}
                {s.dashboardStats?.total_orders ?? s.sellerOrders.length}
              </span>
            </button>
          </div>
        </div>

        {s.activeTab !== 'orders' && activeOrdersList.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-950/70 border border-emerald-700/80 text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {s.language === 'ne'
                    ? `${activeOrdersList.length} नयाँ ग्राहक अर्डर प्राप्त भयो`
                    : `${activeOrdersList.length} Active Customer Order(s) Ready for Action`}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-200/90 mt-0.5">
                  {newestActiveOrder
                    ? `Latest: ${newestActiveOrder.order_number} · ${newestActiveOrder.customer_name} (${newestActiveOrder.customer_area}) · ${newestActiveOrder.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}`
                    : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => s.setActiveTab('orders')}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>{s.language === 'ne' ? 'अर्डर हेर्नुहोस्' : 'View & Pack Orders'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            onClick={() => s.setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'analytics'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{s.t('seller.tabAnalytics')}</span>
          </button>

          <button
            onClick={() => s.setActiveTab('add')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'add'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{s.t('seller.tabAdd')}</span>
          </button>

          <button
            onClick={() => s.setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'products'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <Package className="w-4 h-4" />
            <span>{s.t('seller.tabProducts', { count: s.sellerProducts.length })}</span>
            {lowStockItems.length > 0 && (
              <span className="text-xs bg-red-600 text-white font-mono px-2 py-0.5 rounded-full font-bold ml-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>{s.t('seller.lowCount', { count: lowStockItems.length })}</span>
              </span>
            )}
          </button>

          <button
            onClick={() => s.setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              {s.t('seller.tabOrders')} ({s.sellerOrders.length})
            </span>
          </button>

          <button
            onClick={() => s.setActiveTab('reviews')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'reviews'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>
              {s.language === 'ne' ? 'ग्राहक समीक्षा' : 'Reviews'} ({s.sellerReviews.length})
            </span>
          </button>

          <button
            onClick={() => s.setActiveTab('ledger')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'ledger'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <History className="w-4 h-4" />
            <span>{s.language === 'ne' ? 'स्टक खाता' : 'Inventory Ledger'}</span>
          </button>

          <button
            onClick={() => s.setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${s.activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
          >
            <Settings className="w-4 h-4" />
            <span>{s.language === 'ne' ? 'पसल सेटिङ र भुक्तानी' : 'Store & Payouts'}</span>
          </button>
        </div>

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
