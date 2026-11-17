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
  vendors,
} from '../../src/db/schema.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { serializeAdvertisement, serializePromotion, serializeVendor } from './catalogService.ts';
import { resolveOrderByIdentifier, serializeOrdersBatch } from './orderService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { ApiError } from '../utils/errors.ts';
import {
  assertEnum,
  parseNonNegativeInt,
  parseNumericId,
  parseOptionalDate,
  parsePositiveInt,
} from '../utils/validation.ts';

const USER_ROLES = ['customer', 'seller', 'admin', 'delivery_agent'] as const;
const SELLER_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
const PRODUCT_MODERATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
const REFUND_STATUSES = ['approved', 'rejected', 'processed'] as const;
const RIDER_VERIFICATION_STATUSES = ['pending', 'approved', 'suspended'] as const;
const RIDER_AVAILABILITY_STATUSES = ['offline', 'available', 'busy'] as const;
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export async function getAdminOverview(fromRaw?: unknown, toRaw?: unknown) {
  const fromStr = String(fromRaw || '').trim();
  const toStr = String(toRaw || '').trim();
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
  return {
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
  };
}

export async function listAdminUsers() {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
  return {
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
  };
}

export async function updateAdminUser(req: AuthRequest) {
  const userId = parseNumericId(req.params.id, 'user id', 'INVALID_USER_ID');
  const { is_active, role } = req.body as { is_active?: boolean; role?: string };

  const validatedRole = role ? assertEnum(role, USER_ROLES, 'role', 'INVALID_ROLE') : undefined;

  const [updated] = await db
    .update(users)
    .set({
      ...(is_active !== undefined ? { isActive: Boolean(is_active) } : {}),
      ...(validatedRole ? { role: validatedRole } : {}),
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
    details: { is_active, role: validatedRole },
  });

  return {
    success: true,
    user: {
      id: updated.id,
      uid: updated.uid,
      email: updated.email,
      full_name: updated.fullName,
      phone: updated.phone,
      role: updated.role,
      is_active: updated.isActive,
      is_verified: updated.isVerified,
    },
  };
}

export async function listAdminSellers() {
  const [vendorRows, profiles] = await Promise.all([
    db.select().from(vendors).orderBy(desc(vendors.createdAt)),
    db.select().from(sellerProfiles),
  ]);
  const profileMap = new Map(profiles.map((p) => [p.vendorId, p]));

  return {
    count: vendorRows.length,
    results: vendorRows.map((v) => ({
      ...serializeVendor(v),
      profile: profileMap.get(v.id) || null,
    })),
  };
}

