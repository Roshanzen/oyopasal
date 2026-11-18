import { Router } from 'express';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  addresses,
  notifications,
  products,
  supportTickets,
  ticketMessages,
  users,
  wishlists,
} from '../../src/db/schema.ts';
import {
  AuthRequest,
  getEffectiveSessionKey,
  optionalAuth,
  requireAuth,
} from '../middleware/auth.ts';
import { hydrateProducts, resolveProductByIdentifier } from '../services/catalogService.ts';
import { createNotification } from '../utils/audit.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

function serializeAddress(a: typeof addresses.$inferSelect) {
  return {
    id: `addr-${a.id}`,
    db_id: a.id,
    title: a.title,
    recipient_name: a.recipientName,
    phone: a.phone,
    street: a.street,
    area: a.area,
    city: a.city,
    landmark: a.landmark,
    is_default: a.isDefault,
    lat: parseFloat(a.lat),
    lng: parseFloat(a.lng),
  };
}

// GET /api/v1/account/addresses/
router.get(
  '/account/addresses/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    let targetUserId = req.authUser?.id;
    if (!targetUserId) {
      // If unauthenticated guest, return empty list cleanly without leaking another user's private addresses
      return res.json({ count: 0, results: [] });
    }

    const rows = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, targetUserId))
      .orderBy(desc(addresses.isDefault), desc(addresses.id));

    res.json({
      count: rows.length,
      results: rows.map(serializeAddress),
    });
  })
);

// POST /api/v1/account/addresses/
router.post(
  '/account/addresses/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      title,
      recipient_name,
      phone,
      street,
      area,
      city,
      landmark,
      is_default,
      lat,
      lng,
    } = req.body as {
      title?: string;
      recipient_name?: string;
      phone?: string;
      street?: string;
      area?: string;
      city?: string;
      landmark?: string;
      is_default?: boolean;
      lat?: number;
      lng?: number;
    };

    if (!street?.trim() || !area?.trim()) {
      throw new ApiError(400, 'Street address and area are required.', 'MISSING_ADDRESS_FIELDS');
    }

    if (is_default) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, req.authUser!.id));
    }

    const [created] = await db
      .insert(addresses)
      .values({
        userId: req.authUser!.id,
        title: title?.trim() || 'Home',
        recipientName: recipient_name?.trim() || req.authUser!.fullName || 'Customer',
        phone: phone?.trim() || req.authUser!.phone || '+977 9800000000',
        street: street.trim(),
        area: area.trim(),
        city: city?.trim() || 'Kathmandu',
        landmark: landmark?.trim() || '',
        lat: String(lat ?? 27.6986),
        lng: String(lng ?? 85.3292),
        isDefault: Boolean(is_default),
      })
      .returning();

    if (created.isDefault) {
      await db
        .update(users)
        .set({ defaultAddressId: created.id })
        .where(eq(users.id, req.authUser!.id));
    }

    res.status(201).json(serializeAddress(created));
  })
);

// PUT /api/v1/account/addresses/:id/
router.put(
  '/account/addresses/:id/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const idNum = parseInt(req.params.id.replace(/^addr-/, ''), 10);
    if (Number.isNaN(idNum)) {
      throw new ApiError(400, 'Invalid address id.', 'INVALID_ADDRESS_ID');
    }

    const existing = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, idNum), eq(addresses.userId, req.authUser!.id)))
      .limit(1);

    if (existing.length === 0) {
      throw new ApiError(404, 'Address not found.', 'ADDRESS_NOT_FOUND');
    }

    if (req.body.is_default) {
      await db
        .update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, req.authUser!.id));
    }

    const [updated] = await db
      .update(addresses)
      .set({
        ...(req.body.title ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.recipient_name ? { recipientName: String(req.body.recipient_name).trim() } : {}),
        ...(req.body.phone ? { phone: String(req.body.phone).trim() } : {}),
        ...(req.body.street ? { street: String(req.body.street).trim() } : {}),
        ...(req.body.area ? { area: String(req.body.area).trim() } : {}),
        ...(req.body.city ? { city: String(req.body.city).trim() } : {}),
        ...(req.body.landmark !== undefined ? { landmark: String(req.body.landmark).trim() } : {}),
        ...(req.body.is_default !== undefined ? { isDefault: Boolean(req.body.is_default) } : {}),
        ...(req.body.lat !== undefined ? { lat: String(req.body.lat) } : {}),
        ...(req.body.lng !== undefined ? { lng: String(req.body.lng) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(addresses.id, idNum))
      .returning();

    res.json(serializeAddress(updated));
  })
);

