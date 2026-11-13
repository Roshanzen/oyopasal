import { Router } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  advertisements,
  auditLogs,
  categories,
  coupons,
  deliveryAgents,
  deliveryAssignments,
  deliveryTrackingEvents,
  deliveryZones,
  financialLedger,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  platformSettings,
  products,
  promotions,
  refunds,
  sellerProfiles,
  settlements,
  supportTickets,
  ticketMessages,
  users,
  vendorFulfillments,
  vendors,
} from '../../src/db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { serializeAdvertisement, serializePromotion, serializeVendor } from '../services/catalogService.ts';
import { resolveOrderByIdentifier, serializeOrder } from '../services/orderService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// Protect all /admin/* endpoints
router.use('/admin', requireAuth, requireRole('admin'));

// GET /api/v1/admin/overview/
router.get(
  '/admin/overview/',
  asyncHandler(async (req, res) => {
    const fromStr = String(req.query.from || '').trim();
    const toStr = String(req.query.to || '').trim();
    const fromDate = fromStr ? new Date(fromStr) : null;
    const toDate = toStr ? new Date(toStr) : null;
    const validFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
    const validTo = toDate && !Number.isNaN(toDate.getTime()) ? new Date(toDate.getTime() + 86399999) : null;

    const orderDateFilter =
      validFrom && validTo
        ? sql`AND created_at >= ${validFrom} AND created_at <= ${validTo}`
        : validFrom
        ? sql`AND created_at >= ${validFrom}`
        : validTo
        ? sql`AND created_at <= ${validTo}`
        : sql``;

    const [
      gmvRes,
      ordersCountRes,
      pendingOrdersRes,
      completedOrdersRes,
      usersCountRes,
      customersCountRes,
      vendorsRes,
      pendingVendorsRes,
      pendingProductsRes,
      commissionRes,
      processedRefundsRes,
      pendingRefundsRes,
      openTicketsRes,
      lowStockRes,
      agentStatsRes,
      dailyRevenueRows,
    ] = await Promise.all([
      db.execute(
        sql`SELECT COALESCE(SUM(total_amount), 0)::int AS gmv FROM orders WHERE status != 'CANCELLED' ${orderDateFilter}`
      ),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM orders WHERE 1=1 ${orderDateFilter}`),
      db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM orders WHERE status IN ('ORDER_PLACED', 'CONFIRMED', 'PACKED_BY_VENDOR', 'RIDER_ASSIGNED', 'OUT_FOR_DELIVERY') ${orderDateFilter}`
      ),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM orders WHERE status = 'DELIVERED' ${orderDateFilter}`),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM users`),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM users WHERE role = 'customer'`),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM vendors WHERE approval_status = 'approved'`),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM vendors WHERE approval_status = 'pending'`),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM products WHERE approval_status = 'pending'`),
      db.execute(
        sql`SELECT COALESCE(SUM(commission_amount), 0)::int AS total FROM vendor_fulfillments WHERE status NOT IN ('CANCELLED', 'REJECTED')`
      ),
      db.execute(
        sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM refunds WHERE status IN ('approved', 'processed')`
      ),
      db.execute(sql`SELECT COUNT(*)::int AS cnt FROM refunds WHERE status = 'requested'`),
      db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM support_tickets WHERE status IN ('open', 'in_progress')`
      ),
      db.execute(
        sql`SELECT COUNT(*)::int AS cnt FROM products WHERE stock_count <= low_stock_threshold AND is_active = true`
      ),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE verification_status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE availability_status = 'available')::int AS available,
          COUNT(*) FILTER (WHERE availability_status = 'busy')::int AS busy
        FROM delivery_agents
      `),
      db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'Mon DD') AS day_label,
          COALESCE(SUM(total_amount), 0)::int AS revenue,
          COUNT(*)::int AS orders_count
        FROM orders
        WHERE status != 'CANCELLED' ${orderDateFilter}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY DATE_TRUNC('day', created_at) DESC
        LIMIT 14
      `),
    ]);

    const agRow = (agentStatsRes.rows[0] as any) || {};
    res.json({
      filter: {
        from: validFrom ? validFrom.toISOString() : null,
        to: validTo ? validTo.toISOString() : null,
      },
      kpis: {
        total_gmv: Number((gmvRes.rows[0] as any)?.gmv || 0),
        total_orders: Number((ordersCountRes.rows[0] as any)?.cnt || 0),
        pending_orders: Number((pendingOrdersRes.rows[0] as any)?.cnt || 0),
        completed_orders: Number((completedOrdersRes.rows[0] as any)?.cnt || 0),
        total_users: Number((usersCountRes.rows[0] as any)?.cnt || 0),
        total_customers: Number((customersCountRes.rows[0] as any)?.cnt || 0),
        active_vendors: Number((vendorsRes.rows[0] as any)?.cnt || 0),
        pending_seller_approvals: Number((pendingVendorsRes.rows[0] as any)?.cnt || 0),
        pending_products: Number((pendingProductsRes.rows[0] as any)?.cnt || 0),
        platform_commission: Number((commissionRes.rows[0] as any)?.total || 0),
        total_refunds: Number((processedRefundsRes.rows[0] as any)?.total || 0),
        pending_refunds: Number((pendingRefundsRes.rows[0] as any)?.cnt || 0),
        open_support_tickets: Number((openTicketsRes.rows[0] as any)?.cnt || 0),
        low_stock_products: Number((lowStockRes.rows[0] as any)?.cnt || 0),
        delivery_agent_stats: {
          total: Number(agRow.total || 0),
          approved: Number(agRow.approved || 0),
          available: Number(agRow.available || 0),
          busy: Number(agRow.busy || 0),
        },
      },
      revenue_series: (dailyRevenueRows.rows as any[]).reverse().map((r) => ({
        day: r.day_label,
        revenue: Number(r.revenue || 0),
        orders: Number(r.orders_count || 0),
      })),
    });
  })
);

