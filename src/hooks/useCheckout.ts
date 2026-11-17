import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useCartContext } from '../context/CartContext';
import { useLanguageContext } from '../context/LanguageContext';
import { useLocationContext } from '../context/LocationContext';
import { useToastContext } from '../context/ToastContext';
import { cartService, orderService, paymentService } from '../services';
import { ActiveCouponItem, PaymentMethod, PendingPaymentChallenge } from '../types';

export function useCheckout() {
  const navigate = useNavigate();
  const { cart, applyCoupon, removeCoupon, refreshCart, setCartDrawerOpen } = useCartContext();
  const { user, setLoginModalOpen } = useAuthContext();
  const { currentAddress, setLocationModalOpen } = useLocationContext();
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
    if (cart && cart.items.length > 0 && !paymentChallenge) {
      checkCart();
    }
  }, [cart?.item_count, paymentChallenge]);

  useEffect(() => {
    cartService.getActiveCoupons().then((res) => setActiveCoupons(res.results || [])).catch(() => {});
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
    if (!user) {
      showToast(
        language === 'ne' ? 'अर्डर गर्न कृपया पहिले लगइन गर्नुहोस्' : 'Please sign in to place your order',
        'info'
      );
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
      await orderService.validateCheckout();

      const newOrder = await orderService.createOrder({
        address_id: currentAddress.id,
        delivery_address: currentAddress,
        payment_method: paymentMethod,
        delivery_option: deliveryOption,
        notes: orderNotes,
      });

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
