import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Home, Grid, Search, Package, User, ShoppingBag, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, setCartDrawerOpen } = useApp();

  const currentPath = location.pathname;
  const totalItems = cart?.item_count || 0;

  // Don't show bottom nav on full-screen checkout
  if (currentPath === '/checkout') return null;

  const navItems = [
    { label: 'Home', path: '/', icon: Home, isActive: currentPath === '/' },
    { label: 'Categories', path: '/categories', icon: Grid, isActive: currentPath.startsWith('/categor') },
    { label: 'Search', path: '/search', icon: Search, isActive: currentPath.startsWith('/search') },
    {
      label: 'Orders',
      path: '/account?tab=orders',
      icon: Package,
      isActive: currentPath === '/account' && location.search.includes('orders')
    },
    {
      label: 'Account',
      path: '/account',
      icon: User,
      isActive: currentPath.startsWith('/account') && !location.search.includes('orders')
    },
  ];

  return (
    <>
      {/* Floating Mini Cart Bar on Mobile when items exist */}
      <AnimatePresence>
        {totalItems > 0 && currentPath !== '/checkout' && (
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed bottom-16 left-3 right-3 z-30 md:hidden select-none"
          >
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setCartDrawerOpen(true)}
              className="w-full bg-emerald-700 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between font-bold text-xs cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-800 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="text-left leading-tight">
                  <span className="block text-[11px] text-emerald-200">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </span>
                  <span className="text-sm font-extrabold tabular-nums">
                    Rs. {cart?.total}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-white text-emerald-800 px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-[11px] shadow-xs">
                <span>View Basket</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden shadow-lg pb-safe transition-colors duration-200 select-none">
        <div className="grid grid-cols-5 h-15 items-center px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.82 }}
                onClick={() => navigate(item.path)}
                className={`relative flex flex-col items-center justify-center py-1 transition-colors cursor-pointer ${
                  item.isActive
                    ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.isActive && (
                    <motion.div
                      layoutId="bottomNavActiveDot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
