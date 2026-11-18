import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  deliveryAgents,
  deliveryAssignments,
  deliveryTrackingEvents,
  orders,
  orderStatusHistory,
  payments,
  vendorFulfillments,
} from '../../src/db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { recordOrderDeliveredSettlement, resolveOrderByIdentifier } from '../services/orderService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// GET /api/v1/delivery/orders/:orderId/tracking/ (Real GPS telemetry from DB)
router.get(
  '/delivery/orders/:orderId/tracking/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const orderRow = await resolveOrderByIdentifier(req.params.orderId);
    if (!orderRow) {
      throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');
    }

    if (
      req.authUser!.role !== 'admin' &&
      req.authUser!.role !== 'delivery_agent' &&
      orderRow.userId !== req.authUser!.id
    ) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }

    const assignmentRows = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.orderId, orderRow.id))
      .limit(1);

    const assignment = assignmentRows[0] || null;
    const events = await db
      .select()
      .from(deliveryTrackingEvents)
      .where(eq(deliveryTrackingEvents.orderId, orderRow.id))
      .orderBy(desc(deliveryTrackingEvents.id))
      .limit(20);

    let agent = null;
    if (assignment?.agentId) {
      const aRows = await db
        .select()
        .from(deliveryAgents)
        .where(eq(deliveryAgents.id, assignment.agentId))
        .limit(1);
      if (aRows[0]) {
        agent = {
          id: aRows[0].id,
          full_name: aRows[0].fullName,
          phone: aRows[0].phone,
          vehicle_type: aRows[0].vehicleType,
          vehicle_number: aRows[0].vehicleNumber,
          rating: parseFloat(aRows[0].rating || '4.9'),
        };
      }
    }

    res.json({
      order_id: orderRow.externalKey || `ord-${orderRow.id}`,
      order_number: orderRow.orderNumber,
      order_status: orderRow.status,
      assignment: assignment
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
            agent,
            updated_at: assignment.updatedAt?.toISOString() || null,
          }
        : null,
      events: events.map((e) => ({
        id: e.id,
        lat: parseFloat(e.lat),
        lng: parseFloat(e.lng),
        speed_kmh: e.speedKmh,
        heading: e.heading,
        status_note: e.statusNote,
        recorded_at: e.recordedAt?.toISOString() || null,
      })),
    });
  })
);

// GET /api/v1/delivery/agent/profile/
router.get(
  '/delivery/agent/profile/',
  requireAuth,
  requireRole('delivery_agent', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const agentRows = await db
      .select()
      .from(deliveryAgents)
      .where(eq(deliveryAgents.userId, req.authUser!.id))
      .limit(1);

    if (agentRows.length === 0) {
      throw new ApiError(404, 'Delivery agent profile not found.', 'AGENT_NOT_FOUND');
    }

    const a = agentRows[0];
    res.json({
      id: a.id,
      full_name: a.fullName,
      phone: a.phone,
      vehicle_type: a.vehicleType,
      vehicle_number: a.vehicleNumber,
      verification_status: a.verificationStatus,
      availability_status: a.availabilityStatus,
      current_lat: a.currentLat ? parseFloat(a.currentLat) : null,
      current_lng: a.currentLng ? parseFloat(a.currentLng) : null,
      rating: parseFloat(a.rating || '4.9'),
      total_deliveries: a.totalDeliveries,
    });
  })
);

// PATCH /api/v1/delivery/agent/availability/
router.patch(
  '/delivery/agent/availability/',
  requireAuth,
  requireRole('delivery_agent', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const status = String(req.body?.availability_status || '').toLowerCase();
    if (!['offline', 'available', 'busy'].includes(status)) {
      throw new ApiError(400, 'Invalid availability status.', 'INVALID_STATUS');
    }

    const [updated] = await db
      .update(deliveryAgents)
      .set({ availabilityStatus: status, updatedAt: new Date() })
      .where(eq(deliveryAgents.userId, req.authUser!.id))
      .returning();

    res.json({ success: true, availability_status: updated?.availabilityStatus || status });
  })
);