// GET /api/v1/admin/users/
router.get(
  '/admin/users/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
    res.json({
      count: rows.length,
      results: rows.map((u) => ({
        id: u.id,
        uid: u.uid,
        email: u.email,
        full_name: u.fullName,
        phone: u.phone,
        role: u.role,
        is_active: u.isActive,
        is_verified: u.isVerified,
        created_at: u.createdAt?.toISOString() || null,
      })),
    });
  })
);

// PATCH /api/v1/admin/users/:id/
router.patch(
  '/admin/users/:id/',
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = parseInt(req.params.id, 10);
    const { is_active, role } = req.body as { is_active?: boolean; role?: string };

    if (role && !['customer', 'seller', 'admin', 'delivery_agent'].includes(role)) {
      throw new ApiError(400, 'Invalid role.', 'INVALID_ROLE');
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(is_active !== undefined ? { isActive: Boolean(is_active) } : {}),
        ...(role ? { role } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_USER_UPDATED',
      entityType: 'user',
      entityId: userId,
      details: { is_active, role },
    });

    res.json({ success: true, user: updated });
  })
);

// GET /api/v1/admin/sellers/
router.get(
  '/admin/sellers/',
  asyncHandler(async (_req, res) => {
    const vendorRows = await db.select().from(vendors).orderBy(desc(vendors.createdAt));
    const profiles = await db.select().from(sellerProfiles);
    const profileMap = new Map(profiles.map((p) => [p.vendorId, p]));

    res.json({
      count: vendorRows.length,
      results: vendorRows.map((v) => ({
        ...serializeVendor(v),
        profile: profileMap.get(v.id) || null,
      })),
    });
  })
);

// PATCH /api/v1/admin/sellers/:id/approval/
router.patch(
  '/admin/sellers/:id/approval/',
  asyncHandler(async (req: AuthRequest, res) => {
    const vendorId = parseInt(req.params.id, 10);
    const { approval_status, commission_rate, rejection_reason } = req.body as {
      approval_status?: string;
      commission_rate?: number;
      rejection_reason?: string;
    };

    if (
      approval_status &&
      !['pending', 'approved', 'rejected', 'suspended'].includes(approval_status)
    ) {
      throw new ApiError(400, 'Invalid approval status.', 'INVALID_STATUS');
    }

    const [updated] = await db
      .update(vendors)
      .set({
        ...(approval_status
          ? {
              approvalStatus: approval_status,
              isVerified: approval_status === 'approved',
            }
          : {}),
        ...(commission_rate !== undefined
          ? { commissionRate: Number(commission_rate).toFixed(2) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId))
      .returning();

    if (!updated) throw new ApiError(404, 'Vendor not found.', 'VENDOR_NOT_FOUND');

    if (approval_status) {
      await db
        .update(sellerProfiles)
        .set({
          approvalStatus: approval_status,
          rejectionReason: rejection_reason || null,
          approvedBy: approval_status === 'approved' ? req.authUser!.id : null,
          approvedAt: approval_status === 'approved' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(sellerProfiles.vendorId, vendorId));

      if (updated.ownerUserId) {
        await createNotification({
          userId: updated.ownerUserId,
          roleScope: 'seller',
          title: `Store ${approval_status === 'approved' ? 'Approved!' : 'Status Updated'}`,
          message:
            approval_status === 'approved'
              ? `Congratulations! ${updated.name} is now approved to list products and fulfill live orders.`
              : `Your store status changed to ${approval_status}. ${rejection_reason || ''}`,
          type: 'seller',
          referenceUrl: '/seller',
        });
      }
    }

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_SELLER_APPROVAL_UPDATED',
      entityType: 'vendor',
      entityId: vendorId,
      details: { approval_status, commission_rate, rejection_reason },
    });

    res.json({ success: true, vendor: serializeVendor(updated) });
  })
);

// GET /api/v1/admin/products/
router.get(
  '/admin/products/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(products).orderBy(desc(products.createdAt)).limit(100);
    res.json({ count: rows.length, results: rows });
  })
);

