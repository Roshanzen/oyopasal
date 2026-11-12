import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Search,
  MapPin,
  ShoppingBag,
  User,
  ChevronDown,
  X,
  Clock,
  Sparkles,
  ArrowRight,
  Package,
  Heart,
  Store,
  LogIn,
  ChevronRight,
  Sun,
  Moon
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
    setSellerLoginModalOpen,
    setSellerDashboardModalOpen,
    currentSeller,
    user,
    theme,
    toggleTheme
  } = useApp();

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [categoriesFound, setCategoriesFound] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const totalItems = cart ? cart.item_count : 0;
  const cartTotal = cart ? cart.total : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
      {/* Top Utility Announcement & Merchant Partner Link */}
      <div className="bg-emerald-950 text-emerald-100 text-[11px] py-1.5 px-4 font-medium border-b border-emerald-900/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-700/80 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
              Seller Hub
            </span>
            <span className="hidden sm:inline text-emerald-200/90">
              Grow your local store with 10-minute deliveries across Kathmandu Valley. 0% commission for 30 days.
            </span>
            <span className="sm:hidden text-emerald-200/90 truncate">Partner with OyoPasal Quick-Commerce</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <button
              onClick={() => setSellerLoginModalOpen(true)}
              className="text-emerald-300 hover:text-white font-bold flex items-center gap-1 transition-colors cursor-pointer text-xs"
            >
              <LogIn className="w-3 h-3 text-emerald-400" />
              <span>Login as Seller</span>
            </button>
            <span className="text-emerald-800">·</span>
            <button
              onClick={() => setBecomeSellerModalOpen(true)}
              className="text-amber-300 hover:text-white font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Become a Seller</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 gap-3 sm:gap-6">
          
          {/* Left: Brand Identity & Location */}
          <div className="flex items-center gap-4 lg:gap-8 shrink-0">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
                <span className="font-bold text-xl font-display tracking-tight">O</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white font-display">
                    Oyo<span className="text-emerald-600 dark:text-emerald-400">Pasal</span>
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>10-15 Min Delivery</span>
                </div>
              </div>
            </Link>

            {/* Location Selector */}
            <button
              onClick={() => setLocationModalOpen(true)}
              className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition-colors border border-slate-200/60 dark:border-slate-700/60 text-left max-w-[220px]"
              title="Change Delivery Address"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider leading-none">
                  Delivering to
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                  {currentAddress ? `${currentAddress.title} - ${currentAddress.area}` : 'Select Location'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 ml-auto" />
            </button>
          </div>

          {/* Center: Search Field */}
          <div ref={searchContainerRef} className="flex-1 max-w-xl relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search fresh veggies, milk, snacks, groceries..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-100/90 hover:bg-slate-100 focus:bg-white dark:bg-slate-800/90 dark:hover:bg-slate-800 dark:focus:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 rounded-full border border-transparent focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSuggestions([]);
                    }}
                    className="absolute right-3.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Autocomplete Dropdown */}
            {showDropdown && (searchInput.trim().length > 0 || suggestions.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#0f1422] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {categoriesFound.length > 0 && (
                  <div className="mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">
                      Categories
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {categoriesFound.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleSelectCategory(cat.slug)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.length > 0 ? (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2">
                      Matching Products
                    </span>
                    <div className="mt-1 space-y-1">
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectSuggestion(item.name)}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shrink-0"
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {item.unit} · {item.category}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            Rs. {item.price}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : searchInput.trim().length > 1 ? (
                  <div className="py-4 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">No exact matches for "{searchInput}"</p>
                    <button
                      onClick={handleSearchSubmit}
                      className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mx-auto"
                    >
                      Search all catalog items <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Right: Actions (Theme Toggle, Account & Cart) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 select-none">
            {/* Theme Toggle Button (Light/Dark Mode) */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.85, rotate: 180 }}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </motion.button>

            {/* Wishlist Link (Desktop) */}
            <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88 }}>
              <Link
                to="/account?tab=wishlist"
                className="hidden lg:flex items-center justify-center w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                title="My Wishlist"
              >
                <Heart className="w-5 h-5" />
              </Link>
            </motion.div>

            {/* Become a Seller Button (Desktop) */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setBecomeSellerModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/40 border border-emerald-200/80 dark:border-emerald-800/80 transition-colors shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
              title="Register your store as a partner vendor"
            >
              <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Become a Seller</span>
            </motion.button>

            {/* Active Seller Portal Badge (if logged in as vendor) */}
            {currentSeller && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setSellerDashboardModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
                title="Open Merchant Order Dispatch Portal"
              >
                <Store className="w-3.5 h-3.5 text-emerald-200" />
                <span className="truncate max-w-[120px]">{currentSeller.name}</span>
              </motion.button>
            )}

            {/* Account Menu */}
            <div ref={userMenuRef} className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors font-medium text-sm cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center">
                  {user ? user.full_name.charAt(0) : 'U'}
                </div>
                <span className="hidden sm:inline font-semibold text-slate-800 dark:text-slate-200">
                  {user ? user.full_name.split(' ')[0] : 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 hidden sm:block" />
              </motion.button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0f1422] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.phone || user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
                        <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                        {theme}
                      </span>
                    </button>
                    <Link
                      to="/account?tab=orders"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <Package className="w-4 h-4 text-slate-400" />
                      My Orders & Tracking
                    </Link>
                    <Link
                      to="/account?tab=addresses"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <MapPin className="w-4 h-4 text-slate-400" />
                      Delivery Addresses
                    </Link>
                    <Link
                      to="/account?tab=wishlist"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <Heart className="w-4 h-4 text-slate-400" />
                      Saved Wishlist
                    </Link>
                    <Link
                      to="/account?tab=profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      Account Settings
                    </Link>

                    {/* Dedicated Seller & Merchant Access Section */}
                    <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 px-2">
                      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 block mb-1">
                        Seller & Merchant Access
                      </span>

                      {currentSeller ? (
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            setSellerDashboardModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-left mb-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Store className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <div className="truncate">
                              <span className="block truncate font-bold text-slate-900 dark:text-white">{currentSeller.name}</span>
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">Store Dashboard (Active)</span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setUserMenuOpen(false);
                            setSellerLoginModalOpen(true);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                              <LogIn className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            </div>
                            <div>
                              <span className="block font-bold text-slate-900 dark:text-white group-hover:text-emerald-900 dark:group-hover:text-emerald-300">
                                Login as Seller
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">
                                Manage orders & inventory
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setBecomeSellerModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg font-semibold transition-colors text-left mt-0.5 cursor-pointer"
                      >
                        <Store className="w-3.5 h-3.5 text-slate-400" />
                        <span>Become a Seller (New Store)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Shopping Cart Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => setCartDrawerOpen(true)}
              className="flex items-center gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm cursor-pointer"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5" />
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span
                      key={totalItems}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: [1, 1.35, 1], opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-2 -right-2 bg-amber-500 text-slate-950 font-extrabold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 tabular-nums"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-[11px] font-medium text-emerald-100">
                  {totalItems === 0 ? 'My Basket' : `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}
                </span>
                <span className="text-xs font-bold tabular-nums">
                  {totalItems === 0 ? 'Rs. 0' : `Rs. ${cartTotal}`}
                </span>
              </div>
            </motion.button>

          </div>

        </div>

        {/* Mobile Location Strip */}
        <div className="md:hidden pb-2.5 pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => setLocationModalOpen(true)}
            className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[50%]"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">
              {currentAddress ? `${currentAddress.title} · ${currentAddress.street}` : 'Choose location'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setBecomeSellerModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md"
            >
              <Store className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Become a Seller</span>
            </button>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
              <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>12 Mins</span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}
