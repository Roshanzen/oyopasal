import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Bike,
  ChevronDown,
  ChevronRight,
  Heart,
  Languages,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Package,
  Shield,
  Store,
  Sun,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { TranslatorFn } from '../../../i18n';
import { Language, ThemeMode, UserProfile, Vendor } from '../../../types';

interface UserMenuDropdownProps {
  user: UserProfile;
  currentSeller: Vendor | null;
  wishlistCount: number;
  unreadCount: number;
  theme: ThemeMode;
  language: Language;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onOpenBecomeSeller: () => void;
  onLogout: () => void;
  t: TranslatorFn;
}

export default function UserMenuDropdown({
  user,
  currentSeller,
  wishlistCount,
  unreadCount,
  theme,
  language,
  isOpen,
  onToggle,
  onClose,
  onToggleTheme,
  onToggleLanguage,
  onOpenBecomeSeller,
  onLogout,
  t,
}: UserMenuDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        onClick={onToggle}
        aria-label="Account menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 pl-1.5 pr-2 sm:pr-3 py-1 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-800 dark:text-slate-100 transition-colors cursor-pointer min-h-[40px] lg:min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <div className="w-8 h-8 rounded-full bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
          {user.full_name.charAt(0)}
        </div>
        <span className="hidden sm:inline md:hidden lg:inline text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
          {user.full_name.split(' ')[0]}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0" />
      </motion.button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2.5 w-72 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 py-2 z-50"
        >
          <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{user.full_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.phone || user.email}</p>
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-500" />
                )}
                <span>{theme === 'dark' ? t('header.lightTheme') : t('header.darkTheme')}</span>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono uppercase">
                {theme}
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleLanguage}
              className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-medium cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Languages className="w-4 h-4 text-emerald-500" />
                <span>{t('header.languageLabel')}</span>
              </div>
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                {language === 'en' ? 'English' : 'नेपाली'}
              </span>
            </button>
            <Link
              to="/account?tab=orders"
              onClick={onClose}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <Package className="w-4 h-4 text-slate-400" />
              <span>{t('header.myOrdersTracking')}</span>
            </Link>
            <Link
              to="/account?tab=addresses"
              onClick={onClose}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>{t('header.deliveryAddresses')}</span>
            </Link>
            <Link
              to="/account?tab=wishlist"
              onClick={onClose}
              className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <span className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-slate-400" />
                <span>{t('header.savedWishlist')}</span>
              </span>
              {wishlistCount > 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              to="/account?tab=notifications"
              onClick={onClose}
              className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <span className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-slate-400" />
                <span>{t('header.notifications')}</span>
              </span>
              {unreadCount > 0 && (
                <span className="text-xs font-bold bg-amber-400/20 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full tabular-nums">
                  {t('header.newCount', { count: unreadCount })}
                </span>
              )}
            </Link>
            <Link
              to="/account?tab=profile"
              onClick={onClose}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>{t('header.accountSettings')}</span>
            </Link>

            <div className="border-t border-slate-100 dark:border-slate-800 mt-1.5 pt-2 px-2">
              <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 block mb-1">
                {t('header.sellerMerchantAccess')}
              </span>

              {currentSeller ? (
                <Link
                  to="/seller"
                  onClick={onClose}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-left mb-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Store className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <span className="block truncate font-bold text-slate-900 dark:text-white">
                        {currentSeller.name}
                      </span>
                      <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                        {t('header.storeDashboardAdd')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </Link>
              ) : (
                <Link
                  to="/seller"
                  onClick={onClose}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <LogIn className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="block font-bold text-slate-900 dark:text-white group-hover:text-emerald-900 dark:group-hover:text-emerald-300">
                        {t('header.loginAsSeller')}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block font-normal">
                        {t('header.manageOrdersAdd')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBecomeSeller();
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg font-semibold transition-colors text-left mt-0.5 cursor-pointer"
              >
                <Store className="w-4 h-4" />
                <span>{t('header.becomeSellerNew')}</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                <Link
                  to="/admin"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Admin</span>
                </Link>
                <Link
                  to="/rider"
                  onClick={onClose}
                  className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  <Bike className="w-3.5 h-3.5 text-amber-500" />
                  <span>Rider</span>
                </Link>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 mt-1.5 pt-1.5 px-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('header.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
