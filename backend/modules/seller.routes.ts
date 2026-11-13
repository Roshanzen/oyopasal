import { Router } from 'express';
import crypto from 'crypto';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  categories,
  financialLedger,
  inventoryMovements,
  orderItems,
  orders,
  orderStatusHistory,
  productImages,
  products,
  productVariants,
  reviews,
  sellerProfiles,
  settlements,
  users,
  vendorFulfillments,
  vendors,
} from '../../src/db/schema.ts';
import {
  AuthRequest,
  requireApprovedSeller,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import {
  hydrateProducts,
  resolveProductByIdentifier,
  resolveVendorByIdentifier,
  serializeVendor,
} from '../services/catalogService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

async function resolveSellerVendor(req: AuthRequest) {
  const requestedVendorId = req.query.vendor_id || req.body?.vendor_id;
  if (requestedVendorId) {
    const v = await resolveVendorByIdentifier(String(requestedVendorId));
    if (!v) {
      throw new ApiError(404, 'Requested seller store not found.', 'SELLER_VENDOR_NOT_FOUND');
    }
    if (req.authUser?.role === 'admin') {
      return v;
    }
    if (req.authUser) {
      if (v.ownerUserId === req.authUser.id) {
        return v;
      }
      const sp = await db
        .select()
        .from(sellerProfiles)
        .where(and(eq(sellerProfiles.userId, req.authUser.id), eq(sellerProfiles.vendorId, v.id)))
        .limit(1);
      if (sp.length > 0) {
        return v;
      }
      throw new ApiError(
        403,
        `Your active seller session does not manage "${v.name}". Please sign in as that store.`,
        'FORBIDDEN_VENDOR'
      );
    }
  }
  if (req.authUser?.vendorId) {
    const vRows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, req.authUser.vendorId))
      .limit(1);
    if (vRows[0]) return vRows[0];
  }
  throw new ApiError(403, 'Seller store account not found.', 'SELLER_VENDOR_NOT_FOUND');
}

