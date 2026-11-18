import { Router } from 'express';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { orders, payments, paymentTransactions } from '../../src/db/schema.ts';
import { ENV } from '../config/env.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { resolveOrderByIdentifier } from '../services/orderService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { signGatewayPayload, verifyGatewaySignature } from '../utils/crypto.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// POST /api/v1/payments/initiate/
router.post(
  '/payments/initiate/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { order_id, method } = req.body as { order_id?: string; method?: string };
    if (!order_id) {
      throw new ApiError(400, 'order_id is required.', 'MISSING_ORDER_ID');
    }

    const orderRow = await resolveOrderByIdentifier(order_id);
    if (!orderRow) {
      throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && orderRow.userId !== req.authUser!.id) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }

    const resolvedMethod = (method || orderRow.paymentMethod || 'ESEWA').toUpperCase();
    const transactionUuid = `${orderRow.orderNumber}-${crypto.randomBytes(3).toString('hex')}`;

    let paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderRow.id))
      .limit(1);

    let paymentRow = paymentRows[0];
    if (!paymentRow) {
      [paymentRow] = await db
        .insert(payments)
        .values({
          orderId: orderRow.id,
          userId: req.authUser!.id,
          method: resolvedMethod,
          provider: resolvedMethod.toLowerCase(),
          amount: orderRow.totalAmount,
          currency: 'NPR',
          status: 'initiated',
          gatewayRefId: transactionUuid,
        })
        .returning();
    } else {
      [paymentRow] = await db
        .update(payments)
        .set({
          method: resolvedMethod,
          provider: resolvedMethod.toLowerCase(),
          status: paymentRow.status === 'paid' ? 'paid' : 'initiated',
          gatewayRefId: transactionUuid,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRow.id))
        .returning();
    }

    const signedFields = {
      total_amount: orderRow.totalAmount,
      transaction_uuid: transactionUuid,
      product_code: ENV.ESEWA_MERCHANT_CODE,
    };
    const signature = signGatewayPayload(signedFields, ENV.ESEWA_SECRET_KEY);

    await db.insert(paymentTransactions).values({
      paymentId: paymentRow.id,
      transactionType: 'initiate',
      gatewayTransactionId: transactionUuid,
      status: 'initiated',
      amount: orderRow.totalAmount,
      signatureVerified: true,
      rawPayload: { ...signedFields, signature },
    });

    res.json({
      success: true,
      payment_id: paymentRow.id,
      order_id: orderRow.externalKey || `ord-${orderRow.id}`,
      order_number: orderRow.orderNumber,
      method: resolvedMethod,
      amount: orderRow.totalAmount,
      currency: 'NPR',
      transaction_uuid: transactionUuid,
      product_code: ENV.ESEWA_MERCHANT_CODE,
      signature,
      mode: resolvedMethod === 'CASH_ON_DELIVERY' ? 'cod' : 'sandbox_signed_verification',
    });
  })
);

