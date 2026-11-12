import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
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
  Info
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
    removeCoupon
  } = useApp();

  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponApplying(true);
    try {
      await applyCoupon(couponCode.trim());
      setCouponCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid coupon';
      setCouponError(msg);
    } finally {
      setCouponApplying(false);
    }
  };

  const handleProceedToCheckout = () => {
    setCartDrawerOpen(false);
    navigate('/checkout');
  };

  const totalItems = cart?.item_count || 0;
  const isFreeDelivery = (cart?.delivery_fee || 0) === 0;

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
                    <h2 className="text-base font-bold text-slate-900 dark:text-white font-display">
                      My Shopping Basket
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {totalItems} {totalItems === 1 ? 'item' : 'items'} in your cart
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {totalItems > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-xs text-slate-400 hover:text-rose-600 transition-colors px-2 py-1 cursor-pointer"
                    >
                      Clear All
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
                          ? 'You unlocked FREE delivery!'
                          : `Add Rs. ${cart.amount_needed_for_free_delivery} more for FREE delivery`}
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
                      <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Your basket is empty</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto mt-1">
                        Explore farm-fresh veggies, bakery bakes and everyday essentials delivered in 10-15 minutes.
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setCartDrawerOpen(false)}
                      className="px-5 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors cursor-pointer shadow-md"
                    >
                      Start Shopping
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
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            {group.delivery_fee === 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">Free Delivery</span>
                            ) : (
                              `Delivery: Rs. ${group.delivery_fee}`
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
                                className="w-12 h-12 rounded-xl object-cover bg-slate-50 dark:bg-slate-800 shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                  {item.product.name}
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {item.product.unit}
                                </p>
                                <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                                  Rs. {item.unit_price}
                                </span>
                              </div>

                              {/* Stepper with Spring Taps */}
                              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                                <motion.button
                                  whileTap={{ scale: 0.8 }}
                                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                  aria-label="Decrease quantity"
                                  className="p-1 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </motion.button>
                                <span className="px-2 text-xs font-bold tabular-nums text-slate-900 dark:text-white">
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
                      <span>Coupons & Offers</span>
                    </div>

                    {cart.coupon ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <div>
                            <span className="font-bold">{cart.coupon.code}</span>
                            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{cart.coupon.description}</p>
                          </div>
                        </div>
                        <button
                          onClick={removeCoupon}
                          className="font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs ml-2 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCoupon} className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Enter code (e.g. OYOFRESH20)"
                          className="flex-1 px-3 py-1.5 text-xs uppercase bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:border-emerald-500 focus:outline-none"
                        />
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          type="submit"
                          disabled={couponApplying || !couponCode.trim()}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-bold text-xs hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {couponApplying ? 'Applying...' : 'Apply'}
                        </motion.button>
                      </form>
                    )}

                    {couponError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-medium">{couponError}</p>
                    )}

                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
                        WELCOME50
                      </span>
                      <span>Rs. 50 off on first order</span>
                    </div>
                  </div>
                )}

                {/* Bill Details */}
                {cart && cart.items.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                      Bill Summary
                    </span>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Item Subtotal</span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">Rs. {cart.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Delivery Charges</span>
                      <span className="tabular-nums font-semibold">
                        {cart.delivery_fee === 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">FREE</span>
                        ) : (
                          `Rs. ${cart.delivery_fee}`
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        Handling & Packaging Fee
                        <Info className="w-3 h-3 text-slate-400" />
                      </span>
                      <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">Rs. {cart.handling_fee}</span>
                    </div>
                    {cart.coupon && (
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                        <span>Coupon Discount ({cart.coupon.code})</span>
                        <span className="tabular-nums">- Rs. {cart.coupon.discount_amount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>Total Payable</span>
                      <span className="tabular-nums text-base text-emerald-700 dark:text-emerald-400">
                        Rs. {cart.total}
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
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex flex-col text-left leading-tight">
                      <span className="text-[11px] font-medium text-emerald-100">
                        {totalItems} {totalItems === 1 ? 'item' : 'items'}
                      </span>
                      <span className="text-base font-extrabold tabular-nums">
                        Rs. {cart.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-extrabold tracking-wide text-xs uppercase">
                      <span>Proceed to Checkout</span>
                      <ArrowRight className="w-4 h-4" />
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
