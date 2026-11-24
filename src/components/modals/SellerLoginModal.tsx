import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context';
import {
  X,
  Store,
  KeyRound,
  ArrowRight,
  Mail,
  Lock,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function SellerLoginModal() {
  const navigate = useNavigate();
  const {
    sellerLoginModalOpen,
    setSellerLoginModalOpen,
    setBecomeSellerModalOpen,
    loginAsSeller,
    showToast,
    t
  } = useApp();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  const handleClose = () => {
    setSellerLoginModalOpen(false);
    setLoginError(null);
    setShowForgotNotice(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      showToast('Please enter both store email/phone and password', 'error');
      return;
    }

    setLoading(true);
    setLoginError(null);
    try {
      await loginAsSeller({ identifier: identifier.trim(), password });
      handleClose();
      navigate('/seller');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setLoginError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBecomeSeller = () => {
    handleClose();
    setBecomeSellerModalOpen(true);
  };

  return (
    <AnimatePresence>
      {sellerLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
          {/* Backdrop with Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md bg-white dark:bg-[#0F172A] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 my-8"
          >
            {/* Header */}
            <div className="relative p-6 pb-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {t('slogin.title')}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Merchant Portal & Inventory Access
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {loginError && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="font-semibold leading-relaxed">{loginError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenBecomeSeller}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Apply to Become a Partner Store</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {showForgotNotice && (
                <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200 text-xs flex items-start justify-between gap-2">
                  <p>
                    Please contact OyoPasal Merchant Support at{' '}
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">sellers@oyopasal.com</span> to reset your merchant credentials.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotNotice(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('slogin.idLabel')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="e.g. store@oyopasal.np or +977 9801112201"
                      required
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {t('slogin.passLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotNotice(true)}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{t('slogin.signIn')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Apply CTA */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  Want to sell on OyoPasal?
                </p>
                <button
                  type="button"
                  onClick={handleOpenBecomeSeller}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Apply to Become a Partner Store</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
