import React from 'react';
import { Database, Languages, Moon, Sun } from 'lucide-react';
import { TranslatorFn } from '../../i18n';
import { DbStatusResponse, Language, ThemeMode, UserProfile } from '../../types';

interface ProfileTabProps {
  user: UserProfile | null;
  fullName: string;
  email: string;
  phone: string;
  savingProfile: boolean;
  syncingGoogle: boolean;
  dbStatus: DbStatusResponse | null;
  theme: ThemeMode;
  language: Language;
  t: TranslatorFn;
  onOpenLogin: () => void;
  onChangeFullName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  onToggleTheme: () => void;
  onChangeLanguage: (lang: Language) => void;
}

export default function ProfileTab({
  user,
  fullName,
  email,
  phone,
  savingProfile,
  syncingGoogle,
  dbStatus,
  theme,
  language,
  t,
  onOpenLogin,
  onChangeFullName,
  onChangePhone,
  onSaveProfile,
  onGoogleSignIn,
  onToggleTheme,
  onChangeLanguage,
}: ProfileTabProps) {
  return (
    <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-6">
      {!user && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">{t('account.guestBannerTitle')}</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">{t('account.guestBannerSub')}</p>
          </div>
          <button
            type="button"
            onClick={onOpenLogin}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            {t('header.signIn')}
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-extrabold text-xl flex items-center justify-center font-display">
          {(fullName || 'G').charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
            {user ? fullName : t('header.guestUser')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user?.role ? `Role: ${user.role.toUpperCase()}` : t('account.memberSince')}
          </p>
        </div>
      </div>

      <form onSubmit={onSaveProfile} className="space-y-4 max-w-2xl">
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.fullName')}</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => onChangeFullName(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.emailAddress')}</label>
          <input
            type="email"
            value={email}
            disabled
            className="w-full px-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">{t('account.phoneNumber')}</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
          >
            {savingProfile ? t('account.saving') : t('account.saveProfile')}
          </button>
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={syncingGoogle}
            className="px-5 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            <span>{syncingGoogle ? t('account.signingIn') : t('account.googleSignIn')}</span>
          </button>
        </div>
      </form>

      <div className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3 max-w-2xl">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
          {language === 'ne' ? 'एप सेटिङहरू (थिम र भाषा)' : 'App Settings (Appearance & Language)'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  {theme === 'dark' ? t('header.darkTheme') : t('header.lightTheme')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white block">
                  {t('header.languageLabel')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {language === 'en' ? 'English' : 'नेपाली'}
                </span>
              </div>
            </div>
            <div className="inline-flex rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => language !== 'en' && onChangeLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  language === 'en'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => language !== 'ne' && onChangeLanguage('ne')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  language === 'ne'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                नेपाली
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">{t('account.dbTitle')}</span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('account.dbSub')}</p>
          </div>
        </div>
        {dbStatus?.counts && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <strong>{dbStatus.counts.products}</strong> Products
            </span>
            <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <strong>{dbStatus.counts.vendors}</strong> Vendors
            </span>
            <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <strong>{dbStatus.counts.orders}</strong> Orders
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
