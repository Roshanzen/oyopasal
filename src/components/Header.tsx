import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { NotificationItem } from '../types';
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
  ChevronRight,
  Sun,
  Moon,
  Bell,
  CheckCheck
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
    wishlistIds,
    theme,
    toggleTheme
  } = useApp();

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [categoriesFound, setCategoriesFound] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('oyopasal_read_notifs');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Load real notifications for header indicator & dropdown
  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const res = await api.getNotifications();
        if (active && Array.isArray(res.results)) {
          setNotifications(res.results);
        }
      } catch {
        // Non-blocking if notifications endpoint unavailable
      }
    }
    loadNotifications();
    return () => {
      active = false;
    };
  }, []);

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

  const markNotificationRead = (id: string) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('oyopasal_read_notifs', JSON.stringify(next));
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotifIds(allIds);
    localStorage.setItem('oyopasal_read_notifs', JSON.stringify(allIds));
  };

  const unreadCount = notifications.filter((n) => !n.read && !readNotifIds.includes(n.id)).length;
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
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-[12px] uppercase tracking-wider transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <span>SELLER HUB</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <p className="hidden xl:block text-[13px] font-medium text-emerald-100/90 truncate">
              Grow your local store with 10-minute deliveries across Kathmandu Valley. 0% commission for 30 days.
            </p>
            <p className="xl:hidden text-[13px] font-medium text-emerald-100/90 truncate">
              10-minute deliveries across Kathmandu Valley · 0% commission for 30 days
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/seller"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-200 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-md px-1.5 py-0.5"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentSeller ? `${currentSeller.name} Hub` : 'Login as Seller'}</span>
            </Link>
            <span className="h-3.5 w-px bg-emerald-800/80" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setBecomeSellerModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 hover:text-amber-200 font-bold text-[12px] transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Store className="w-3.5 h-3.5 text-amber-300" />
              <span>Become a Seller</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Main Navigation Header (Responsive Desktop/Tablet 1-row, Mobile 3-row) */}
      <div className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-x-2.5 sm:gap-x-3 lg:gap-x-5 gap-y-2.5 py-2.5 md:py-0 md:h-20">
          {/* A. OyoPasal Logo */}
          <Link
            to="/"
            className="order-1 flex items-center gap-2.5 group shrink-0 pr-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-950/20 shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span className="font-extrabold text-xl sm:text-2xl font-display tracking-tight leading-none">O</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap">
                Oyo<span className="text-emerald-600 dark:text-emerald-400">Pasal</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-1 whitespace-nowrap">
                <Clock className="w-3 h-3 shrink-0" />
                <span>10–15 MIN DELIVERY</span>
              </span>
            </div>
          </Link>

          {/* B. Delivery Location Selector (Row 2 on Mobile, Zone B on Tablet/Desktop) */}
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            aria-label="Change delivery location"
            title="Change Delivery Address"
            className="order-3 md:order-2 w-full md:w-auto md:max-w-[195px] lg:max-w-[235px] xl:max-w-[270px] flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 dark:bg-[#141b2b] dark:hover:bg-[#1a2236] border border-slate-200/80 dark:border-slate-700/80 text-left transition-colors shrink-0 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-tight whitespace-nowrap">
                Delivering to
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white truncate leading-tight mt-0.5">
                {currentAddress ? `${currentAddress.title} – ${currentAddress.area}` : 'Select Location'}
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
                  aria-label="Search groceries and products"
                  placeholder="Search fresh veggies, milk, snacks, groceries..."
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
                      Categories
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
                      {categoriesFound.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelectCategory(cat.slug)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.length > 0 ? (
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
                      Matching Products
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
                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.unit} · {item.category}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0 ml-3">
                            Rs. {item.price}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : searchInput.trim().length > 1 ? (
                  <div className="py-5 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No exact matches for &ldquo;{searchInput}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Search all catalog items</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* D, E, F. Right Cluster: Utility Actions, User Profile & Shopping Cart */}
          <div className="order-2 md:order-4 ml-auto md:ml-0 flex items-center gap-2 lg:gap-2.5 shrink-0 select-none">
            {/* D. Utility Actions (Theme Toggle, Wishlist, Notifications) */}
            <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
              {/* Theme Toggle */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-amber-400" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </motion.button>

              {/* Wishlist */}
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.92 }} className="hidden lg:block">
                <Link
                  to="/account?tab=wishlist"
                  aria-label="My Wishlist"
                  title="My Wishlist"
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
                  aria-label="Notifications"
                  aria-expanded={notifMenuOpen}
                  aria-haspopup="menu"
                  title="Notifications"
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
                        Notifications
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Mark all read</span>
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
                      {notifications.length === 0 ? (
                        <div className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                          You&apos;re all caught up!
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !n.read && !readNotifIds.includes(n.id);
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => {
                                markNotificationRead(n.id);
                                setNotifMenuOpen(false);
                                navigate('/account?tab=notifications');
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
                      View all notifications →
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* E. User Profile Menu */}
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
                className="flex items-center gap-2 pl-1.5 pr-2.5 sm:pr-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-[#141b2b] dark:hover:bg-[#1c2539] text-slate-800 dark:text-slate-100 transition-colors cursor-pointer min-h-[42px] lg:min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                  {user ? user.full_name.charAt(0) : 'U'}
                </div>
                <span className="hidden sm:inline md:hidden lg:inline text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                  {user ? user.full_name.split(' ')[0] : 'Account'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0" />
              </motion.button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2.5 w-72 bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 py-2 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.full_name || 'Guest User'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user?.phone || user?.email || 'Sign in for faster checkout'}
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
                        <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                      </div>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded font-mono uppercase">
                        {theme}
                      </span>
                    </button>
                    <Link
                      to="/account?tab=orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <Package className="w-4 h-4 text-slate-400" />
                      <span>My Orders &amp; Tracking</span>
                    </Link>
                    <Link
                      to="/account?tab=addresses"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>Delivery Addresses</span>
                    </Link>
                    <Link
                      to="/account?tab=wishlist"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <span className="flex items-center gap-2.5">
                        <Heart className="w-4 h-4 text-slate-400" />
                        <span>Saved Wishlist</span>
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
                        <span>Notifications</span>
                      </span>
                      {unreadCount > 0 && (
                        <span className="text-xs font-bold bg-amber-400/20 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full tabular-nums">
                          {unreadCount} new
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/account?tab=profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Account Settings</span>
                    </Link>

                    {/* Dedicated Seller & Merchant Access Section */}
                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1.5 pt-2 px-2">
                      <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 block mb-1">
                        Seller &amp; Merchant Access
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
                                Store Dashboard &amp; Add Products
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
                                Login as Seller
                              </span>
                              <span className="text-xs text-slate-400 dark:text-slate-500 block font-normal">
                                Manage orders &amp; add products
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
                        <span>Become a Seller (New Store)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* F. Shopping Cart Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setCartDrawerOpen(true)}
              aria-label={`Shopping cart with ${totalItems} items, total Rs. ${cartTotal}`}
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2 rounded-[14px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950/20 transition-colors cursor-pointer min-h-[42px] lg:min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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
                  {totalItems === 0 ? 'My Basket' : `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
                </span>
                <span className="text-sm font-bold whitespace-nowrap tabular-nums">
                  {cartLoading && !cart ? '...' : `Rs. ${cartTotal}`}
                </span>
              </div>
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