// GET /api/v1/seller/dashboard/
router.get(
  '/seller/dashboard/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);

    const [vendorProducts, fulfillments, ledgerRows, orderItemRows] = await Promise.all([
      db.select().from(products).where(eq(products.vendorId, vendor.id)).orderBy(desc(products.id)),
      db
        .select()
        .from(vendorFulfillments)
        .where(eq(vendorFulfillments.vendorId, vendor.id))
        .orderBy(desc(vendorFulfillments.createdAt)),
      db
        .select()
        .from(financialLedger)
        .where(eq(financialLedger.vendorId, vendor.id))
        .orderBy(desc(financialLedger.createdAt))
        .limit(50),
      db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          qty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
          rev: sql<number>`COALESCE(SUM(${orderItems.totalPrice}), 0)::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orderItems.vendorId, vendor.id), sql`${orders.status} != 'CANCELLED'`))
        .groupBy(orderItems.productId, orderItems.productName)
        .orderBy(desc(sql`SUM(${orderItems.totalPrice})`))
        .limit(5),
    ]);

    const nonCancelled = fulfillments.filter((f) => !['CANCELLED', 'REJECTED'].includes(f.status));
    const totalSales = nonCancelled.reduce((sum, f) => sum + f.subtotal, 0);
    const totalCommission = nonCancelled.reduce((sum, f) => sum + f.commissionAmount, 0);
    const netEarnings = nonCancelled.reduce((sum, f) => sum + f.vendorNetPayout, 0);
    const pendingOrdersCount = fulfillments.filter((f) =>
      ['ORDER_PLACED', 'CONFIRMED_BY_VENDOR', 'PACKED_BY_VENDOR'].includes(f.status)
    ).length;

    const lowStockProducts = vendorProducts.filter((p) => p.stockCount <= p.lowStockThreshold || !p.inStock);
    const serializedProducts = await hydrateProducts(vendorProducts);

    res.json({
      vendor: serializeVendor(vendor),
      approval_status: vendor.approvalStatus,
      stats: {
        total_products: vendorProducts.length,
        in_stock_count: vendorProducts.filter((p) => p.inStock && p.stockCount > 0).length,
        low_stock_count: lowStockProducts.length,
        total_orders: nonCancelled.length,
        pending_orders: pendingOrdersCount,
        total_revenue: totalSales,
        total_commission: totalCommission,
        net_earnings: netEarnings,
        commission_rate: Number(vendor.commissionRate),
      },
      top_products: orderItemRows,
      recent_ledger: ledgerRows,
      products: serializedProducts,
    });
  })
);

// GET /api/v1/seller/analytics/ (Real PostgreSQL SQL Aggregations — Zero Hardcoded Charts)
router.get(
  '/seller/analytics/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const monthsLimit = Math.min(12, Math.max(1, parseInt(String(req.query.months || '6'), 10) || 6));

    const [monthlyRows, topProductRows, categoryRows, statusBreakdown] = await Promise.all([
      db.execute(sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', o.created_at), 'Mon YY') AS month_label,
          DATE_TRUNC('month', o.created_at) AS month_sort,
          COALESCE(SUM(vf.subtotal), 0)::int AS revenue,
          COUNT(vf.id)::int AS orders_count,
          COALESCE(SUM(vf.vendor_net_payout), 0)::int AS net_payout
        FROM vendor_fulfillments vf
        INNER JOIN orders o ON vf.order_id = o.id
        WHERE vf.vendor_id = ${vendor.id}
          AND vf.status NOT IN ('CANCELLED', 'REJECTED')
          AND o.created_at >= NOW() - (${monthsLimit} || ' months')::interval
        GROUP BY DATE_TRUNC('month', o.created_at)
        ORDER BY month_sort ASC
      `),
      db.execute(sql`
        SELECT
          oi.product_name AS name,
          COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
          COALESCE(SUM(oi.total_price), 0)::int AS revenue
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE oi.vendor_id = ${vendor.id}
          AND o.status != 'CANCELLED'
        GROUP BY oi.product_name
        ORDER BY revenue DESC
        LIMIT 6
      `),
      db.execute(sql`
        SELECT
          COALESCE(p.category, 'General') AS category,
          COALESCE(SUM(oi.total_price), 0)::int AS revenue,
          COALESCE(SUM(oi.quantity), 0)::int AS units
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.vendor_id = ${vendor.id}
          AND o.status != 'CANCELLED'
        GROUP BY p.category
        ORDER BY revenue DESC
      `),
      db.execute(sql`
        SELECT status, COUNT(*)::int AS count
        FROM vendor_fulfillments
        WHERE vendor_id = ${vendor.id}
        GROUP BY status
      `),
    ]);

    const monthlyTrend = (monthlyRows.rows as any[]).map((r) => ({
      month: String(r.month_label),
      revenue: Number(r.revenue || 0),
      orders: Number(r.orders_count || 0),
      netPayout: Number(r.net_payout || 0),
    }));

    const topProducts = (topProductRows.rows as any[]).map((r) => ({
      name: String(r.name),
      shortName: String(r.name).length > 20 ? `${String(r.name).slice(0, 18)}…` : String(r.name),
      units: Number(r.units_sold || 0),
      revenue: Number(r.revenue || 0),
    }));

    const totalRevenue = topProducts.reduce((sum, p) => sum + p.revenue, 0);
    const totalOrders = monthlyTrend.reduce((sum, m) => sum + m.orders, 0);

    res.json({
      vendor_id: vendor.externalKey || `v-${vendor.id}`,
      period_months: monthsLimit,
      summary: {
        total_revenue: monthlyTrend.reduce((sum, m) => sum + m.revenue, 0) || totalRevenue,
        total_orders: totalOrders,
        avg_order_value: totalOrders > 0 ? Math.round(monthlyTrend.reduce((s, m) => s + m.revenue, 0) / totalOrders) : 0,
      },
      monthly_trend: monthlyTrend,
      top_products: topProducts,
      category_breakdown: (categoryRows.rows as any[]).map((r) => ({
        category: String(r.category),
        revenue: Number(r.revenue || 0),
        units: Number(r.units || 0),
      })),
      fulfillment_status_counts: statusBreakdown.rows,
    });
  })
);

