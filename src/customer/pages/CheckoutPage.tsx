import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../shared/context/AppContext';
import { api } from '../../shared/services/api';
import { ActiveCouponItem } from '../../shared/types';
import {
  ShieldCheck,
  Clock,
  MapPin,
  CreditCard,
  Banknote,
  Store,
  Tag,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Plus,
  Lock,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

interface PendingPaymentChallenge {
  orderId: string;
  orderNumber: string;
  method: string;
  amount: number;
  transactionUuid: string;
  signature: string;
  productCode: string;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const {
    cart,
    user,
    setLoginModalOpen,
    currentAddress,
    setLocationModalOpen,
    applyCoupon,
    removeCoupon,
    showToast,
    refreshCart,
    setCartDrawerOpen,
    t,
    formatPrice,
    language
  } = useApp();

  const [deliveryOption, setDeliveryOption] = useState<'EXPRESS_12_MINS' | 'SCHEDULED_TODAY'>('EXPRESS_12_MINS');
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | 'CARD'>('CASH_ON_DELIVERY');
  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [activeCoupons, setActiveCoupons] = useState<ActiveCouponItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [paymentChallenge, setPaymentChallenge] = useState<PendingPaymentChallenge | null>(null);

  useEffect(() => {
    async function checkCart() {
      try {
        await api.validateCheckout();
        setValidationError('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Cart validation note';
        setValidationError(msg);
      }
    }
    if (cart && cart.items.length > 0 && !paymentChallenge) {
      checkCart();
    }
  }, [cart?.item_count, paymentChallenge]);

  useEffect(() => {
    api.getActiveCoupons().then(res => setActiveCoupons(res.results || [])).catch(() => {});
  }, []);

  if (paymentChallenge) {
    const handleVerifyGateway = async () => {
      setVerifyingPayment(true);
      try {
        const res = await api.verifyPayment({
          order_id: paymentChallenge.orderId,
          transaction_uuid: paymentChallenge.transactionUuid,
          signature: paymentChallenge.signature
        });
        if (res.success) {
          showToast(
            language === 'ne'
              ? `भुक्तानी प्रमाणित भयो (${paymentChallenge.method})! अर्डर पठाइँदैछ।`
              : `Payment verified via HMAC (${paymentChallenge.method})! Order confirmed.`,
            'success'
          );
          navigate(`/orders/${paymentChallenge.orderId}`);
        }
      } catch (err: any) {
        showToast(err?.message || 'Payment verification failed', 'error');
      } finally {
        setVerifyingPayment(false);
      }
    };

    return (
      <div className="min-h-screen w-full bg-slate-50 dark:bg-[#090D16] py-12 px-4">
        <div className="max-w-lg mx-auto bg-white dark:bg-[#111726] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="text-center space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {paymentChallenge.method} · HMAC-SHA256 Gateway
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display">
              {language === 'ne' ? 'भुक्तानी प्रमाणीकरण पूरा गर्नुहोस्' : 'Verify & Authorize Payment'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Order <strong>{paymentChallenge.orderNumber}</strong>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Payable Amount</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-lg">
                {formatPrice(paymentChallenge.amount)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Transaction UUID</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
                {paymentChallenge.transactionUuid}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Merchant Code</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">{paymentChallenge.productCode}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={verifyingPayment}
            onClick={handleVerifyGateway}
            className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
          >
            {verifyingPayment ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            <span>{verifyingPayment ? 'Verifying Signature...' : `Confirm & Verify ${paymentChallenge.method} Payment`}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/orders/${paymentChallenge.orderId}`)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            {language === 'ne' ? 'अर्डर ट्र्याक पृष्ठमा जानुहोस्' : 'Continue to Order Tracking (Pending Payment)'}
          </button>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('checkout.emptyTitle')}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6">{t('checkout.emptySub')}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-full bg-emerald-600 text-white font-bold text-xs cursor-pointer"
        >
          {t('checkout.browseMarketplace')}
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
    if (!user) {
      showToast(language === 'ne' ? 'अर्डर गर्न कृपया पहिले लगइन गर्नुहोस्' : 'Please sign in to place your order', 'info');
      setLoginModalOpen(true);
      return;
    }
    if (!currentAddress) {
      showToast('Please select or add a delivery address', 'error');
      setLocationModalOpen(true);
      return;
    }

    setSubmittingOrder(true);
    setValidationError('');

    try {
      await api.validateCheckout();

      const newOrder = await api.createOrder({
        address_id: currentAddress.id,
        delivery_address: currentAddress,
        payment_method: paymentMethod,
        delivery_option: deliveryOption,
        notes: orderNotes
      });

      setCartDrawerOpen(false);
      await refreshCart();

      if (paymentMethod !== 'CASH_ON_DELIVERY') {
        const init = await api.initiatePayment(newOrder.id, paymentMethod);
        setPaymentChallenge({
          orderId: newOrder.id,
          orderNumber: newOrder.order_number,
          method: init.method,
          amount: init.amount,
          transactionUuid: init.transaction_uuid,
          signature: init.signature,
          productCode: init.product_code
        });
        return;
      }

      showToast(language === 'ne' ? 'अर्डर सफल भयो!' : 'Order confirmed! Preparing your items.', 'success');
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
                {t('checkout.title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('checkout.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-3.5 py-2 rounded-xl font-bold border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('checkout.secureBadge')}</span>
          </div>
        </div>

        {!user && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {language === 'ne' ? 'अर्डर पूरा गर्न ग्राहक खातामा लगइन गर्नुहोस्।' : 'Sign in to your customer account to save your delivery address and place this order.'}
            </span>
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm cursor-pointer shrink-0"
            >
              {t('header.signIn')}
            </button>
          </div>
        )}

        {validationError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1 */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">1</span>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">{t('checkout.step1Title')}</h2>
                </div>
                <button
                  onClick={() => setLocationModalOpen(true)}
                  className="text-sm font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  {t('checkout.changeAddAddress')}
                </button>
              </div>

              {currentAddress ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-slate-900 dark:text-white">{currentAddress.title}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({currentAddress.recipient_name} · {currentAddress.phone})
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {currentAddress.street}, {currentAddress.area}, {currentAddress.city}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLocationModalOpen(true)}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('checkout.selectAddress')}</span>
                </button>
              )}
            </div>

            {/* Step 2 */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">2</span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">{t('checkout.step2Title')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryOption('EXPRESS_12_MINS')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    deliveryOption === 'EXPRESS_12_MINS'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{t('checkout.instantTitle')}</span>
                      <span className="text-xs font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded">{t('checkout.fastestBadge')}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('checkout.instantSub')}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryOption('SCHEDULED_TODAY')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    deliveryOption === 'SCHEDULED_TODAY'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600'
                      : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{t('checkout.eveningTitle')}</span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('checkout.eveningSub')}</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">3</span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">
                  {t('checkout.step3Title', { count: cart.item_count })}
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
                        {group.delivery_fee === 0 ? t('common.freeDelivery') : t('cart.deliveryLabel', { amount: formatPrice(group.delivery_fee) })}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-slate-800 dark:text-slate-300 truncate font-semibold">
                            {item.quantity}x {item.product.name} ({item.product.unit})
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">{formatPrice(item.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-sm flex items-center justify-center">4</span>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wide">{t('checkout.step4Title')}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH_ON_DELIVERY')}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'CASH_ON_DELIVERY' ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600' : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">{t('checkout.codTitle')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('checkout.codSub')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('ESEWA')}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'ESEWA' ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600' : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center shrink-0 font-extrabold text-sm">eS</div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">{t('checkout.esewaTitle')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('checkout.esewaSub')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('KHALTI')}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'KHALTI' ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600' : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 font-extrabold text-sm">Kh</div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">{t('checkout.khaltiTitle')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('checkout.khaltiSub')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-4 rounded-2xl border text-left flex items-center gap-3 cursor-pointer ${
                    paymentMethod === 'CARD' ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-600' : 'bg-white dark:bg-[#0f1422] border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white block">{t('checkout.cardTitle')}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('checkout.cardSub')}</span>
                  </div>
                </button>
              </div>

              <div className="pt-2">
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 block mb-1.5">{t('checkout.notesLabel')}</label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder={t('checkout.notesPlaceholder')}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t('checkout.couponTitle')}</span>
              </div>

              {cart.coupon ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-sm text-emerald-900 dark:text-emerald-200">
                  <div>
                    <span className="font-bold">{cart.coupon.code}</span>
                    <p className="text-xs text-emerald-800 dark:text-emerald-300">{cart.coupon.description}</p>
                  </div>
                  <button onClick={removeCoupon} className="font-bold text-rose-600 dark:text-rose-400 text-sm cursor-pointer">
                    {t('common.remove')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder={language === 'ne' ? 'कुपन कोड राख्नुहोस्' : 'Enter coupon code'}
                      className="flex-1 px-3.5 py-2.5 text-sm uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                    />
                    <button type="submit" className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-bold text-sm cursor-pointer">
                      {t('common.apply')}
                    </button>
                  </form>
                  {activeCoupons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {activeCoupons.map((cp) => (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={async () => {
                            setCouponError('');
                            try {
                              await applyCoupon(cp.code);
                            } catch (err: unknown) {
                              setCouponError(err instanceof Error ? err.message : 'Coupon unavailable');
                            }
                          }}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer"
                          title={cp.description}
                        >
                          {cp.code} · {cp.discount_type === 'percentage' ? `${cp.discount_value}%` : formatPrice(cp.discount_value)} OFF
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {couponError && <p className="text-xs text-rose-600 font-semibold">{couponError}</p>}
            </div>

            <div className="bg-white dark:bg-[#111726] rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3 text-sm">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white uppercase tracking-wide pb-2 border-b border-slate-100 dark:border-slate-800">
                {t('checkout.paymentSummary')}
              </h3>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('checkout.itemsSubtotal')}</span>
                <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('checkout.deliveryFee')}</span>
                <span className="tabular-nums font-semibold">
                  {cart.delivery_fee === 0 ? <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('common.free')}</span> : formatPrice(cart.delivery_fee)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>{t('checkout.platformFee')}</span>
                <span className="tabular-nums font-semibold text-slate-800 dark:text-slate-200">{formatPrice(cart.handling_fee)}</span>
              </div>
              {cart.coupon && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                  <span>{t('checkout.couponSavings', { code: cart.coupon.code })}</span>
                  <span className="tabular-nums">- {formatPrice(cart.coupon.discount_amount)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline text-base font-extrabold text-slate-900 dark:text-white">
                <span>{t('checkout.totalAmount')}</span>
                <span className="text-2xl text-emerald-700 dark:text-emerald-400 tabular-nums font-extrabold">{formatPrice(cart.total)}</span>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={submittingOrder}
                className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-md flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {submittingOrder ? t('checkout.verifying') : t('checkout.confirmOrder', { amount: formatPrice(cart.total) })}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="pt-2 text-xs text-slate-400 text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('checkout.encryptedNote')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