// PATCH /api/v1/admin/products/:id/moderation/
router.patch(
  '/admin/products/:id/moderation/',
  asyncHandler(async (req: AuthRequest, res) => {
    const productId = parseInt(req.params.id, 10);
    const { approval_status, is_active } = req.body as {
      approval_status?: string;
      is_active?: boolean;
    };

    const [updated] = await db
      .update(products)
      .set({
        ...(approval_status ? { approvalStatus: approval_status } : {}),
        ...(is_active !== undefined ? { isActive: Boolean(is_active) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    if (!updated) throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_PRODUCT_MODERATION',
      entityType: 'product',
      entityId: productId,
      details: { approval_status, is_active },
    });

    res.json({ success: true, product: updated });
  })
);

// Categories CMS
router.post(
  '/admin/categories/',
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      name,
      name_ne,
      slug,
      icon,
      accent,
      description,
      image_url,
      parent_id,
      display_order,
    } = req.body as Record<string, any>;
    if (!name?.trim() || !slug?.trim()) {
      throw new ApiError(400, 'Category name and slug are required.', 'MISSING_FIELDS');
    }
    const [created] = await db
      .insert(categories)
      .values({
        externalKey: `cat-${slug.trim().toLowerCase()}`,
        name: name.trim(),
        nameNe: name_ne?.trim() || name.trim(),
        slug: slug.trim().toLowerCase(),
        icon: icon || 'Package',
        accent: accent || '#059669',
        description: description || '',
        imageUrl: image_url?.trim() || null,
        parentId: parent_id ? Number(parent_id) : null,
        displayOrder: Number(display_order || 11),
      })
      .returning();
    res.status(201).json({ success: true, category: created });
  })
);

router.patch(
  '/admin/categories/:id/',
  asyncHandler(async (req, res) => {
    const catId = parseInt(req.params.id, 10);
    if (Number.isNaN(catId)) throw new ApiError(400, 'Invalid category id.', 'INVALID_ID');
    const body = req.body as Record<string, any>;
    const [updated] = await db
      .update(categories)
      .set({
        ...(body.name ? { name: String(body.name).trim() } : {}),
        ...(body.name_ne ? { nameNe: String(body.name_ne).trim() } : {}),
        ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
        ...(body.image_url !== undefined ? { imageUrl: body.image_url ? String(body.image_url).trim() : null } : {}),
        ...(body.display_order !== undefined ? { displayOrder: Number(body.display_order) } : {}),
        ...(body.is_active !== undefined ? { isActive: Boolean(body.is_active) } : {}),
      })
      .where(eq(categories.id, catId))
      .returning();
    if (!updated) throw new ApiError(404, 'Category not found.', 'NOT_FOUND');
    res.json({ success: true, category: updated });
  })
);

router.delete(
  '/admin/categories/:id/',
  asyncHandler(async (req, res) => {
    const catId = parseInt(req.params.id, 10);
    if (Number.isNaN(catId)) throw new ApiError(400, 'Invalid category id.', 'INVALID_ID');
    await db.update(categories).set({ isActive: false }).where(eq(categories.id, catId));
    res.json({ success: true });
  })
);

// Banners / Promotions CMS
router.get(
  '/admin/promotions/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(promotions).orderBy(asc(promotions.sortOrder));
    res.json({ count: rows.length, results: rows.map(serializePromotion) });
  })
);

