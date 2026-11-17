import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  Bike,
  CreditCard,
  FileText,
  LifeBuoy,
  LogOut,
  Megaphone,
  Package,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Tag,
  Wallet,
} from 'lucide-react';
import { AdminTab, useAdminPortal } from '../../hooks/useAdminPortal';
import AdminAuthView from '../../components/admin/AdminAuthView';
import AdminOverviewTab from '../../components/admin/AdminOverviewTab';
import AdminSellersTab from '../../components/admin/AdminSellersTab';
import AdminOrdersDispatchTab from '../../components/admin/AdminOrdersDispatchTab';
import AdminProductsTab from '../../components/admin/AdminProductsTab';
import AdminCmsTab from '../../components/admin/AdminCmsTab';
import AdminAdsTab from '../../components/admin/AdminAdsTab';
import {
  AdminPaymentsTab,
  AdminRefundsTab,
  AdminSettlementsTab,
} from '../../components/admin/AdminFinanceTabs';
import {
  AdminAuditTab,
  AdminFleetTab,
  AdminSettingsTab,
  AdminTicketsTab,
} from '../../components/admin/AdminGovernanceTabs';

const ADMIN_TABS: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'sellers', label: 'Sellers & KYC', icon: Store },
  { id: 'orders', label: 'Orders & Dispatch', icon: ShoppingBag },
  { id: 'products', label: 'Products Moderation', icon: Package },
  { id: 'cms', label: 'Banners, Categories & Coupons', icon: Tag },
  { id: 'ads', label: 'Advertisements', icon: Megaphone },
  { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
  { id: 'refunds', label: 'Refunds', icon: AlertCircle },
  { id: 'fleet', label: 'Zones, Riders & Users', icon: Bike },
  { id: 'settlements', label: 'Settlements & Payouts', icon: Wallet },
  { id: 'settings', label: 'Platform Settings', icon: Settings },
  { id: 'tickets', label: 'Support Tickets', icon: LifeBuoy },
  { id: 'audit', label: 'Audit Logs', icon: FileText },
];