// GET /api/v1/delivery/assignments/
router.get(
  '/delivery/assignments/',
  requireAuth,
  requireRole('delivery_agent', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    let rows;
    if (req.authUser!.role === 'admin') {
      rows = await db
        .select({ assignment: deliveryAssignments, order: orders })
        .from(deliveryAssignments)
        .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
        .orderBy(desc(deliveryAssignments.createdAt))
        .limit(50);
    } else {
      const agentId = req.authUser!.agentId;
      if (!agentId) {
        return res.json({ count: 0, results: [] });
      }
      rows = await db
        .select({ assignment: deliveryAssignments, order: orders })
        .from(deliveryAssignments)
        .innerJoin(orders, eq(deliveryAssignments.orderId, orders.id))
        .where(eq(deliveryAssignments.agentId, agentId))
        .orderBy(desc(deliveryAssignments.createdAt));
    }

    res.json({
      count: rows.length,
      results: rows.map((r) => ({
        id: r.assignment.id,
        status: r.assignment.status,
        order_id: r.order.id,
        order_external_id: r.order.externalKey || `ord-${r.order.id}`,
        order_number: r.order.orderNumber,
        order_status: r.order.status,
        recipient_name: r.order.recipientName,
        recipient_phone: r.order.recipientPhone,
        delivery_address: `${r.order.deliveryAddress}, ${r.order.deliveryArea}`,
        vendor_name: r.order.vendorName,
        total_amount: r.order.totalAmount,
        payment_method: r.order.paymentMethod,
        payment_status: r.order.paymentStatus,
        pickup_lat: r.assignment.pickupLat ? parseFloat(r.assignment.pickupLat) : null,
        pickup_lng: r.assignment.pickupLng ? parseFloat(r.assignment.pickupLng) : null,
        dropoff_lat: r.assignment.dropoffLat ? parseFloat(r.assignment.dropoffLat) : null,
        dropoff_lng: r.assignment.dropoffLng ? parseFloat(r.assignment.dropoffLng) : null,
        current_lat: r.assignment.currentLat ? parseFloat(r.assignment.currentLat) : null,
        current_lng: r.assignment.currentLng ? parseFloat(r.assignment.currentLng) : null,
        eta_minutes: r.assignment.etaMinutes,
        speed_kmh: r.assignment.speedKmh,
      })),
    });
  })
);

// POST /api/v1/delivery/assignments/:id/location/ (Push real GPS ping from rider)
router.post(
  '/delivery/assignments/:id/location/',
  requireAuth,
  requireRole('delivery_agent', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const assignmentId = parseInt(req.params.id, 10);
    const { lat, lng, speed_kmh = 24, heading = 0, eta_minutes, status_note } = req.body as {
      lat?: number;
      lng?: number;
      speed_kmh?: number;
      heading?: number;
      eta_minutes?: number;
      status_note?: string;
    };

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new ApiError(400, 'Numeric lat and lng coordinates are required.', 'INVALID_COORDINATES');
    }

    const aRows = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.id, assignmentId))
      .limit(1);
    if (aRows.length === 0) {
      throw new ApiError(404, 'Delivery assignment not found.', 'ASSIGNMENT_NOT_FOUND');
    }
    const assignment = aRows[0];
    if (req.authUser!.role !== 'admin' && assignment.agentId !== req.authUser!.agentId) {
      throw new ApiError(403, 'You are not assigned to this delivery.', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(deliveryAssignments)
        .set({
          currentLat: String(lat),
          currentLng: String(lng),
          speedKmh: Math.max(0, Math.round(Number(speed_kmh))),
          ...(eta_minutes !== undefined ? { etaMinutes: Math.max(1, Math.round(Number(eta_minutes))) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(deliveryAssignments.id, assignmentId));

      await tx.insert(deliveryTrackingEvents).values({
        assignmentId,
        orderId: assignment.orderId,
        lat: String(lat),
        lng: String(lng),
        speedKmh: Math.max(0, Math.round(Number(speed_kmh))),
        heading: Math.round(Number(heading)),
        statusNote: status_note?.trim() || 'Rider GPS telemetry update',
      });

      if (assignment.agentId) {
        await tx
          .update(deliveryAgents)
          .set({
            currentLat: String(lat),
            currentLng: String(lng),
            lastLocationAt: new Date(),
          })
          .where(eq(deliveryAgents.id, assignment.agentId));
      }
    });

    res.json({ success: true, lat, lng });
  })
);

