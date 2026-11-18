import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { cartItems, carts, coupons, productVariants } from '../../src/db/schema.ts';
import { AuthRequest, getEffectiveSessionKey, optionalAuth } from '../middleware/auth.ts';
import {
  calculateAndSerializeCart,
  computeCouponDiscount,
  getOrCreateCartRow,
  resolveProductByIdentifier,
} from '../services/catalogService.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// GET /api/v1/cart/
router.get(
  '/cart/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const sessionKey = getEffectiveSessionKey(req);
    const cart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    res.json(cart);
  })
);

// POST /api/v1/cart/items/
router.post(
  '/cart/items/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { product_id, quantity = 1, variant_id } = req.body as {
      product_id?: string;
      quantity?: number;
      variant_id?: string;
    };

    if (!product_id) {
      throw new ApiError(400, 'product_id is required.', 'MISSING_PRODUCT_ID');
    }
    const qty = Math.max(1, parseInt(String(quantity), 10) || 1);

    const productRow = await resolveProductByIdentifier(product_id);
    if (!productRow || !productRow.isActive || productRow.approvalStatus !== 'approved') {
      throw new ApiError(404, 'Product not found or unavailable.', 'PRODUCT_NOT_FOUND');
    }
    if (!productRow.inStock || productRow.stockCount <= 0) {
      throw new ApiError(409, `${productRow.name} is currently out of stock.`, 'OUT_OF_STOCK');
    }

    let resolvedVariantId: number | null = null;
    let unitPrice = productRow.price;
    let availableStock = productRow.stockCount;

    if (variant_id) {
      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productRow.id));
      const matched = variants.find(
        (v) =>
          v.externalKey === variant_id ||
          `var-${v.id}` === variant_id ||
          String(v.id) === String(variant_id)
      );
      if (matched) {
        resolvedVariantId = matched.id;
        unitPrice = matched.price;
        availableStock = Math.min(productRow.stockCount, matched.stock);
      }
    }

    const sessionKey = getEffectiveSessionKey(req);
    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);

    const existingItems = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.productId, productRow.id)));

    const matchingItem = existingItems.find(
      (i) => (i.variantId ?? null) === (resolvedVariantId ?? null)
    );

    const targetQty = (matchingItem?.quantity || 0) + qty;
    if (targetQty > availableStock) {
      throw new ApiError(
        409,
        `Only ${availableStock} unit(s) of "${productRow.name}" available in stock.`,
        'INSUFFICIENT_STOCK'
      );
    }

    if (matchingItem) {
      await db
        .update(cartItems)
        .set({
          quantity: targetQty,
          unitPriceSnapshot: unitPrice,
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, matchingItem.id));
    } else {
      await db.insert(cartItems).values({
        cartId: cartRow.id,
        productId: productRow.id,
        variantId: resolvedVariantId,
        quantity: qty,
        unitPriceSnapshot: unitPrice,
      });
    }

    const updatedCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    res.json(updatedCart);
  })
);

// PUT /api/v1/cart/items/:itemId/
router.put(
  '/cart/items/:itemId/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = req.params.itemId.replace(/^ci-/, '');
    const itemIdNum = parseInt(rawId, 10);
    if (Number.isNaN(itemIdNum)) {
      throw new ApiError(400, 'Invalid cart item id.', 'INVALID_CART_ITEM');
    }

    const quantity = parseInt(String(req.body.quantity ?? 1), 10);
    const sessionKey = getEffectiveSessionKey(req);
    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);

    const existing = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemIdNum), eq(cartItems.cartId, cartRow.id)))
      .limit(1);

    if (existing.length === 0) {
      throw new ApiError(404, 'Cart item not found.', 'CART_ITEM_NOT_FOUND');
    }

    if (quantity <= 0) {
      await db.delete(cartItems).where(eq(cartItems.id, itemIdNum));
    } else {
      const prodRows = await db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, existing[0].productId),
      });
      const maxStock = prodRows?.stockCount ?? 99;
      if (quantity > maxStock) {
        throw new ApiError(
          409,
          `Only ${maxStock} unit(s) available in stock.`,
          'INSUFFICIENT_STOCK'
        );
      }
      await db
        .update(cartItems)
        .set({ quantity, updatedAt: new Date() })
        .where(eq(cartItems.id, itemIdNum));
    }

    const updatedCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    res.json(updatedCart);
  })
);

// DELETE /api/v1/cart/items/:itemId/
router.delete(
  '/cart/items/:itemId/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const rawId = req.params.itemId.replace(/^ci-/, '');
    const itemIdNum = parseInt(rawId, 10);
    if (Number.isNaN(itemIdNum)) {
      throw new ApiError(400, 'Invalid cart item id.', 'INVALID_CART_ITEM');
    }

    const sessionKey = getEffectiveSessionKey(req);
    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);

    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemIdNum), eq(cartItems.cartId, cartRow.id)));

    const updatedCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    res.json(updatedCart);
  })
);

// DELETE /api/v1/cart/clear/
router.delete(
  '/cart/clear/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const sessionKey = getEffectiveSessionKey(req);
    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);
    await db.delete(cartItems).where(eq(cartItems.cartId, cartRow.id));
    await db
      .update(carts)
      .set({ appliedCouponCode: null, updatedAt: new Date() })
      .where(eq(carts.id, cartRow.id));

    const updatedCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    res.json(updatedCart);
  })
);

// POST /api/v1/coupons/apply/
router.post(
  '/coupons/apply/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const code = String(req.body.code || '')
      .trim()
      .toUpperCase();
    if (!code) {
      throw new ApiError(400, 'Coupon code is required.', 'MISSING_COUPON');
    }

    const couponRows = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    if (couponRows.length === 0 || !couponRows[0].isActive) {
      throw new ApiError(404, `Coupon code "${code}" is invalid or expired.`, 'INVALID_COUPON');
    }

    const couponRow = couponRows[0];
    const now = new Date();
    if (couponRow.expiresAt && couponRow.expiresAt < now) {
      throw new ApiError(400, `Coupon "${code}" has expired.`, 'COUPON_EXPIRED');
    }
    if (couponRow.usageLimit !== null && couponRow.usedCount >= couponRow.usageLimit) {
      throw new ApiError(400, `Coupon "${code}" usage limit reached.`, 'COUPON_EXHAUSTED');
    }

    const sessionKey = getEffectiveSessionKey(req);
    const currentCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);

    if (currentCart.subtotal < couponRow.minOrderAmount) {
      throw new ApiError(
        400,
        `Minimum order of Rs. ${couponRow.minOrderAmount} required to use ${code}.`,
        'COUPON_MIN_ORDER'
      );
    }

    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);
    await db
      .update(carts)
      .set({ appliedCouponCode: code, updatedAt: new Date() })
      .where(eq(carts.id, cartRow.id));

    const updatedCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    const discountAmount = computeCouponDiscount(
      couponRow,
      updatedCart.subtotal,
      updatedCart.delivery_fee
    );

    res.json({
      success: true,
      coupon: {
        code: couponRow.code,
        discount_amount: discountAmount,
        description: couponRow.description,
      },
      cart: updatedCart,
    });
  })
);

// DELETE /api/v1/coupons/remove/
router.delete(
  '/coupons/remove/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const sessionKey = getEffectiveSessionKey(req);
    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);
    await db
      .update(carts)
      .set({ appliedCouponCode: null, updatedAt: new Date() })
      .where(eq(carts.id, cartRow.id));

    const updatedCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    res.json({ success: true, cart: updatedCart });
  })
);

export default router;