router.post(
  '/admin/promotions/',
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      title,
      title_ne,
      subtitle,
      subtitle_ne,
      badge,
      cta_text,
      cta_category,
      destination_url,
      image_url,
      coupon_code,
      color_theme,
      placement,
      sort_order,
      starts_at,
      ends_at,
    } = req.body as Record<string, any>;

    if (!title?.trim() || !subtitle?.trim() || !image_url?.trim()) {
      throw new ApiError(400, 'Promotion title, subtitle, and image_url are required.', 'MISSING_FIELDS');
    }

    const [created] = await db
      .insert(promotions)
      .values({
        externalKey: `promo-${Date.now()}`,
        title: title.trim(),
        titleNe: title_ne?.trim() || title.trim(),
        subtitle: subtitle.trim(),
        subtitleNe: subtitle_ne?.trim() || subtitle.trim(),
        badge: badge?.trim() || 'FEATURED',
        badgeNe: badge?.trim() || 'विशेष',
        ctaText: cta_text?.trim() || 'Shop Now',
        ctaTextNe: cta_text?.trim() || 'अहिले किन्नुहोस्',
        ctaCategory: cta_category || 'fruits-vegetables',
        destinationUrl: destination_url?.trim() || null,
        imageUrl: image_url.trim(),
        couponCode: coupon_code || null,
        colorTheme: color_theme || 'emerald',
        placement: placement || 'hero',
        sortOrder: Number(sort_order || 10),
        isActive: true,
        startsAt: starts_at ? new Date(starts_at) : null,
        endsAt: ends_at ? new Date(ends_at) : null,
      })
      .returning();

    res.status(201).json({ success: true, promotion: serializePromotion(created) });
  })
);

router.patch(
  '/admin/promotions/:id/',
  asyncHandler(async (req, res) => {
    const promoId = parseInt(req.params.id, 10);
    const {
      is_active,
      title,
      subtitle,
      sort_order,
      image_url,
      destination_url,
      starts_at,
      ends_at,
    } = req.body as Record<string, any>;
    const [updated] = await db
      .update(promotions)
      .set({
        ...(is_active !== undefined ? { isActive: Boolean(is_active) } : {}),
        ...(title ? { title: String(title).trim() } : {}),
        ...(subtitle ? { subtitle: String(subtitle).trim() } : {}),
        ...(sort_order !== undefined ? { sortOrder: Number(sort_order) } : {}),
        ...(image_url ? { imageUrl: String(image_url).trim() } : {}),
        ...(destination_url !== undefined
          ? { destinationUrl: destination_url ? String(destination_url).trim() : null }
          : {}),
        ...(starts_at !== undefined ? { startsAt: starts_at ? new Date(starts_at) : null } : {}),
        ...(ends_at !== undefined ? { endsAt: ends_at ? new Date(ends_at) : null } : {}),
      })
      .where(eq(promotions.id, promoId))
      .returning();

    res.json({ success: true, promotion: updated ? serializePromotion(updated) : null });
  })
);

router.delete(
  '/admin/promotions/:id/',
  asyncHandler(async (req, res) => {
    const promoId = parseInt(req.params.id, 10);
    await db.delete(promotions).where(eq(promotions.id, promoId));
    res.json({ success: true });
  })
);

// Advertisements CMS CRUD
router.get(
  '/admin/advertisements/',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(advertisements)
      .orderBy(asc(advertisements.priority), desc(advertisements.id));
    res.json({ count: rows.length, results: rows.map(serializeAdvertisement) });
  })
);

router.post(
  '/admin/advertisements/',
  asyncHandler(async (req, res) => {
    const {
      title,
      title_ne,
      subtitle,
      subtitle_ne,
      image_url,
      destination_url,
      placement,
      priority,
      starts_at,
      ends_at,
    } = req.body as Record<string, any>;

    if (!title?.trim() || !image_url?.trim()) {
      throw new ApiError(400, 'Advertisement title and image_url are required.', 'MISSING_FIELDS');
    }

    const [created] = await db
      .insert(advertisements)
      .values({
        title: title.trim(),
        titleNe: title_ne?.trim() || title.trim(),
        subtitle: subtitle?.trim() || '',
        subtitleNe: subtitle_ne?.trim() || subtitle?.trim() || '',
        imageUrl: image_url.trim(),
        destinationUrl: destination_url?.trim() || '/search',
        placement: placement || 'homepage_mid',
        priority: Number(priority ?? 5),
        isActive: true,
        startsAt: starts_at ? new Date(starts_at) : null,
        endsAt: ends_at ? new Date(ends_at) : null,
      })
      .returning();

    res.status(201).json({ success: true, advertisement: serializeAdvertisement(created) });
  })
);

