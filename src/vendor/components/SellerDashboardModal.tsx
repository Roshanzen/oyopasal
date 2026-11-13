import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { translateOrderStatus } from '../../shared/i18n/translations';
import { SellerFulfillmentItem } from '../../shared/types';
import {
  X,
  Store,
  Package,
  TrendingUp,
  Star,
  CheckCircle2,
  Truck,
  LogOut,
  BarChart3,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SellerDashboardModal() {
  const navigate = useNavigate();
  const {
    sellerDashboardModalOpen,
    setSellerDashboardModalOpen,
    currentSeller,
    logoutSeller,
    showToast,
    t,
    formatPrice,
    language
  } = useApp();

  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [allOrders, setAllOrders] = useState<SellerFulfillmentItem[]>([]);
  const [orderTab, setOrderTab] = useState<'active' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeOnline, setStoreOnline] = useState(true);
  const [packingId, setPackingId] = useState<number | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!currentSeller) return;
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [data, ordersRes] = await Promise.all([
        api.getSellerDashboard(currentSeller.id),
        api.getSellerOrders(currentSeller.id)
      ]);
      setDashboardData(data);
      if (data?.vendor && typeof data.vendor.is_online === 'boolean') {
        setStoreOnline(data.vendor.is_online);
      }
      setAllOrders(ordersRes.results || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load store orders';
      setError(msg);
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentSeller]);

  useEffect(() => {
    if (!sellerDashboardModalOpen || !currentSeller) return;
    loadData();
    const interval = window.setInterval(() => {
      loadData(true);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [sellerDashboardModalOpen, currentSeller, loadData]);

  if (!sellerDashboardModalOpen || !currentSeller) return null;

  const activeOrders = allOrders.filter((o) =>
    ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(o.status)
  );
  const displayedOrders = orderTab === 'active' ? activeOrders : allOrders;

  const handleMarkPacked = async (fulfillment: SellerFulfillmentItem) => {
    setPackingId(fulfillment.fulfillment_id);
    try {
      await api.updateSellerFulfillmentStatus(fulfillment.fulfillment_id, 'PACKED_BY_VENDOR', currentSeller.id);
      setAllOrders(prev =>
        prev.map(o => (o.fulfillment_id === fulfillment.fulfillment_id ? { ...o, status: 'PACKED_BY_VENDOR' } : o))
      );
      showToast(
        language === 'ne'
          ? `अर्डर ${fulfillment.order_number} प्याक गरिएको चिन्ह लगाइयो!`
          : `Order ${fulfillment.order_number} marked as packed!`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not update fulfillment status', 'error');
    } finally {
      setPackingId(null);
    }
  };

  const handleToggleStoreStatus = async () => {
    const nextOnline = !storeOnline;
    try {
      await api.updateSellerStore({ is_online: nextOnline }, currentSeller.id);
      setStoreOnline(nextOnline);
      showToast(
        nextOnline
          ? 'Store is now ONLINE. Receiving customer orders!'
          : 'Store is now PAUSED for new orders.',
        nextOnline ? 'success' : 'info'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update store status', 'error');
    }
  };

  return (
    <AnimatePresence>
      {sellerDashboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSellerDashboardModalOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full max-w-3xl bg-white dark:bg-[#111726] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 z-10 my-8 max-h-[90vh] overflow-y-auto"
          >
            <button
              onClick={() => setSellerDashboardModalOpen(false)}
              aria-label="Close dashboard"
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                  <Store className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      {t('sdash.hub')}
                    </span>
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                      {currentSeller.id}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display">
                    {currentSeller.name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleStoreStatus}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all border cursor-pointer ${
                    storeOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${storeOnline ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                  <span>{storeOnline ? t('sdash.openOrders') : t('sdash.paused')}</span>
                </button>

                <button
                  onClick={logoutSeller}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  title={t('sdash.signOut')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  {t('sdash.grossSales')}
                </span>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatPrice(dashboardData?.stats?.total_revenue ?? 0)}
                </div>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5 mt-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Net {formatPrice(dashboardData?.stats?.net_earnings ?? 0)}</span>
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  {t('sdash.dispatched')}
                </span>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {dashboardData?.stats?.total_orders ?? 0}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                  {dashboardData?.stats?.pending_orders ?? 0} pending
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  {language === 'ne' ? 'स्टक स्थिति' : 'Catalog Stock'}
                </span>
                <div className="text-xl font-extrabold text-emerald-800 dark:text-emerald-400 tabular-nums">
                  {dashboardData?.stats?.in_stock_count ?? 0} / {dashboardData?.stats?.total_products ?? 0}
                </div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1 block">
                  {dashboardData?.stats?.low_stock_count ?? 0} low stock
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  {t('sdash.score')}
                </span>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>{currentSeller.rating || 4.9}</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
                  {(dashboardData?.approval_status || 'approved').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    {t('sdash.liveOrders', { count: activeOrders.length })}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setOrderTab('all')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        orderTab === 'all'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      All ({allOrders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderTab('active')}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        orderTab === 'active'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      Pending ({activeOrders.length})
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadData()}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 cursor-pointer"
                    title="Refresh Orders"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {error ? (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-200 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadData()}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : loading && allOrders.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">{t('common.loading')}</div>
              ) : displayedOrders.length > 0 ? (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {displayedOrders.map((ord) => (
                    <div
                      key={ord.fulfillment_id}
                      className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {ord.order_number}
                          </span>
                          <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded">
                            {translateOrderStatus(ord.status, language)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {ord.customer_name} · {ord.customer_area}
                          </span>
                        </div>

                        <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                          <strong>{ord.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}</strong>
                        </div>

                        <p className="text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1 font-semibold">
                          <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{formatPrice(ord.subtotal)} ({ord.payment_method.replace(/_/g, ' ')})</span>
                        </p>
                      </div>

                      {['ORDER_PLACED', 'CONFIRMED_BY_VENDOR'].includes(ord.status) && (
                        <button
                          disabled={packingId === ord.fulfillment_id}
                          onClick={() => handleMarkPacked(ord)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 stroke-2.5" />
                          <span>{t('sdash.handedRider')}</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                  <span>{t('sdash.allPacked')}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {t('sdash.catalogCount', { count: dashboardData?.products?.length || 0 })}
                </h3>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                  {t('sdash.autoSync')}
                </span>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {dashboardData?.products && dashboardData.products.length > 0 ? (
                  dashboardData.products.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm bg-white dark:bg-[#0f1422]"
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-xs sm:max-w-md">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                        />
                        <div className="truncate">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{item.unit}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {formatPrice(item.discounted_price)}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded ${
                          item.stock <= (item.low_stock_threshold ?? 5) || !item.in_stock
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                        }`}>
                          {item.in_stock ? `${t('common.inStock')} (${item.stock})` : t('common.outOfStock')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 dark:text-slate-500 py-2">{t('common.loading')}</p>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setSellerDashboardModalOpen(false);
                    navigate('/seller');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>{t('sdash.openCharts')}</span>
                </button>
                <button
                  onClick={() => setSellerDashboardModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
                >
                  {t('sdash.customerView')}
                </button>
              </div>

              <button
                onClick={logoutSeller}
                className="text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3 py-1.5 cursor-pointer self-start sm:self-auto"
              >
                {t('sdash.signOut')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
