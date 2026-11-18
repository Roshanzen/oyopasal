import crypto from 'crypto';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  addresses,
  cartItems,
  carts,
  couponRedemptions,
  coupons,
  deliveryAgents,
  deliveryAssignments,
  deliveryTrackingEvents,
  financialLedger,
  inventoryMovements,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  paymentTransactions,
  productVariants,
  products,
  refunds,
  users,
  vendorFulfillments,
  vendors,
} from '../../src/db/schema.ts';
import { AuthenticatedUser } from '../middleware/auth.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { ApiError } from '../utils/errors.ts';
import {
  computeCouponDiscount,
  getOrCreateCartRow,
  getPlatformFeesConfig,
  resolveProductByIdentifier,
} from './catalogService.ts';

export async function resolveOrderByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const byKey = await db
    .select()
    .from(orders)
    .where(or(eq(orders.externalKey, trimmed), eq(orders.orderNumber, trimmed)))
    .limit(1);
  if (byKey.length > 0) return byKey[0];

  const numericMatch = /^(\d+)$/.exec(trimmed) || /^ord-(\d+)$/.exec(trimmed);
  if (numericMatch) {
    const id = parseInt(numericMatch[1], 10);
    const byId = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (byId.length > 0) return byId[0];
  }
  return null;
}

