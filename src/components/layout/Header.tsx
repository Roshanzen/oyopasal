import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Heart,
  MapPin,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useApp } from '../../context';
import { notificationService } from '../../services';
import { messagingService } from '../../services/messagingService';
import { NotificationItem } from '../../types';
import HeaderSearchBar from './header/HeaderSearchBar';
import UserMenuDropdown from './header/UserMenuDropdown';
import BrandLogo from '../common/BrandLogo';

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    setNotifLoading(true);
    setNotifError('');
    try {
      const res = await notificationService.getNotifications();
      const list = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? (res as any) : []);
      setNotifications(list);
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Unable to load notifications');
    } finally {
      setNotifLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [user?.id, loadNotifications]);

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    try {
      await notificationService.markNotificationRead(id);
      setNotifications((prev) => (Array.isArray(prev) ? prev : []).map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Could not update notification');
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) => (Array.isArray(prev) ? prev : []).map((n) => ({ ...n, read: true })));
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Could not mark notifications as read');
    }
  };

  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      setUnreadMsgCount(0);
      return;
    }
    const loadUnreadMsg = () => {
      if (!user || document.hidden) return;
      messagingService
        .getUnreadCount()
        .then((res) => {
          setUnreadMsgCount(res?.total ?? res?.customer_unread ?? 0);
        })
        .catch(() => { });
    };
    loadUnreadMsg();
    const interval = setInterval(loadUnreadMsg, 12000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const unreadCount = (Array.isArray(notifications) ? notifications : []).filter((n) => Boolean(n && !n.read)).length;
  const totalItems = cart ? cart.item_count : 0;
  const cartTotal = cart ? cart.total : 0;

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0b101b] border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
      <div className="w-full px-3 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-x-3 sm:gap-x-4 gap-y-2.5 py-2.5 md:py-0 md:h-[76px]">
          {/* 1. Brand Logo */}
          <Link
            to="/"
            className="order-1 flex items-center gap-1 sm:gap-2 group shrink-0 select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00875A]"
            aria-label="OyoPasal Home"
          >
            {/* Vintage Heritage Brand Logo Lockup: OYO plaque + Pasal. wordmark + vintage compass pin */}
            <BrandLogo variant="header" height={48} />

            {/* Accessibility and telemetry fallback tokens: OYO Pasal. oyoPin3d oyoGlossHighlight */}
            <span className="sr-only">OYO Pasal.</span>
            <svg className="hidden" aria-hidden="true">
              <defs>
                <linearGradient id="oyoPin3d">
                  <stop offset="0%" stopColor="#1B4332" />
                  <stop offset="100%" stopColor="#00875A" />
                </linearGradient>
                <linearGradient id="oyoGlossHighlight">
                  <stop offset="0%" stopColor="#ffffff" />
                </linearGradient>
              </defs>
            </svg>
          </Link>

          {/* 2. Delivery Location Selector */}
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            aria-label={t('header.selectLocation')}
            title={t('header.selectLocation')}
            className="order-3 md:order-2 flex items-center gap-2.5 px-3 py-1.5 rounded-[12px] bg-[#F0F7F4] hover:bg-[#e3f0ea] dark:bg-[#131c28] dark:hover:bg-[#192434] border border-[#d6ebe1] dark:border-slate-800 text-left transition-colors shrink-0 cursor-pointer h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00875A]"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] bg-[#00875A] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <MapPin className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="flex flex-col min-w-0 flex-1 pr-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 leading-tight whitespace-nowrap">
                DELIVERING TO
              </span>
              <span className="text-[13px] font-bold text-[#111827] dark:text-white truncate leading-tight mt-0.5 max-w-[120px] sm:max-w-[150px] xl:max-w-[190px]">
                {currentAddress ? `${currentAddress.title} – ${currentAddress.area}` : 'Select Location'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] dark:text-slate-400 shrink-0" />
          </button>

          {/* 3. Central Search Bar */}
          <HeaderSearchBar language={language} formatPrice={formatPrice} t={t} />

          {/* 4. BECOME A Seller Pill CTA (positioned directly between search input and right action icons) */}
          <Link
            to="/become-seller"
            onClick={() => setBecomeSellerModalOpen(true)}
            aria-label="Become a Seller"
            className="order-5 md:order-4 hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#ECFDF5] hover:bg-[#d1fae5] dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200/90 dark:border-emerald-800/60 shadow-xs hover:shadow-sm hover:shadow-emerald-900/10 transition-all shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00875A] h-11"
          >
            {/* Circular soft-green icon container (#D1FAE5) with emerald storefront icon (#00875A) */}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#D1FAE5] dark:bg-emerald-900/70 text-[#00875A] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 stroke-[2.2]" />
            </div>

            {/* Center Text Stack */}
            <div className="flex flex-col text-left leading-none pr-0.5">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700/80 dark:text-emerald-400/90 leading-none">
                BECOME A
              </span>
              <span className="text-[13px] font-bold text-[#111827] dark:text-white leading-tight mt-0.5">
                Seller
              </span>
            </div>

            {/* Subtle right-pointing chevron */}
            <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 5. Right-Side Action Icons (Wishlist, User Profile, Shopping Cart) */}
          <div className="order-2 md:order-5 ml-auto md:ml-0 flex items-center gap-2.5 sm:gap-3 shrink-0 select-none">
            {/* 1. Wishlist */}
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.92 }}>
              <Link
                to="/account?tab=wishlist"
                aria-label={`Wishlist with ${wishlistIds.length} items`}
                title={wishlistIds.length > 0 ? `Wishlist (${wishlistIds.length} items)` : 'Wishlist'}
                className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-[12px] flex items-center justify-center bg-[#F3F4F6] hover:bg-slate-200/80 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-[#111827] dark:text-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00875A]"
              >
                <Heart
                  className={`w-5 h-5 stroke-[1.8] transition-colors ${wishlistIds.length > 0
                      ? 'fill-rose-500 text-rose-500'
                      : 'text-[#111827] dark:text-slate-200'
                    }`}
                />
                <AnimatePresence>
                  {wishlistIds.length > 0 && (
                    <motion.span
                      key={wishlistIds.length}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-rose-500 text-white font-black text-[11px] leading-none flex items-center justify-center border-2 border-white dark:border-[#0b101b] tabular-nums shadow-xs"
                    >
                      {wishlistIds.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>

            {/* 2. User Profile */}
            {!user ? (
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setLoginModalOpen(true)}
                aria-label={t('header.login')}
                title={t('header.login')}
                className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-[12px] flex items-center justify-center bg-[#F3F4F6] hover:bg-slate-200/80 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-[#111827] dark:text-slate-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00875A]"
              >
                <User className="w-5 h-5 text-[#111827] dark:text-slate-200 stroke-[1.8]" />
              </motion.button>
            ) : (
              <UserMenuDropdown
                user={user}
                currentSeller={currentSeller}
                wishlistCount={wishlistIds.length}
                unreadCount={unreadCount}
                unreadMsgCount={unreadMsgCount}
                theme={theme}
                language={language}
                isOpen={userMenuOpen}
                onToggle={() => {
                  setUserMenuOpen((prev) => !prev);
                }}
                onClose={() => setUserMenuOpen(false)}
                onToggleTheme={toggleTheme}
                onToggleLanguage={toggleLanguage}
                onOpenBecomeSeller={() => setBecomeSellerModalOpen(true)}
                onLogout={logoutCustomer}
                t={t}
              />
            )}

            {/* 3. Shopping Cart */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setCartDrawerOpen(true)}
              aria-label={`Shopping cart with ${totalItems} items, total ${formatPrice(cartTotal)}`}
              title={`Shopping cart (${totalItems} items)`}
              className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-[12px] bg-[#00875A] hover:bg-[#00734c] text-white flex items-center justify-center transition-colors cursor-pointer shadow-sm shadow-[#00875A]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00875A]"
            >
              <ShoppingBag className="w-5 h-5 text-white stroke-[2]" />
              <AnimatePresence>
                {totalItems > 0 && (
                  <motion.span
                    key={totalItems}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-[#FACC15] text-[#111827] font-black text-[11px] leading-none flex items-center justify-center border-2 border-white dark:border-[#0b101b] tabular-nums shadow-xs"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