// GET /api/v1/seller/products/
router.get(
  '/seller/products/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.vendorId, vendor.id))
      .orderBy(desc(products.id));

    const results = await hydrateProducts(rows);
    res.json({ count: results.length, results });
  })
);

// POST /api/v1/seller/products/
router.post(
  '/seller/products/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const {
      name,
      category_slug,
      unit,
      original_price,
      discounted_price,
      stock = 25,
      low_stock_threshold = 5,
      is_organic = false,
      description,
      image_url,
      gallery_urls,
      sections = ['fresh_arrivals'],
    } = req.body as {
      name?: string;
      category_slug?: string;
      unit?: string;
      original_price?: number;
      discounted_price?: number;
      stock?: number;
      low_stock_threshold?: number;
      is_organic?: boolean;
      description?: string;
      image_url?: string;
      gallery_urls?: string[];
      sections?: string[];
    };

    if (!name?.trim() || !unit?.trim() || !discounted_price) {
      throw new ApiError(400, 'Product name, unit, and price are required.', 'MISSING_FIELDS');
    }

    const discPrice = Math.max(1, Number(discounted_price));
    const origPrice = Math.max(discPrice, Number(original_price || discPrice));
    const stockNum = Math.max(0, Number(stock));
    const discountPercent = origPrice > discPrice ? Math.round(((origPrice - discPrice) / origPrice) * 100) : 0;

    const catSlug = (category_slug || 'grocery').trim();
    const catRow = (
      await db
        .select()
        .from(categories)
        .where(or(eq(categories.slug, catSlug), eq(categories.externalKey, catSlug)))
        .limit(1)
    )[0];

    const slugBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const suffix = crypto.randomBytes(2).toString('hex');
    const extraGallery = Array.isArray(gallery_urls)
      ? gallery_urls.map((u) => String(u).trim()).filter(Boolean)
      : [];
    const finalImage = image_url?.trim() || extraGallery[0] || vendor.image;
    const secs = Array.isArray(sections) && sections.length > 0 ? sections : ['fresh_arrivals'];

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(products)
        .values({
          externalKey: `prod-${slugBase.slice(0, 12)}-${suffix}`,
          slug: `${slugBase}-${suffix}`,
          name: name.trim(),
          category: catRow?.name || 'Grocery & Staples',
          subCategory: catRow?.slug || catSlug,
          categoryId: catRow?.id ?? null,
          sku: `OP-${suffix.toUpperCase()}`,
          price: discPrice,
          originalPrice: origPrice,
          discountPercent,
          unit: unit.trim(),
          inStock: stockNum > 0,
          stockCount: stockNum,
          lowStockThreshold: Math.max(1, Number(low_stock_threshold)),
          isOrganic: Boolean(is_organic),
          origin: `${vendor.area}, ${vendor.city}`,
          rating: '5.0',
          ratingCount: 1,
          image: finalImage,
          description: description?.trim() || `Fresh ${name.trim()} supplied directly by ${vendor.name}.`,
          vendorId: vendor.id,
          vendorName: vendor.name,
          isBestSeller: secs.includes('best_sellers'),
          isTrending: secs.includes('trending'),
          isFresh: secs.includes('fresh_arrivals'),
          isDeal: secs.includes('top_deals'),
          isRecommended: secs.includes('recommended'),
          sections: secs,
          approvalStatus: 'approved',
          isActive: true,
        })
        .returning();

      await tx.insert(productVariants).values({
        externalKey: `var-${inserted.id}-1`,
        productId: inserted.id,
        name: unit.trim(),
        unit: unit.trim(),
        price: discPrice,
        originalPrice: origPrice,
        stock: stockNum,
        isDefault: true,
      });

      const allUrls = Array.from(new Set([finalImage, ...extraGallery]));
      for (let i = 0; i < allUrls.length; i++) {
        await tx.insert(productImages).values({
          productId: inserted.id,
          imageUrl: allUrls[i],
          altText: name.trim(),
          sortOrder: i,
          isPrimary: i === 0,
        });
      }

      await tx.insert(inventoryMovements).values({
        productId: inserted.id,
        vendorId: vendor.id,
        delta: stockNum,
        previousStock: 0,
        newStock: stockNum,
        reason: 'initial',
        actorUserId: req.authUser!.id,
        note: 'Added via Seller Portal',
      });

      return inserted;
    });

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
      action: 'SELLER_PRODUCT_CREATED',
      entityType: 'product',
      entityId: created.id,
      details: { name: created.name, vendorId: vendor.id, price: created.price },
      ipAddress: req.ip,
    });

    const [serialized] = await hydrateProducts([created]);
    res.status(201).json({
      success: true,
      message: `"${created.name}" is now live in the customer store.`,
      product: serialized,
    });
  })
);