// PATCH /api/v1/delivery/assignments/:id/status/
router.patch(
  '/delivery/assignments/:id/status/',
  requireAuth,
  requireRole('delivery_agent', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const assignmentId = parseInt(req.params.id, 10);
    const nextStatus = String(req.body?.status || '').toLowerCase();
    const proofNote = req.body?.proof_note ? String(req.body.proof_note).trim() : undefined;

    if (!['accepted', 'picked_up', 'in_transit', 'delivered', 'failed'].includes(nextStatus)) {
      throw new ApiError(400, 'Invalid delivery assignment status.', 'INVALID_STATUS');
    }

    const aRows = await db
      .select()
      .from(deliveryAssignments)
      .where(eq(deliveryAssignments.id, assignmentId))
      .limit(1);
    if (aRows.length === 0) {
      throw new ApiError(404, 'Delivery assignment not found.', 'ASSIGNMENT_NOT_FOUND');
    }
    const assignment = aRows[0];
    if (req.authUser!.role !== 'admin' && assignment.agentId !== req.authUser!.agentId) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }

    const mappedOrderStatus =
      nextStatus === 'accepted'
        ? 'RIDER_ASSIGNED'
        : nextStatus === 'picked_up' || nextStatus === 'in_transit'
        ? 'OUT_FOR_DELIVERY'
        : nextStatus === 'delivered'
        ? 'DELIVERED'
        : null;

    await db.transaction(async (tx) => {
      await tx
        .update(deliveryAssignments)
        .set({
          status: nextStatus,
          ...(nextStatus === 'picked_up' ? { pickedUpAt: new Date() } : {}),
          ...(nextStatus === 'delivered' ? { deliveredAt: new Date(), etaMinutes: 0 } : {}),
          ...(proofNote ? { proofNote } : {}),
          updatedAt: new Date(),
        })
        .where(eq(deliveryAssignments.id, assignmentId));

      if (mappedOrderStatus) {
        await tx
          .update(orders)
          .set({
            status: mappedOrderStatus,
            ...(nextStatus === 'delivered' ? { deliveredAt: new Date() } : {}),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, assignment.orderId));

        await tx
          .update(vendorFulfillments)
          .set({
            status: mappedOrderStatus,
            ...(nextStatus === 'picked_up' ? { dispatchedAt: new Date() } : {}),
            ...(nextStatus === 'delivered' ? { deliveredAt: new Date() } : {}),
            updatedAt: new Date(),
          })
          .where(eq(vendorFulfillments.orderId, assignment.orderId));

        const titleMap: Record<string, string> = {
          RIDER_ASSIGNED: 'Rider Accepted Delivery',
          OUT_FOR_DELIVERY: 'Out for Delivery',
          DELIVERED: 'Order Delivered',
        };
        const descMap: Record<string, string> = {
          RIDER_ASSIGNED: 'Delivery partner accepted assignment and is heading to store pickup.',
          OUT_FOR_DELIVERY: 'Rider picked up your order and is en route to your doorstep.',
          DELIVERED: proofNote || 'Delivered safely to recipient.',
        };

        await tx.insert(orderStatusHistory).values({
          orderId: assignment.orderId,
          status: mappedOrderStatus,
          title: titleMap[mappedOrderStatus] || mappedOrderStatus,
          description: descMap[mappedOrderStatus] || nextStatus,
          actorUserId: req.authUser!.id,
          actorRole: req.authUser!.role,
        });
      }

      if (nextStatus === 'delivered') {
        const ordRows = await tx.select().from(orders).where(eq(orders.id, assignment.orderId)).limit(1);
        if (ordRows[0]?.paymentMethod === 'CASH_ON_DELIVERY') {
          await tx
            .update(orders)
            .set({ paymentStatus: 'PAID' })
            .where(eq(orders.id, assignment.orderId));
          await tx
            .update(payments)
            .set({ status: 'paid', updatedAt: new Date() })
            .where(eq(payments.orderId, assignment.orderId));
        }

        if (assignment.agentId) {
          const agRows = await tx
            .select()
            .from(deliveryAgents)
            .where(eq(deliveryAgents.id, assignment.agentId))
            .limit(1);
          if (agRows[0]) {
            await tx
              .update(deliveryAgents)
              .set({
                totalDeliveries: agRows[0].totalDeliveries + 1,
                availabilityStatus: 'available',
                updatedAt: new Date(),
              })
              .where(eq(deliveryAgents.id, agRows[0].id));
          }
        }
      }
    });

    if (nextStatus === 'delivered') {
      await recordOrderDeliveredSettlement(assignment.orderId);
    }

    const parentOrder = (
      await db.select().from(orders).where(eq(orders.id, assignment.orderId)).limit(1)
    )[0];
    if (parentOrder?.userId) {
      await createNotification({
        userId: parentOrder.userId,
        roleScope: 'customer',
        title: `Delivery Update: ${parentOrder.orderNumber}`,
        message:
          nextStatus === 'delivered'
            ? 'Your OyoPasal order has been delivered! Enjoy your fresh groceries.'
            : `Rider status updated to ${nextStatus.replace(/_/g, ' ')}.`,
        type: 'delivery',
        referenceUrl: `/orders/${parentOrder.id}`,
      });
    }

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
      action: 'DELIVERY_STATUS_UPDATED',
      entityType: 'delivery_assignment',
      entityId: assignmentId,
      details: { orderId: assignment.orderId, nextStatus },
    });

    res.json({ success: true, status: nextStatus, order_status: mappedOrderStatus });
  })
);

export default router;