// POST /api/v1/payments/verify/
// Requires cryptographic HMAC signature matching the server-issued payment initiation payload.
router.post(
  '/payments/verify/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { order_id, transaction_uuid, signature, gateway_ref } = req.body as {
      order_id?: string;
      transaction_uuid?: string;
      signature?: string;
      gateway_ref?: string;
    };

    if (!order_id || !transaction_uuid || !signature) {
      throw new ApiError(
        400,
        'order_id, transaction_uuid, and signature are required to verify payment.',
        'MISSING_VERIFICATION_FIELDS'
      );
    }

    const orderRow = await resolveOrderByIdentifier(order_id);
    if (!orderRow) {
      throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && orderRow.userId !== req.authUser!.id) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderRow.id))
      .limit(1);
    const paymentRow = paymentRows[0];
    if (!paymentRow) {
      throw new ApiError(404, 'Payment record not found for this order.', 'PAYMENT_NOT_FOUND');
    }

    const expectedPayload = {
      total_amount: paymentRow.amount,
      transaction_uuid,
      product_code: ENV.ESEWA_MERCHANT_CODE,
    };
    const isValid = verifyGatewaySignature(expectedPayload, signature, ENV.ESEWA_SECRET_KEY);

    if (!isValid || (paymentRow.gatewayRefId && paymentRow.gatewayRefId !== transaction_uuid)) {
      await db.insert(paymentTransactions).values({
        paymentId: paymentRow.id,
        transactionType: 'verify',
        gatewayTransactionId: transaction_uuid,
        status: 'failed',
        amount: paymentRow.amount,
        signatureVerified: false,
        rawPayload: { transaction_uuid, gateway_ref, error: 'HMAC signature mismatch' },
      });
      throw new ApiError(
        400,
        'Payment signature verification failed. Order remains unpaid.',
        'INVALID_PAYMENT_SIGNATURE'
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: 'paid',
          gatewayRefId: gateway_ref || transaction_uuid,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRow.id));

      await tx
        .update(orders)
        .set({
          paymentStatus: 'PAID',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderRow.id));

      await tx.insert(paymentTransactions).values({
        paymentId: paymentRow.id,
        transactionType: 'verify',
        gatewayTransactionId: gateway_ref || transaction_uuid,
        status: 'paid',
        amount: paymentRow.amount,
        signatureVerified: true,
        rawPayload: expectedPayload,
      });
    });

    await createNotification({
      userId: orderRow.userId,
      roleScope: 'customer',
      title: `Payment Confirmed for ${orderRow.orderNumber}`,
      message: `Rs. ${paymentRow.amount} verified via ${paymentRow.method}.`,
      type: 'payment',
      referenceUrl: `/orders/${orderRow.id}`,
    });

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
      action: 'PAYMENT_VERIFIED',
      entityType: 'payment',
      entityId: paymentRow.id,
      details: { orderId: orderRow.id, amount: paymentRow.amount, method: paymentRow.method },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      payment_status: 'PAID',
      transaction_uuid,
      order_number: orderRow.orderNumber,
    });
  })
);

// POST /api/v1/payments/webhook/ (Server-to-server signed webhook endpoint)
router.post(
  '/payments/webhook/',
  asyncHandler(async (req, res) => {
    const { transaction_uuid, total_amount, product_code, signature, status } = req.body as {
      transaction_uuid?: string;
      total_amount?: number;
      product_code?: string;
      signature?: string;
      status?: string;
    };

    if (!transaction_uuid || !total_amount || !signature) {
      throw new ApiError(400, 'Malformed webhook payload.', 'INVALID_WEBHOOK');
    }

    const valid = verifyGatewaySignature(
      {
        total_amount: Number(total_amount),
        transaction_uuid,
        product_code: product_code || ENV.ESEWA_MERCHANT_CODE,
      },
      signature,
      ENV.ESEWA_SECRET_KEY
    );

    if (!valid) {
      throw new ApiError(401, 'Invalid webhook HMAC signature.', 'INVALID_SIGNATURE');
    }

    const pRows = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayRefId, transaction_uuid))
      .limit(1);
    if (pRows.length === 0) {
      throw new ApiError(404, 'Matching payment not found.', 'PAYMENT_NOT_FOUND');
    }

    const nextStatus = status === 'COMPLETE' ? 'paid' : 'failed';
    await db
      .update(payments)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(payments.id, pRows[0].id));

    if (nextStatus === 'paid') {
      await db
        .update(orders)
        .set({ paymentStatus: 'PAID', updatedAt: new Date() })
        .where(eq(orders.id, pRows[0].orderId));
    }

    await db.insert(paymentTransactions).values({
      paymentId: pRows[0].id,
      transactionType: 'webhook',
      gatewayTransactionId: transaction_uuid,
      status: nextStatus,
      amount: Number(total_amount),
      signatureVerified: true,
      rawPayload: req.body,
    });

    res.json({ received: true, status: nextStatus });
  })
);

export default router;