export async function serializeOrder(orderRow: typeof orders.$inferSelect) {
  const [itemRows, fulfillmentRows, historyRows, assignmentRows, trackingRows, refundRows, paymentRows] =
    await Promise.all([
      db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id)),
      db.select().from(vendorFulfillments).where(eq(vendorFulfillments.orderId, orderRow.id)),
      db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, orderRow.id))
        .orderBy(orderStatusHistory.id),
      db.select().from(deliveryAssignments).where(eq(deliveryAssignments.orderId, orderRow.id)).limit(1),
      db
        .select()
        .from(deliveryTrackingEvents)
        .where(eq(deliveryTrackingEvents.orderId, orderRow.id))
        .orderBy(desc(deliveryTrackingEvents.id))
        .limit(20),
      db.select().from(refunds).where(eq(refunds.orderId, orderRow.id)),
      db.select().from(payments).where(eq(payments.orderId, orderRow.id)).limit(1),
    ]);

  const vendorIds = Array.from(
    new Set(
      [
        ...fulfillmentRows.map((f) => f.vendorId),
        ...itemRows.map((i) => i.vendorId).filter((v): v is number => v !== null),
      ]
    )
  );
  const vendorRows =
    vendorIds.length > 0 ? await db.select().from(vendors).where(inArray(vendors.id, vendorIds)) : [];
  const vendorMap = new Map(vendorRows.map((v) => [v.id, v]));

  const itemsByVendorMap = new Map<
    string,
    {
      vendor: { id: string; name: string; lat?: number; lng?: number; area?: string };
      fulfillment_status: string;
      fulfillment_id?: number;
      items: {
        id: number;
        product_id: string | null;
        product_name: string;
        unit: string;
        quantity: number;
        unit_price: number;
        total: number;
        image_url: string;
      }[];
      vendor_delivery_fee: number;
    }
  >();

  for (const item of itemRows) {
    const vRow = item.vendorId ? vendorMap.get(item.vendorId) : undefined;
    const vExtId = vRow?.externalKey || (item.vendorId ? `v-${item.vendorId}` : 'v-himalayan');
    const vName = vRow?.name || orderRow.vendorName || 'OyoPasal Partner';
    const matchingFulfillment = fulfillmentRows.find((f) => f.id === item.vendorFulfillmentId || f.vendorId === item.vendorId);

    if (!itemsByVendorMap.has(vExtId)) {
      itemsByVendorMap.set(vExtId, {
        vendor: {
          id: vExtId,
          name: vName,
          lat: vRow ? parseFloat(vRow.lat) : undefined,
          lng: vRow ? parseFloat(vRow.lng) : undefined,
          area: vRow?.area,
        },
        fulfillment_status: matchingFulfillment?.status || orderRow.status,
        fulfillment_id: matchingFulfillment?.id,
        items: [],
        vendor_delivery_fee: matchingFulfillment?.deliveryFee || 0,
      });
    }

    itemsByVendorMap.get(vExtId)!.items.push({
      id: item.id,
      product_id: item.productId ? `prod-${item.productId}` : null,
      product_name: item.productName,
      unit: item.unit || '1 pc',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.totalPrice,
      image_url: item.image || '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    });
  }

  let agentDetails: {
    id: number;
    full_name: string;
    phone: string;
    vehicle_type: string;
    vehicle_number: string;
    rating: number;
  } | null = null;

  const assignment = assignmentRows[0] || null;
  if (assignment?.agentId) {
    const agentRows = await db
      .select()
      .from(deliveryAgents)
      .where(eq(deliveryAgents.id, assignment.agentId))
      .limit(1);
    if (agentRows.length > 0) {
      agentDetails = {
        id: agentRows[0].id,
        full_name: agentRows[0].fullName,
        phone: agentRows[0].phone,
        vehicle_type: agentRows[0].vehicleType,
        vehicle_number: agentRows[0].vehicleNumber,
        rating: parseFloat(agentRows[0].rating || '4.9'),
      };
    }
  }

  const timelineSteps = ['ORDER_PLACED', 'PACKED_BY_VENDOR', 'RIDER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIdx = timelineSteps.indexOf(orderRow.status);
  const historyMap = new Map(historyRows.map((h) => [h.status, h]));

  const defaultDescriptions: Record<string, { title: string; desc: string }> = {
    ORDER_PLACED: {
      title: 'Order Placed',
      desc: 'Order confirmed and sent to neighborhood store.',
    },
    PACKED_BY_VENDOR: {
      title: 'Packed by Vendor',
      desc: 'Your fresh items are quality-checked & sealed.',
    },
    RIDER_ASSIGNED: {
      title: 'Rider Assigned',
      desc: agentDetails ? `${agentDetails.full_name} assigned for pickup.` : 'Assigning nearest delivery partner.',
    },
    OUT_FOR_DELIVERY: {
      title: 'Out for Delivery',
      desc: 'Rider is on the way to your address.',
    },
    DELIVERED: {
      title: 'Delivered',
      desc: 'Delivered safely to your doorstep.',
    },
  };

  const trackingUpdates =
    orderRow.status === 'CANCELLED'
      ? historyRows.map((h) => ({
          timestamp: h.createdAt ? new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          title: h.title,
          description: h.description,
          done: true,
        }))
      : timelineSteps.map((st, idx) => {
          const hist = historyMap.get(st);
          const done = currentIdx >= idx;
          return {
            timestamp: hist?.createdAt
              ? new Date(hist.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : done
              ? 'Completed'
              : 'Pending',
            title: hist?.title || defaultDescriptions[st].title,
            description: hist?.description || defaultDescriptions[st].desc,
            done,
          };
        });

  return {
    id: orderRow.externalKey || `ord-${orderRow.id}`,
    db_id: orderRow.id,
    order_number: orderRow.orderNumber,
    created_at: orderRow.createdAt ? new Date(orderRow.createdAt).toISOString() : new Date().toISOString(),
    status: orderRow.status,
    estimated_delivery_mins: orderRow.estimatedMinutes,
    delivery_address: {
      id: orderRow.addressId ? `addr-${orderRow.addressId}` : 'addr-order',
      title: orderRow.deliveryTitle || 'Home',
      recipient_name: orderRow.recipientName,
      phone: orderRow.recipientPhone,
      street: orderRow.deliveryAddress,
      area: orderRow.deliveryArea,
      city: orderRow.deliveryCity,
      landmark: orderRow.deliveryLandmark || '',
      is_default: true,
      lat: orderRow.deliveryLat ? parseFloat(orderRow.deliveryLat) : 27.6986,
      lng: orderRow.deliveryLng ? parseFloat(orderRow.deliveryLng) : 85.3292,
    },
    delivery_option: orderRow.deliveryOption,
    payment_method: orderRow.paymentMethod,
    payment_status: orderRow.paymentStatus,
    payment_id: paymentRows[0]?.id ?? null,
    items_by_vendor: Array.from(itemsByVendorMap.values()),
    subtotal: orderRow.subtotal,
    delivery_fee: orderRow.deliveryFee,
    handling_fee: orderRow.handlingFee,
    coupon_discount: orderRow.discount,
    total_amount: orderRow.totalAmount,
    tracking_updates: trackingUpdates,
    delivery_assignment: assignment
      ? {
          id: assignment.id,
          status: assignment.status,
          pickup_lat: assignment.pickupLat ? parseFloat(assignment.pickupLat) : null,
          pickup_lng: assignment.pickupLng ? parseFloat(assignment.pickupLng) : null,
          dropoff_lat: assignment.dropoffLat ? parseFloat(assignment.dropoffLat) : null,
          dropoff_lng: assignment.dropoffLng ? parseFloat(assignment.dropoffLng) : null,
          current_lat: assignment.currentLat ? parseFloat(assignment.currentLat) : null,
          current_lng: assignment.currentLng ? parseFloat(assignment.currentLng) : null,
          speed_kmh: assignment.speedKmh,
          eta_minutes: assignment.etaMinutes,
          agent: agentDetails,
          updated_at: assignment.updatedAt ? new Date(assignment.updatedAt).toISOString() : null,
        }
      : null,
    tracking_events: trackingRows.map((ev) => ({
      id: ev.id,
      lat: parseFloat(ev.lat),
      lng: parseFloat(ev.lng),
      speed_kmh: ev.speedKmh,
      heading: ev.heading,
      status_note: ev.statusNote,
      recorded_at: ev.recordedAt ? new Date(ev.recordedAt).toISOString() : null,
    })),
    refunds: refundRows.map((rf) => ({
      id: rf.id,
      amount: rf.amount,
      reason: rf.reason,
      status: rf.status,
      admin_note: rf.adminNote,
      created_at: rf.createdAt ? new Date(rf.createdAt).toISOString() : null,
    })),
  };
}

export async function createTransactionalOrder(params: {
  sessionKey: string;
  authUser: AuthenticatedUser;
  addressId?: string;
  deliveryAddressPayload?: {
    title?: string;
    recipient_name?: string;
    phone?: string;
    street?: string;
    area?: string;
    city?: string;
    landmark?: string;
    lat?: number;
    lng?: number;
  };
  paymentMethod?: string;
  deliveryOption?: string;
  notes?: string;
  ipAddress?: string;
  directItems?: { product_id: string; quantity: number; variant_id?: string }[];
  couponCodeOverride?: string | null;
}) {
  const { authUser, sessionKey } = params;
  const isDirectOrder = Array.isArray(params.directItems) && params.directItems.length > 0;
  const cartRow = isDirectOrder ? null : await getOrCreateCartRow(sessionKey, authUser.id);
  const feeConfig = await getPlatformFeesConfig();

  // Resolve address
  let addrRecord: typeof addresses.$inferSelect | null = null;
  if (params.addressId) {
    const numericMatch = /^(\d+)$/.exec(params.addressId) || /^addr-(\d+)$/.exec(params.addressId);
    if (numericMatch) {
      const addrIdNum = parseInt(numericMatch[1], 10);
      const found = await db
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, addrIdNum), eq(addresses.userId, authUser.id)))
        .limit(1);
      if (found.length > 0) addrRecord = found[0];
    }
  }
  if (!addrRecord && !params.deliveryAddressPayload) {
    const fallback = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, authUser.id))
      .orderBy(desc(addresses.isDefault), desc(addresses.id))
      .limit(1);
    if (fallback.length > 0) addrRecord = fallback[0];
  }

  const deliveryStreet =
    params.deliveryAddressPayload?.street || addrRecord?.street || 'New Baneshwor Chowk';
  const deliveryArea = params.deliveryAddressPayload?.area || addrRecord?.area || 'New Baneshwor';
  const deliveryCity = params.deliveryAddressPayload?.city || addrRecord?.city || 'Kathmandu';
  const deliveryLandmark = params.deliveryAddressPayload?.landmark || addrRecord?.landmark || '';
  const deliveryTitle = params.deliveryAddressPayload?.title || addrRecord?.title || 'Home';
  const recipientName =
    params.deliveryAddressPayload?.recipient_name ||
    addrRecord?.recipientName ||
    authUser.fullName ||
    'Customer';
  const recipientPhone =
    params.deliveryAddressPayload?.phone || addrRecord?.phone || authUser.phone || '+977 9800000000';
  const deliveryLat = String(
    params.deliveryAddressPayload?.lat ?? (addrRecord?.lat || '27.6986')
  );
  const deliveryLng = String(
    params.deliveryAddressPayload?.lng ?? (addrRecord?.lng || '85.3292')
  );

  const paymentMethod = (params.paymentMethod || 'CASH_ON_DELIVERY').toUpperCase();
  const deliveryOption = (params.deliveryOption || 'EXPRESS_12_MINS').toUpperCase();

  const createdOrder = await db.transaction(async (tx) => {
    let rawCartItems: { productId: number; variantId: number | null; quantity: number }[] = [];
    if (isDirectOrder && params.directItems) {
      for (const di of params.directItems) {
        const resolved = await resolveProductByIdentifier(String(di.product_id));
        if (!resolved) {
          throw new ApiError(404, `Product "${di.product_id}" not found.`, 'PRODUCT_NOT_FOUND');
        }
        rawCartItems.push({
          productId: resolved.id,
          variantId: null,
          quantity: Math.max(1, Math.round(Number(di.quantity) || 1)),
        });
      }
    } else if (cartRow) {
      const dbCartItems = await tx
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cartRow.id))
        .orderBy(cartItems.id);
      rawCartItems = dbCartItems.map((ci) => ({
        productId: ci.productId,
        variantId: ci.variantId,
        quantity: ci.quantity,
      }));
    }

    if (rawCartItems.length === 0) {
      throw new ApiError(400, 'Your cart is empty. Add items before placing an order.', 'EMPTY_CART');
    }

    let subtotal = 0;
    const validatedLines: {
      cartItem: { productId: number; variantId: number | null; quantity: number };
      product: {
        id: number;
        name: string;
        price: number;
        stockCount: number;
        inStock: boolean;
        vendorId: number;
        vendorName: string;
        image: string;
        unit: string;
        approvalStatus: string;
        isActive: boolean;
      };
      variant: { id: number; name: string; unit: string; price: number; stock: number } | null;
      unitPrice: number;
      lineTotal: number;
    }[] = [];

    const vendorMap = new Map<number, typeof vendors.$inferSelect>();

    for (const ci of rawCartItems) {
      // Lock product row in PostgreSQL to guarantee concurrent oversell safety
      const lockedResult = await tx.execute(sql`
        SELECT id, name, price, stock_count, in_stock, vendor_id, vendor_name, image, unit, approval_status, is_active
        FROM products
        WHERE id = ${ci.productId}
        FOR UPDATE
      `);
      const pRow = lockedResult.rows[0] as
        | {
            id: number;
            name: string;
            price: number;
            stock_count: number;
            in_stock: boolean;
            vendor_id: number | null;
            vendor_name: string;
            image: string;
            unit: string;
            approval_status: string;
            is_active: boolean;
          }
        | undefined;

      if (!pRow || !pRow.is_active || pRow.approval_status !== 'approved') {
        throw new ApiError(400, `Product "${pRow?.name || ci.productId}" is no longer available.`, 'PRODUCT_UNAVAILABLE');
      }

      if (!pRow.in_stock || pRow.stock_count < ci.quantity) {
        throw new ApiError(
          409,
          `Insufficient stock for "${pRow.name}". Only ${Math.max(0, pRow.stock_count)} left.`,
          'INSUFFICIENT_STOCK'
        );
      }

      let variantInfo: { id: number; name: string; unit: string; price: number; stock: number } | null = null;
      let unitPrice = Number(pRow.price);

      if (ci.variantId) {
        const varResult = await tx.execute(sql`
          SELECT id, name, unit, price, stock, is_active
          FROM product_variants
          WHERE id = ${ci.variantId} AND product_id = ${pRow.id}
          FOR UPDATE
        `);
        const vRow = varResult.rows[0] as
          | { id: number; name: string; unit: string; price: number; stock: number; is_active: boolean }
          | undefined;
        if (vRow && vRow.is_active) {
          if (vRow.stock < ci.quantity) {
            throw new ApiError(
              409,
              `Insufficient stock for "${pRow.name} (${vRow.name})". Only ${Math.max(0, vRow.stock)} left.`,
              'INSUFFICIENT_STOCK'
            );
          }
          variantInfo = {
            id: vRow.id,
            name: vRow.name,
            unit: vRow.unit,
            price: Number(vRow.price),
            stock: Number(vRow.stock),
          };
          unitPrice = Number(vRow.price);
        }
      }

      const vendorId = pRow.vendor_id || 1;
      if (!vendorMap.has(vendorId)) {
        const vRows = await tx.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
        if (vRows.length > 0) vendorMap.set(vendorId, vRows[0]);
      }

      const lineTotal = unitPrice * ci.quantity;
      subtotal += lineTotal;
      validatedLines.push({
        cartItem: ci,
        product: {
          id: pRow.id,
          name: pRow.name,
          price: Number(pRow.price),
          stockCount: Number(pRow.stock_count),
          inStock: Boolean(pRow.in_stock),
          vendorId,
          vendorName: pRow.vendor_name,
          image: pRow.image,
          unit: pRow.unit,
          approvalStatus: pRow.approval_status,
          isActive: Boolean(pRow.is_active),
        },
        variant: variantInfo,
        unitPrice,
        lineTotal,
      });
    }

    const deliveryFee = subtotal >= feeConfig.freeDeliveryThreshold ? 0 : feeConfig.baseDeliveryFee;
    const handlingFee = feeConfig.handlingFee;

    let discount = 0;
    let appliedCouponRow: typeof coupons.$inferSelect | null = null;
    const effectiveCouponCode = isDirectOrder
      ? params.couponCodeOverride || null
      : cartRow?.appliedCouponCode || null;
    if (effectiveCouponCode) {
      const cRows = await tx
        .select()
        .from(coupons)
        .where(eq(coupons.code, effectiveCouponCode.toUpperCase()))
        .limit(1);
      if (cRows.length > 0) {
        const comp = computeCouponDiscount(cRows[0], subtotal, deliveryFee);
        if (comp > 0) {
          discount = comp;
          appliedCouponRow = cRows[0];
        }
      }
    }

    const totalAmount = Math.max(0, subtotal + deliveryFee + handlingFee - discount);
    const orderNumber = `OP-${Math.floor(100000 + Math.random() * 899999)}`;
    const primaryVendor = validatedLines[0].product.vendorName;
    const vendorNamesSummary = Array.from(new Set(validatedLines.map((l) => l.product.vendorName))).join(', ');

    const [insertedOrder] = await tx
      .insert(orders)
      .values({
        externalKey: `ord-${crypto.randomUUID().slice(0, 8)}`,
        orderNumber,
        userId: authUser.id,
        userUid: authUser.uid,
        status: 'ORDER_PLACED',
        totalAmount,
        subtotal,
        deliveryFee,
        handlingFee,
        discount,
        couponCode: appliedCouponRow?.code || null,
        addressId: addrRecord?.id ?? null,
        deliveryAddress: deliveryStreet,
        deliveryArea,
        deliveryCity,
        deliveryLandmark,
        deliveryTitle,
        deliveryLat,
        deliveryLng,
        recipientName,
        recipientPhone,
        deliveryOption,
        paymentMethod,
        paymentStatus: 'PENDING', // Gateway payments transition to PAID only on verified callback/verification!
        vendorName: vendorNamesSummary || primaryVendor,
        estimatedMinutes: deliveryOption === 'EXPRESS_12_MINS' ? 12 : 35,
        notes: params.notes || null,
      })
      .returning();

    // Group items per vendor for multi-vendor fulfillments
    const linesByVendor = new Map<number, typeof validatedLines>();
    for (const line of validatedLines) {
      const arr = linesByVendor.get(line.product.vendorId) || [];
      arr.push(line);
      linesByVendor.set(line.product.vendorId, arr);
    }

    let firstFulfillmentId: number | null = null;
    let firstVendorRow: typeof vendors.$inferSelect | undefined;
    let deliveryFeeAssigned = false;

    for (const [vId, vLines] of linesByVendor.entries()) {
      const vRow = vendorMap.get(vId);
      if (!firstVendorRow && vRow) firstVendorRow = vRow;
      const vSubtotal = vLines.reduce((acc, l) => acc + l.lineTotal, 0);
      const commissionRate = Number(vRow?.commissionRate || feeConfig.defaultCommissionRate);
      const commissionAmount = Math.round((vSubtotal * commissionRate) / 100);
      const vendorNetPayout = Math.max(0, vSubtotal - commissionAmount);
      const vDelivFee = !deliveryFeeAssigned && deliveryFee > 0 ? deliveryFee : 0;
      if (vDelivFee > 0) deliveryFeeAssigned = true;

      const [fulfillment] = await tx
        .insert(vendorFulfillments)
        .values({
          orderId: insertedOrder.id,
          vendorId: vId,
          status: 'ORDER_PLACED',
          subtotal: vSubtotal,
          deliveryFee: vDelivFee,
          commissionRate: commissionRate.toFixed(2),
          commissionAmount,
          vendorNetPayout,
        })
        .returning();

      if (!firstFulfillmentId) firstFulfillmentId = fulfillment.id;

      for (const line of vLines) {
        const lineComm = Math.round((line.lineTotal * commissionRate) / 100);
        await tx.insert(orderItems).values({
          orderId: insertedOrder.id,
          vendorFulfillmentId: fulfillment.id,
          vendorId: vId,
          productId: line.product.id,
          variantId: line.variant?.id ?? null,
          variantName: line.variant?.name ?? null,
          productName: line.product.name,
          quantity: line.cartItem.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.lineTotal,
          image: line.product.image,
          unit: line.variant?.unit || line.product.unit,
          commissionAmount: lineComm,
          vendorNetAmount: Math.max(0, line.lineTotal - lineComm),
        });

        const newStock = Math.max(0, line.product.stockCount - line.cartItem.quantity);
        await tx
          .update(products)
          .set({
            stockCount: newStock,
            inStock: newStock > 0,
            updatedAt: new Date(),
          })
          .where(eq(products.id, line.product.id));

        await tx.insert(inventoryMovements).values({
          productId: line.product.id,
          variantId: line.variant?.id ?? null,
          vendorId: vId,
          delta: -line.cartItem.quantity,
          previousStock: line.product.stockCount,
          newStock,
          reason: 'order_placed',
          referenceType: 'order',
          referenceId: insertedOrder.orderNumber,
          actorUserId: authUser.id,
          note: `Order ${insertedOrder.orderNumber}`,
        });

        if (line.variant) {
          const newVarStock = Math.max(0, line.variant.stock - line.cartItem.quantity);
          await tx
            .update(productVariants)
            .set({ stock: newVarStock })
            .where(eq(productVariants.id, line.variant.id));
        }
      }
    }

    await tx.insert(orderStatusHistory).values({
      orderId: insertedOrder.id,
      status: 'ORDER_PLACED',
      title: 'Order Placed',
      description: `Order ${orderNumber} placed (${paymentMethod}).`,
      actorUserId: authUser.id,
      actorRole: authUser.role,
    });

    const [payment] = await tx
      .insert(payments)
      .values({
        orderId: insertedOrder.id,
        userId: authUser.id,
        method: paymentMethod,
        provider: paymentMethod === 'CASH_ON_DELIVERY' ? 'cod' : paymentMethod.toLowerCase(),
        amount: totalAmount,
        currency: 'NPR',
        status: 'pending',
        idempotencyKey: `ord-${insertedOrder.id}-${paymentMethod}`,
      })
      .returning();

    await tx.insert(paymentTransactions).values({
      paymentId: payment.id,
      transactionType: 'initiate',
      status: 'pending',
      amount: totalAmount,
      signatureVerified: false,
      rawPayload: { method: paymentMethod, orderNumber },
    });

    if (appliedCouponRow) {
      await tx.insert(couponRedemptions).values({
        couponId: appliedCouponRow.id,
        userId: authUser.id,
        orderId: insertedOrder.id,
        discountAmount: discount,
      });
      await tx
        .update(coupons)
        .set({ usedCount: appliedCouponRow.usedCount + 1 })
        .where(eq(coupons.id, appliedCouponRow.id));
    }

    await tx.insert(deliveryAssignments).values({
      orderId: insertedOrder.id,
      vendorFulfillmentId: firstFulfillmentId,
      status: 'unassigned',
      pickupLat: firstVendorRow?.lat || '27.6915',
      pickupLng: firstVendorRow?.lng || '85.3420',
      dropoffLat: deliveryLat,
      dropoffLng: deliveryLng,
      etaMinutes: insertedOrder.estimatedMinutes,
    });

    // Clear cart only for cart-based checkout (preserve regular cart on AI direct purchase)
    if (!isDirectOrder && cartRow) {
      await tx.delete(cartItems).where(eq(cartItems.cartId, cartRow.id));
      await tx.update(carts).set({ appliedCouponCode: null, updatedAt: new Date() }).where(eq(carts.id, cartRow.id));
    }

    return { order: insertedOrder, vendorIds: Array.from(linesByVendor.keys()) };
  });

  // Post-commit side effects (notifications + audit log)
  await createNotification({
    userId: authUser.id,
    roleScope: 'customer',
    title: `Order ${createdOrder.order.orderNumber} Placed`,
    message: `Your order for Rs. ${createdOrder.order.totalAmount} has been sent to the neighborhood store.`,
    type: 'order',
    referenceUrl: `/orders/${createdOrder.order.id}`,
  });

  for (const vId of createdOrder.vendorIds) {
    const vRows = await db.select().from(vendors).where(eq(vendors.id, vId)).limit(1);
    if (vRows[0]?.ownerUserId) {
      await createNotification({
        userId: vRows[0].ownerUserId,
        roleScope: 'seller',
        title: `New Order ${createdOrder.order.orderNumber}`,
        message: `New order received from ${recipientName}. Please pack items for pickup.`,
        type: 'order',
        referenceUrl: `/seller`,
      });
    }
  }

  await recordAuditLog({
    actorUserId: authUser.id,
    actorRole: authUser.role,
    action: 'ORDER_CREATED',
    entityType: 'order',
    entityId: createdOrder.order.id,
    details: { orderNumber: createdOrder.order.orderNumber, totalAmount: createdOrder.order.totalAmount },
    ipAddress: params.ipAddress,
  });

  return serializeOrder(createdOrder.order);
}