// PUT /api/v1/seller/products/:id/
router.put(
  '/seller/products/:id/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && pRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'You can only update products belonging to your store.', 'FORBIDDEN');
    }

    const body = req.body as Record<string, any>;
    const nextPrice = body.discounted_price ? Number(body.discounted_price) : pRow.price;
    const nextOrig = body.original_price ? Math.max(nextPrice, Number(body.original_price)) : pRow.originalPrice;
    const discountPercent = nextOrig > nextPrice ? Math.round(((nextOrig - nextPrice) / nextOrig) * 100) : 0;

    const [updated] = await db
      .update(products)
      .set({
        ...(body.name ? { name: String(body.name).trim() } : {}),
        ...(body.unit ? { unit: String(body.unit).trim() } : {}),
        ...(body.description ? { description: String(body.description).trim() } : {}),
        ...(body.image_url ? { image: String(body.image_url).trim() } : {}),
        ...(body.is_organic !== undefined ? { isOrganic: Boolean(body.is_organic) } : {}),
        price: nextPrice,
        originalPrice: nextOrig,
        discountPercent,
        updatedAt: new Date(),
      })
      .where(eq(products.id, pRow.id))
      .returning();

    const [serialized] = await hydrateProducts([updated]);
    res.json({ success: true, product: serialized });
  })
);

// PATCH /api/v1/seller/products/:id/toggle-stock/
router.patch(
  '/seller/products/:id/toggle-stock/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && pRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'You can only manage stock for your own store.', 'FORBIDDEN');
    }

    const nextInStock = !pRow.inStock;
    const nextStockCount = nextInStock && pRow.stockCount <= 0 ? 15 : pRow.stockCount;

    const [updated] = await db
      .update(products)
      .set({
        inStock: nextInStock,
        stockCount: nextStockCount,
        updatedAt: new Date(),
      })
      .where(eq(products.id, pRow.id))
      .returning();

    await db.insert(inventoryMovements).values({
      productId: pRow.id,
      vendorId: vendor.id,
      delta: nextStockCount - pRow.stockCount,
      previousStock: pRow.stockCount,
      newStock: nextStockCount,
      reason: 'toggle_stock',
      actorUserId: req.authUser!.id,
      note: nextInStock ? 'Marked In Stock' : 'Marked Out of Stock',
    });

    const [serialized] = await hydrateProducts([updated]);
    res.json({ success: true, in_stock: updated.inStock, product: serialized });
  })
);

// PATCH /api/v1/seller/products/:id/restock/
router.patch(
  '/seller/products/:id/restock/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && pRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'You can only restock products in your own store.', 'FORBIDDEN');
    }

    const addStock = Math.max(1, parseInt(String(req.body?.add_stock ?? 25), 10) || 25);
    const newStock = pRow.stockCount + addStock;

    const [updated] = await db
      .update(products)
      .set({
        stockCount: newStock,
        inStock: true,
        updatedAt: new Date(),
      })
      .where(eq(products.id, pRow.id))
      .returning();

    await db.execute(
      sql`UPDATE product_variants SET stock = stock + ${addStock} WHERE product_id = ${pRow.id} AND is_default = true`
    );

    await db.insert(inventoryMovements).values({
      productId: pRow.id,
      vendorId: vendor.id,
      delta: addStock,
      previousStock: pRow.stockCount,
      newStock,
      reason: 'restock',
      actorUserId: req.authUser!.id,
      note: `Quick restock +${addStock} units`,
    });

    const [serialized] = await hydrateProducts([updated]);
    res.json({
      success: true,
      message: `Added ${addStock} units to ${pRow.name} (Total: ${newStock}).`,
      stock: newStock,
      in_stock: true,
      product: serialized,
    });
  })
);