// DELETE /api/v1/account/addresses/:id/
router.delete(
  '/account/addresses/:id/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const idNum = parseInt(req.params.id.replace(/^addr-/, ''), 10);
    if (Number.isNaN(idNum)) {
      throw new ApiError(400, 'Invalid address id.', 'INVALID_ADDRESS_ID');
    }

    const existing = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, idNum), eq(addresses.userId, req.authUser!.id)))
      .limit(1);
    if (existing.length === 0) {
      throw new ApiError(404, 'Address not found.', 'ADDRESS_NOT_FOUND');
    }

    await db.delete(addresses).where(eq(addresses.id, idNum));
    res.json({ success: true });
  })
);

// GET /api/v1/wishlist/
router.get(
  '/wishlist/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const sessionKey = getEffectiveSessionKey(req);
    const rows = req.authUser
      ? await db.select().from(wishlists).where(eq(wishlists.userId, req.authUser.id))
      : await db.select().from(wishlists).where(eq(wishlists.sessionKey, sessionKey));

    if (rows.length === 0) {
      return res.json({ count: 0, next: null, previous: null, results: [] });
    }

    const productIds = rows.map((r) => r.productId);
    const prodRows = await db.select().from(products).where(inArray(products.id, productIds));
    const serialized = await hydrateProducts(prodRows);

    res.json({
      count: serialized.length,
      next: null,
      previous: null,
      results: serialized,
    });
  })
);

// POST /api/v1/wishlist/toggle/
router.post(
  '/wishlist/toggle/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { product_id } = req.body as { product_id?: string };
    if (!product_id) {
      throw new ApiError(400, 'product_id is required.', 'MISSING_PRODUCT_ID');
    }
    const pRow = await resolveProductByIdentifier(product_id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }

    const sessionKey = getEffectiveSessionKey(req);
    const whereOwner = req.authUser
      ? and(eq(wishlists.userId, req.authUser.id), eq(wishlists.productId, pRow.id))
      : and(eq(wishlists.sessionKey, sessionKey), eq(wishlists.productId, pRow.id));

    const existing = await db.select().from(wishlists).where(whereOwner).limit(1);
    let isWishlisted = false;

    if (existing.length > 0) {
      await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
      isWishlisted = false;
    } else {
      await db.insert(wishlists).values({
        userId: req.authUser?.id ?? null,
        sessionKey: req.authUser ? null : sessionKey,
        productId: pRow.id,
      });
      isWishlisted = true;
    }

    const updatedRows = req.authUser
      ? await db.select().from(wishlists).where(eq(wishlists.userId, req.authUser.id))
      : await db.select().from(wishlists).where(eq(wishlists.sessionKey, sessionKey));

    const pIds = updatedRows.map((w) => w.productId);
    const pObjs =
      pIds.length > 0 ? await db.select().from(products).where(inArray(products.id, pIds)) : [];
    const wishlistIds = pObjs.map((p) => p.externalKey || `prod-${p.id}`);

    res.json({
      product_id: pRow.externalKey || `prod-${pRow.id}`,
      is_wishlisted: isWishlisted,
      wishlist_ids: wishlistIds,
    });
  })
);

// GET /api/v1/notifications/
router.get(
  '/notifications/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const rows = req.authUser
      ? await db
          .select()
          .from(notifications)
          .where(or(eq(notifications.userId, req.authUser.id), eq(notifications.roleScope, 'all')))
          .orderBy(desc(notifications.createdAt))
          .limit(30)
      : await db
          .select()
          .from(notifications)
          .where(eq(notifications.roleScope, 'all'))
          .orderBy(desc(notifications.createdAt))
          .limit(10);

    res.json({
      count: rows.length,
      results: rows.map((n) => ({
        id: `notif-${n.id}`,
        db_id: n.id,
        title: n.title,
        message: n.message,
        created_at: n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Just now',
        read: n.isRead,
        type: n.type,
        reference_url: n.referenceUrl,
      })),
    });
  })
);

