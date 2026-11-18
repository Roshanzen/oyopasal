import { Router } from 'express';
import crypto from 'crypto';
import { and, asc, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  advertisements,
  categories,
  coupons,
  deliveryZones,
  orderItems,
  orders,
  products,
  promotions,
  reviews,
  sellerProfiles,
  users,
  vendors,
} from '../../src/db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';
import {
  getCartItemCountMapByCategory,
  getPublicSettings,
  hydrateProducts,
  resolveProductByIdentifier,
  serializeAdvertisement,
  serializeCategory,
  serializePromotion,
  serializeVendor,
} from '../services/catalogService.ts';
import { createNotification, recordAuditLog } from '../utils/audit.ts';
import { hashPassword } from '../utils/crypto.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

// GET /api/v1/categories/
router.get(
  '/categories/',
  asyncHandler(async (_req, res) => {
    const [catRows, countsMap] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.displayOrder), asc(categories.id)),
      getCartItemCountMapByCategory(),
    ]);

    const results = catRows.map((c) => serializeCategory(c, countsMap.get(c.id) || 0));
    res.json({
      count: results.length,
      next: null,
      previous: null,
      results,
    });
  })
);

// GET /api/v1/promotions/
router.get(
  '/promotions/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const placement = String(req.query.placement || '').trim();
    const conditions: any[] = [
      eq(promotions.isActive, true),
      or(isNull(promotions.startsAt), lte(promotions.startsAt, now)),
      or(isNull(promotions.endsAt), gte(promotions.endsAt, now)),
    ];
    if (placement) {
      conditions.push(eq(promotions.placement, placement));
    }

    const promoRows = await db
      .select()
      .from(promotions)
      .where(and(...conditions))
      .orderBy(asc(promotions.sortOrder), asc(promotions.id));

    const results = promoRows.map(serializePromotion);
    res.json({
      count: results.length,
      next: null,
      previous: null,
      results,
    });
  })
);

// GET /api/v1/advertisements/
router.get(
  '/advertisements/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const placement = String(req.query.placement || '').trim();
    const conditions: any[] = [
      eq(advertisements.isActive, true),
      or(isNull(advertisements.startsAt), lte(advertisements.startsAt, now)),
      or(isNull(advertisements.endsAt), gte(advertisements.endsAt, now)),
    ];
    if (placement) {
      conditions.push(eq(advertisements.placement, placement));
    }

    const adRows = await db
      .select()
      .from(advertisements)
      .where(and(...conditions))
      .orderBy(asc(advertisements.priority), desc(advertisements.id));

    const results = adRows.map(serializeAdvertisement);
    res.json({
      count: results.length,
      results,
    });
  })
);

// POST /api/v1/advertisements/:id/click/
router.post(
  '/advertisements/:id/click/',
  asyncHandler(async (req, res) => {
    const idNum = parseInt(String(req.params.id).replace(/^ad-/, ''), 10);
    if (!Number.isNaN(idNum)) {
      await db
        .update(advertisements)
        .set({ clicksCount: sql`${advertisements.clicksCount} + 1` })
        .where(eq(advertisements.id, idNum));
    }
    res.json({ success: true });
  })
);

// GET /api/v1/coupons/active/
router.get(
  '/coupons/active/',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const rows = await db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.isActive, true),
          or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
          or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now))
        )
      )
      .orderBy(asc(coupons.minOrderAmount), asc(coupons.id));

    const eligible = rows.filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit);
    res.json({
      count: eligible.length,
      results: eligible.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discount_type: c.discountType,
        discount_value: c.discountValue,
        max_discount_amount: c.maxDiscountAmount,
        min_order_amount: c.minOrderAmount,
      })),
    });
  })
);

// GET /api/v1/settings/public/
router.get(
  '/settings/public/',
  asyncHandler(async (_req, res) => {
    const settings = await getPublicSettings();
    res.json(settings);
  })
);

// GET /api/v1/zones/
router.get(
  '/zones/',
  asyncHandler(async (_req, res) => {
    const zones = await db
      .select()
      .from(deliveryZones)
      .where(eq(deliveryZones.isActive, true))
      .orderBy(asc(deliveryZones.id));

    res.json({
      count: zones.length,
      results: zones.map((z) => ({
        id: z.id,
        name: z.name,
        slug: z.slug,
        city: z.city,
        center_lat: parseFloat(z.centerLat),
        center_lng: parseFloat(z.centerLng),
        radius_km: parseFloat(String(z.radiusKm)),
        base_delivery_fee: z.baseDeliveryFee,
        free_delivery_threshold: z.freeDeliveryThreshold,
        estimated_mins: z.estimatedMins,
      })),
    });
  })
);

