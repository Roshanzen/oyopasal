import { useCallback, useState } from 'react';
import { useCartContext } from '../context/CartContext';
import { cartService } from '../services';
import { ActiveCouponItem } from '../types';

export function useCart() {
  const cartCtx = useCartContext();
  const [activeCoupons, setActiveCoupons] = useState<ActiveCouponItem[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsError, setCouponsError] = useState('');

  const loadActiveCoupons = useCallback(async () => {
    setCouponsLoading(true);
    setCouponsError('');
    try {
      const res = await cartService.getActiveCoupons();
      setActiveCoupons(res.results || []);
    } catch (err) {
      setCouponsError(err instanceof Error ? err.message : 'Unable to load available coupons');
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  return {
    ...cartCtx,
    activeCoupons,
    couponsLoading,
    couponsError,
    loadActiveCoupons,
  };
}