// DELETE /api/v1/seller/products/:id/
router.delete(
  '/seller/products/:id/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && pRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'You can only delete products from your own store.', 'FORBIDDEN');
    }

    await db
      .update(products)
      .set({ isActive: false, inStock: false, updatedAt: new Date() })
      .where(eq(products.id, pRow.id));

    await recordAuditLog({
      actorUserId: req.authUser!.id,
      actorRole: req.authUser!.role,
      action: 'SELLER_PRODUCT_ARCHIVED',
      entityType: 'product',
      entityId: pRow.id,
      details: { name: pRow.name, vendorId: vendor.id },
    });

    res.json({ success: true, message: `"${pRow.name}" removed from storefront.` });
  })
);

// POST /api/v1/seller/products/:id/images/
router.post(
  '/seller/products/:id/images/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && pRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'You can only manage images for your own store.', 'FORBIDDEN');
    }
    const { image_url, is_primary } = req.body as { image_url?: string; is_primary?: boolean };
    if (!image_url?.trim()) {
      throw new ApiError(400, 'image_url is required.', 'MISSING_IMAGE_URL');
    }

    const existing = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, pRow.id));
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), -1);

    if (is_primary) {
      await db
        .update(productImages)
        .set({ isPrimary: false })
        .where(eq(productImages.productId, pRow.id));
      await db
        .update(products)
        .set({ image: image_url.trim(), updatedAt: new Date() })
        .where(eq(products.id, pRow.id));
    }

    await db.insert(productImages).values({
      productId: pRow.id,
      imageUrl: image_url.trim(),
      altText: pRow.name,
      sortOrder: maxOrder + 1,
      isPrimary: Boolean(is_primary) || existing.length === 0,
    });

    const refreshed = await db.select().from(products).where(eq(products.id, pRow.id)).limit(1);
    const [serialized] = await hydrateProducts(refreshed);
    res.status(201).json({ success: true, product: serialized });
  })
);

// DELETE /api/v1/seller/products/:id/images/:imageId/
router.delete(
  '/seller/products/:id/images/:imageId/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    if (req.authUser!.role !== 'admin' && pRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'Forbidden.', 'FORBIDDEN');
    }
    const imageId = parseInt(req.params.imageId, 10);
    if (Number.isNaN(imageId)) {
      throw new ApiError(400, 'Invalid image id.', 'INVALID_ID');
    }
    await db
      .delete(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, pRow.id)));

    const remaining = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, pRow.id));
    if (remaining.length > 0 && !remaining.some((img) => img.imageUrl === pRow.image)) {
      await db
        .update(products)
        .set({ image: remaining[0].imageUrl, updatedAt: new Date() })
        .where(eq(products.id, pRow.id));
    }

    const refreshed = await db.select().from(products).where(eq(products.id, pRow.id)).limit(1);
    const [serialized] = await hydrateProducts(refreshed);
    res.json({ success: true, product: serialized });
  })
);

// GET /api/v1/seller/reviews/
router.get(
  '/seller/reviews/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const rows = await db
      .select({
        review: reviews,
        productName: products.name,
        productImage: products.image,
        authorName: users.fullName,
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(products.vendorId, vendor.id))
      .orderBy(desc(reviews.createdAt))
      .limit(100);

    const avgRating =
      rows.length > 0
        ? Number((rows.reduce((s, r) => s + r.review.rating, 0) / rows.length).toFixed(2))
        : 0;

    res.json({
      count: rows.length,
      average_rating: avgRating,
      results: rows.map((r) => ({
        id: r.review.id,
        product_id: r.review.productId,
        product_name: r.productName,
        product_image: r.productImage,
        author_name: r.authorName || 'Customer',
        rating: r.review.rating,
        title: r.review.title,
        comment: r.review.comment,
        is_verified_purchase: r.review.isVerifiedPurchase,
        created_at: r.review.createdAt?.toISOString() || new Date().toISOString(),
      })),
    });
  })
);