// GET /api/v1/vendors/
router.get(
  '/vendors/',
  asyncHandler(async (_req, res) => {
    const vendorRows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.approvalStatus, 'approved'))
      .orderBy(desc(vendors.isFeatured), asc(vendors.id));

    const results = vendorRows.map(serializeVendor);
    res.json({
      count: results.length,
      next: null,
      previous: null,
      results,
    });
  })
);

// POST /api/v1/vendors/register/ -> creates pending seller application for Admin approval
router.post(
  '/vendors/register/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      store_name,
      category,
      city,
      area,
      contact_person,
      phone,
      email,
      password,
      daily_orders,
      pan_vat_number,
    } = req.body as {
      store_name?: string;
      category?: string;
      city?: string;
      area?: string;
      contact_person?: string;
      phone?: string;
      email?: string;
      password?: string;
      daily_orders?: string;
      pan_vat_number?: string;
    };

    if (!store_name?.trim() || !phone?.trim() || !contact_person?.trim() || !area?.trim()) {
      throw new ApiError(
        400,
        'Store name, contact person, area, and phone number are required.',
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const slugBase = store_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const uniqueSuffix = crypto.randomBytes(2).toString('hex');
    const slug = `${slugBase}-${uniqueSuffix}`;
    const externalKey = `v-${slugBase.slice(0, 14)}-${uniqueSuffix}`;

    const sellerEmail =
      (email || '').trim().toLowerCase() ||
      `seller.${phone.replace(/[^\d]/g, '') || uniqueSuffix}@oyopasal.np`;

    const result = await db.transaction(async (tx) => {
      let ownerUserId = req.authUser?.id;

      if (!ownerUserId) {
        const existingUser = await tx
          .select()
          .from(users)
          .where(or(eq(users.email, sellerEmail), eq(users.phone, phone.trim())))
          .limit(1);

        if (existingUser.length > 0) {
          ownerUserId = existingUser[0].id;
          if (existingUser[0].role === 'customer') {
            await tx
              .update(users)
              .set({ role: 'seller', updatedAt: new Date() })
              .where(eq(users.id, ownerUserId));
          }
        } else {
          const [createdUser] = await tx
            .insert(users)
            .values({
              uid: `seller-usr-${crypto.randomUUID().slice(0, 10)}`,
              email: sellerEmail,
              username: slug.replace(/-/g, '_').slice(0, 32),
              passwordHash: hashPassword(password && password.length >= 6 ? password : 'OyoPasal@2026'),
              fullName: contact_person.trim(),
              phone: phone.trim(),
              role: 'seller',
              isActive: true,
              isVerified: true,
            })
            .returning();
          ownerUserId = createdUser.id;
        }
      } else if (req.authUser!.role === 'customer') {
        await tx
          .update(users)
          .set({ role: 'seller', updatedAt: new Date() })
          .where(eq(users.id, ownerUserId));
      }

      const [newVendor] = await tx
        .insert(vendors)
        .values({
          externalKey,
          slug,
          name: store_name.trim(),
          ownerUserId,
          phone: phone.trim(),
          email: sellerEmail,
          rating: '5.0',
          ratingCount: 1,
          eta: '15-20 mins',
          distance: '1.5 km',
          address: `${area.trim()}, ${city?.trim() || 'Kathmandu'}`,
          area: area.trim(),
          city: city?.trim() || 'Kathmandu',
          lat: '27.7010',
          lng: '85.3310',
          image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
          cuisine: category?.trim() || 'Grocery & Fresh Essentials',
          tags: [category?.trim() || 'Local Store', 'Pending Verification'],
          isFeatured: false,
          isVerified: false,
          approvalStatus: 'pending',
          isOnline: true,
          commissionRate: '10.00',
        })
        .returning();

      await tx.insert(sellerProfiles).values({
        userId: ownerUserId,
        vendorId: newVendor.id,
        businessName: store_name.trim(),
        contactPerson: contact_person.trim(),
        phone: phone.trim(),
        email: sellerEmail,
        panVatNumber: pan_vat_number?.trim() || null,
        dailyOrdersEstimate: daily_orders || '20-50',
        approvalStatus: 'pending',
      });

      return newVendor;
    });

    await createNotification({
      roleScope: 'admin',
      title: 'New Seller Onboarding Application',
      message: `${result.name} (${result.area}) applied to join OyoPasal Marketplace and awaits review.`,
      type: 'seller',
      referenceUrl: '/admin',
    });

    await recordAuditLog({
      actorUserId: result.ownerUserId,
      actorRole: 'seller',
      action: 'SELLER_APPLIED',
      entityType: 'vendor',
      entityId: result.id,
      details: { storeName: result.name, area: result.area },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message:
        'Application submitted! Our Kathmandu operations team will review and approve your store shortly.',
      vendor: serializeVendor(result),
    });
  })
);