router.patch(
  '/admin/advertisements/:id/',
  asyncHandler(async (req, res) => {
    const adId = parseInt(req.params.id, 10);
    const body = req.body as Record<string, any>;
    const [updated] = await db
      .update(advertisements)
      .set({
        ...(body.title ? { title: String(body.title).trim() } : {}),
        ...(body.subtitle !== undefined ? { subtitle: String(body.subtitle).trim() } : {}),
        ...(body.image_url ? { imageUrl: String(body.image_url).trim() } : {}),
        ...(body.destination_url ? { destinationUrl: String(body.destination_url).trim() } : {}),
        ...(body.placement ? { placement: String(body.placement).trim() } : {}),
        ...(body.priority !== undefined ? { priority: Number(body.priority) } : {}),
        ...(body.is_active !== undefined ? { isActive: Boolean(body.is_active) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(advertisements.id, adId))
      .returning();

    if (!updated) throw new ApiError(404, 'Advertisement not found.', 'NOT_FOUND');
    res.json({ success: true, advertisement: serializeAdvertisement(updated) });
  })
);

router.delete(
  '/admin/advertisements/:id/',
  asyncHandler(async (req, res) => {
    const adId = parseInt(req.params.id, 10);
    await db.delete(advertisements).where(eq(advertisements.id, adId));
    res.json({ success: true });
  })
);

// Payments Ledger
router.get(
  '/admin/payments/',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        payment: payments,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        customerName: users.fullName,
        customerEmail: users.email,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .leftJoin(users, eq(payments.userId, users.id))
      .orderBy(desc(payments.createdAt))
      .limit(100);

    res.json({
      count: rows.length,
      results: rows.map((r) => ({
        id: r.payment.id,
        order_id: r.payment.orderId,
        order_number: r.orderNumber,
        order_status: r.orderStatus,
        customer_name: r.customerName || 'Customer',
        customer_email: r.customerEmail || '',
        method: r.payment.method,
        provider: r.payment.provider,
        amount: r.payment.amount,
        currency: r.payment.currency,
        status: r.payment.status,
        gateway_ref_id: r.payment.gatewayRefId,
        created_at: r.payment.createdAt?.toISOString() || null,
      })),
    });
  })
);

// Orders + Rider Dispatch
router.get(
  '/admin/orders/',
  asyncHandler(async (_req, res) => {
    const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
    const serialized = await Promise.all(orderRows.map((o) => serializeOrder(o)));
    res.json({ count: serialized.length, results: serialized });
  })
);

router.post(
  '/admin/orders/:id/assign-rider/',
  asyncHandler(async (req: AuthRequest, res) => {
    const orderRow = await resolveOrderByIdentifier(req.params.id);
    if (!orderRow) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');

    const agentId = parseInt(String(req.body?.agent_id), 10);
    const agentRows = await db
      .select()
      .from(deliveryAgents)
      .where(eq(deliveryAgents.id, agentId))
      .limit(1);
    if (agentRows.length === 0) {
      throw new ApiError(404, 'Delivery rider not found.', 'AGENT_NOT_FOUND');
    }
    const agent = agentRows[0];

    const firstVendorRow = await db
      .select({ lat: vendors.lat, lng: vendors.lng })
      .from(orderItems)
      .innerJoin(vendors, eq(orderItems.vendorId, vendors.id))
      .where(eq(orderItems.orderId, orderRow.id))
      .limit(1);

    const resolvedPickupLat = firstVendorRow[0]?.lat || null;
    const resolvedPickupLng = firstVendorRow[0]?.lng || null;

    await db.transaction(async (tx) => {
      const existingAssign = await tx
        .select()
        .from(deliveryAssignments)
        .where(eq(deliveryAssignments.orderId, orderRow.id))
        .limit(1);

      const startLat = agent.currentLat || existingAssign[0]?.pickupLat || resolvedPickupLat || orderRow.deliveryLat || '';
      const startLng = agent.currentLng || existingAssign[0]?.pickupLng || resolvedPickupLng || orderRow.deliveryLng || '';

      let assignmentId: number;
      if (existingAssign.length > 0) {
        const [upd] = await tx
          .update(deliveryAssignments)
          .set({
            agentId: agent.id,
            status: 'assigned',
            ...(startLat ? { currentLat: startLat } : {}),
            ...(startLng ? { currentLng: startLng } : {}),
            assignedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deliveryAssignments.id, existingAssign[0].id))
          .returning();
        assignmentId = upd.id;
      } else {
        const [ins] = await tx
          .insert(deliveryAssignments)
          .values({
            orderId: orderRow.id,
            agentId: agent.id,
            status: 'assigned',
            pickupLat: resolvedPickupLat,
            pickupLng: resolvedPickupLng,
            dropoffLat: orderRow.deliveryLat || null,
            dropoffLng: orderRow.deliveryLng || null,
            currentLat: startLat || null,
            currentLng: startLng || null,
            assignedAt: new Date(),
          })
          .returning();
        assignmentId = ins.id;
      }

      if (startLat && startLng) {
        await tx.insert(deliveryTrackingEvents).values({
          assignmentId,
          orderId: orderRow.id,
          lat: startLat,
          lng: startLng,
          speedKmh: 0,
          statusNote: `Rider ${agent.fullName} assigned by dispatch`,
        });
      }

      await tx
        .update(orders)
        .set({ status: 'RIDER_ASSIGNED', updatedAt: new Date() })
        .where(eq(orders.id, orderRow.id));

      await tx.insert(orderStatusHistory).values({
        orderId: orderRow.id,
        status: 'RIDER_ASSIGNED',
        title: 'Rider Assigned',
        description: `${agent.fullName} (${agent.vehicleNumber}) assigned for pickup.`,
        actorUserId: req.authUser!.id,
        actorRole: 'admin',
      });
    });

    await createNotification({
      userId: agent.userId,
      roleScope: 'delivery_agent',
      title: `New Delivery Assignment: ${orderRow.orderNumber}`,
      message: `Pickup from ${orderRow.vendorName} and deliver to ${orderRow.deliveryArea}.`,
      type: 'delivery',
      referenceUrl: '/rider',
    });

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_RIDER_ASSIGNED',
      entityType: 'order',
      entityId: orderRow.id,
      details: { agentId: agent.id, agentName: agent.fullName },
    });

    res.json({ success: true, message: `Assigned ${agent.fullName} to ${orderRow.orderNumber}.` });
  })
);