export async function updateAdminSellerApproval(req: AuthRequest) {
  const vendorId = parseNumericId(req.params.id, 'vendor id', 'INVALID_VENDOR_ID');
  const { approval_status, commission_rate, rejection_reason } = req.body as {
    approval_status?: string;
    commission_rate?: number;
    rejection_reason?: string;
  };

  const validatedStatus = approval_status
    ? assertEnum(approval_status, SELLER_APPROVAL_STATUSES, 'approval status', 'INVALID_STATUS')
    : undefined;

  let formattedCommission: string | undefined;
  if (commission_rate !== undefined) {
    const rate = Number(commission_rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new ApiError(400, 'Commission rate must be between 0 and 100.', 'INVALID_COMMISSION');
    }
    formattedCommission = rate.toFixed(2);
  }

  const [updated] = await db
    .update(vendors)
    .set({
      ...(validatedStatus
        ? {
            approvalStatus: validatedStatus,
            isVerified: validatedStatus === 'approved',
          }
        : {}),
      ...(formattedCommission !== undefined ? { commissionRate: formattedCommission } : {}),
      updatedAt: new Date(),
    })
    .where(eq(vendors.id, vendorId))
    .returning();

  if (!updated) throw new ApiError(404, 'Vendor not found.', 'VENDOR_NOT_FOUND');

  if (validatedStatus) {
    await db
      .update(sellerProfiles)
      .set({
        approvalStatus: validatedStatus,
        rejectionReason: rejection_reason || null,
        approvedBy: validatedStatus === 'approved' ? req.authUser!.id : null,
        approvedAt: validatedStatus === 'approved' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.vendorId, vendorId));

    if (updated.ownerUserId) {
      await createNotification({
        userId: updated.ownerUserId,
        roleScope: 'seller',
        title: `Store ${validatedStatus === 'approved' ? 'Approved!' : 'Status Updated'}`,
        message:
          validatedStatus === 'approved'
            ? `Congratulations! ${updated.name} is now approved to list products and fulfill live orders.`
            : `Your store status changed to ${validatedStatus}. ${rejection_reason || ''}`,
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
    details: { approval_status: validatedStatus, commission_rate, rejection_reason },
  });

  return { success: true, vendor: serializeVendor(updated) };
}

export async function listAdminProducts() {
  const rows = await db.select().from(products).orderBy(desc(products.createdAt)).limit(100);
  return { count: rows.length, results: rows };
}

export async function moderateAdminProduct(req: AuthRequest) {
  const productId = parseNumericId(req.params.id, 'product id', 'INVALID_PRODUCT_ID');
  const { approval_status, is_active } = req.body as {
    approval_status?: string;
    is_active?: boolean;
  };

  const validatedStatus = approval_status
    ? assertEnum(approval_status, PRODUCT_MODERATION_STATUSES, 'product approval status', 'INVALID_STATUS')
    : undefined;

  const [updated] = await db
    .update(products)
    .set({
      ...(validatedStatus ? { approvalStatus: validatedStatus } : {}),
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
    details: { approval_status: validatedStatus, is_active },
  });

  return { success: true, product: updated };
}

export async function createAdminCategory(body: Record<string, any>) {
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
  } = body;
  if (!name?.trim() || !slug?.trim()) {
    throw new ApiError(400, 'Category name and slug are required.', 'MISSING_FIELDS');
  }
  const [created] = await db
    .insert(categories)
    .values({
      externalKey: `cat-${String(slug).trim().toLowerCase()}`,
      name: String(name).trim(),
      nameNe: name_ne?.trim() || String(name).trim(),
      slug: String(slug).trim().toLowerCase(),
      icon: icon || 'Package',
      accent: accent || '#059669',
      description: description || '',
      imageUrl: image_url?.trim() || null,
      parentId: parent_id ? parsePositiveInt(parent_id, 'parent_id', 'INVALID_PARENT_ID') : null,
      displayOrder:
        display_order !== undefined
          ? parseNonNegativeInt(display_order, 'display_order', 'INVALID_ORDER')
          : 11,
    })
    .returning();
  return { success: true, category: created };
}

export async function updateAdminCategory(idRaw: unknown, body: Record<string, any>) {
  const catId = parseNumericId(idRaw, 'category id', 'INVALID_ID');
  const [updated] = await db
    .update(categories)
    .set({
      ...(body.name ? { name: String(body.name).trim() } : {}),
      ...(body.name_ne ? { nameNe: String(body.name_ne).trim() } : {}),
      ...(body.description !== undefined ? { description: String(body.description).trim() } : {}),
      ...(body.image_url !== undefined
        ? { imageUrl: body.image_url ? String(body.image_url).trim() : null }
        : {}),
      ...(body.display_order !== undefined
        ? { displayOrder: parseNonNegativeInt(body.display_order, 'display_order', 'INVALID_ORDER') }
        : {}),
      ...(body.is_active !== undefined ? { isActive: Boolean(body.is_active) } : {}),
    })
    .where(eq(categories.id, catId))
    .returning();
  if (!updated) throw new ApiError(404, 'Category not found.', 'NOT_FOUND');
  return { success: true, category: updated };
}

export async function deactivateAdminCategory(idRaw: unknown) {
  const catId = parseNumericId(idRaw, 'category id', 'INVALID_ID');
  await db.update(categories).set({ isActive: false }).where(eq(categories.id, catId));
  return { success: true };
}

export async function listAdminPromotions() {
  const rows = await db.select().from(promotions).orderBy(asc(promotions.sortOrder));
  return { count: rows.length, results: rows.map(serializePromotion) };
}

export async function createAdminPromotion(body: Record<string, any>) {
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
  } = body;

  if (!title?.trim() || !subtitle?.trim() || !image_url?.trim()) {
    throw new ApiError(400, 'Promotion title, subtitle, and image_url are required.', 'MISSING_FIELDS');
  }

  const startsAt = parseOptionalDate(starts_at, 'starts_at') ?? null;
  const endsAt = parseOptionalDate(ends_at, 'ends_at') ?? null;

  const [created] = await db
    .insert(promotions)
    .values({
      externalKey: `promo-${Date.now()}`,
      title: String(title).trim(),
      titleNe: title_ne?.trim() || String(title).trim(),
      subtitle: String(subtitle).trim(),
      subtitleNe: subtitle_ne?.trim() || String(subtitle).trim(),
      badge: badge?.trim() || 'FEATURED',
      badgeNe: badge?.trim() || 'विशेष',
      ctaText: cta_text?.trim() || 'Shop Now',
      ctaTextNe: cta_text?.trim() || 'अहिले किन्नुहोस्',
      ctaCategory: cta_category || 'fruits-vegetables',
      destinationUrl: destination_url?.trim() || null,
      imageUrl: String(image_url).trim(),
      couponCode: coupon_code || null,
      colorTheme: color_theme || 'emerald',
      placement: placement || 'hero',
      sortOrder:
        sort_order !== undefined
          ? parseNonNegativeInt(sort_order, 'sort_order', 'INVALID_SORT_ORDER')
          : 10,
      isActive: true,
      startsAt,
      endsAt,
    })
    .returning();

  return { success: true, promotion: serializePromotion(created) };
}