// GET /api/v1/products/autocomplete/
router.get(
  '/products/autocomplete/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({ suggestions: [], categories: [] });
    }

    const pattern = `%${q}%`;
    const [matchedProducts, matchedCategories] = await Promise.all([
      db
        .select()
        .from(products)
        .where(
          and(
            eq(products.isActive, true),
            eq(products.approvalStatus, 'approved'),
            or(
              ilike(products.name, pattern),
              ilike(products.category, pattern),
              ilike(products.vendorName, pattern)
            )
          )
        )
        .limit(8),
      db
        .select()
        .from(categories)
        .where(and(eq(categories.isActive, true), ilike(categories.name, pattern)))
        .limit(5),
    ]);

    res.json({
      suggestions: matchedProducts.map((p) => ({
        id: p.externalKey || `prod-${p.id}`,
        name: p.name,
        category: p.category,
        price: p.price,
        image_url: p.image,
        unit: p.unit,
      })),
      categories: matchedCategories.map((c) => ({
        id: c.externalKey || `cat-${c.id}`,
        name: c.name,
        slug: c.slug,
      })),
    });
  })
);

// GET /api/v1/products/
router.get(
  '/products/',
  asyncHandler(async (req, res) => {
    const categorySlug = String(req.query.category || '').trim();
    const vendorKey = String(req.query.vendor || '').trim();
    const section = String(req.query.section || '').trim();
    const search = String(req.query.search || '').trim();
    const minPrice = req.query.min_price ? Number(req.query.min_price) : undefined;
    const maxPrice = req.query.max_price ? Number(req.query.max_price) : undefined;
    const inStockOnly = String(req.query.in_stock || '') === 'true';
    const ordering = String(req.query.ordering || '').trim();
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size || '50'), 10) || 50));

    const conditions: any[] = [
      eq(products.isActive, true),
      eq(products.approvalStatus, 'approved'),
    ];

    if (categorySlug && categorySlug !== 'all') {
      const catRow = await db
        .select()
        .from(categories)
        .where(or(eq(categories.slug, categorySlug), eq(categories.externalKey, categorySlug)))
        .limit(1);
      if (catRow.length > 0) {
        conditions.push(or(eq(products.categoryId, catRow[0].id), eq(products.subCategory, categorySlug)));
      } else {
        conditions.push(eq(products.subCategory, categorySlug));
      }
    }

    if (vendorKey) {
      const vRow = await db
        .select()
        .from(vendors)
        .where(or(eq(vendors.externalKey, vendorKey), eq(vendors.slug, vendorKey)))
        .limit(1);
      if (vRow.length > 0) {
        conditions.push(eq(products.vendorId, vRow[0].id));
      } else {
        return res.json({ count: 0, next: null, previous: null, results: [] });
      }
    }

    if (search) {
      const pat = `%${search}%`;
      conditions.push(
        or(
          ilike(products.name, pat),
          ilike(products.description, pat),
          ilike(products.category, pat),
          ilike(products.vendorName, pat)
        )
      );
    }

    if (typeof minPrice === 'number' && !Number.isNaN(minPrice)) {
      conditions.push(gte(products.price, minPrice));
    }
    if (typeof maxPrice === 'number' && !Number.isNaN(maxPrice)) {
      conditions.push(lte(products.price, maxPrice));
    }
    if (inStockOnly) {
      conditions.push(and(eq(products.inStock, true), gte(products.stockCount, 1)));
    }

    let orderExpr: any = desc(products.id);
    if (ordering === 'price' || ordering === 'price_asc') orderExpr = asc(products.price);
    else if (ordering === '-price' || ordering === 'price_desc') orderExpr = desc(products.price);
    else if (ordering === '-rating' || ordering === 'rating') orderExpr = desc(products.rating);
    else if (ordering === '-discount') orderExpr = desc(products.discountPercent);
    else if (ordering === 'newest') orderExpr = desc(products.createdAt);

    let allRows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(orderExpr);

    if (section) {
      allRows = allRows.filter((p) => {
        const secs = Array.isArray(p.sections) ? p.sections : [];
        return (
          secs.includes(section) ||
          (section === 'best_sellers' && p.isBestSeller) ||
          (section === 'trending' && p.isTrending) ||
          (section === 'fresh_arrivals' && p.isFresh) ||
          (section === 'top_deals' && p.isDeal) ||
          (section === 'recommended' && p.isRecommended)
        );
      });
    }

    const totalCount = allRows.length;
    const offset = (page - 1) * pageSize;
    const paged = allRows.slice(offset, offset + pageSize);
    const serialized = await hydrateProducts(paged);

    res.json({
      count: totalCount,
      next: offset + pageSize < totalCount ? `?page=${page + 1}` : null,
      previous: page > 1 ? `?page=${page - 1}` : null,
      results: serialized,
    });
  })
);

