import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useCartContext } from '../context/CartContext';
import { useLanguageContext } from '../context/LanguageContext';
import { useLocationContext } from '../context/LocationContext';
import { useToastContext } from '../context/ToastContext';
import { cartService, orderService, paymentService } from '../services';
import { ActiveCouponItem, PaymentMethod, PendingPaymentChallenge } from '../types';
import { calculateDistanceInKm } from '../utils';

export function useCheckout() {
  const navigate = useNavigate();
  const { cart, applyCoupon, removeCoupon, refreshCart, setCartDrawerOpen } = useCartContext();
  const { user, setLoginModalOpen } = useAuthContext();
  const { currentAddress, setLocationModalOpen, vendors } = useLocationContext();
  const { showToast } = useToastContext();
  const { language } = useLanguageContext();

  const [deliveryOption, setDeliveryOption] = useState<'EXPRESS_12_MINS' | 'SCHEDULED_TODAY'>('EXPRESS_12_MINS');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [orderNotes, setOrderNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');
  const [activeCoupons, setActiveCoupons] = useState<ActiveCouponItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [paymentChallenge, setPaymentChallenge] = useState<PendingPaymentChallenge | null>(null);

  // Hyperlocal delivery radius verification
  const { maxDistanceKm, maxAllowedExpressKm, isOutsideExpressZone } = useMemo(() => {
    if (!currentAddress || typeof currentAddress.lat !== 'number' || typeof currentAddress.lng !== 'number') {
      return { maxDistanceKm: 0, maxAllowedExpressKm: 15.0, isOutsideExpressZone: false };
    }

    const cartVendorIds = new Set<string>();
    if (cart?.vendor_groups) {
      cart.vendor_groups.forEach((g) => {
        if (g.vendor?.id) cartVendorIds.add(String(g.vendor.id));
      });
    }
    if (cart?.items) {
      cart.items.forEach((it) => {
        if (it.product?.vendor?.id) cartVendorIds.add(String(it.product.vendor.id));
      });
    }

    let maxDist = 0;
    let minAllowedExpress = 15.0;

    cartVendorIds.forEach((vId) => {
      const v = (vendors || []).find((vend) => String(vend.id) === vId || vend.slug === vId);
      if (v && typeof v.lat === 'number' && typeof v.lng === 'number') {
        const dist = calculateDistanceInKm(v.lat, v.lng, currentAddress.lat!, currentAddress.lng!);
        if (dist > maxDist) maxDist = dist;
        const vMax = typeof v.max_local_delivery_km === 'number' ? v.max_local_delivery_km : 15.0;
        if (vMax < minAllowedExpress) minAllowedExpress = vMax;
      }
    });

    const isOutside = maxDist > minAllowedExpress;
    return {
      maxDistanceKm: Math.round(maxDist * 10) / 10,
      maxAllowedExpressKm: minAllowedExpress,
      isOutsideExpressZone: isOutside,
    };
  }, [currentAddress, cart, vendors]);

  // If outside express zone, ensure standard delivery is selected
  useEffect(() => {
    if (isOutsideExpressZone && deliveryOption === 'EXPRESS_12_MINS') {
      setDeliveryOption('SCHEDULED_TODAY');
    }
  }, [isOutsideExpressZone, deliveryOption]);

  useEffect(() => {
    async function checkCart() {
      try {
        await orderService.validateCheckout();
        setValidationError('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Cart validation note';
        setValidationError(msg);
      }
    }
    if (cart && cart.items && cart.items.length > 0 && !paymentChallenge) {
      checkCart();
    }
  }, [cart?.item_count, paymentChallenge]);

  useEffect(() => {
    cartService
      .getActiveCoupons()
      .then((res: any) => {
        const list = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
        setActiveCoupons(list);
      })
      .catch(() => {});
  }, []);

  const handleApplyCoupon = useCallback(
    async (codeToApply?: string) => {
      const target = (codeToApply ?? couponCode).trim();
      if (!target) return;
      setCouponError('');
      try {
        await applyCoupon(target);
        if (!codeToApply) setCouponCode('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid coupon';
        setCouponError(msg);
      }
    },
    [applyCoupon, couponCode]
  );

  const handlePlaceOrder = useCallback(async () => {
    if (submittingOrder) return;

    if (!user) {
      showToast(
        language === 'ne' ? 'अर्डर गर्न कृपया पहिले लगइन गर्नुहोस्' : 'Please sign in to place your order',
        'info'
      );
      setLoginModalOpen(true);
      return;
    }
    if (!cart || !cart.items || cart.items.length === 0) {
      showToast('Your basket is empty. Please add items before checking out.', 'error');
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
      await orderService.validateCheckout();

      const newOrder = await orderService.createOrder({
        address_id: currentAddress.id,
        delivery_address: currentAddress,
        payment_method: paymentMethod,
        delivery_option: deliveryOption,
        notes: orderNotes,
      });

      if (!newOrder || !newOrder.id) {
        throw new Error('Order creation was not acknowledged by the server. Please check your past orders.');
      }

      setCartDrawerOpen(false);
      await refreshCart();

      if (paymentMethod !== 'CASH_ON_DELIVERY') {
        const init = await paymentService.initiatePayment(newOrder.id, paymentMethod);
        setPaymentChallenge({
          orderId: newOrder.id,
          orderNumber: newOrder.order_number,
          method: init.method,
          amount: init.amount,
          transactionUuid: init.transaction_uuid,
          signature: init.signature,
          productCode: init.product_code,
        });
        return;
      }

      showToast(
        language === 'ne' ? 'अर्डर सफल भयो!' : 'Order confirmed! Preparing your items.',
        'success'
      );
      navigate(`/orders/${newOrder.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place order';
      setValidationError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmittingOrder(false);
    }
  }, [
    cart,
    currentAddress,
    deliveryOption,
    language,
    navigate,
    orderNotes,
    paymentMethod,
    refreshCart,
    setCartDrawerOpen,
    setLocationModalOpen,
    setLoginModalOpen,
    showToast,
    submittingOrder,
    user,
  ]);

  const handleVerifyGateway = useCallback(async () => {
    if (!paymentChallenge) return;
    setVerifyingPayment(true);
    try {
      const res = await paymentService.verifyPayment({
        order_id: paymentChallenge.orderId,
        transaction_uuid: paymentChallenge.transactionUuid,
        signature: paymentChallenge.signature,
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment verification failed';
      showToast(msg, 'error');
    } finally {
      setVerifyingPayment(false);
    }
  }, [language, navigate, paymentChallenge, showToast]);

  return {
    cart,
    user,
    currentAddress,
    deliveryOption,
    setDeliveryOption,
    maxDistanceKm,
    maxAllowedExpressKm,
    isOutsideExpressZone,
    paymentMethod,
    setPaymentMethod,
    orderNotes,
    setOrderNotes,
    couponCode,
    setCouponCode,
    couponError,
    activeCoupons,
    submittingOrder,
    verifyingPayment,
    validationError,
    paymentChallenge,
    handleApplyCoupon,
    removeCoupon,
    handlePlaceOrder,
    handleVerifyGateway,
    setLoginModalOpen,
    setLocationModalOpen,
  };
}