// GET /api/v1/seller/inventory/movements/
router.get(
  '/seller/inventory/movements/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const rows = await db
      .select({
        movement: inventoryMovements,
        productName: products.name,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(inventoryMovements.productId, products.id))
      .where(eq(inventoryMovements.vendorId, vendor.id))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(50);

    res.json({
      count: rows.length,
      results: rows.map((r) => ({
        id: r.movement.id,
        product_name: r.productName,
        delta: r.movement.delta,
        previous_stock: r.movement.previousStock,
        new_stock: r.movement.newStock,
        reason: r.movement.reason,
        reference_id: r.movement.referenceId,
        note: r.movement.note,
        created_at: r.movement.createdAt?.toISOString() || new Date().toISOString(),
      })),
    });
  })
);

// GET /api/v1/seller/orders/ (Vendor-isolated order fulfillments)
router.get(
  '/seller/orders/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const fulfillments = await db
      .select({
        fulfillment: vendorFulfillments,
        order: orders,
      })
      .from(vendorFulfillments)
      .innerJoin(orders, eq(vendorFulfillments.orderId, orders.id))
      .where(eq(vendorFulfillments.vendorId, vendor.id))
      .orderBy(desc(orders.createdAt), desc(vendorFulfillments.id))
      .limit(100);

    const results = await Promise.all(
      fulfillments.map(async (row) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(
            and(
              eq(orderItems.orderId, row.order.id),
              or(
                eq(orderItems.vendorId, vendor.id),
                eq(orderItems.vendorFulfillmentId, row.fulfillment.id)
              )
            )
          );
        return {
          fulfillment_id: row.fulfillment.id,
          order_id: row.order.externalKey || `ord-${row.order.id}`,
          order_number: row.order.orderNumber,
          vendor_id: vendor.externalKey || `v-${vendor.id}`,
          vendor_name: vendor.name,
          status: row.fulfillment.status,
          parent_order_status: row.order.status,
          customer_name: row.order.recipientName,
          customer_phone: row.order.recipientPhone,
          customer_area: row.order.deliveryArea,
          delivery_address: row.order.deliveryAddress,
          delivery_city: row.order.deliveryCity,
          notes: row.order.notes,
          payment_method: row.order.paymentMethod,
          payment_status: row.order.paymentStatus,
          subtotal: row.fulfillment.subtotal,
          commission_amount: row.fulfillment.commissionAmount,
          net_payout: row.fulfillment.vendorNetPayout,
          created_at: row.order.createdAt?.toISOString() || new Date().toISOString(),
          items: items.map((i) => ({
            id: i.id,
            product_name: i.productName,
            quantity: i.quantity,
            unit: i.unit,
            unit_price: i.unitPrice,
            total_price: i.totalPrice,
            image: i.image,
          })),
        };
      })
    );

    res.json({ count: results.length, results });
  })
);

