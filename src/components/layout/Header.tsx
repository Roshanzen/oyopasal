import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Clock,
  Heart,
  Languages,
  LogIn,
  MapPin,
  Moon,
  ShoppingBag,
  Sun,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../context';
import { notificationService } from '../../services';
import { NotificationItem } from '../../types';
import AnnouncementBar from './header/AnnouncementBar';
import HeaderSearchBar from './header/HeaderSearchBar';
import NotificationsDropdown from './header/NotificationsDropdown';
import UserMenuDropdown from './header/UserMenuDropdown';

export default function Header() {
  const {
    cart,
    cartLoading,
    setCartDrawerOpen,
    currentAddress,
    setLocationModalOpen,
    setBecomeSellerModalOpen,
    currentSeller,
    user,
    setLoginModalOpen,
    logoutCustomer,
    wishlistIds,
    theme,
    toggleTheme,
    language,
    toggleLanguage,
    t,
    formatPrice,
  } = useApp();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    setNotifError('');
    try {
      const res = await notificationService.getNotifications();
      if (Array.isArray(res.results)) {
        setNotifications(res.results);
      }
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Unable to load notifications');
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [user?.id, loadNotifications]);

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    try {
      await notificationService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Could not update notification');
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Could not mark notifications as read');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const totalItems = cart ? cart.item_count : 0;
  const cartTotal = cart ? cart.total : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0b101b]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 shadow-sm transition-colors duration-200">
      <AnnouncementBar
        currentSeller={currentSeller}
        onOpenBecomeSeller={() => setBecomeSellerModalOpen(true)}
        t={t}
      />

      <div className="w-full px-3 sm:px-6 lg:px-10">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-x-2 sm:gap-x-3 lg:gap-x-4 gap-y-2.5 py-2.5 md:py-0 md:h-20">
          {/* A. OyoPasal Logo */}
          <Link
            to="/"
            className="order-1 flex items-center gap-2 sm:gap-2.5 group shrink-0 pr-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/20 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span className="font-extrabold text-lg sm:text-2xl font-display tracking-tight leading-none">O</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-lg sm:text-2xl tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap">
                Oyo<span className="text-emerald-600 dark:text-emerald-400">Pasal</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-0.5 sm:mt-1 whitespace-nowrap">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="hidden xs:inline sm:inline">{t('brand.tagline')}</span>
              </span>
            </div>
          </Link>

          {/* B. Delivery Location Selector */}
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            aria-label={t('header.selectLocation')}
            title={t('header.selectLocation')}
            className="order-3 md:order-2 w-full md:w-auto md:max-w-[180px] lg:max-w-[225px] xl:max-w-[260px] flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 dark:bg-[#141b2b] dark:hover:bg-[#1a2236] border border-slate-200/80 dark:border-slate-700/80 text-left transition-colors shrink-0 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-tight whitespace-nowrap">
                {t('header.deliveringTo')}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight mt-0.5">
                {currentAddress ? `${currentAddress.title} – ${currentAddress.area}` : t('header.selectLocation')}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0 ml-1" />
          </button>

          {/* C. Search Bar */}
          <HeaderSearchBar language={language} formatPrice={formatPrice} t={t} />

          {/* D, E, F. Right Cluster */}
          <div className="order-2 md:order-4 ml-auto md:ml-0 flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0 select-none">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={toggleLanguage}
              aria-label={language === 'en' ? 'Switch to Nepali' : 'अंग्रेजीमा बदल्नुहोस्'}
              title={language === 'en' ? 'नेपाली भाषामा हेर्नुहोस्' : 'Switch to English'}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 h-10 lg:h-11 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Languages className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="flex items-center gap-1 text-xs font-extrabold tracking-tight">
                <span className={language === 'en' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                  EN
                </span>
                <span className="text-slate-300 dark:text-slate-700">/</span>
                <span className={language === 'ne' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                  ने
                </span>
              </span>
            </motion.button>

            <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
                title={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
                className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </motion.button>

              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.92 }} className="hidden xl:block">
                <Link
                  to="/account?tab=wishlist"
                  aria-label={t('header.wishlist')}
                  title={t('header.wishlist')}
                  className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Heart className="w-5 h-5" />
                  {wishlistIds.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[12px] font-bold leading-none flex items-center justify-center border-2 border-white dark:border-[#0b101b] tabular-nums">
                      {wishlistIds.length}
                    </span>
                  )}
                </Link>
              </motion.div>

              <NotificationsDropdown
                isOpen={notifMenuOpen}
                onToggle={() => {
                  setNotifMenuOpen((prev) => !prev);
                  setUserMenuOpen(false);
                }}
                onClose={() => setNotifMenuOpen(false)}
                notifications={notifications}
                unreadCount={unreadCount}
                loading={notifLoading}
                error={notifError}
                onRetry={loadNotifications}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                t={t}
              />
            </div>

            {!user ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLoginModalOpen(true)}
                aria-label={t('header.login')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 h-10 lg:h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>{t('header.login')}</span>
              </motion.button>
            ) : (
              <UserMenuDropdown
                user={user}
                currentSeller={currentSeller}
                wishlistCount={wishlistIds.length}
                unreadCount={unreadCount}
                theme={theme}
                language={language}
                isOpen={userMenuOpen}
                onToggle={() => {
                  setUserMenuOpen((prev) => !prev);
                  setNotifMenuOpen(false);
                }}
                onClose={() => setUserMenuOpen(false)}
                onToggleTheme={toggleTheme}
                onToggleLanguage={toggleLanguage}
                onOpenBecomeSeller={() => setBecomeSellerModalOpen(true)}
                onLogout={logoutCustomer}
                t={t}
              />
            )}

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setCartDrawerOpen(true)}
              aria-label={`Shopping cart with ${totalItems} items, total ${formatPrice(cartTotal)}`}
              className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-4 py-2 rounded-[14px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950/20 transition-colors cursor-pointer min-h-[40px] lg:min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <div className="relative shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span
                      key={totalItems}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 font-extrabold text-[12px] min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center border-2 border-emerald-600 tabular-nums leading-none"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex flex-col text-left leading-tight">
                <span className="hidden sm:block text-[12px] font-medium text-emerald-100 whitespace-nowrap">
                  {totalItems === 0
                    ? t('header.myBasket')
                    : `${totalItems} ${totalItems === 1 ? t('common.item') : t('common.items')}`}
                </span>
                <span className="text-xs sm:text-sm font-bold whitespace-nowrap tabular-nums">
                  {cartLoading && !cart ? '...' : formatPrice(cartTotal)}
                </span>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
