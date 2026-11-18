import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  cartItems,
  orderItems,
  orders,
  payments,
  products,
  refunds,
} from '../../src/db/schema.ts';
import {
  AuthRequest,
  getEffectiveSessionKey,
  optionalAuth,
  requireAuth,
} from '../middleware/auth.ts';
import { calculateAndSerializeCart, getOrCreateCartRow } from '../services/catalogService.ts';
import {
  cancelTransactionalOrder,
  createTransactionalOrder,
  resolveOrderByIdentifier,
  serializeOrder,
} from '../services/orderService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// POST /api/v1/checkout/validate/
router.post(
  '/checkout/validate/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const sessionKey = getEffectiveSessionKey(req);
    const cart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
    if (cart.items.length === 0) {
      throw new ApiError(400, 'Cart is empty.', 'EMPTY_CART');
    }
    for (const item of cart.items) {
      if (!item.product.in_stock || item.product.stock < item.quantity) {
        throw new ApiError(
          409,
          `Insufficient stock for ${item.product.name} (${item.product.stock} left).`,
          'INSUFFICIENT_STOCK'
        );
      }
    }
    res.json({
      valid: true,
      authoritative_cart: cart,
    });
  })
);

// GET /api/v1/orders/
router.get(
  '/orders/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const orderRows =
      req.authUser!.role === 'admin'
        ? await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100)
        : await db
            .select()
            .from(orders)
            .where(eq(orders.userId, req.authUser!.id))
            .orderBy(desc(orders.createdAt))
            .limit(50);

    const serialized = await Promise.all(orderRows.map((o) => serializeOrder(o)));
    res.json({
      count: serialized.length,
      next: null,
      previous: null,
      results: serialized,
    });
  })
);

// POST /api/v1/orders/
router.post(
  '/orders/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      address_id,
      delivery_address,
      payment_method,
      delivery_option,
      notes,
    } = req.body as {
      address_id?: string;
      delivery_address?: any;
      payment_method?: string;
      delivery_option?: string;
      notes?: string;
    };

    const sessionKey = getEffectiveSessionKey(req);
    const order = await createTransactionalOrder({
      sessionKey,
      authUser: req.authUser!,
      addressId: address_id,
      deliveryAddressPayload: delivery_address,
      paymentMethod: payment_method,
      deliveryOption: delivery_option,
      notes,
      ipAddress: req.ip,
    });

    res.status(201).json(order);
  })
);

// GET /api/v1/orders/:id/
router.get(
  '/orders/:id/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const orderRow = await resolveOrderByIdentifier(req.params.id);
    if (!orderRow) {
      throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }

    if (
      req.authUser!.role !== 'admin' &&
      req.authUser!.role !== 'delivery_agent' &&
      orderRow.userId !== req.authUser!.id
    ) {
      throw new ApiError(403, 'You do not have permission to view this order.', 'FORBIDDEN');
    }

    const serialized = await serializeOrder(orderRow);
    res.json(serialized);
  })
);

// POST /api/v1/orders/:id/cancel/
router.post(
  '/orders/:id/cancel/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const reason = String(req.body?.reason || 'Cancelled by customer').trim();
    const cancelled = await cancelTransactionalOrder(req.params.id, req.authUser!, reason);
    res.json(cancelled);
  })
);

// POST /api/v1/orders/:id/reorder/
router.post(
  '/orders/:id/reorder/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const orderRow = await resolveOrderByIdentifier(req.params.id);
    if (!orderRow) {
      throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && orderRow.userId !== req.authUser!.id) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id));
    const sessionKey = getEffectiveSessionKey(req);
    const cartRow = await getOrCreateCartRow(sessionKey, req.authUser!.id);

    let addedCount = 0;
    const skipped: string[] = [];

    for (const item of items) {
      if (!item.productId) {
        skipped.push(item.productName);
        continue;
      }
      const prodRows = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const pRow = prodRows[0];
      if (!pRow || !pRow.isActive || !pRow.inStock || pRow.stockCount <= 0) {
        skipped.push(item.productName);
        continue;
      }
      const qtyToAdd = Math.min(item.quantity, pRow.stockCount);
      const existingCartItem = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.productId, pRow.id)))
        .limit(1);

      if (existingCartItem.length > 0) {
        await db
          .update(cartItems)
          .set({
            quantity: Math.min(pRow.stockCount, existingCartItem[0].quantity + qtyToAdd),
            updatedAt: new Date(),
          })
          .where(eq(cartItems.id, existingCartItem[0].id));
      } else {
        await db.insert(cartItems).values({
          cartId: cartRow.id,
          productId: pRow.id,
          variantId: item.variantId,
          quantity: qtyToAdd,
          unitPriceSnapshot: pRow.price,
        });
      }
      addedCount += 1;
    }

    const cart = await calculateAndSerializeCart(sessionKey, req.authUser!.id);
    res.json({
      success: true,
      added_count: addedCount,
      skipped_items: skipped,
      cart,
    });
  })
);

// POST /api/v1/orders/:id/refund/
router.post(
  '/orders/:id/refund/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const orderRow = await resolveOrderByIdentifier(req.params.id);
    if (!orderRow) {
      throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && orderRow.userId !== req.authUser!.id) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }
    if (orderRow.status !== 'DELIVERED' && orderRow.paymentStatus !== 'PAID') {
      throw new ApiError(
        400,
        'Refund requests are only available for delivered or paid orders.',
        'REFUND_NOT_ELIGIBLE'
      );
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      throw new ApiError(400, 'Please provide a reason for your refund request.', 'MISSING_REASON');
    }
    const requestedAmount = req.body?.amount
      ? Math.min(orderRow.totalAmount, Math.max(1, Number(req.body.amount)))
      : orderRow.totalAmount;

    const paymentRow = (
      await db.select().from(payments).where(eq(payments.orderId, orderRow.id)).limit(1)
    )[0];

    const [createdRefund] = await db
      .insert(refunds)
      .values({
        orderId: orderRow.id,
        paymentId: paymentRow?.id ?? null,
        userId: req.authUser!.id,
        amount: requestedAmount,
        reason,
        status: 'requested',
      })
      .returning();

    await createNotification({
      roleScope: 'admin',
      title: `Refund Requested: ${orderRow.orderNumber}`,
      message: `${req.authUser!.fullName || 'Customer'} requested Rs. ${requestedAmount} refund: ${reason}`,
      type: 'refund',
      referenceUrl: '/admin',
    });

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
      action: 'REFUND_REQUESTED',
      entityType: 'refund',
      entityId: createdRefund.id,
      details: { orderId: orderRow.id, amount: requestedAmount, reason },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      refund: createdRefund,
    });
  })
);

export default router;