export async function updateAdminPromotion(idRaw: unknown, body: Record<string, any>) {
  const promoId = parseNumericId(idRaw, 'promotion id', 'INVALID_PROMO_ID');
  const {
    is_active,
    title,
    subtitle,
    sort_order,
    image_url,
    destination_url,
    starts_at,
    ends_at,
  } = body;

  const startsAt = parseOptionalDate(starts_at, 'starts_at');
  const endsAt = parseOptionalDate(ends_at, 'ends_at');

  const [updated] = await db
    .update(promotions)
    .set({
      ...(is_active !== undefined ? { isActive: Boolean(is_active) } : {}),
      ...(title ? { title: String(title).trim() } : {}),
      ...(subtitle ? { subtitle: String(subtitle).trim() } : {}),
      ...(sort_order !== undefined
        ? { sortOrder: parseNonNegativeInt(sort_order, 'sort_order', 'INVALID_SORT_ORDER') }
        : {}),
      ...(image_url ? { imageUrl: String(image_url).trim() } : {}),
      ...(destination_url !== undefined
        ? { destinationUrl: destination_url ? String(destination_url).trim() : null }
        : {}),
      ...(startsAt !== undefined ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
    })
    .where(eq(promotions.id, promoId))
    .returning();

  if (!updated) throw new ApiError(404, 'Promotion not found.', 'NOT_FOUND');
  return { success: true, promotion: serializePromotion(updated) };
}

export async function deleteAdminPromotion(idRaw: unknown) {
  const promoId = parseNumericId(idRaw, 'promotion id', 'INVALID_PROMO_ID');
  await db.delete(promotions).where(eq(promotions.id, promoId));
  return { success: true };
}

export async function listAdminAdvertisements() {
  const rows = await db
    .select()
    .from(advertisements)
    .orderBy(asc(advertisements.priority), desc(advertisements.id));
  return { count: rows.length, results: rows.map(serializeAdvertisement) };
}

export async function createAdminAdvertisement(body: Record<string, any>) {
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
  } = body;

  if (!title?.trim() || !image_url?.trim()) {
    throw new ApiError(400, 'Advertisement title and image_url are required.', 'MISSING_FIELDS');
  }

  const startsAt = parseOptionalDate(starts_at, 'starts_at') ?? null;
  const endsAt = parseOptionalDate(ends_at, 'ends_at') ?? null;

  const [created] = await db
    .insert(advertisements)
    .values({
      title: String(title).trim(),
      titleNe: title_ne?.trim() || String(title).trim(),
      subtitle: subtitle?.trim() || '',
      subtitleNe: subtitle_ne?.trim() || subtitle?.trim() || '',
      imageUrl: String(image_url).trim(),
      destinationUrl: destination_url?.trim() || '/search',
      placement: placement || 'homepage_mid',
      priority:
        priority !== undefined
          ? parseNonNegativeInt(priority, 'priority', 'INVALID_PRIORITY')
          : 5,
      isActive: true,
      startsAt,
      endsAt,
    })
    .returning();

  return { success: true, advertisement: serializeAdvertisement(created) };
}

