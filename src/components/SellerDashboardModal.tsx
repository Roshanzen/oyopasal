import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  X,
  Store,
  Package,
  TrendingUp,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  Truck,
  Power,
  RotateCcw,
  Sparkles,
  LogOut,
  ChevronRight,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SellerDashboardModal() {
  const navigate = useNavigate();
  const {
    sellerDashboardModalOpen,
    setSellerDashboardModalOpen,
    currentSeller,
    logoutSeller,
    showToast
  } = useApp();

  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [storeOnline, setStoreOnline] = useState(true);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  useEffect(() => {
    if (sellerDashboardModalOpen && currentSeller) {
      async function loadData() {
        try {
          setLoading(true);
          const data = await api.getSellerDashboard(currentSeller.id);
          setDashboardData(data);
          setPendingOrders(data.pending_orders || []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }
  }, [sellerDashboardModalOpen, currentSeller]);

  if (!sellerDashboardModalOpen || !currentSeller) return null;

  const handleMarkPacked = (orderNum: string) => {
    setPendingOrders(prev => prev.filter(o => o.order_number !== orderNum));
    showToast(`Order ${orderNum} marked as packed! Nearest EV courier alerted for pickup.`, 'success');
  };

  const handleToggleStoreStatus = () => {
    setStoreOnline(!storeOnline);
    showToast(
      !storeOnline
        ? 'Store is now ONLINE. Receiving customer orders!'
        : 'Store is now PAUSED for new orders.',
      !storeOnline ? 'success' : 'info'
    );
  };

  return (
    <AnimatePresence>
      {sellerDashboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSellerDashboardModalOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full max-w-3xl bg-white dark:bg-[#111726] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 z-10 my-8 max-h-[90vh] overflow-y-auto"
          >
        
        {/* Close Button */}
        <button
          onClick={() => setSellerDashboardModalOpen(false)}
          aria-label="Close dashboard"
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-xs">
              <Store className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Merchant Partner Hub
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
            {/* Online Status Toggle */}
            <button
              onClick={handleToggleStoreStatus}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold transition-all border cursor-pointer ${
                storeOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${storeOnline ? 'bg-emerald-600' : 'bg-rose-600'}`} />
              <span>{storeOnline ? 'Open for Orders' : 'Store Paused'}</span>
            </button>

            <button
              onClick={logoutSeller}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Sign out of seller account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-time KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Today's Gross Sales
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              Rs. {dashboardData?.stats?.today_revenue || '16,850'}
            </div>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18% vs yesterday</span>
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Dispatched Orders
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {dashboardData?.stats?.today_orders || 42}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
              100% on-time fulfilment
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Avg. Pack Time
            </span>
            <div className="text-xl font-extrabold text-emerald-800 dark:text-emerald-400 tabular-nums">
              {dashboardData?.stats?.avg_packing_time || '4.2 mins'}
            </div>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-1 block">
              ⚡ Superfast rating
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
              Customer Score
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>{currentSeller.rating || 4.9}</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 block">
              Verified local hub
            </span>
          </div>
        </div>

        {/* Live Orders to Pack Queue */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Live Orders Waiting for Packaging ({pendingOrders.length})
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              Courier arrives in ~2-4 mins
            </span>
          </div>

          {pendingOrders.length > 0 ? (
            <div className="space-y-3">
              {pendingOrders.map((ord, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {ord.order_number}
                      </span>
                      <span className="text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded">
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {ord.created_at} · {ord.customer_area}
                      </span>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                      Items: <strong>{ord.items.join(', ')}</strong>
                    </div>

                    <p className="text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1 font-semibold">
                      <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{ord.rider}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleMarkPacked(ord.order_number)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-2.5" />
                    <span>Handed to Rider</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
              <span>All current customer orders have been packed and handed to riders!</span>
            </div>
          )}
        </div>

        {/* Quick Inventory Stock Overview */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Store Catalog ({dashboardData?.products?.length || 0} Listed Items)
            </h3>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
              Automatic sync with customer catalog
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
                      Rs. {item.discounted_price}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                      In Stock ({item.stock})
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Loading catalog items...</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSellerDashboardModalOpen(false);
                navigate('/seller');
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Open Visual Summary & Sales Charts</span>
            </button>
            <button
              onClick={() => setSellerDashboardModalOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
            >
              Customer View
            </button>
          </div>

          <button
            onClick={logoutSeller}
            className="text-sm font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-3 py-1.5 cursor-pointer self-start sm:self-auto"
          >
            Sign Out of Store
          </button>
        </div>

      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
}