// Refunds
router.get(
  '/admin/refunds/',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({
        refund: refunds,
        orderNumber: orders.orderNumber,
        customerName: users.fullName,
      })
      .from(refunds)
      .innerJoin(orders, eq(refunds.orderId, orders.id))
      .leftJoin(users, eq(refunds.userId, users.id))
      .orderBy(desc(refunds.createdAt));

    res.json({
      count: rows.length,
      results: rows.map((r) => ({
        id: r.refund.id,
        order_id: r.refund.orderId,
        order_number: r.orderNumber,
        customer_name: r.customerName || 'Customer',
        amount: r.refund.amount,
        reason: r.refund.reason,
        status: r.refund.status,
        admin_note: r.refund.adminNote,
        created_at: r.refund.createdAt?.toISOString() || null,
      })),
    });
  })
);

router.patch(
  '/admin/refunds/:id/',
  asyncHandler(async (req: AuthRequest, res) => {
    const refundId = parseInt(req.params.id, 10);
    const { status, admin_note } = req.body as { status?: string; admin_note?: string };
    if (!status || !['approved', 'rejected', 'processed'].includes(status)) {
      throw new ApiError(400, 'Invalid refund status.', 'INVALID_STATUS');
    }

    const [updated] = await db
      .update(refunds)
      .set({
        status,
        adminNote: admin_note || null,
        processedBy: req.authUser!.id,
        processedAt: new Date(),
      })
      .where(eq(refunds.id, refundId))
      .returning();

    if (!updated) throw new ApiError(404, 'Refund not found.', 'REFUND_NOT_FOUND');

    if (status === 'processed' && updated.paymentId) {
      await db
        .update(payments)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(payments.id, updated.paymentId));
    }

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_REFUND_UPDATED',
      entityType: 'refund',
      entityId: refundId,
      details: { status, admin_note },
    });

    res.json({ success: true, refund: updated });
  })
);

// Delivery Zones CRUD
router.get(
  '/admin/zones/',
  asyncHandler(async (_req, res) => {
    const zones = await db.select().from(deliveryZones).orderBy(asc(deliveryZones.id));
    res.json({ count: zones.length, results: zones });
  })
);

router.post(
  '/admin/zones/',
  asyncHandler(async (req, res) => {
    const { name, slug, city, base_delivery_fee, free_delivery_threshold, estimated_mins, radius_km } =
      req.body as Record<string, any>;
    if (!name?.trim() || !slug?.trim()) {
      throw new ApiError(400, 'Zone name and slug are required.', 'MISSING_FIELDS');
    }
    const [created] = await db
      .insert(deliveryZones)
      .values({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        city: city || 'Kathmandu',
        baseDeliveryFee: Number(base_delivery_fee ?? 35),
        freeDeliveryThreshold: Number(free_delivery_threshold ?? 499),
        estimatedMins: Number(estimated_mins ?? 12),
        radiusKm: String(radius_km ?? '5.00'),
      })
      .returning();
    res.status(201).json({ success: true, zone: created });
  })
);

