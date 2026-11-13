import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { ActiveCouponItem } from '../../shared/types';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Tag,
  CheckCircle2,
  Clock,
  Store,
  Info,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CartDrawer() {
  const navigate = useNavigate();
  const {
    cart,
    cartDrawerOpen,
    setCartDrawerOpen,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    applyCoupon,
    removeCoupon,
    t,
    formatPrice
  } = useApp();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [activeCoupons, setActiveCoupons] = useState<ActiveCouponItem[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsError, setCouponsError] = useState('');

  const loadActiveCoupons = useCallback(async () => {
    setCouponsLoading(true);
    setCouponsError('');
    try {
      const res = await api.getActiveCoupons();
      setActiveCoupons(res.results || []);
    } catch (err) {
      setCouponsError(err instanceof Error ? err.message : 'Unable to load available coupons');
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (cartDrawerOpen) {
      loadActiveCoupons();
    }
  }, [cartDrawerOpen, loadActiveCoupons]);

  const applyCodeValue = async (code: string) => {
    if (!code.trim()) return;
    setCouponError('');
    setCouponApplying(true);
    try {
      await applyCoupon(code.trim());
      setCouponCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid coupon';
      setCouponError(msg);
    } finally {
      setCouponApplying(false);
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyCodeValue(couponCode);
  };

  const handleProceedToCheckout = () => {
    setCartDrawerOpen(false);
    navigate('/checkout');
  };

  const totalItems = cart?.item_count || 0;
  const isFreeDelivery = (cart?.delivery_fee || 0) === 0;
  const itemWord = totalItems === 1 ? t('common.item') : t('common.items');

  return (
    <AnimatePresence>
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none">
          {/* Backdrop with Smooth Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setCartDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            {/* Drawer Panel with Spring Slide */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="w-screen max-w-md bg-white dark:bg-[#0f1422] text-slate-900 dark:text-slate-100 shadow-2xl flex flex-col justify-between border-l border-slate-200/80 dark:border-slate-800"
            >
              
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                      {t('cart.title')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('cart.inYourCart', { count: totalItems, label: itemWord })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {totalItems > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-xs text-slate-400 hover:text-rose-600 transition-colors px-2 py-1 cursor-pointer"
                    >
                      {t('cart.clearAll')}
                    </button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setCartDrawerOpen(false)}
                    aria-label="Close basket"
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* Free Delivery Tracker Bar */}
                {cart && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/80 dark:border-emerald-900/60">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        {isFreeDelivery
                          ? t('cart.freeUnlocked')
                          : t('cart.addMoreForFree', { amount: formatPrice(cart.amount_needed_for_free_delivery) })}
                      </span>
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold tabular-nums">
                        {Math.min(100, Math.round((cart.subtotal / cart.free_delivery_threshold) * 100))}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-emerald-200/60 dark:bg-emerald-900/80 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-emerald-600 rounded-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, Math.round((cart.subtotal / cart.free_delivery_threshold) * 100))}%`
                        }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!cart || cart.items.length === 0) && (
                  <div className="py-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{t('cart.emptyTitle')}</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto mt-1">
                        {t('cart.emptySubtitle')}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setCartDrawerOpen(false)}
                      className="px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors cursor-pointer shadow-md"
                    >
                      {t('cart.startShopping')}
                    </motion.button>
                  </div>
                )}

                {/* Multi-Vendor Grouped Items */}
                {cart && cart.vendor_groups && cart.vendor_groups.length > 0 && (
                  <div className="space-y-4">
                    {cart.vendor_groups.map((group, groupIdx) => (
                      <div
                        key={groupIdx}
                        className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111726] p-3.5 shadow-2xs"
                      >
                        {/* Vendor Header */}
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                              {group.vendor.name}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {group.delivery_fee === 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('common.freeDelivery')}</span>
                            ) : (
                              t('cart.deliveryLabel', { amount: formatPrice(group.delivery_fee) })
                            )}
                          </span>
                        </div>

                        {/* Vendor Items */}
                        <div className="space-y-3">
                          {group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <img
                                src={item.product.image_url}
                                alt={item.product.name}
                                referrerPolicy="no-referrer"
                                className="w-13 h-13 rounded-xl object-cover bg-slate-50 dark:bg-slate-800 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                  {item.product.name}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.product.unit}
                                </p>
                                <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                  {formatPrice(item.unit_price)}
                                </span>
                              </div>

                              {/* Stepper with Spring Taps */}
                              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                                <motion.button
                                  whileTap={{ scale: 0.8 }}
                                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                  aria-label="Decrease quantity"
                                  className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </motion.button>
                                <span className="px-2 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                                  {item.quantity}
                                </span>
                                <motion.button
                                  whileTap={{ scale: 0.8 }}
                                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                  aria-label="Increase quantity"
                                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </motion.button>
                              </div>

                              <motion.button
                                whileTap={{ scale: 0.8 }}
                                onClick={() => removeCartItem(item.id)}
                                aria-label="Remove item"
                                className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </motion.button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Coupons Section */}
                {cart && cart.items.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                      <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('cart.couponsOffers')}</span>
                    </div>

                    {cart.coupon ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <div>
                            <span className="font-bold">{cart.coupon.code}</span>
                            <p className="text-xs text-emerald-800 dark:text-emerald-300">{cart.coupon.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={removeCoupon}
                          className="font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs ml-2 cursor-pointer"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCoupon} className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder={t('cart.couponPlaceholder')}
                          className="flex-1 px-3 py-2 text-sm uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:border-emerald-500 focus:outline-none"
                        />
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="submit"
                          disabled={couponApplying || !couponCode.trim()}
                          className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-bold text-sm hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {couponApplying ? t('common.applying') : t('common.apply')}
                        </motion.button>
                      </form>
                    )}

                    {couponError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">{couponError}</p>
                    )}

                    {couponsLoading ? (
                      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Loading active offers...</span>
                      </div>
                    ) : couponsError ? (
                      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-rose-600 dark:text-rose-400">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{couponsError}</span>
                        </span>
                        <button
                          type="button"
                          onClick={loadActiveCoupons}
                          className="font-bold underline cursor-pointer shrink-0"
                        >
                          Retry
                        </button>
                      </div>
                    ) : activeCoupons.length > 0 ? (
                      <div className="mt-2.5 space-y-1.5">
                        {activeCoupons.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                disabled={Boolean(cart.coupon) || couponApplying}
                                onClick={() => applyCodeValue(c.code)}
                                className="bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-300 font-bold px-2 py-0.5 rounded shrink-0 cursor-pointer disabled:opacity-60 transition-colors"
                              >
                                {c.code}
                              </button>
                              <span className="truncate">{c.description}</span>
                            </div>
                            {c.min_order_amount > 0 && (
                              <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                                Min {formatPrice(c.min_order_amount)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        No active promotional codes available right now.
                      </p>
                    )}
                  </div>
                )}

                {/* Bill Details */}
                {cart && cart.items.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-sm">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                      {t('cart.billSummary')}
                    </span>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>{t('cart.itemSubtotal')}</span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{formatPrice(cart.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>{t('cart.deliveryCharges')}</span>
                      <span className="tabular-nums font-semibold">
                        {cart.delivery_fee === 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('common.free')}</span>
                        ) : (
                          formatPrice(cart.delivery_fee)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        {t('cart.handlingFee')}
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{formatPrice(cart.handling_fee)}</span>
                    </div>
                    {cart.coupon && (
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                        <span>{t('cart.couponDiscount', { code: cart.coupon.code })}</span>
                        <span className="tabular-nums">- {formatPrice(cart.coupon.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>{t('cart.totalPayable')}</span>
                      <span className="tabular-nums text-lg text-emerald-700 dark:text-emerald-400">
                        {formatPrice(cart.total)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Checkout CTA */}
              {cart && cart.items.length > 0 && (
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#0f1422]">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleProceedToCheckout}
                    className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex flex-col text-left leading-tight">
                      <span className="text-xs font-medium text-emerald-100">
                        {totalItems} {itemWord}
                      </span>
                      <span className="text-lg font-extrabold tabular-nums">
                        {formatPrice(cart.total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-extrabold tracking-wide text-sm uppercase">
                      <span>{t('cart.proceedCheckout')}</span>
                      <ArrowRight className="w-4.5 h-4.5" />
                    </div>
                  </motion.button>
                </div>
              )}

            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