export default function AdminPortalPage() {
  const admin = useAdminPortal();

  if (!admin.isAdmin) {
    return (
      <AdminAuthView
        user={admin.user}
        language={admin.language}
        identifier={admin.identifier}
        password={admin.password}
        authLoading={admin.authLoading}
        onChangeIdentifier={admin.setIdentifier}
        onChangePassword={admin.setPassword}
        onSubmit={admin.handleAdminLogin}
        onQuickDemoAdmin={admin.handleQuickDemoAdmin}
        onLogout={admin.logoutCustomer}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 lg:px-10 pb-24">
      <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">OyoPasal Operations & Admin Console</h1>
            <p className="text-xs text-slate-400">
              Signed in as {admin.user?.full_name} ({admin.user?.email}) · Live PostgreSQL Governance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={admin.loadTabData}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${admin.loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link to="/" className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400">
            Storefront
          </Link>
          <button
            onClick={admin.logoutCustomer}
            className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-slate-800">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => admin.setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                admin.activeTab === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error + Retry Banner */}
      {admin.loadError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{admin.loadError}</span>
          </div>
          <button
            type="button"
            onClick={admin.loadTabData}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {admin.activeTab === 'overview' && (
        <AdminOverviewTab
          overview={admin.overview}
          loading={admin.loading}
          dateFrom={admin.dateFrom}
          dateTo={admin.dateTo}
          onChangeDateFrom={admin.setDateFrom}
          onChangeDateTo={admin.setDateTo}
          onClearDates={() => {
            admin.setDateFrom('');
            admin.setDateTo('');
          }}
          formatPrice={admin.formatPrice}
        />
      )}

      {admin.activeTab === 'sellers' && (
        <AdminSellersTab
          sellers={admin.sellers}
          loading={admin.loading}
          onApprove={admin.handleApproveSeller}
          onToggleCommission={admin.handleToggleCommissionRate}
        />
      )}

      {admin.activeTab === 'orders' && (
        <AdminOrdersDispatchTab
          orders={admin.orders}
          riders={admin.riders}
          loading={admin.loading}
          selectedRiderByOrder={admin.selectedRiderByOrder}
          onSelectRider={(orderId, riderId) =>
            admin.setSelectedRiderByOrder((prev) => ({ ...prev, [orderId]: riderId }))
          }
          onAssignRider={admin.handleAssignRider}
          formatPrice={admin.formatPrice}
        />
      )}

      {admin.activeTab === 'products' && (
        <AdminProductsTab
          products={admin.products}
          loading={admin.loading}
          formatPrice={admin.formatPrice}
          onToggleActive={admin.handleToggleProductActive}
        />
      )}

      {admin.activeTab === 'cms' && (
        <AdminCmsTab
          categories={admin.categories}
          promotions={admin.promotions}
          coupons={admin.coupons}
          catName={admin.catName}
          catNameNe={admin.catNameNe}
          catSlug={admin.catSlug}
          catDesc={admin.catDesc}
          catImageUrl={admin.catImageUrl}
          uploadingCatImg={admin.uploadingCatImg}
          editingCatId={admin.editingCatId}
          editCatName={admin.editCatName}
          editCatImg={admin.editCatImg}
          setCatName={admin.setCatName}
          setCatNameNe={admin.setCatNameNe}
          setCatSlug={admin.setCatSlug}
          setCatDesc={admin.setCatDesc}
          setCatImageUrl={admin.setCatImageUrl}
          setUploadingCatImg={admin.setUploadingCatImg}
          setEditingCatId={admin.setEditingCatId}
          setEditCatName={admin.setEditCatName}
          setEditCatImg={admin.setEditCatImg}
          promoTitle={admin.promoTitle}
          promoSub={admin.promoSub}
          promoImageUrl={admin.promoImageUrl}
          promoDestUrl={admin.promoDestUrl}
          promoStartsAt={admin.promoStartsAt}
          promoEndsAt={admin.promoEndsAt}
          uploadingPromoImg={admin.uploadingPromoImg}
          setPromoTitle={admin.setPromoTitle}
          setPromoSub={admin.setPromoSub}
          setPromoImageUrl={admin.setPromoImageUrl}
          setPromoDestUrl={admin.setPromoDestUrl}
          setPromoStartsAt={admin.setPromoStartsAt}
          setPromoEndsAt={admin.setPromoEndsAt}
          setUploadingPromoImg={admin.setUploadingPromoImg}
          couponCode={admin.couponCode}
          couponDesc={admin.couponDesc}
          couponVal={admin.couponVal}
          setCouponCode={admin.setCouponCode}
          setCouponDesc={admin.setCouponDesc}
          setCouponVal={admin.setCouponVal}
          onUploadAsset={admin.handleUploadAsset}
          onRefresh={admin.loadTabData}
          showToast={admin.showToast}
        />
      )}

      {admin.activeTab === 'ads' && (
        <AdminAdsTab
          ads={admin.ads}
          loading={admin.loading}
          adTitle={admin.adTitle}
          adSubtitle={admin.adSubtitle}
          adImageUrl={admin.adImageUrl}
          adDestUrl={admin.adDestUrl}
          adPlacement={admin.adPlacement}
          adPriority={admin.adPriority}
          uploadingAdImg={admin.uploadingAdImg}
          setAdTitle={admin.setAdTitle}
          setAdSubtitle={admin.setAdSubtitle}
          setAdImageUrl={admin.setAdImageUrl}
          setAdDestUrl={admin.setAdDestUrl}
          setAdPlacement={admin.setAdPlacement}
          setAdPriority={admin.setAdPriority}
          setUploadingAdImg={admin.setUploadingAdImg}
          onUploadAsset={admin.handleUploadAsset}
          onRefresh={admin.loadTabData}
          showToast={admin.showToast}
        />
      )}

      {admin.activeTab === 'payments' && (
        <AdminPaymentsTab
          paymentsList={admin.paymentsList}
          loading={admin.loading}
          formatPrice={admin.formatPrice}
        />
      )}

      {admin.activeTab === 'refunds' && (
        <AdminRefundsTab
          refunds={admin.refunds}
          formatPrice={admin.formatPrice}
          onRefresh={admin.loadTabData}
          showToast={admin.showToast}
        />
      )}

      {admin.activeTab === 'fleet' && (
        <AdminFleetTab
          zones={admin.zones}
          riders={admin.riders}
          usersList={admin.usersList}
          zoneName={admin.zoneName}
          zoneSlug={admin.zoneSlug}
          setZoneName={admin.setZoneName}
          setZoneSlug={admin.setZoneSlug}
          onRefresh={admin.loadTabData}
        />
      )}

      {admin.activeTab === 'settlements' && (
        <AdminSettlementsTab
          vendorBalances={admin.settlementData.vendor_balances}
          settlements={admin.settlementData.settlements}
          formatPrice={admin.formatPrice}
          onExportCsv={admin.handleExportSettlementsCsv}
          onRefresh={admin.loadTabData}
          showToast={admin.showToast}
        />
      )}

      {admin.activeTab === 'settings' && (
        <AdminSettingsTab
          deliveryFeesCfg={admin.deliveryFeesCfg}
          commissionCfg={admin.commissionCfg}
          supportCfg={admin.supportCfg}
          savingSettingKey={admin.savingSettingKey}
          setDeliveryFeesCfg={admin.setDeliveryFeesCfg}
          setCommissionCfg={admin.setCommissionCfg}
          setSupportCfg={admin.setSupportCfg}
          onSaveSetting={admin.handleSaveSetting}
        />
      )}

      {admin.activeTab === 'tickets' && (
        <AdminTicketsTab
          tickets={admin.tickets}
          ticketReplyDraft={admin.ticketReplyDraft}
          onChangeReplyDraft={(ticketId, val) =>
            admin.setTicketReplyDraft((prev) => ({ ...prev, [ticketId]: val }))
          }
          onReply={admin.handleReplyTicket}
          onRefresh={admin.loadTabData}
        />
      )}

      {admin.activeTab === 'audit' && <AdminAuditTab auditLogs={admin.auditLogs} />}
    </div>
  );
}
