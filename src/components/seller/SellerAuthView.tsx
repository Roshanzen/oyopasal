import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, Store, KeyRound, Sparkles } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { Language } from '../../types';

interface SellerAuthViewProps {
  loginLoading: boolean;
  customStoreId: string;
  customPassword: string;
  customLoginError?: string | null;
  language: Language;
  t: TranslatorFn;
  onCustomLogin: (e: React.FormEvent) => void;
  onChangeStoreId: (val: string) => void;
  onChangePassword: (val: string) => void;
  onOpenBecomeSeller: () => void;
}

export default function SellerAuthView({
  loginLoading,
  customStoreId,
  customPassword,
  customLoginError,
  language,
  t,
  onCustomLogin,
  onChangeStoreId,
  onChangePassword,
  onOpenBecomeSeller,
}: SellerAuthViewProps) {
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-10 transition-colors flex flex-col justify-center items-center">
      <div className="w-full max-w-xl mx-auto">
        {/* Top Navigation */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('seller.backCustomer')}</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('slogin.hub')}</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-900/30">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {t('seller.portalTitle')}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm max-w-md mx-auto">
            {t('seller.portalSub')}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('seller.accountLogin')}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Enter your authorized merchant credentials to access your store inventory, orders, and sales analytics.
          </p>

          {/* Error Banner */}
          {customLoginError && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{customLoginError}</p>
              </div>
              <button
                type="button"
                onClick={onOpenBecomeSeller}
                className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Apply to Become a Partner Store</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Forgot Notice */}
          {showForgotNotice && (
            <div className="mb-6 p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200 text-xs flex items-start justify-between gap-2">
              <p>
                To reset your merchant password, please contact OyoPasal Merchant Support at{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">sellers@oyopasal.com</span> or call{' '}
                <span className="font-semibold">+977 01-5970000</span>.
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

          <form onSubmit={onCustomLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                {t('seller.storeIdLabel')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customStoreId}
                  onChange={(e) => onChangeStoreId(e.target.value)}
                  placeholder={
                    language === 'ne'
                      ? 'जस्तै: vendor@store.com वा +977 9801112201'
                      : 'e.g. vendor@store.com or +977 9801112201'
                  }
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
                  {t('seller.passwordLabel')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotNotice(true)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={customPassword}
                  onChange={(e) => onChangePassword(e.target.value)}
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
              disabled={loginLoading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t('seller.enterDashboard')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Become a Seller Link */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('seller.wantToSell')}
            </p>
            <button
              type="button"
              onClick={onOpenBecomeSeller}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('seller.applyPartner')}</span>
            </button>
          </div>
        </div>

        {/* Security Footer */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Protected by OyoPasal Multi-Factor Authentication & RSA-256 JWT Encryption.
        </p>
      </div>
    </div>
  );
}