export async function cancelTransactionalOrder(
  orderIdentifier: string,
  authUser: AuthenticatedUser,
  reason = 'Cancelled by user'
) {
  const target = await resolveOrderByIdentifier(orderIdentifier);
  if (!target) {
    throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
  }
  if (authUser.role !== 'admin' && target.userId !== authUser.id) {
    throw new ApiError(403, 'You do not have permission to cancel this order.', 'FORBIDDEN');
  }
  const cancellableStatuses = ['ORDER_PLACED', 'PACKED_BY_VENDOR', 'RIDER_ASSIGNED'];
  if (!cancellableStatuses.includes(target.status)) {
    throw new ApiError(
      400,
      `Order cannot be cancelled while in "${target.status}" status.`,
      'ORDER_NOT_CANCELLABLE'
    );
  }

  const updated = await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`SELECT id, status FROM orders WHERE id = ${target.id} FOR UPDATE`);
    const currentStatus = (locked.rows[0] as { status: string } | undefined)?.status;
    if (!currentStatus || !cancellableStatuses.includes(currentStatus)) {
      throw new ApiError(400, 'Order can no longer be cancelled.', 'ORDER_NOT_CANCELLABLE');
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, target.id));
    for (const item of items) {
      if (item.productId) {
        const pRes = await tx.execute(
          sql`SELECT id, stock_count, vendor_id FROM products WHERE id = ${item.productId} FOR UPDATE`
        );
        const pRow = pRes.rows[0] as { id: number; stock_count: number; vendor_id: number | null } | undefined;
        if (pRow) {
          const newStock = Number(pRow.stock_count) + item.quantity;
          await tx
            .update(products)
            .set({ stockCount: newStock, inStock: true, updatedAt: new Date() })
            .where(eq(products.id, pRow.id));

          await tx.insert(inventoryMovements).values({
            productId: pRow.id,
            variantId: item.variantId,
            vendorId: pRow.vendor_id,
            delta: item.quantity,
            previousStock: Number(pRow.stock_count),
            newStock,
            reason: 'order_cancelled',
            referenceType: 'order',
            referenceId: target.orderNumber,
            actorUserId: authUser.id,
            note: reason,
          });
        }
      }
      if (item.variantId) {
        await tx.execute(
          sql`UPDATE product_variants SET stock = stock + ${item.quantity} WHERE id = ${item.variantId}`
        );
      }
    }

    const [updOrder] = await tx
      .update(orders)
      .set({
        status: 'CANCELLED',
        cancelledReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, target.id))
      .returning();

    await tx
      .update(vendorFulfillments)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(vendorFulfillments.orderId, target.id));

    await tx
      .update(deliveryAssignments)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(deliveryAssignments.orderId, target.id));

    await tx.insert(orderStatusHistory).values({
      orderId: target.id,
      status: 'CANCELLED',
      title: 'Order Cancelled',
      description: reason,
      actorUserId: authUser.id,
      actorRole: authUser.role,
    });

    return updOrder;
  });

  await recordAuditLog({
    actorUserId: authUser.id,
    actorRole: authUser.role,
    action: 'ORDER_CANCELLED',
    entityType: 'order',
    entityId: updated.id,
    details: { orderNumber: updated.orderNumber, reason },
  });

  return serializeOrder(updated);
}

export async function recordOrderDeliveredSettlement(orderId: number) {
  const fulfillments = await db
    .select()
    .from(vendorFulfillments)
    .where(eq(vendorFulfillments.orderId, orderId));

  for (const f of fulfillments) {
    const existingLedger = await db
      .select()
      .from(financialLedger)
      .where(and(eq(financialLedger.orderId, orderId), eq(financialLedger.vendorId, f.vendorId)))
      .limit(1);
    if (existingLedger.length === 0) {
      await db.insert(financialLedger).values([
        {
          vendorId: f.vendorId,
          orderId,
          entryType: 'sale_credit',
          amount: f.subtotal,
          description: `Gross sale from Order #${orderId}`,
        },
        {
          vendorId: f.vendorId,
          orderId,
          entryType: 'commission_debit',
          amount: -f.commissionAmount,
          description: `Platform commission (${f.commissionRate}%) on Order #${orderId}`,
        },
      ]);
    }
  }
}