// Riders Fleet Management
router.get(
  '/admin/riders/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(deliveryAgents).orderBy(asc(deliveryAgents.id));
    res.json({ count: rows.length, results: rows });
  })
);

router.patch(
  '/admin/riders/:id/',
  asyncHandler(async (req, res) => {
    const agentId = parseInt(req.params.id, 10);
    const { verification_status, availability_status } = req.body as Record<string, string>;
    const [updated] = await db
      .update(deliveryAgents)
      .set({
        ...(verification_status ? { verificationStatus: verification_status } : {}),
        ...(availability_status ? { availabilityStatus: availability_status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(deliveryAgents.id, agentId))
      .returning();

    res.json({ success: true, rider: updated });
  })
);

// Coupons Management
router.get(
  '/admin/coupons/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
    res.json({ count: rows.length, results: rows });
  })
);

router.post(
  '/admin/coupons/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { code, description, discount_type, discount_value, max_discount_amount, min_order_amount } =
      req.body as Record<string, any>;
    if (!code?.trim() || !description?.trim()) {
      throw new ApiError(400, 'Coupon code and description are required.', 'MISSING_FIELDS');
    }
    const [created] = await db
      .insert(coupons)
      .values({
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discountType: discount_type || 'percentage',
        discountValue: Number(discount_value ?? 10),
        maxDiscountAmount: max_discount_amount ? Number(max_discount_amount) : null,
        minOrderAmount: Number(min_order_amount ?? 200),
        isActive: true,
      })
      .returning();
    res.status(201).json({ success: true, coupon: created });
  })
);

router.patch(
  '/admin/coupons/:id/',
  asyncHandler(async (req, res) => {
    const couponId = parseInt(req.params.id, 10);
    const [updated] = await db
      .update(coupons)
      .set({ isActive: Boolean(req.body.is_active) })
      .where(eq(coupons.id, couponId))
      .returning();
    res.json({ success: true, coupon: updated });
  })
);

// Settlements & Payouts
router.get(
  '/admin/settlements/',
  asyncHandler(async (_req, res) => {
    const [vendorRows, existingSettlements] = await Promise.all([
      db.select().from(vendors).where(eq(vendors.approvalStatus, 'approved')),
      db
        .select({ settlement: settlements, vendorName: vendors.name })
        .from(settlements)
        .innerJoin(vendors, eq(settlements.vendorId, vendors.id))
        .orderBy(desc(settlements.createdAt)),
    ]);

    const balances = await db.execute(sql`
      SELECT
        vendor_id,
        COALESCE(SUM(CASE WHEN entry_type = 'sale_credit' THEN amount ELSE 0 END), 0)::int AS gross_sales,
        COALESCE(SUM(CASE WHEN entry_type = 'commission_debit' THEN ABS(amount) ELSE 0 END), 0)::int AS commission,
        COALESCE(SUM(amount), 0)::int AS net_balance
      FROM financial_ledger
      GROUP BY vendor_id
    `);
    const balMap = new Map((balances.rows as any[]).map((b) => [Number(b.vendor_id), b]));

    res.json({
      vendor_balances: vendorRows.map((v) => {
        const b = balMap.get(v.id);
        return {
          vendor_id: v.id,
          vendor_name: v.name,
          commission_rate: Number(v.commissionRate),
          gross_sales: Number(b?.gross_sales || 0),
          commission: Number(b?.commission || 0),
          net_balance: Number(b?.net_balance || 0),
        };
      }),
      settlements: existingSettlements.map((s) => ({
        ...s.settlement,
        vendor_name: s.vendorName,
      })),
    });
  })
);

