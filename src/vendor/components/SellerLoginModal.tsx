import React, { useState, useEffect } from 'react';
import { useApp } from '../../shared/context/AppContext';
import {
  X,
  Store,
  KeyRound,
  ArrowRight,
  Phone,
  Building,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SellerLoginModal() {
  const {
    sellerLoginModalOpen,
    setSellerLoginModalOpen,
    setBecomeSellerModalOpen,
    loginAsSeller,
    vendors,
    refreshVendors,
    showToast,
    t
  } = useApp();

  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorsError, setVendorsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'custom'>('quick');

  useEffect(() => {
    if (!sellerLoginModalOpen) return;
    if (vendors.length > 0) {
      if (!selectedVendorId || !vendors.some((v) => v.id === selectedVendorId)) {
        setSelectedVendorId(vendors[0].id);
      }
      return;
    }
    let active = true;
    setVendorsLoading(true);
    setVendorsError(null);
    refreshVendors()
      .catch((err) => {
        if (active) setVendorsError(err instanceof Error ? err.message : 'Failed to load stores');
      })
      .finally(() => {
        if (active) setVendorsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sellerLoginModalOpen, vendors, selectedVendorId, refreshVendors]);

  const handleRetryVendors = async () => {
    setVendorsLoading(true);
    setVendorsError(null);
    try {
      await refreshVendors();
    } catch (err) {
      setVendorsError(err instanceof Error ? err.message : 'Failed to load stores');
    } finally {
      setVendorsLoading(false);
    }
  };

  const handleClose = () => {
    setSellerLoginModalOpen(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === 'quick') {
        if (!selectedVendorId) {
          showToast('Please select a store to continue', 'error');
          setLoading(false);
          return;
        }
        await loginAsSeller({ vendor_id: selectedVendorId, demo_quick_login: true });
      } else {
        if (!identifier.trim() || !password.trim()) {
          showToast('Please enter both store email/phone and password', 'error');
          setLoading(false);
          return;
        }
        await loginAsSeller({ identifier: identifier.trim(), password });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBecomeSeller = () => {
    setSellerLoginModalOpen(false);
    setBecomeSellerModalOpen(true);
  };

  return (
    <AnimatePresence>
      {sellerLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full max-w-md bg-white dark:bg-[#111726] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 z-10 my-8"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              aria-label="Close dialog"
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                <Store className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  {t('slogin.hub')}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-display">
                  {t('slogin.title')}
                </h2>
              </div>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {t('slogin.subtitle')}
            </p>

            {/* Tab switch */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-4 text-sm font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('quick')}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'quick'
                    ? 'bg-white dark:bg-[#0f1422] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('slogin.tabQuick')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'custom'
                    ? 'bg-white dark:bg-[#0f1422] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('slogin.tabCustom')}
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {activeTab === 'quick' ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                    {t('slogin.selectStore')}
                  </label>
                  {vendorsLoading ? (
                    <div className="py-8 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                      <span>Loading registered stores...</span>
                    </div>
                  ) : vendorsError ? (
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {vendorsError}
                      </span>
                      <button
                        type="button"
                        onClick={handleRetryVendors}
                        className="font-bold underline cursor-pointer shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  ) : vendors.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                      No approved vendor stores found in database yet. Use Store Credentials or apply as a new partner.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {vendors.map((v) => {
                        const isSelected = selectedVendorId === v.id;
                        const categoryLabel =
                          v.tags && v.tags.length > 0
                            ? v.tags.slice(0, 2).join(', ')
                            : 'Verified Store';
                        const areaLabel = v.area || v.location || v.city || 'Kathmandu Valley';
                        return (
                          <div
                            key={v.id}
                            onClick={() => setSelectedVendorId(v.id)}
                            className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-500 shadow-2xs'
                                : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                <Building className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{v.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {categoryLabel} · {areaLabel}
                                </p>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-3" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('slogin.mobileEmail')}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. +977 9841234567 or store@vendor.com"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {t('slogin.pinPassword')}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || (activeTab === 'quick' && !selectedVendorId)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>{loading ? t('slogin.authenticating') : t('slogin.submit')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{t('slogin.noAccount')}</span>
                <button
                  type="button"
                  onClick={handleOpenBecomeSeller}
                  className="font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  {t('header.becomeSeller')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
