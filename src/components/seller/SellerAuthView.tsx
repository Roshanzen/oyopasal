import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronRight, RefreshCw, ShieldCheck, Sparkles, Store } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { Language, Vendor } from '../../types';

interface SellerAuthViewProps {
  vendors: Vendor[];
  vendorsRefreshing: boolean;
  loginLoading: boolean;
  customStoreId: string;
  customPassword: string;
  language: Language;
  t: TranslatorFn;
  onRefreshVendors: () => void;
  onQuickLogin: (vendorId: string) => void;
  onCustomLogin: (e: React.FormEvent) => void;
  onChangeStoreId: (val: string) => void;
  onChangePassword: (val: string) => void;
  onOpenBecomeSeller: () => void;
}

export default function SellerAuthView({
  vendors,
  vendorsRefreshing,
  loginLoading,
  customStoreId,
  customPassword,
  language,
  t,
  onRefreshVendors,
  onQuickLogin,
  onCustomLogin,
  onChangeStoreId,
  onChangePassword,
  onOpenBecomeSeller,
}: SellerAuthViewProps) {
  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 py-8 px-4 sm:px-6 lg:px-10">
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-base text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('seller.backCustomer')}</span>
          </Link>
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/60">
            <ShieldCheck className="w-4 h-4" />
            <span>{t('slogin.hub')}</span>
          </div>
        </div>

        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-900/30">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{t('seller.portalTitle')}</h1>
          <p className="mt-2 text-slate-400 max-w-lg mx-auto text-base">{t('seller.portalSub')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-slate-800/90 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>{t('seller.quickLogin')}</span>
              </h2>
              <button
                type="button"
                onClick={onRefreshVendors}
                className="text-xs font-bold text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${vendorsRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('seller.demoAccounts')}</span>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">{t('seller.quickLoginSub')}</p>

            {vendors.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl">
                {vendorsRefreshing ? 'Loading stores from PostgreSQL...' : 'No verified vendor stores returned yet.'}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {vendors.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onQuickLogin(v.id)}
                    disabled={loginLoading}
                    className="w-full text-left p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-emerald-500/60 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-white group-hover:text-emerald-400 transition-colors truncate">
                          {v.name}
                        </span>
                        <span className="text-xs bg-emerald-900/60 text-emerald-300 font-mono px-1.5 py-0.5 rounded shrink-0">
                          ★ {v.rating}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5 truncate">
                        {v.tags && v.tags.length > 0 ? v.tags.join(', ') : v.description || 'Verified Store'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        {v.area || v.location || v.city || 'Kathmandu Valley'}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-800/90 rounded-2xl p-6 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">{t('seller.accountLogin')}</h2>
            <p className="text-sm text-slate-400 mb-5">{t('seller.accountLoginSub')}</p>

            <form onSubmit={onCustomLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">{t('seller.storeIdLabel')}</label>
                <input
                  type="text"
                  value={customStoreId}
                  onChange={(e) => onChangeStoreId(e.target.value)}
                  placeholder={
                    language === 'ne'
                      ? 'जस्तै: seller.himalayan@oyopasal.np वा +977 9801112201'
                      : 'e.g. seller.himalayan@oyopasal.np or +977 9801112201'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">{t('seller.passwordLabel')}</label>
                <input
                  type="password"
                  value={customPassword}
                  onChange={(e) => onChangePassword(e.target.value)}
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
                    <span>{t('seller.enterDashboard')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-700/80 text-center">
              <p className="text-sm text-slate-400 mb-2">{t('seller.wantToSell')}</p>
              <button
                type="button"
                onClick={onOpenBecomeSeller}
                className="text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                {t('seller.applyPartner')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