router.post(
  '/admin/settlements/generate/',
  asyncHandler(async (req: AuthRequest, res) => {
    const vendorId = parseInt(String(req.body?.vendor_id), 10);
    const vendorRows = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendorRows[0]) throw new ApiError(404, 'Vendor not found.', 'VENDOR_NOT_FOUND');

    const ledgerRes = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type = 'sale_credit' THEN amount ELSE 0 END), 0)::int AS gross_sales,
        COALESCE(SUM(CASE WHEN entry_type = 'commission_debit' THEN ABS(amount) ELSE 0 END), 0)::int AS commission,
        COALESCE(SUM(amount), 0)::int AS net_balance
      FROM financial_ledger
      WHERE vendor_id = ${vendorId}
    `);
    const row = ledgerRes.rows[0] as any;
    const netBalance = Number(row?.net_balance || 0);
    if (netBalance <= 0) {
      throw new ApiError(400, 'No positive unsettled balance for this vendor.', 'ZERO_BALANCE');
    }

    const [created] = await db
      .insert(settlements)
      .values({
        vendorId,
        periodStart: new Date(Date.now() - 7 * 86400_000),
        periodEnd: new Date(),
        grossSales: Number(row?.gross_sales || 0),
        commissionTotal: Number(row?.commission || 0),
        netPayout: netBalance,
        status: 'pending',
        processedBy: req.authUser!.id,
      })
      .returning();

    res.status(201).json({ success: true, settlement: created });
  })
);

router.patch(
  '/admin/settlements/:id/pay/',
  asyncHandler(async (req: AuthRequest, res) => {
    const settlementId = parseInt(req.params.id, 10);
    const payoutRef = String(req.body?.payout_reference || `PAY-${Date.now()}`).trim();

    const sRows = await db
      .select()
      .from(settlements)
      .where(eq(settlements.id, settlementId))
      .limit(1);
    if (!sRows[0]) throw new ApiError(404, 'Settlement not found.', 'SETTLEMENT_NOT_FOUND');
    if (sRows[0].status === 'paid') {
      throw new ApiError(400, 'Settlement already paid.', 'ALREADY_PAID');
    }

    const [updated] = await db.transaction(async (tx) => {
      const [upd] = await tx
        .update(settlements)
        .set({
          status: 'paid',
          payoutReference: payoutRef,
          paidAt: new Date(),
          processedBy: req.authUser!.id,
        })
        .where(eq(settlements.id, settlementId))
        .returning();

      await tx.insert(financialLedger).values({
        vendorId: sRows[0].vendorId,
        settlementId: sRows[0].id,
        entryType: 'payout_debit',
        amount: -sRows[0].netPayout,
        description: `Payout settled (${payoutRef})`,
      });

      return [upd];
    });

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_SETTLEMENT_PAID',
      entityType: 'settlement',
      entityId: settlementId,
      details: { payoutReference: payoutRef, netPayout: updated.netPayout },
    });

    res.json({ success: true, settlement: updated });
  })
);

// Support Tickets (Admin view & reply/resolve)
router.get(
  '/admin/tickets/',
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select({ ticket: supportTickets, customerName: users.fullName, customerEmail: users.email })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.userId, users.id))
      .orderBy(desc(supportTickets.updatedAt));

    const results = await Promise.all(
      rows.map(async (r) => {
        const msgs = await db
          .select()
          .from(ticketMessages)
          .where(eq(ticketMessages.ticketId, r.ticket.id))
          .orderBy(ticketMessages.id);
        return {
          ...r.ticket,
          customer_name: r.customerName || 'Customer',
          customer_email: r.customerEmail || '',
          messages: msgs,
        };
      })
    );
    res.json({ count: results.length, results });
  })
);

router.patch(
  '/admin/tickets/:id/',
  asyncHandler(async (req: AuthRequest, res) => {
    const ticketId = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };
    const [updated] = await db
      .update(supportTickets)
      .set({
        ...(status ? { status } : {}),
        assignedAdminId: req.authUser!.id,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();

    res.json({ success: true, ticket: updated });
  })
);

// Audit Logs & Settings
router.get(
  '/admin/audit-logs/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json({ count: rows.length, results: rows });
  })
);

router.get(
  '/admin/settings/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(platformSettings);
    res.json({ count: rows.length, results: rows });
  })
);

router.put(
  '/admin/settings/',
  asyncHandler(async (req: AuthRequest, res) => {
    const { key, value, description } = req.body as {
      key?: string;
      value?: Record<string, unknown>;
      description?: string;
    };
    if (!key || !value) {
      throw new ApiError(400, 'Setting key and value are required.', 'MISSING_FIELDS');
    }

    const existing = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);

    let saved;
    if (existing.length === 0) {
      [saved] = await db
        .insert(platformSettings)
        .values({ key, value, description: description || '', updatedBy: req.authUser!.id })
        .returning();
    } else {
      [saved] = await db
        .update(platformSettings)
        .set({ value, ...(description ? { description } : {}), updatedBy: req.authUser!.id, updatedAt: new Date() })
        .where(eq(platformSettings.key, key))
        .returning();
    }

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: 'admin',
      action: 'ADMIN_SETTING_UPDATED',
      entityType: 'platform_setting',
      entityId: key,
      details: value,
    });

    res.json({ success: true, setting: saved });
  })
);

export default router;