// PATCH /api/v1/notifications/:id/read/
router.patch(
  '/notifications/:id/read/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const idNum = parseInt(req.params.id.replace(/^notif-/, ''), 10);
    if (Number.isNaN(idNum)) {
      throw new ApiError(400, 'Invalid notification id.', 'INVALID_ID');
    }
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, idNum), eq(notifications.userId, req.authUser!.id)));
    res.json({ success: true });
  })
);

// PATCH /api/v1/notifications/read-all/
router.patch(
  '/notifications/read-all/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.authUser!.id));
    res.json({ success: true });
  })
);

// GET /api/v1/support/tickets/
router.get(
  '/support/tickets/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const tickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, req.authUser!.id))
      .orderBy(desc(supportTickets.updatedAt));

    const results = await Promise.all(
      tickets.map(async (tk) => {
        const msgs = await db
          .select()
          .from(ticketMessages)
          .where(eq(ticketMessages.ticketId, tk.id))
          .orderBy(ticketMessages.id);
        return {
          id: tk.id,
          ticket_number: tk.ticketNumber,
          category: tk.category,
          subject: tk.subject,
          status: tk.status,
          priority: tk.priority,
          order_id: tk.orderId,
          created_at: tk.createdAt?.toISOString() || new Date().toISOString(),
          messages: msgs.map((m) => ({
            id: m.id,
            sender_role: m.senderRole,
            message: m.message,
            created_at: m.createdAt?.toISOString() || new Date().toISOString(),
          })),
        };
      })
    );

    res.json({ count: results.length, results });
  })
);

// POST /api/v1/support/tickets/
router.post(
  '/support/tickets/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { category, subject, message, order_id, priority } = req.body as {
      category?: string;
      subject?: string;
      message?: string;
      order_id?: number;
      priority?: string;
    };

    if (!subject?.trim() || !message?.trim()) {
      throw new ApiError(400, 'Subject and message are required.', 'MISSING_TICKET_FIELDS');
    }

    const ticketNumber = `TKT-${Math.floor(10000 + Math.random() * 89999)}`;
    const [created] = await db
      .insert(supportTickets)
      .values({
        ticketNumber,
        userId: req.authUser!.id,
        orderId: order_id || null,
        category: category?.trim() || 'order_issue',
        subject: subject.trim(),
        status: 'open',
        priority: priority || 'normal',
      })
      .returning();

    await db.insert(ticketMessages).values({
      ticketId: created.id,
      senderUserId: req.authUser!.id,
      senderRole: req.authUser!.role,
      message: message.trim(),
    });

    await createNotification({
      roleScope: 'admin',
      title: `New Support Ticket ${ticketNumber}`,
      message: `${req.authUser!.fullName || 'Customer'}: ${subject.trim()}`,
      type: 'support',
      referenceUrl: '/admin',
    });

    res.status(201).json({
      success: true,
      ticket: {
        id: created.id,
        ticket_number: created.ticketNumber,
        subject: created.subject,
        status: created.status,
      },
    });
  })
);

// POST /api/v1/support/tickets/:id/reply/
router.post(
  '/support/tickets/:id/reply/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const ticketId = parseInt(req.params.id, 10);
    const { message } = req.body as { message?: string };
    if (!message?.trim()) {
      throw new ApiError(400, 'Reply message cannot be empty.', 'MISSING_MESSAGE');
    }

    const tkRows = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);
    if (tkRows.length === 0) {
      throw new ApiError(404, 'Support ticket not found.', 'TICKET_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && tkRows[0].userId !== req.authUser!.id) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }

    const [msg] = await db
      .insert(ticketMessages)
      .values({
        ticketId,
        senderUserId: req.authUser!.id,
        senderRole: req.authUser!.role,
        message: message.trim(),
      })
      .returning();

    await db
      .update(supportTickets)
      .set({
        status: req.authUser!.role === 'admin' ? 'in_progress' : tkRows[0].status,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticketId));

    res.status(201).json({ success: true, message: msg });
  })
);

export default router;
