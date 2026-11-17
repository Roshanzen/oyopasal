import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { Advertisement, Category } from '../../shared/types';
import {
  Shield,
  Store,
  Package,
  ShoppingBag,
  Tag,
  MapPin,
  Bike,
  Wallet,
  LifeBuoy,
  FileText,
  Settings,
  RefreshCw,
  LogOut,
  Download,
  BarChart3,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Megaphone,
  CreditCard,
  Trash2,
  Upload,
  ExternalLink,
  Pencil,
  Check,
  X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type AdminTab =
  | 'overview'
  | 'sellers'
  | 'orders'
  | 'products'
  | 'cms'
  | 'ads'
  | 'payments'
  | 'refunds'
  | 'fleet'
  | 'settlements'
  | 'settings'
  | 'tickets'
  | 'audit';

export default function AdminPortalPage() {
  const { user, loginCustomer, logoutCustomer, refreshVendors, showToast, formatPrice, language } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [identifier, setIdentifier] = useState('admin@oyopasal.np');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [overview, setOverview] = useState<any | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [settlementData, setSettlementData] = useState<{ vendor_balances: any[]; settlements: any[] }>({
    vendor_balances: [],
    settlements: []
  });
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedRiderByOrder, setSelectedRiderByOrder] = useState<Record<string, number>>({});

  // CMS: Categories
  const [catName, setCatName] = useState('');
  const [catNameNe, setCatNameNe] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImageUrl, setCatImageUrl] = useState('');
  const [uploadingCatImg, setUploadingCatImg] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatImg, setEditCatImg] = useState('');

  // CMS: Promotions
  const [promoTitle, setPromoTitle] = useState('');
  const [promoSub, setPromoSub] = useState('');
  const [promoImageUrl, setPromoImageUrl] = useState('');
  const [promoDestUrl, setPromoDestUrl] = useState('');
  const [promoStartsAt, setPromoStartsAt] = useState('');
  const [promoEndsAt, setPromoEndsAt] = useState('');
  const [uploadingPromoImg, setUploadingPromoImg] = useState(false);

  // CMS: Coupons & Zones
  const [couponCode, setCouponCode] = useState('');
  const [couponDesc, setCouponDesc] = useState('');
  const [couponVal, setCouponVal] = useState(15);
  const [zoneName, setZoneName] = useState('');
  const [zoneSlug, setZoneSlug] = useState('');
  const [ticketReplyDraft, setTicketReplyDraft] = useState<Record<number, string>>({});

  // Advertisements CRUD state
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adDestUrl, setAdDestUrl] = useState('/search');
  const [adPlacement, setAdPlacement] = useState('homepage_mid');
  const [adPriority, setAdPriority] = useState(1);
  const [uploadingAdImg, setUploadingAdImg] = useState(false);

  // Platform Settings state
  const [deliveryFeesCfg, setDeliveryFeesCfg] = useState({
    baseDeliveryFee: 40,
    freeDeliveryThreshold: 500,
    handlingFee: 10,
    defaultEtaMins: 12
  });
  const [commissionCfg, setCommissionCfg] = useState({
    defaultCommissionRate: 10,
    newSellerZeroCommissionDays: 30
  });
  const [supportCfg, setSupportCfg] = useState({
    brandName: 'OyoPasal',
    tagline: '10–15 MIN DELIVERY',
    email: 'care@oyopasal.np',
    phone: '+977-01-4991234',
    address: 'New Baneshwor, Kathmandu',
    hours: '6:00 AM – 11:00 PM Daily'
  });
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const loadTabData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setLoadError(null);
    try {
      if (activeTab === 'overview') {
        const res = await api.getAdminOverview(dateFrom || undefined, dateTo || undefined);
        setOverview(res);
      } else if (activeTab === 'sellers') {
        const res = await api.getAdminSellers();
        setSellers(res.results || []);
      } else if (activeTab === 'orders') {
        const [ordRes, riderRes] = await Promise.all([api.getAdminOrders(), api.getAdminRiders()]);
        setOrders(ordRes.results || []);
        setRiders(riderRes.results || []);
      } else if (activeTab === 'products') {
        const res = await api.getAdminProducts();
        setProducts(res.results || []);
      } else if (activeTab === 'cms') {
        const [catRes, promoRes, couponRes] = await Promise.all([
          api.getCategories(),
          api.getAdminPromotions(),
          api.getAdminCoupons()
        ]);
        setCategories(catRes.results || []);
        setPromotions(promoRes.results || []);
        setCoupons(couponRes.results || []);
      } else if (activeTab === 'ads') {
        const res = await api.getAdminAdvertisements();
        setAds(res.results || []);
      } else if (activeTab === 'payments') {
        const res = await api.getAdminPayments();
        setPaymentsList(res.results || []);
      } else if (activeTab === 'refunds') {
        const res = await api.getAdminRefunds();
        setRefunds(res.results || []);
      } else if (activeTab === 'fleet') {
        const [zRes, rRes, uRes] = await Promise.all([
          api.getAdminZones(),
          api.getAdminRiders(),
          api.getAdminUsers()
        ]);
        setZones(zRes.results || []);
        setRiders(rRes.results || []);
        setUsersList(uRes.results || []);
      } else if (activeTab === 'settlements') {
        const res = await api.getAdminSettlements();
        setSettlementData(res);
      } else if (activeTab === 'settings') {
        const res = await api.getAdminSettings();
        const rows = res.results || [];
        for (const row of rows) {
          if (row.key === 'delivery_fees' && row.value) {
            setDeliveryFeesCfg(prev => ({ ...prev, ...row.value }));
          } else if (row.key === 'commission_policy' && row.value) {
            setCommissionCfg(prev => ({ ...prev, ...row.value }));
          } else if (row.key === 'store_support' && row.value) {
            setSupportCfg(prev => ({ ...prev, ...row.value }));
          }
        }
      } else if (activeTab === 'tickets') {
        const res = await api.getAdminTickets();
        setTickets(res.results || []);
      } else if (activeTab === 'audit') {
        const res = await api.getAdminAuditLogs();
        setAuditLogs(res.results || []);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to load admin telemetry';
      setLoadError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, activeTab, dateFrom, dateTo, showToast]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await loginCustomer({ phone_or_email: identifier.trim(), password });
    } catch {
      // toast handled
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickDemoAdmin = async () => {
    setAuthLoading(true);
    try {
      await loginCustomer({ phone_or_email: 'admin@oyopasal.np', demo_quick_login: true });
    } catch {
      // handled
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUploadAsset = async (
    file: File,
    entityType: string,
    setBusy: (b: boolean) => void,
    onDone: (url: string) => void
  ) => {
    setBusy(true);
    try {
      const asset = await api.uploadMediaFile(file, entityType, undefined, false);
      onDone(asset.url);
      showToast('Image uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExportSettlementsCsv = () => {
    const rows = [
      ['Settlement ID', 'Vendor', 'Gross Sales', 'Commission', 'Net Payout', 'Status', 'Reference'],
      ...settlementData.settlements.map((s: any) => [
        s.id,
        s.vendor_name,
        s.grossSales ?? s.gross_sales,
        s.commissionTotal ?? s.commission_total,
        s.netPayout ?? s.net_payout,
        s.status,
        s.payoutReference ?? s.payout_reference ?? ''
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `oyopasal-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 py-10 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              <span>{language === 'ne' ? 'स्टोरमा फर्कनुहोस्' : 'Back to Storefront'}</span>
            </Link>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
              RBAC Admin Portal
            </span>
          </div>

          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30">
                <Shield className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-white">OyoPasal Admin Console</h1>
              <p className="text-sm text-slate-400">
                {user
                  ? `Signed in as ${user.email} (${user.role}). Administrator role required.`
                  : 'Sign in with administrator credentials to manage vendors, dispatch, refunds, and payouts.'}
              </p>
            </div>

            {user && user.role !== 'admin' && (
              <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-700/70 text-amber-200 text-xs flex items-center justify-between">
                <span>Current session does not have admin privileges.</span>
                <button onClick={logoutCustomer} className="font-bold underline cursor-pointer">Sign Out</button>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Admin Email</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer"
              >
                {authLoading ? 'Signing in...' : 'Sign In as Administrator'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={authLoading}
                onClick={handleQuickDemoAdmin}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Quick Seeded Admin Access (admin@oyopasal.np)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
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
            <p className="text-xs text-slate-400">Signed in as {user.full_name} ({user.email}) · Live PostgreSQL Governance</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadTabData}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link to="/" className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-emerald-400">
            Storefront
          </Link>
          <button
            onClick={logoutCustomer}
            className="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b border-slate-800">
        {[
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
          { id: 'audit', label: 'Audit Logs', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error + Retry Banner */}
      {loadError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadTabData}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase text-slate-400">Date Range Filter</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {loading && !overview ? (
            <div className="p-12 text-center text-sm text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
              Loading platform overview metrics...
            </div>
          ) : overview ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Total GMV</span>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">{formatPrice(overview.kpis.total_gmv)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Total / Pending Orders</span>
                  <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                    {overview.kpis.total_orders} <span className="text-sm text-amber-400">({overview.kpis.pending_orders} live)</span>
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Active Stores / Pending KYC</span>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
                    {overview.kpis.active_vendors} / {overview.kpis.pending_seller_approvals}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Platform Commission</span>
                  <p className="text-2xl font-extrabold text-indigo-400 mt-1 font-mono">
                    {formatPrice(overview.kpis.platform_commission ?? 0)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Pending Products / Low Stock</span>
                  <p className="text-2xl font-extrabold text-sky-400 mt-1 font-mono">
                    {overview.kpis.pending_products ?? 0} / <span className="text-rose-400">{overview.kpis.low_stock_products ?? 0}</span>
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Total Users / Customers</span>
                  <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                    {overview.kpis.total_users ?? 0} / {overview.kpis.total_customers ?? 0}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Processed Refunds / Open</span>
                  <p className="text-2xl font-extrabold text-rose-400 mt-1 font-mono">
                    {formatPrice(overview.kpis.total_refunds ?? 0)} ({overview.kpis.pending_refunds})
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <span className="text-xs text-slate-400 uppercase font-bold">Fleet Riders (Avail/Busy/Total)</span>
                  <p className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                    {overview.kpis.delivery_agent_stats?.available ?? 0} / {overview.kpis.delivery_agent_stats?.busy ?? 0} / {overview.kpis.delivery_agent_stats?.total ?? 0}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                <h2 className="text-base font-bold text-white mb-4">Daily Order Revenue Trend (PostgreSQL)</h2>
                {overview.revenue_series?.length > 0 ? (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.revenue_series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 py-10 text-center">No non-cancelled orders recorded in this range.</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* SELLERS & APPROVALS */}
      {activeTab === 'sellers' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-center py-10 text-slate-400">Loading sellers...</p>
          ) : sellers.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No sellers registered yet.</p>
          ) : (
            sellers.map(v => (
              <div key={v.db_id || v.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-white">{v.name}</span>
                    <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                      v.approval_status === 'approved' ? 'bg-emerald-950 text-emerald-300' :
                      v.approval_status === 'pending' ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300'
                    }`}>
                      {v.approval_status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">Commission: {v.commission_rate ?? 10}%</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{v.area} · {v.email} · {v.phone}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {v.approval_status !== 'approved' && (
                    <button
                      onClick={async () => {
                        await api.updateSellerApproval(v.db_id, { approval_status: 'approved' });
                        showToast(`Approved ${v.name}`, 'success');
                        await Promise.all([loadTabData(), refreshVendors()]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Approve Store
                    </button>
                  )}
                  {v.approval_status !== 'suspended' && (
                    <button
                      onClick={async () => {
                        await api.updateSellerApproval(v.db_id, { approval_status: 'suspended' });
                        showToast(`Suspended ${v.name}`, 'info');
                        await Promise.all([loadTabData(), refreshVendors()]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold cursor-pointer"
                    >
                      Suspend
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const nextRate = v.commission_rate === 12 ? 10 : 12;
                      await api.updateSellerApproval(v.db_id, { commission_rate: nextRate });
                      showToast(`Updated commission rate to ${nextRate}%`, 'success');
                      loadTabData();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Toggle Rate (10%/12%)
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ORDERS & RIDER DISPATCH */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-center py-10 text-slate-400">Loading orders...</p>
          ) : orders.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No orders placed yet.</p>
          ) : (
            orders.map(ord => (
              <div key={ord.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{ord.order_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold">{ord.status}</span>
                    <span className="text-xs text-emerald-400 font-mono">{formatPrice(ord.total_amount)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {ord.delivery_address?.recipient_name} · {ord.delivery_address?.street}, {ord.delivery_address?.area} · {ord.payment_method} ({ord.payment_status})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRiderByOrder[ord.id] || riders[0]?.id || ''}
                    onChange={e => setSelectedRiderByOrder(prev => ({ ...prev, [ord.id]: Number(e.target.value) }))}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    {riders.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.fullName} ({r.vehicleNumber} · {r.availabilityStatus})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      const agId = selectedRiderByOrder[ord.id] || riders[0]?.id;
                      if (!agId) return;
                      await api.assignRiderToOrder(ord.id, agId);
                      showToast(`Dispatched rider to ${ord.order_number}`, 'success');
                      loadTabData();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Assign Rider
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PRODUCTS MODERATION */}
      {activeTab === 'products' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
          {loading ? (
            <p className="text-center py-10 text-slate-400">Loading products...</p>
          ) : products.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No products found.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Vendor</th>
                  <th className="pb-2">Price / Stock</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {products.map(p => (
                  <tr key={p.id}>
                    <td className="py-2.5 font-semibold text-white">{p.name}</td>
                    <td className="py-2.5 text-slate-400">{p.vendorName}</td>
                    <td className="py-2.5 font-mono">{formatPrice(p.price)} · {p.stockCount}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.isActive ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                        {p.isActive ? p.approvalStatus : 'inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={async () => {
                          await api.moderateAdminProduct(p.id, { is_active: !p.isActive });
                          showToast('Product visibility updated', 'info');
                          loadTabData();
                        }}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                      >
                        {p.isActive ? 'Deactivate' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* CMS: BANNERS, CATEGORIES & COUPONS */}
      {activeTab === 'cms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Categories Management */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <form
              onSubmit={async e => {
                e.preventDefault();
                await api.createAdminCategory({
                  name: catName,
                  name_ne: catNameNe || catName,
                  slug: catSlug,
                  description: catDesc,
                  image_url: catImageUrl || undefined
                });
                setCatName('');
                setCatNameNe('');
                setCatSlug('');
                setCatDesc('');
                setCatImageUrl('');
                showToast('Category created', 'success');
                loadTabData();
              }}
              className="space-y-2.5"
            >
              <h3 className="font-bold text-white">Create Category</h3>
              <input required value={catName} onChange={e => setCatName(e.target.value)} placeholder="Name (English)" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
              <input value={catNameNe} onChange={e => setCatNameNe(e.target.value)} placeholder="Name (Nepali - Optional)" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
              <input required value={catSlug} onChange={e => setCatSlug(e.target.value)} placeholder="slug-url" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
              <input value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Short description" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
              <div className="flex gap-2 items-center">
                <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1 shrink-0">
                  {uploadingCatImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAsset(f, 'category', setUploadingCatImg, setCatImageUrl);
                      e.target.value = '';
                    }}
                  />
                </label>
                <input value={catImageUrl} onChange={e => setCatImageUrl(e.target.value)} placeholder="Category image URL" className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              </div>
              <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Add Category</button>
            </form>

            <div className="pt-3 border-t border-slate-800 space-y-2 max-h-80 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  {editingCatId === cat.db_id ? (
                    <div className="space-y-2">
                      <input value={editCatName} onChange={e => setEditCatName(e.target.value)} className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white" />
                      <input value={editCatImg} onChange={e => setEditCatImg(e.target.value)} placeholder="Image URL" className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!cat.db_id) return;
                            await api.updateAdminCategory(cat.db_id, { name: editCatName, image_url: editCatImg || null });
                            setEditingCatId(null);
                            showToast('Category updated', 'success');
                            loadTabData();
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                        <button type="button" onClick={() => setEditingCatId(null)} className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {cat.image_url && <img src={cat.image_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                        <div className="min-w-0">
                          <span className="font-bold text-white block truncate">{cat.name}</span>
                          <span className="text-slate-500">/{cat.slug} · {cat.item_count} items</span>
                        </div>
                      </div>
                      {cat.db_id && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.db_id!);
                              setEditCatName(cat.name);
                              setEditCatImg(cat.image_url || '');
                            }}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await api.deleteAdminCategory(cat.db_id!);
                              showToast(`Deactivated ${cat.name}`, 'info');
                              loadTabData();
                            }}
                            className="p-1 rounded bg-rose-950/60 text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Promotions Management */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!promoImageUrl.trim()) {
                  showToast('Please upload or enter a promotion banner image URL', 'error');
                  return;
                }
                await api.createAdminPromotion({
                  title: promoTitle,
                  subtitle: promoSub,
                  image_url: promoImageUrl.trim(),
                  destination_url: promoDestUrl.trim() || undefined,
                  starts_at: promoStartsAt || undefined,
                  ends_at: promoEndsAt || undefined
                });
                setPromoTitle('');
                setPromoSub('');
                setPromoImageUrl('');
                setPromoDestUrl('');
                setPromoStartsAt('');
                setPromoEndsAt('');
                showToast('Promotion banner added', 'success');
                loadTabData();
              }}
              className="space-y-2.5"
            >
              <h3 className="font-bold text-white">Create Banner Promotion</h3>
              <input required value={promoTitle} onChange={e => setPromoTitle(e.target.value)} placeholder="Banner Title" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
              <input required value={promoSub} onChange={e => setPromoSub(e.target.value)} placeholder="Subtitle" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
              <div className="flex gap-2 items-center">
                <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1 shrink-0">
                  {uploadingPromoImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAsset(f, 'promotion', setUploadingPromoImg, setPromoImageUrl);
                      e.target.value = '';
                    }}
                  />
                </label>
                <input required value={promoImageUrl} onChange={e => setPromoImageUrl(e.target.value)} placeholder="Banner image URL *" className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              </div>
              <input value={promoDestUrl} onChange={e => setPromoDestUrl(e.target.value)} placeholder="Destination URL (e.g. /category/top-deals)" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block">Starts At</label>
                  <input type="date" value={promoStartsAt} onChange={e => setPromoStartsAt(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-slate-400 block">Ends At</label>
                  <input type="date" value={promoEndsAt} onChange={e => setPromoEndsAt(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white" />
                </div>
              </div>
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">Publish Banner</button>
            </form>

            <div className="space-y-2 pt-3 border-t border-slate-800 max-h-80 overflow-y-auto">
              {promotions.map(pr => (
                <div key={pr.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-2 text-slate-300">
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{pr.title}</span>
                    <span className="text-emerald-400">{pr.badge} · {pr.is_active === false ? 'Inactive' : 'Active'}</span>
                  </div>
                  {pr.db_id && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await api.updateAdminPromotion(pr.db_id, { is_active: pr.is_active === false });
                          loadTabData();
                        }}
                        className="px-2 py-1 rounded bg-slate-800 text-indigo-300 font-bold cursor-pointer"
                      >
                        {pr.is_active === false ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.deleteAdminPromotion(pr.db_id);
                          showToast('Banner deleted', 'info');
                          loadTabData();
                        }}
                        className="p-1 rounded bg-rose-950/60 text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coupons Management */}
          <form
            onSubmit={async e => {
              e.preventDefault();
              await api.createAdminCoupon({ code: couponCode, description: couponDesc, discount_value: couponVal });
              setCouponCode('');
              setCouponDesc('');
              showToast('Coupon created', 'success');
              loadTabData();
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
          >
            <h3 className="font-bold text-white">Create Coupon Code</h3>
            <input required value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="CODE (e.g. DASHAIN20)" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input required value={couponDesc} onChange={e => setCouponDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input type="number" value={couponVal} onChange={e => setCouponVal(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <button type="submit" className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer">Create Coupon</button>
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              {coupons.map(c => (
                <div key={c.id} className="text-xs flex items-center justify-between text-slate-300 py-1">
                  <span><strong>{c.code}</strong> ({c.discountValue}{c.discountType === 'percentage' ? '%' : ' Rs'})</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await api.toggleAdminCoupon(c.id, !c.isActive);
                      loadTabData();
                    }}
                    className="underline text-indigo-400 cursor-pointer"
                  >
                    {c.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ))}
            </div>
          </form>
        </div>
      )}

      {/* ADVERTISEMENTS MANAGEMENT */}
      {activeTab === 'ads' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={async e => {
              e.preventDefault();
              if (!adImageUrl.trim()) {
                showToast('Please upload or enter an advertisement image URL', 'error');
                return;
              }
              await api.createAdminAdvertisement({
                title: adTitle,
                subtitle: adSubtitle,
                image_url: adImageUrl.trim(),
                destination_url: adDestUrl.trim() || '/search',
                placement: adPlacement,
                priority: adPriority
              });
              setAdTitle('');
              setAdSubtitle('');
              setAdImageUrl('');
              setAdDestUrl('/search');
              showToast('Advertisement campaign created', 'success');
              loadTabData();
            }}
            className="lg:col-span-5 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
          >
            <h3 className="font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <span>Create Storefront Advertisement</span>
            </h3>
            <input required value={adTitle} onChange={e => setAdTitle(e.target.value)} placeholder="Campaign Headline" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input value={adSubtitle} onChange={e => setAdSubtitle(e.target.value)} placeholder="Subtitle / Offer Details" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <div className="flex gap-2 items-center">
              <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer inline-flex items-center gap-1 shrink-0">
                {uploadingAdImg ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAsset(f, 'advertisement', setUploadingAdImg, setAdImageUrl);
                    e.target.value = '';
                  }}
                />
              </label>
              <input required value={adImageUrl} onChange={e => setAdImageUrl(e.target.value)} placeholder="Creative image URL *" className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Placement</label>
                <select value={adPlacement} onChange={e => setAdPlacement(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white">
                  <option value="homepage_mid">Homepage Mid Banner</option>
                  <option value="homepage_bottom">Homepage Bottom Strip</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Priority</label>
                <input type="number" min="1" value={adPriority} onChange={e => setAdPriority(Number(e.target.value))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
              </div>
            </div>
            <input value={adDestUrl} onChange={e => setAdDestUrl(e.target.value)} placeholder="Destination route (e.g. /category/organic-gourmet)" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
              Publish Advertisement
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {loading && ads.length === 0 ? (
              <div className="p-10 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">Loading advertisements...</div>
            ) : ads.length === 0 ? (
              <div className="p-10 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">No advertisements created yet.</div>
            ) : (
              ads.map(ad => (
                <div key={ad.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img src={ad.image_url} alt={ad.title} className="w-20 h-14 rounded-xl object-cover bg-slate-800 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{ad.title}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono">{ad.placement}</span>
                        <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${ad.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                          {ad.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{ad.subtitle}</p>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {ad.destination_url}</span>
                        <span>·</span>
                        <span className="text-amber-400 font-mono">{ad.clicks_count} clicks</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateAdminAdvertisement(ad.db_id, { is_active: !ad.is_active });
                        loadTabData();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                    >
                      {ad.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.deleteAdminAdvertisement(ad.db_id);
                        showToast('Advertisement deleted', 'info');
                        loadTabData();
                      }}
                      className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS LEDGER */}
      {activeTab === 'payments' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
          {loading ? (
            <p className="text-center py-10 text-slate-400">Loading payment transactions...</p>
          ) : paymentsList.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No payment transactions recorded yet.</p>
          ) : (
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-xs">
                  <th className="pb-2">Order</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Gateway Ref</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paymentsList.map(pay => (
                  <tr key={pay.id}>
                    <td className="py-2.5 font-bold text-white">{pay.order_number}</td>
                    <td className="py-2.5 text-slate-300">{pay.customer_name}</td>
                    <td className="py-2.5 font-mono text-indigo-300">{pay.method}</td>
                    <td className="py-2.5 font-mono font-bold text-emerald-400">{formatPrice(pay.amount)}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        pay.status === 'paid' ? 'bg-emerald-950 text-emerald-300' :
                        pay.status === 'refunded' ? 'bg-rose-950 text-rose-300' : 'bg-amber-950 text-amber-300'
                      }`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-400">{pay.gateway_ref_id || '-'}</td>
                    <td className="py-2.5 text-xs text-slate-500">{pay.created_at ? new Date(pay.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* REFUNDS */}
      {activeTab === 'refunds' && (
        <div className="space-y-3">
          {refunds.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No refund requests submitted.</p>
          ) : (
            refunds.map(rf => (
              <div key={rf.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-white">{rf.order_number} · {formatPrice(rf.amount)}</span>
                  <p className="text-xs text-slate-400 mt-0.5">{rf.customer_name} — {rf.reason}</p>
                  <span className="text-xs uppercase font-bold text-amber-400">Status: {rf.status}</span>
                </div>
                {rf.status === 'requested' && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await api.updateAdminRefund(rf.id, 'processed', 'Approved & processed by Admin');
                        showToast('Refund processed', 'success');
                        loadTabData();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Approve & Process
                    </button>
                    <button
                      onClick={async () => {
                        await api.updateAdminRefund(rf.id, 'rejected', 'Rejected after review');
                        showToast('Refund rejected', 'info');
                        loadTabData();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ZONES, RIDERS & USERS */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> Delivery Zones</h3>
            <form
              onSubmit={async e => {
                e.preventDefault();
                await api.createAdminZone({ name: zoneName, slug: zoneSlug });
                setZoneName('');
                setZoneSlug('');
                loadTabData();
              }}
              className="flex gap-2"
            >
              <input required value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Zone Name" className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs" />
              <input required value={zoneSlug} onChange={e => setZoneSlug(e.target.value)} placeholder="slug" className="w-28 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs" />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold cursor-pointer">Add</button>
            </form>
            <div className="space-y-2">
              {zones.map(z => (
                <div key={z.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between text-xs">
                  <span className="font-bold text-white">{z.name} ({z.city})</span>
                  <span className="text-slate-400">Fee Rs. {z.baseDeliveryFee} · ETA {z.estimatedMins}m</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2"><Bike className="w-4 h-4 text-sky-400" /> Fleet Riders & Users</h3>
            {riders.map(r => (
              <div key={r.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white">{r.fullName}</span>
                  <span className="text-slate-400 block">{r.vehicleNumber} · {r.availabilityStatus}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold uppercase">{r.verificationStatus}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-800 space-y-1.5 max-h-56 overflow-y-auto">
              {usersList.map(u => (
                <div key={u.id} className="flex items-center justify-between text-xs text-slate-300 py-1">
                  <span className="truncate">{u.email} ({u.role})</span>
                  <button
                    onClick={async () => {
                      await api.updateAdminUser(u.id, { is_active: !u.is_active });
                      loadTabData();
                    }}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer ${u.is_active ? 'bg-slate-800 text-emerald-400' : 'bg-rose-950 text-rose-300'}`}
                  >
                    {u.is_active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SETTLEMENTS & PAYOUTS */}
      {activeTab === 'settlements' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Vendor Balances & Settlement Payouts</h2>
            <button
              onClick={handleExportSettlementsCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settlementData.vendor_balances.map(vb => (
              <div key={vb.vendor_id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">{vb.vendor_name}</span>
                  <span className="text-xs text-slate-400">
                    Gross {formatPrice(vb.gross_sales)} · Commission ({vb.commission_rate}%) {formatPrice(vb.commission)}
                  </span>
                  <span className="text-sm font-bold text-emerald-400 block mt-1">
                    Unsettled Balance: {formatPrice(vb.net_balance)}
                  </span>
                </div>
                <button
                  disabled={vb.net_balance <= 0}
                  onClick={async () => {
                    await api.generateSettlement(vb.vendor_id);
                    showToast(`Settlement generated for ${vb.vendor_name}`, 'success');
                    loadTabData();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                >
                  Generate Payout
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            {settlementData.settlements.map((s: any) => (
              <div key={s.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-sm">
                <div>
                  <span className="font-bold text-white">{s.vendor_name} · Net {formatPrice(s.netPayout ?? s.net_payout)}</span>
                  <span className="text-xs text-slate-400 block">Status: {s.status} {s.payoutReference ? `· Ref: ${s.payoutReference}` : ''}</span>
                </div>
                {s.status === 'pending' && (
                  <button
                    onClick={async () => {
                      await api.paySettlement(s.id);
                      showToast('Settlement marked PAID & ledger updated', 'success');
                      loadTabData();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={async e => {
              e.preventDefault();
              setSavingSettingKey('delivery_fees');
              try {
                await api.saveAdminSetting('delivery_fees', deliveryFeesCfg, 'Default delivery & handling fees');
                await refreshVendors();
                showToast('Delivery fees updated', 'success');
              } finally {
                setSavingSettingKey(null);
              }
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
          >
            <h3 className="font-bold text-white">Delivery & Handling Fees</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Base Delivery Fee (NPR)</label>
              <input type="number" value={deliveryFeesCfg.baseDeliveryFee} onChange={e => setDeliveryFeesCfg(p => ({ ...p, baseDeliveryFee: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Free Delivery Threshold (NPR)</label>
              <input type="number" value={deliveryFeesCfg.freeDeliveryThreshold} onChange={e => setDeliveryFeesCfg(p => ({ ...p, freeDeliveryThreshold: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Handling Fee (NPR)</label>
              <input type="number" value={deliveryFeesCfg.handlingFee} onChange={e => setDeliveryFeesCfg(p => ({ ...p, handlingFee: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Default ETA (Mins)</label>
              <input type="number" value={deliveryFeesCfg.defaultEtaMins} onChange={e => setDeliveryFeesCfg(p => ({ ...p, defaultEtaMins: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            </div>
            <button type="submit" disabled={savingSettingKey === 'delivery_fees'} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">
              {savingSettingKey === 'delivery_fees' ? 'Saving...' : 'Save Delivery Fees'}
            </button>
          </form>

          <form
            onSubmit={async e => {
              e.preventDefault();
              setSavingSettingKey('commission_policy');
              try {
                await api.saveAdminSetting('commission_policy', commissionCfg, 'Default marketplace commission rules');
                await refreshVendors();
                showToast('Commission policy updated', 'success');
              } finally {
                setSavingSettingKey(null);
              }
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
          >
            <h3 className="font-bold text-white">Commission Policy</h3>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Default Commission Rate (%)</label>
              <input type="number" value={commissionCfg.defaultCommissionRate} onChange={e => setCommissionCfg(p => ({ ...p, defaultCommissionRate: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Zero-Commission Onboarding Days</label>
              <input type="number" value={commissionCfg.newSellerZeroCommissionDays} onChange={e => setCommissionCfg(p => ({ ...p, newSellerZeroCommissionDays: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            </div>
            <button type="submit" disabled={savingSettingKey === 'commission_policy'} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
              {savingSettingKey === 'commission_policy' ? 'Saving...' : 'Save Commission Policy'}
            </button>
          </form>

          <form
            onSubmit={async e => {
              e.preventDefault();
              setSavingSettingKey('store_support');
              try {
                await api.saveAdminSetting('store_support', supportCfg, 'Storefront branding and support contact info');
                await refreshVendors();
                showToast('Store support & branding updated', 'success');
              } finally {
                setSavingSettingKey(null);
              }
            }}
            className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
          >
            <h3 className="font-bold text-white">Brand & Customer Support Info</h3>
            <input value={supportCfg.brandName} onChange={e => setSupportCfg(p => ({ ...p, brandName: e.target.value }))} placeholder="Brand Name" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input value={supportCfg.tagline} onChange={e => setSupportCfg(p => ({ ...p, tagline: e.target.value }))} placeholder="Tagline" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input value={supportCfg.email} onChange={e => setSupportCfg(p => ({ ...p, email: e.target.value }))} placeholder="Support Email" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input value={supportCfg.phone} onChange={e => setSupportCfg(p => ({ ...p, phone: e.target.value }))} placeholder="Support Phone" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input value={supportCfg.address} onChange={e => setSupportCfg(p => ({ ...p, address: e.target.value }))} placeholder="Office Address" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <input value={supportCfg.hours} onChange={e => setSupportCfg(p => ({ ...p, hours: e.target.value }))} placeholder="Support Hours" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white" />
            <button type="submit" disabled={savingSettingKey === 'store_support'} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold cursor-pointer">
              {savingSettingKey === 'store_support' ? 'Saving...' : 'Save Support Settings'}
            </button>
          </form>
        </div>
      )}

      {/* SUPPORT TICKETS */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No support tickets found.</p>
          ) : (
            tickets.map(tkt => (
              <div key={tkt.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-mono text-indigo-400">{tkt.ticketNumber} · {tkt.customer_name}</span>
                    <h3 className="font-bold text-white">{tkt.subject}</h3>
                  </div>
                  <select
                    value={tkt.status}
                    onChange={async e => {
                      await api.updateAdminTicket(tkt.id, e.target.value);
                      loadTabData();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  {tkt.messages?.map((m: any) => (
                    <div key={m.id} className="p-2 rounded-lg bg-slate-950 text-xs text-slate-300">
                      <strong className="text-emerald-400 uppercase mr-1">{m.senderRole}:</strong> {m.message}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ticketReplyDraft[tkt.id] || ''}
                    onChange={e => setTicketReplyDraft(prev => ({ ...prev, [tkt.id]: e.target.value }))}
                    placeholder="Write admin reply..."
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                  <button
                    onClick={async () => {
                      const txt = (ticketReplyDraft[tkt.id] || '').trim();
                      if (!txt) return;
                      await api.replySupportTicket(tkt.id, txt);
                      setTicketReplyDraft(prev => ({ ...prev, [tkt.id]: '' }));
                      loadTabData();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
          {auditLogs.length === 0 ? (
            <p className="text-center py-10 text-slate-400">No audit log records found.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Entity</th>
                  <th className="pb-2">Details</th>
                  <th className="pb-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLogs.map(log => (
                  <tr key={log.id}>
                    <td className="py-2 font-bold text-indigo-300">{log.action}</td>
                    <td className="py-2 text-slate-300">{log.actorRole}</td>
                    <td className="py-2 text-slate-400">{log.entityType} #{log.entityId}</td>
                    <td className="py-2 font-mono text-slate-400 max-w-xs truncate">{JSON.stringify(log.details)}</td>
                    <td className="py-2 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