export async function updateAdminAdvertisement(idRaw: unknown, body: Record<string, any>) {
  const adId = parseNumericId(idRaw, 'advertisement id', 'INVALID_AD_ID');
  const startsAt = parseOptionalDate(body.starts_at, 'starts_at');
  const endsAt = parseOptionalDate(body.ends_at, 'ends_at');

  const [updated] = await db
    .update(advertisements)
    .set({
      ...(body.title ? { title: String(body.title).trim() } : {}),
      ...(body.subtitle !== undefined ? { subtitle: String(body.subtitle).trim() } : {}),
      ...(body.image_url ? { imageUrl: String(body.image_url).trim() } : {}),
      ...(body.destination_url ? { destinationUrl: String(body.destination_url).trim() } : {}),
      ...(body.placement ? { placement: String(body.placement).trim() } : {}),
      ...(body.priority !== undefined
        ? { priority: parseNonNegativeInt(body.priority, 'priority', 'INVALID_PRIORITY') }
        : {}),
      ...(body.is_active !== undefined ? { isActive: Boolean(body.is_active) } : {}),
      ...(startsAt !== undefined ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(advertisements.id, adId))
    .returning();

  if (!updated) throw new ApiError(404, 'Advertisement not found.', 'NOT_FOUND');
  return { success: true, advertisement: serializeAdvertisement(updated) };
}

export async function deleteAdminAdvertisement(idRaw: unknown) {
  const adId = parseNumericId(idRaw, 'advertisement id', 'INVALID_AD_ID');
  await db.delete(advertisements).where(eq(advertisements.id, adId));
  return { success: true };
}

export async function listAdminPayments() {
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

  return {
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
  };
}

export async function listAdminOrders() {
  const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
  const serialized = await serializeOrdersBatch(orderRows);
  return { count: serialized.length, results: serialized };
}

export async function assignAdminOrderRider(req: AuthRequest) {
  const orderRow = await resolveOrderByIdentifier(req.params.id);
  if (!orderRow) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');

  const agentId = parseNumericId(req.body?.agent_id, 'agent_id', 'INVALID_AGENT_ID');
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

    const startLat =
      agent.currentLat || existingAssign[0]?.pickupLat || resolvedPickupLat || orderRow.deliveryLat || '';
    const startLng =
      agent.currentLng || existingAssign[0]?.pickupLng || resolvedPickupLng || orderRow.deliveryLng || '';

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

  return { success: true, message: `Assigned ${agent.fullName} to ${orderRow.orderNumber}.` };
}

export async function listAdminRefunds() {
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

  return {
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
  };
}

export async function updateAdminRefund(req: AuthRequest) {
  const refundId = parseNumericId(req.params.id, 'refund id', 'INVALID_REFUND_ID');
  const { status, admin_note } = req.body as { status?: string; admin_note?: string };
  const validatedStatus = assertEnum(status, REFUND_STATUSES, 'refund status', 'INVALID_STATUS');

  const [updated] = await db
    .update(refunds)
    .set({
      status: validatedStatus,
      adminNote: admin_note || null,
      processedBy: req.authUser!.id,
      processedAt: new Date(),
    })
    .where(eq(refunds.id, refundId))
    .returning();

  if (!updated) throw new ApiError(404, 'Refund not found.', 'REFUND_NOT_FOUND');

  if (validatedStatus === 'processed' && updated.paymentId) {
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
    details: { status: validatedStatus, admin_note },
  });

  return { success: true, refund: updated };
}

export async function listAdminZones() {
  const zones = await db.select().from(deliveryZones).orderBy(asc(deliveryZones.id));
  return { count: zones.length, results: zones };
}

export async function createAdminZone(body: Record<string, any>) {
  const { name, slug, city, base_delivery_fee, free_delivery_threshold, estimated_mins, radius_km } = body;
  if (!name?.trim() || !slug?.trim()) {
    throw new ApiError(400, 'Zone name and slug are required.', 'MISSING_FIELDS');
  }
  const [created] = await db
    .insert(deliveryZones)
    .values({
      name: String(name).trim(),
      slug: String(slug).trim().toLowerCase(),
      city: city || 'Kathmandu',
      baseDeliveryFee:
        base_delivery_fee !== undefined
          ? parseNonNegativeInt(base_delivery_fee, 'base_delivery_fee', 'INVALID_FEE')
          : 35,
      freeDeliveryThreshold:
        free_delivery_threshold !== undefined
          ? parseNonNegativeInt(free_delivery_threshold, 'free_delivery_threshold', 'INVALID_THRESHOLD')
          : 499,
      estimatedMins:
        estimated_mins !== undefined
          ? parsePositiveInt(estimated_mins, 'estimated_mins', 'INVALID_ETA')
          : 12,
      radiusKm: String(radius_km ?? '5.00'),
    })
    .returning();
  return { success: true, zone: created };
}

export async function listAdminRiders() {
  const rows = await db.select().from(deliveryAgents).orderBy(asc(deliveryAgents.id));
  return { count: rows.length, results: rows };
}

export async function updateAdminRider(idRaw: unknown, body: Record<string, any>) {
  const agentId = parseNumericId(idRaw, 'rider id', 'INVALID_AGENT_ID');
  const { verification_status, availability_status } = body;

  const validatedVerification = verification_status
    ? assertEnum(verification_status, RIDER_VERIFICATION_STATUSES, 'verification_status', 'INVALID_STATUS')
    : undefined;
  const validatedAvailability = availability_status
    ? assertEnum(availability_status, RIDER_AVAILABILITY_STATUSES, 'availability_status', 'INVALID_STATUS')
    : undefined;

  const [updated] = await db
    .update(deliveryAgents)
    .set({
      ...(validatedVerification ? { verificationStatus: validatedVerification } : {}),
      ...(validatedAvailability ? { availabilityStatus: validatedAvailability } : {}),
      updatedAt: new Date(),
    })
    .where(eq(deliveryAgents.id, agentId))
    .returning();

  if (!updated) throw new ApiError(404, 'Delivery rider not found.', 'AGENT_NOT_FOUND');
  return { success: true, rider: updated };
}

export async function listAdminCoupons() {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  return { count: rows.length, results: rows };
}

export async function createAdminCoupon(body: Record<string, any>) {
  const { code, description, discount_type, discount_value, max_discount_amount, min_order_amount } = body;
  if (!code?.trim() || !description?.trim()) {
    throw new ApiError(400, 'Coupon code and description are required.', 'MISSING_FIELDS');
  }
  const [created] = await db
    .insert(coupons)
    .values({
      code: String(code).trim().toUpperCase(),
      description: String(description).trim(),
      discountType: discount_type || 'percentage',
      discountValue:
        discount_value !== undefined
          ? parseNonNegativeInt(discount_value, 'discount_value', 'INVALID_DISCOUNT')
          : 10,
      maxDiscountAmount: max_discount_amount
        ? parsePositiveInt(max_discount_amount, 'max_discount_amount', 'INVALID_DISCOUNT')
        : null,
      minOrderAmount:
        min_order_amount !== undefined
          ? parseNonNegativeInt(min_order_amount, 'min_order_amount', 'INVALID_MIN_ORDER')
          : 200,
      isActive: true,
    })
    .returning();
  return { success: true, coupon: created };
}

export async function updateAdminCoupon(idRaw: unknown, isActive: boolean) {
  const couponId = parseNumericId(idRaw, 'coupon id', 'INVALID_COUPON_ID');
  const [updated] = await db
    .update(coupons)
    .set({ isActive: Boolean(isActive) })
    .where(eq(coupons.id, couponId))
    .returning();
  if (!updated) throw new ApiError(404, 'Coupon not found.', 'COUPON_NOT_FOUND');
  return { success: true, coupon: updated };
}

export async function getAdminSettlements() {
  const [vendorRows, existingSettlements, balances] = await Promise.all([
    db.select().from(vendors).where(eq(vendors.approvalStatus, 'approved')),
    db
      .select({ settlement: settlements, vendorName: vendors.name })
      .from(settlements)
      .innerJoin(vendors, eq(settlements.vendorId, vendors.id))
      .orderBy(desc(settlements.createdAt)),
    db.execute(sql`
      SELECT
        vendor_id,
        COALESCE(SUM(CASE WHEN entry_type = 'sale_credit' THEN amount ELSE 0 END), 0)::int AS gross_sales,
        COALESCE(SUM(CASE WHEN entry_type = 'commission_debit' THEN ABS(amount) ELSE 0 END), 0)::int AS commission,
        COALESCE(SUM(amount), 0)::int AS net_balance
      FROM financial_ledger
      GROUP BY vendor_id
    `),
  ]);

  const balMap = new Map((balances.rows as any[]).map((b) => [Number(b.vendor_id), b]));

  return {
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
  };
}

export async function generateAdminSettlement(req: AuthRequest) {
  const vendorId = parseNumericId(req.body?.vendor_id, 'vendor_id', 'INVALID_VENDOR_ID');
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

  return { success: true, settlement: created };
}

export async function payAdminSettlement(req: AuthRequest) {
  const settlementId = parseNumericId(req.params.id, 'settlement id', 'INVALID_SETTLEMENT_ID');
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

  return { success: true, settlement: updated };
}

export async function listAdminTickets() {
  const rows = await db
    .select({ ticket: supportTickets, customerName: users.fullName, customerEmail: users.email })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.updatedAt));

  if (rows.length === 0) {
    return { count: 0, results: [] };
  }

  const ticketIds = rows.map((r) => r.ticket.id);
  const allMsgs = await db
    .select()
    .from(ticketMessages)
    .where(inArray(ticketMessages.ticketId, ticketIds))
    .orderBy(ticketMessages.id);

  const msgsByTicket = new Map<number, (typeof ticketMessages.$inferSelect)[]>();
  for (const msg of allMsgs) {
    const list = msgsByTicket.get(msg.ticketId) || [];
    list.push(msg);
    msgsByTicket.set(msg.ticketId, list);
  }

  const results = rows.map((r) => ({
    ...r.ticket,
    customer_name: r.customerName || 'Customer',
    customer_email: r.customerEmail || '',
    messages: msgsByTicket.get(r.ticket.id) || [],
  }));

  return { count: results.length, results };
}

export async function updateAdminTicket(req: AuthRequest) {
  const ticketId = parseNumericId(req.params.id, 'ticket id', 'INVALID_TICKET_ID');
  const { status } = req.body as { status?: string };
  const validatedStatus = status
    ? assertEnum(status, TICKET_STATUSES, 'ticket status', 'INVALID_STATUS')
    : undefined;

  const [updated] = await db
    .update(supportTickets)
    .set({
      ...(validatedStatus ? { status: validatedStatus } : {}),
      assignedAdminId: req.authUser!.id,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, ticketId))
    .returning();

  if (!updated) throw new ApiError(404, 'Support ticket not found.', 'TICKET_NOT_FOUND');
  return { success: true, ticket: updated };
}

export async function listAdminAuditLogs() {
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
  return { count: rows.length, results: rows };
}

export async function listAdminSettings() {
  const rows = await db.select().from(platformSettings);
  return { count: rows.length, results: rows };
}

export async function upsertAdminSetting(req: AuthRequest) {
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
      .set({
        value,
        ...(description ? { description } : {}),
        updatedBy: req.authUser!.id,
        updatedAt: new Date(),
      })
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

  return { success: true, setting: saved };
}
