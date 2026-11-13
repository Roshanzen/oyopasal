import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { NotificationItem } from '../../shared/types';
import { translateCategoryName } from '../../shared/i18n/translations';
import {
  Search,
  MapPin,
  ShoppingBag,
  User,
  ChevronDown,
  X,
  Clock,
  ArrowRight,
  Package,
  Heart,
  Store,
  LogIn,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  Bell,
  CheckCheck,
  Languages,
  Shield,
  Bike,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Header() {
  const navigate = useNavigate();
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
    formatPrice
  } = useApp();

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [categoriesFound, setCategoriesFound] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    setNotifError('');
    try {
      const res = await api.getNotifications();
      if (Array.isArray(res.results)) {
        setNotifications(res.results);
      }
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Unable to load notifications');
    } finally {
      setNotifLoading(false);
    }
  }, []);

  // Load real notifications for header indicator & dropdown
  useEffect(() => {
    loadNotifications();
  }, [user?.id, loadNotifications]);

  // Debounced search autocomplete
  useEffect(() => {
    if (!searchInput.trim()) {
      setSuggestions([]);
      setCategoriesFound([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.getAutocomplete(searchInput.trim());
        setSuggestions(res.suggestions || []);
        setCategoriesFound(res.categories || []);
      } catch (err) {
        console.error('Autocomplete error', err);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Click outside & Escape key listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(target)) {
        setNotifMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowDropdown(false);
        setUserMenuOpen(false);
        setNotifMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
    }
  };

  const handleSelectSuggestion = (productName: string) => {
    setSearchInput(productName);
    setShowDropdown(false);
    navigate(`/search?q=${encodeURIComponent(productName)}`);
  };

  const handleSelectCategory = (slug: string) => {
    setShowDropdown(false);
    navigate(`/category/${slug}`);
  };

  const markNotificationRead = async (id: string) => {
    if (!user) return;
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      setNotifError(err instanceof Error ? err.message : 'Could not update notification');
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;
    try {
      await api.markAllNotificationsRead();
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
      {/* Row 1: Promotional / Seller Announcement Bar (Desktop & Tablet) */}
      <div className="hidden md:flex items-center min-h-[42px] bg-[#052e23] dark:bg-[#06231b] text-emerald-50 border-b border-emerald-800/50 px-4 sm:px-6 lg:px-10 py-1.5">
        <div className="w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/seller"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[12px] uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span>{t('header.sellerHub')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <p className="hidden xl:block text-[13px] font-medium text-emerald-100/90 truncate">
              {t('header.announcementLong')}
            </p>
            <p className="xl:hidden text-[13px] font-medium text-emerald-100/90 truncate">
              {t('header.announcementShort')}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/seller"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-200 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md px-1.5 py-0.5"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {currentSeller
                  ? t('header.sellerHubSuffix', { name: currentSeller.name })
                  : t('header.loginAsSeller')}
              </span>
            </Link>
            <span className="h-3.5 w-px bg-emerald-800/80" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setBecomeSellerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 hover:text-amber-200 font-bold text-[12px] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Store className="w-3.5 h-3.5 text-amber-300" />
              <span>{t('header.becomeSeller')}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Main Navigation Header (Responsive Desktop/Tablet 1-row, Mobile 3-row) */}
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

          {/* B. Delivery Location Selector (Row 2 on Mobile, Zone B on Tablet/Desktop) */}
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

          {/* C. Search Bar (Row 3 Full-Width on Mobile, Highest Priority Flex-1 on Tablet/Desktop) */}
          <div ref={searchContainerRef} className="order-4 md:order-3 w-full md:w-auto md:flex-1 min-w-0 relative">
            <form onSubmit={handleSearchSubmit} className="relative" role="search">
              <div className="relative flex items-center">
                <Search className="w-5 h-5 text-slate-400 dark:text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  aria-label={t('header.searchPlaceholder')}
                  placeholder={t('header.searchPlaceholder')}
                  className="w-full pl-11 pr-10 py-2.5 md:py-3 rounded-[14px] bg-slate-100 hover:bg-slate-200/60 focus:bg-white dark:bg-[#141b2b] dark:hover:bg-[#182032] dark:focus:bg-[#182032] text-sm text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all placeholder:text-slate-500 dark:placeholder:text-slate-400 font-medium"
                />
                {searchInput && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearchInput('');
                      setSuggestions([]);
                    }}
                    className="absolute right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Autocomplete Dropdown */}
            {showDropdown && (searchInput.trim().length > 0 || suggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-3 z-50">
                {categoriesFound.length > 0 && (
                  <div className="mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                      {t('header.categories')}
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
                      {categoriesFound.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat.slug)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                        >
                          {translateCategoryName(cat.slug, cat.name, language)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.length > 0 ? (
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                      {t('header.matchingProducts')}
                    </span>
                    <div className="mt-1 space-y-1 max-h-80 overflow-y-auto">
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSuggestion(item.name)}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.unit} · {translateCategoryName(item.category || '', item.category || '', language)}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0 ml-3">
                            {formatPrice(item.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : searchInput.trim().length > 1 ? (
                  <div className="py-5 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('header.noMatches', { query: searchInput })}
                    </p>
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t('header.searchAllCatalog')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* D, E, F. Right Cluster: Language Switcher, Utility Actions, Login/Profile & Shopping Cart */}
          <div className="order-2 md:order-4 ml-auto md:ml-0 flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0 select-none">
            {/* Language Switcher Pill (EN | ने) — Right Side */}
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

            {/* D. Utility Actions (Theme Toggle, Wishlist, Notifications) */}
            <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
              {/* Theme Toggle */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
                title={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
                className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </motion.button>

              {/* Wishlist */}
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

              {/* Notifications Dropdown Trigger */}
              <div ref={notifMenuRef} className="relative">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setNotifMenuOpen((prev) => !prev);
                    setUserMenuOpen(false);
                  }}
                  aria-label={t('header.notifications')}
                  aria-expanded={notifMenuOpen}
                  aria-haspopup="menu"
                  title={t('header.notifications')}
                  className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 text-[12px] font-extrabold leading-none flex items-center justify-center border-2 border-white dark:border-[#0b101b] tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </motion.button>

                {notifMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {t('header.notifications')}
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>{t('header.markAllRead')}</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                      {notifError ? (
                        <div className="py-6 px-4 text-center space-y-2">
                          <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{notifError}</span>
                          </div>
                          <button
                            type="button"
                            onClick={loadNotifications}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        </div>
                      ) : notifLoading && notifications.length === 0 ? (
                        <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          {t('header.allCaughtUp')}
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !n.read;
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => {
                                markNotificationRead(n.id);
                                setNotifMenuOpen(false);
                                navigate(n.reference_url || '/account?tab=notifications');
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                                isUnread ? 'bg-emerald-50/50 dark:bg-emerald-950/25' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                  {n.title}
                                </span>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                {n.message}
                              </p>
                              <span className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 block">
                                {n.created_at}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <Link
                      to="/account?tab=notifications"
                      onClick={() => setNotifMenuOpen(false)}
                      className="block w-full text-center py-2.5 bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-emerald-700 dark:text-emerald-400 border-t border-slate-100 dark:border-slate-800 transition-colors"
                    >
                      {t('header.viewAllNotifications')}
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* E. Customer Login Button (when signed out) OR User Profile Dropdown (when signed in) */}
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
              <div ref={userMenuRef} className="relative">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setUserMenuOpen((prev) => !prev);
                    setNotifMenuOpen(false);
                  }}
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
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

                {userMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2.5 w-72 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 py-2 z-50"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{user.full_name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {user.phone || user.email}
                      </p>
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={toggleTheme}
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
                        onClick={toggleLanguage}
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
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                      >
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>{t('header.myOrdersTracking')}</span>
                      </Link>
                      <Link
                        to="/account?tab=addresses"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                      >
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{t('header.deliveryAddresses')}</span>
                      </Link>
                      <Link
                        to="/account?tab=wishlist"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                      >
                        <span className="flex items-center gap-2.5">
                          <Heart className="w-4 h-4 text-slate-400" />
                          <span>{t('header.savedWishlist')}</span>
                        </span>
                        {wishlistIds.length > 0 && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {wishlistIds.length}
                          </span>
                        )}
                      </Link>
                      <Link
                        to="/account?tab=notifications"
                        onClick={() => setUserMenuOpen(false)}
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
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{t('header.accountSettings')}</span>
                      </Link>

                      {/* Dedicated Seller & Merchant Access Section */}
                      <div className="border-t border-slate-100 dark:border-slate-800 mt-1.5 pt-2 px-2">
                        <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 block mb-1">
                          {t('header.sellerMerchantAccess')}
                        </span>

                        {currentSeller ? (
                          <Link
                            to="/seller"
                            onClick={() => setUserMenuOpen(false)}
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
                            onClick={() => setUserMenuOpen(false)}
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
                            setUserMenuOpen(false);
                            setBecomeSellerModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg font-semibold transition-colors text-left mt-0.5 cursor-pointer"
                        >
                          <Store className="w-4 h-4" />
                          <span>{t('header.becomeSellerNew')}</span>
                        </button>

                        <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                          <Link
                            to="/admin"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Admin</span>
                          </Link>
                          <Link
                            to="/rider"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                          >
                            <Bike className="w-3.5 h-3.5 text-amber-500" />
                            <span>Rider</span>
                          </Link>
                        </div>
                      </div>

                      {/* Sign Out */}
                      <div className="border-t border-slate-100 dark:border-slate-800 mt-1.5 pt-1.5 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logoutCustomer();
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
            )}

            {/* F. Shopping Cart Button */}
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