// GET /api/v1/products/:id/
router.get(
  '/products/:id/',
  asyncHandler(async (req, res) => {
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow || !pRow.isActive) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    const [serialized] = await hydrateProducts([pRow]);
    res.json(serialized);
  })
);

// GET /api/v1/products/:id/similar/
router.get(
  '/products/:id/similar/',
  asyncHandler(async (req, res) => {
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      return res.json({ count: 0, next: null, previous: null, results: [] });
    }
    const candidates = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          eq(products.approvalStatus, 'approved'),
          pRow.categoryId ? eq(products.categoryId, pRow.categoryId) : eq(products.category, pRow.category)
        )
      )
      .limit(8);

    const filtered = candidates.filter((c) => c.id !== pRow.id).slice(0, 6);
    const results = await hydrateProducts(filtered);
    res.json({
      count: results.length,
      next: null,
      previous: null,
      results,
    });
  })
);

// GET /api/v1/products/:id/reviews/
router.get(
  '/products/:id/reviews/',
  asyncHandler(async (req, res) => {
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }

    const reviewRows = await db
      .select({
        review: reviews,
        authorName: users.fullName,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(and(eq(reviews.productId, pRow.id), eq(reviews.isVisible, true)))
      .orderBy(desc(reviews.createdAt));

    res.json({
      count: reviewRows.length,
      average_rating: parseFloat(pRow.rating || '4.8'),
      results: reviewRows.map((r) => ({
        id: r.review.id,
        rating: r.review.rating,
        title: r.review.title,
        comment: r.review.comment,
        author_name: r.authorName || 'Customer',
        is_verified_purchase: r.review.isVerifiedPurchase,
        created_at: r.review.createdAt ? new Date(r.review.createdAt).toISOString() : new Date().toISOString(),
      })),
    });
  })
);

// POST /api/v1/products/:id/reviews/ (Verified buyer check + rating recalculation)
router.post(
  '/products/:id/reviews/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const pRow = await resolveProductByIdentifier(req.params.id);
    if (!pRow) {
      throw new ApiError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    }
    const { rating, title, comment } = req.body as {
      rating?: number;
      title?: string;
      comment?: string;
    };

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      throw new ApiError(400, 'Rating must be between 1 and 5.', 'INVALID_RATING');
    }
    if (!comment || !comment.trim()) {
      throw new ApiError(400, 'Please enter your review comment.', 'MISSING_COMMENT');
    }

    // Check if user has a delivered order containing this product
    const deliveredPurchases = await db
      .select({ orderId: orders.id })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.userId, req.authUser!.id),
          eq(orders.status, 'DELIVERED'),
          eq(orderItems.productId, pRow.id)
        )
      )
      .limit(1);

    const isVerifiedPurchase = deliveredPurchases.length > 0;
    const [inserted] = await db
      .insert(reviews)
      .values({
        productId: pRow.id,
        vendorId: pRow.vendorId,
        userId: req.authUser!.id,
        orderId: deliveredPurchases[0]?.orderId ?? null,
        rating: Math.round(numRating),
        title: title?.trim() || null,
        comment: comment.trim(),
        isVerifiedPurchase,
        isVisible: true,
      })
      .returning();

    const stats = await db
      .select({
        avg: sql<string>`ROUND(AVG(${reviews.rating}), 1)::text`,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(reviews)
      .where(and(eq(reviews.productId, pRow.id), eq(reviews.isVisible, true)));

    if (stats[0] && stats[0].cnt > 0) {
      await db
        .update(products)
        .set({
          rating: stats[0].avg || pRow.rating,
          ratingCount: stats[0].cnt,
          updatedAt: new Date(),
        })
        .where(eq(products.id, pRow.id));
    }

    res.status(201).json({
      success: true,
      review: {
        id: inserted.id,
        rating: inserted.rating,
        title: inserted.title,
        comment: inserted.comment,
        author_name: req.authUser!.fullName || 'Customer',
        is_verified_purchase: inserted.isVerifiedPurchase,
        created_at: inserted.createdAt?.toISOString() || new Date().toISOString(),
      },
    });
  })
);

export default router;
