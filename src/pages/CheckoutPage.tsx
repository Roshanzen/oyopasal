import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { Address } from '../types';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  CreditCard,
  Wallet,
  Banknote,
  Store,
  Tag,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Plus
} from 'lucide-react';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const {
    cart,
    addresses,
    currentAddress,
    setCurrentAddress,
    setLocationModalOpen,
    applyCoupon,
    removeCoupon,
    showToast,
    refreshCart
  } = useApp();

  const [deliveryOption, setDeliveryOption] = useState<'EXPRESS_12_MINS' | 'SCHEDULED_TODAY'>('EXPRESS_12_MINS');
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | 'CARD'>('CASH_ON_DELIVERY');
  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Validate on mount
  useEffect(() => {
    async function checkCart() {
      try {
        await api.validateCheckout();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Cart is empty or contains out of stock items';
        setValidationError(msg);
      }
    }
    checkCart();
  }, []);

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Your basket is empty</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">
          Add items to your basket before proceeding to checkout.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
        >
          Browse Marketplace
        </button>
      </div>
    );
  }

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError('');
    try {
      await applyCoupon(couponCode.trim());
      setCouponCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid coupon';
      setCouponError(msg);
    }
  };

  const handlePlaceOrder = async () => {
    if (!currentAddress) {
      showToast('Please select or add a delivery address', 'error');
      return;
    }

    setSubmittingOrder(true);
    setValidationError('');

    try {
      // 1. Authoritative Backend Validation of prices, stock, discounts
      await api.validateCheckout();

      // 2. Authoritative Order Creation on Server
      const newOrder = await api.createOrder({
        address_id: currentAddress.id,
        delivery_address: currentAddress,
        payment_method: paymentMethod,
        delivery_option: deliveryOption,
        notes: orderNotes
      });

      showToast('Order confirmed! Rider dispatched.', 'success');
      await refreshCart();
      navigate(`/orders/${newOrder.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place order';
      setValidationError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#090D16] py-8 pb-24">
      <div className="w-full px-4 sm:px-6 lg:px-10">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
                Express Checkout
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                10-15 minute delivery by OyoPasal Micro-Hubs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-3.5 py-2 rounded-xl font-bold border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Secure Checkout</span>
          </div>
        </div>

        {validationError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left 2 Columns: Workflow Steps */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Delivery Address */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                    Delivery Address
                  </h2>
                </div>
                <button
                  onClick={() => setLocationModalOpen(true)}
                  className="text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
                >
                  Change / Add New
                </button>
              </div>

              {currentAddress ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-slate-900 dark:text-white">
                        {currentAddress.title}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({currentAddress.recipient_name} · {currentAddress.phone})
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {currentAddress.street}, {currentAddress.area}, {currentAddress.city}
                    </p>
                    {currentAddress.landmark && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Landmark: {currentAddress.landmark}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLocationModalOpen(true)}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm flex items-center justify-center gap-2 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Select Delivery Address</span>
                </button>
              )}
            </div>

            {/* Step 2: Delivery Speed Option */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                  Delivery Speed & Slot
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryOption('EXPRESS_12_MINS')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    deliveryOption === 'EXPRESS_12_MINS'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        ⚡ Instant 10-15 Mins
                      </span>
                      <span className="text-xs font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded">
                        FASTEST
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Direct courier dispatch from closest local sellers.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryOption('SCHEDULED_TODAY')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    deliveryOption === 'SCHEDULED_TODAY'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Evening Slot (6 PM - 8 PM)
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Consolidated eco-friendly delivery this evening.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 3: Multi-Vendor Order Review */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">
                  3
                </span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                  Review Multi-Vendor Items ({cart.item_count})
                </h2>
              </div>

              <div className="space-y-4">
                {cart.vendor_groups.map((group, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>{group.vendor.name}</span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">
                        {group.delivery_fee === 0 ? 'Free Delivery' : `Delivery: Rs. ${group.delivery_fee}`}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                              {item.quantity}x
                            </span>
                            <span className="text-slate-800 dark:text-slate-300 truncate font-semibold">
                              {item.product.name} ({item.product.unit})
                            </span>
                          </div>
                          <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                            Rs. {item.total_price}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4: Payment Method Selection */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">
                  4
                </span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                  Select Payment Method
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'CASH_ON_DELIVERY'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      Cash on Delivery (COD)
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Pay cash or QR at your door
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('ESEWA')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'ESEWA'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0 font-extrabold text-sm">
                    eS
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      eSewa Mobile Wallet
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Instant digital gateway
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('KHALTI')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'KHALTI'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 font-extrabold text-sm">
                    Kh
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      Khalti Digital Wallet
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Seamless one-click pay
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'CARD'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600 shadow-2xs'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">
                      Debit / Credit Card
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Visa, Mastercard, SCT
                    </span>
                  </div>
                </button>
              </div>

              {/* Delivery instructions note */}
              <div className="pt-2">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">
                  Delivery instructions (optional)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Ring the bell twice, leave at door..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

          </div>

          {/* Right Column: Order Total & Confirm */}
          <div className="space-y-6">
            
            {/* Coupons Card */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Coupon Code</span>
              </div>

              {cart.coupon ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-sm text-emerald-900 dark:text-emerald-200">
                  <div>
                    <span className="font-bold">{cart.coupon.code}</span>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">{cart.coupon.description}</p>
                  </div>
                  <button onClick={removeCoupon} className="font-bold text-rose-600 dark:text-rose-400 text-sm cursor-pointer">
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. OYOFRESH20"
                    className="flex-1 px-3.5 py-2.5 text-sm uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-bold text-sm hover:bg-slate-800 dark:hover:bg-emerald-700 cursor-pointer"
                  >
                    Apply
                  </button>
                </form>
              )}
              {couponError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{couponError}</p>
              )}
            </div>

            {/* Bill Summary */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3 text-sm">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-100 dark:border-slate-800">
                Payment Summary
              </h3>

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Items Subtotal</span>
                <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">Rs. {cart.subtotal}</span>
              </div>

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery Fee</span>
                <span className="tabular-nums font-semibold">
                  {cart.delivery_fee === 0 ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">FREE</span>
                  ) : (
                    `Rs. ${cart.delivery_fee}`
                  )}
                </span>
              </div>

              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Platform & Packaging Fee</span>
                <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">Rs. {cart.handling_fee}</span>
              </div>

              {cart.coupon && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>Coupon Savings ({cart.coupon.code})</span>
                  <span className="tabular-nums">- Rs. {cart.coupon.discount_amount}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline text-base font-extrabold text-slate-900 dark:text-white">
                <span>Total Amount</span>
                <span className="text-2xl text-emerald-700 dark:text-emerald-400 tabular-nums font-extrabold">
                  Rs. {cart.total}
                </span>
              </div>

              {/* Confirm Order CTA */}
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submittingOrder}
                className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-base shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <span>{submittingOrder ? 'Verifying with Backend...' : `Confirm Order · Rs. ${cart.total}`}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="pt-2 text-xs text-slate-400 dark:text-slate-500 text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Encrypted & Server-Verified Transaction</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