// PATCH /api/v1/seller/orders/:fulfillmentId/status/
router.patch(
  '/seller/orders/:fulfillmentId/status/',
  requireAuth,
  requireApprovedSeller,
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const fulfillmentId = parseInt(req.params.fulfillmentId, 10);
    const nextStatus = String(req.body?.status || '').toUpperCase();
    const allowedTransitions = [
      'CONFIRMED_BY_VENDOR',
      'PACKED_BY_VENDOR',
      'READY_FOR_RIDER_PICKUP',
      'REJECTED',
    ];
    if (!allowedTransitions.includes(nextStatus)) {
      throw new ApiError(
        400,
        `Invalid seller fulfillment status. Allowed: ${allowedTransitions.join(', ')}`,
        'INVALID_STATUS'
      );
    }

    const fRows = await db
      .select()
      .from(vendorFulfillments)
      .where(eq(vendorFulfillments.id, fulfillmentId))
      .limit(1);
    if (fRows.length === 0) {
      throw new ApiError(404, 'Vendor fulfillment not found.', 'FULFILLMENT_NOT_FOUND');
    }
    const fRow = fRows[0];
    if (req.authUser!.role !== 'admin' && fRow.vendorId !== vendor.id) {
      throw new ApiError(403, 'You can only update your own store fulfillments.', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(vendorFulfillments)
        .set({
          status: nextStatus,
          ...(nextStatus === 'PACKED_BY_VENDOR' || nextStatus === 'READY_FOR_RIDER_PICKUP'
            ? { packedAt: new Date() }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(vendorFulfillments.id, fulfillmentId));

      const siblingFulfillments = await tx
        .select()
        .from(vendorFulfillments)
        .where(eq(vendorFulfillments.orderId, fRow.orderId));

      const allPackedOrReady = siblingFulfillments.every((s) =>
        ['PACKED_BY_VENDOR', 'READY_FOR_RIDER_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(
          s.id === fulfillmentId ? nextStatus : s.status
        )
      );

      if (allPackedOrReady) {
        await tx
          .update(orders)
          .set({ status: 'PACKED_BY_VENDOR', updatedAt: new Date() })
          .where(and(eq(orders.id, fRow.orderId), eq(orders.status, 'ORDER_PLACED')));
      }

      await tx.insert(orderStatusHistory).values({
        orderId: fRow.orderId,
        vendorFulfillmentId: fulfillmentId,
        status: nextStatus === 'READY_FOR_RIDER_PICKUP' ? 'PACKED_BY_VENDOR' : nextStatus,
        title:
          nextStatus === 'CONFIRMED_BY_VENDOR'
            ? 'Confirmed by Store'
            : nextStatus === 'PACKED_BY_VENDOR'
            ? 'Packed by Vendor'
            : nextStatus === 'READY_FOR_RIDER_PICKUP'
            ? 'Ready for Rider Pickup'
            : 'Rejected by Vendor',
        description: `${vendor.name} updated order fulfillment status to ${nextStatus}.`,
        actorUserId: req.authUser!.id,
        actorRole: req.authUser!.role,
      });
    });

    const parentOrder = (await db.select().from(orders).where(eq(orders.id, fRow.orderId)).limit(1))[0];
    if (parentOrder?.userId) {
      await createNotification({
        userId: parentOrder.userId,
        roleScope: 'customer',
        title: `Order ${parentOrder.orderNumber} Update`,
        message: `${vendor.name} marked your items as ${nextStatus.replace(/_/g, ' ').toLowerCase()}.`,
        type: 'order',
        referenceUrl: `/orders/${parentOrder.id}`,
      });
    }

    res.json({ success: true, status: nextStatus });
  })
);

// GET /api/v1/seller/store/ & PUT /api/v1/seller/store/
router.get(
  '/seller/store/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const vendorSettlements = await db
      .select()
      .from(settlements)
      .where(eq(settlements.vendorId, vendor.id))
      .orderBy(desc(settlements.createdAt))
      .limit(20);

    res.json({
      vendor: serializeVendor(vendor),
      settlements: vendorSettlements,
    });
  })
);

router.put(
  '/seller/store/',
  requireAuth,
  requireRole('seller', 'admin'),
  asyncHandler(async (req: AuthRequest, res) => {
    const vendor = await resolveSellerVendor(req);
    const {
      description,
      is_online,
      open_time,
      close_time,
      phone,
      area,
      eta,
      logo_url,
      cover_image_url,
      image,
    } = req.body as Record<string, any>;

    const [updated] = await db
      .update(vendors)
      .set({
        ...(description !== undefined ? { description: String(description).trim() } : {}),
        ...(is_online !== undefined ? { isOnline: Boolean(is_online) } : {}),
        ...(open_time ? { openTime: String(open_time).trim() } : {}),
        ...(close_time ? { closeTime: String(close_time).trim() } : {}),
        ...(phone ? { phone: String(phone).trim() } : {}),
        ...(area ? { area: String(area).trim() } : {}),
        ...(eta ? { eta: String(eta).trim() } : {}),
        ...(logo_url ? { logoUrl: String(logo_url).trim() } : {}),
        ...(cover_image_url ? { coverImageUrl: String(cover_image_url).trim(), image: String(cover_image_url).trim() } : {}),
        ...(image ? { image: String(image).trim() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendor.id))
      .returning();

    res.json({ success: true, vendor: serializeVendor(updated) });
  })
);

export default router;
