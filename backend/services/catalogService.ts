import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  advertisements,
  cartItems,
  carts,
  categories,
  coupons,
  platformSettings,
  productImages,
  products,
  productVariants,
  promotions,
  vendors,
} from '../../src/db/schema.ts';

export function serializeVendor(v: typeof vendors.$inferSelect) {
  return {
    id: v.externalKey || `v-${v.id}`,
    db_id: v.id,
    name: v.name,
    slug: v.slug,
    rating: parseFloat(v.rating || '4.8') || 4.8,
    rating_count: v.ratingCount,
    delivery_time_mins: v.eta,
    verified: v.isVerified,
    approval_status: v.approvalStatus,
    is_online: v.isOnline,
    distance_km: parseFloat(String(v.distance || '1.2').replace(/[^\d.]/g, '')) || 1.2,
    location: `${v.area}, ${v.city}`,
    address: v.address,
    area: v.area,
    city: v.city,
    lat: parseFloat(v.lat || '27.7172'),
    lng: parseFloat(v.lng || '85.3240'),
    image: v.image,
    logo_url: v.logoUrl || v.image,
    cover_image_url: v.coverImageUrl || v.image,
    description: v.description || '',
    tags: Array.isArray(v.tags) ? v.tags : [],
    cuisine: v.cuisine,
    open_time: v.openTime,
    close_time: v.closeTime,
    commission_rate: Number(v.commissionRate || 10),
    phone: v.phone || '',
    email: v.email || '',
  };
}

export function serializeCategory(c: typeof categories.$inferSelect, itemCount: number) {
  return {
    id: c.externalKey || `cat-${c.id}`,
    db_id: c.id,
    name: c.name,
    name_ne: c.nameNe || c.name,
    slug: c.slug,
    parent_id: c.parentId ?? null,
    icon: c.icon,
    image_url: c.imageUrl || null,
    item_count: itemCount,
    accent: c.accent,
    description: c.description,
    display_order: c.displayOrder,
    is_active: c.isActive,
  };
}

export function serializePromotion(p: typeof promotions.$inferSelect) {
  return {
    id: p.externalKey || `promo-${p.id}`,
    db_id: p.id,
    title: p.title,
    title_ne: p.titleNe || p.title,
    subtitle: p.subtitle,
    subtitle_ne: p.subtitleNe || p.subtitle,
    badge: p.badge,
    badge_ne: p.badgeNe || p.badge,
    cta_text: p.ctaText,
    cta_text_ne: p.ctaTextNe || p.ctaText,
    cta_category: p.ctaCategory,
    destination_url: p.destinationUrl || null,
    image: p.imageUrl,
    code: p.couponCode || undefined,
    color_theme: p.colorTheme,
    placement: p.placement,
    sort_order: p.sortOrder,
    is_active: p.isActive,
    starts_at: p.startsAt ? p.startsAt.toISOString() : null,
    ends_at: p.endsAt ? p.endsAt.toISOString() : null,
  };
}

export function serializeAdvertisement(a: typeof advertisements.$inferSelect) {
  return {
    id: `ad-${a.id}`,
    db_id: a.id,
    title: a.title,
    title_ne: a.titleNe || a.title,
    subtitle: a.subtitle,
    subtitle_ne: a.subtitleNe || a.subtitle,
    image_url: a.imageUrl,
    destination_url: a.destinationUrl,
    placement: a.placement,
    priority: a.priority,
    is_active: a.isActive,
    starts_at: a.startsAt ? a.startsAt.toISOString() : null,
    ends_at: a.endsAt ? a.endsAt.toISOString() : null,
    clicks_count: a.clicksCount,
  };
}

export function serializeProduct(
  p: typeof products.$inferSelect,
  vendorRow?: typeof vendors.$inferSelect | null,
  categoryRow?: typeof categories.$inferSelect | null,
  variantsRows: (typeof productVariants.$inferSelect)[] = [],
  imageRows: (typeof productImages.$inferSelect)[] = []
) {
  const sortedImageRows = [...imageRows].sort((a, b) => a.sortOrder - b.sortOrder);
  const gallery = sortedImageRows.length > 0 ? sortedImageRows.map((img) => img.imageUrl) : [p.image];
  const galleryItems = sortedImageRows.map((img) => ({
    id: img.id,
    image_url: img.imageUrl,
    alt_text: img.altText || p.name,
    sort_order: img.sortOrder,
    is_primary: img.isPrimary,
  }));

  const mappedVariants = variantsRows
    .filter((v) => v.isActive)
    .map((v) => ({
      id: v.externalKey || `var-${v.id}`,
      db_id: v.id,
      name: v.name,
      unit: v.unit,
      price: v.price,
      original_price: v.originalPrice,
      stock: v.stock,
    }));

  if (mappedVariants.length === 0) {
    mappedVariants.push({
      id: `var-default-${p.id}`,
      db_id: 0,
      name: p.unit,
      unit: p.unit,
      price: p.price,
      original_price: p.originalPrice,
      stock: p.stockCount,
    });
  }

  return {
    id: p.externalKey || `prod-${p.id}`,
    db_id: p.id,
    name: p.name,
    slug: p.slug,
    category: {
      id: categoryRow?.externalKey || (p.categoryId ? `cat-${p.categoryId}` : 'cat-grocery'),
      name: categoryRow?.name || p.category,
      slug: categoryRow?.slug || p.subCategory || 'grocery',
    },
    vendor: {
      id: vendorRow?.externalKey || (p.vendorId ? `v-${p.vendorId}` : 'v-himalayan'),
      name: vendorRow?.name || p.vendorName,
      rating: vendorRow ? parseFloat(vendorRow.rating || '4.8') || 4.8 : 4.8,
      delivery_time_mins: vendorRow?.eta || '12-15 mins',
    },
    original_price: p.originalPrice,
    discounted_price: p.price,
    discount_percentage: p.discountPercent,
    unit: p.unit,
    stock: p.stockCount,
    low_stock_threshold: p.lowStockThreshold,
    in_stock: p.inStock && p.stockCount > 0,
    is_organic: p.isOrganic,
    rating: parseFloat(p.rating || '4.8') || 4.8,
    reviews_count: p.ratingCount,
    image_url: p.image,
    gallery,
    gallery_items: galleryItems,
    description: p.description,
    origin: p.origin,
    variants: mappedVariants,
    sections: Array.isArray(p.sections) ? p.sections : [],
    approval_status: p.approvalStatus,
    is_active: p.isActive,
  };
}

export async function hydrateProducts(productRows: (typeof products.$inferSelect)[]) {
  if (productRows.length === 0) return [];

  const vendorIds = Array.from(new Set(productRows.map((p) => p.vendorId).filter((v): v is number => v !== null)));
  const categoryIds = Array.from(new Set(productRows.map((p) => p.categoryId).filter((c): c is number => c !== null)));
  const productIds = productRows.map((p) => p.id);

  const [vendorRows, categoryRows, variantRows, imageRows] = await Promise.all([
    vendorIds.length > 0 ? db.select().from(vendors).where(inArray(vendors.id, vendorIds)) : Promise.resolve([]),
    categoryIds.length > 0 ? db.select().from(categories).where(inArray(categories.id, categoryIds)) : Promise.resolve([]),
    db.select().from(productVariants).where(inArray(productVariants.productId, productIds)),
    db.select().from(productImages).where(inArray(productImages.productId, productIds)),
  ]);

  const vMap = new Map(vendorRows.map((v) => [v.id, v]));
  const cMap = new Map(categoryRows.map((c) => [c.id, c]));
  const varMap = new Map<number, (typeof productVariants.$inferSelect)[]>();
  const imgMap = new Map<number, (typeof productImages.$inferSelect)[]>();

  for (const vr of variantRows) {
    const arr = varMap.get(vr.productId) || [];
    arr.push(vr);
    varMap.set(vr.productId, arr);
  }
  for (const im of imageRows) {
    const arr = imgMap.get(im.productId) || [];
    arr.push(im);
    imgMap.set(im.productId, arr);
  }

  return productRows.map((p) =>
    serializeProduct(
      p,
      p.vendorId ? vMap.get(p.vendorId) || null : null,
      p.categoryId ? cMap.get(p.categoryId) || null : null,
      varMap.get(p.id) || [],
      imgMap.get(p.id) || []
    )
  );
}

export async function resolveProductByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const numericMatch = /^(\d+)$/.exec(trimmed) || /^prod-(\d+)$/.exec(trimmed);
  const byKey = await db
    .select()
    .from(products)
    .where(or(eq(products.externalKey, trimmed), eq(products.slug, trimmed)))
    .limit(1);
  if (byKey.length > 0) return byKey[0];
  if (numericMatch) {
    const id = parseInt(numericMatch[1], 10);
    const byId = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (byId.length > 0) return byId[0];
  }
  return null;
}

export async function resolveVendorByIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const numericMatch = /^(\d+)$/.exec(trimmed) || /^v-(\d+)$/.exec(trimmed);
  const byKey = await db
    .select()
    .from(vendors)
    .where(or(eq(vendors.externalKey, trimmed), eq(vendors.slug, trimmed)))
    .limit(1);
  if (byKey.length > 0) return byKey[0];
  if (numericMatch) {
    const id = parseInt(numericMatch[1], 10);
    const byId = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (byId.length > 0) return byId[0];
  }
  return null;
}

export async function getPlatformFeesConfig() {
  const rows = await db
    .select()
    .from(platformSettings)
    .where(or(eq(platformSettings.key, 'delivery_fees'), eq(platformSettings.key, 'delivery_pricing')));
  const feesRow = rows.find((r) => r.key === 'delivery_fees') || rows.find((r) => r.key === 'delivery_pricing');
  const val = (feesRow?.value || {}) as Record<string, unknown>;
  return {
    baseDeliveryFee: Number(val.baseDeliveryFee ?? val.baseFeePerVendor ?? 35),
    freeDeliveryThreshold: Number(val.freeDeliveryThreshold ?? 499),
    handlingFee: Number(val.handlingFee ?? 15),
    defaultCommissionRate: Number(val.defaultCommissionRate ?? 10),
  };
}

export async function getPublicSettings() {
  const rows = await db.select().from(platformSettings);
  const byKey = new Map(rows.map((r) => [r.key, (r.value || {}) as Record<string, unknown>]));
  const fees = byKey.get('delivery_fees') || byKey.get('delivery_pricing') || {};
  const commission = byKey.get('commission_policy') || {};
  const support = byKey.get('store_support') || {};

  return {
    delivery_fees: {
      baseDeliveryFee: Number(fees.baseDeliveryFee ?? fees.baseFeePerVendor ?? 35),
      freeDeliveryThreshold: Number(fees.freeDeliveryThreshold ?? 499),
      handlingFee: Number(fees.handlingFee ?? 15),
      defaultEtaMins: Number(fees.defaultEtaMins ?? 12),
    },
    commission_policy: {
      defaultCommissionRate: Number(commission.defaultCommissionRate ?? 10),
      newSellerZeroCommissionDays: Number(commission.newSellerZeroCommissionDays ?? 30),
    },
    store_support: {
      brandName: String(support.brandName ?? 'OyoPasal'),
      tagline: String(support.tagline ?? '10–15 MIN DELIVERY'),
      email: String(support.email ?? 'support@oyopasal.com.np'),
      phone: String(support.phone ?? '+977 1-4782910'),
      address: String(support.address ?? 'New Baneshwor, Kathmandu, Nepal'),
      hours: String(support.hours ?? '6:00 AM – 11:00 PM Daily'),
    },
  };
}

export async function getOrCreateCartRow(sessionKey: string, userId?: number | null) {
  if (userId) {
    const userCarts = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
    if (userCarts.length > 0) {
      return userCarts[0];
    }
  }
  const bySession = await db.select().from(carts).where(eq(carts.sessionKey, sessionKey)).limit(1);
  if (bySession.length > 0) {
    if (userId && !bySession[0].userId) {
      const [updated] = await db
        .update(carts)
        .set({ userId, updatedAt: new Date() })
        .where(eq(carts.id, bySession[0].id))
        .returning();
      return updated;
    }
    return bySession[0];
  }

  const [created] = await db
    .insert(carts)
    .values({
      sessionKey,
      userId: userId ?? null,
    })
    .returning();
  return created;
}

export function computeCouponDiscount(
  couponRow: typeof coupons.$inferSelect,
  subtotal: number,
  deliveryFee: number
): number {
  if (!couponRow.isActive) return 0;
  const now = new Date();
  if (couponRow.startsAt && couponRow.startsAt > now) return 0;
  if (couponRow.expiresAt && couponRow.expiresAt < now) return 0;
  if (couponRow.usageLimit !== null && couponRow.usedCount >= couponRow.usageLimit) return 0;
  if (subtotal < couponRow.minOrderAmount) return 0;

  if (couponRow.discountType === 'free_delivery') {
    return deliveryFee;
  }
  if (couponRow.discountType === 'flat') {
    return Math.min(subtotal, couponRow.discountValue);
  }
  const pct = Math.round((subtotal * couponRow.discountValue) / 100);
  if (couponRow.maxDiscountAmount) {
    return Math.min(pct, couponRow.maxDiscountAmount, subtotal);
  }
  return Math.min(pct, subtotal);
}

export async function calculateAndSerializeCart(sessionKey: string, userId?: number | null) {
  const cartRow = await getOrCreateCartRow(sessionKey, userId);
  const feeConfig = await getPlatformFeesConfig();

  const rawItems = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.cartId, cartRow.id))
    .orderBy(asc(cartItems.id));

  if (rawItems.length === 0) {
    return {
      items: [],
      item_count: 0,
      vendor_groups: [],
      subtotal: 0,
      delivery_fee: 0,
      free_delivery_threshold: feeConfig.freeDeliveryThreshold,
      amount_needed_for_free_delivery: feeConfig.freeDeliveryThreshold,
      handling_fee: 0,
      coupon: null,
      total: 0,
    };
  }

  const productIds = rawItems.map((i) => i.productId);
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  const serializedList = await hydrateProducts(productRows);
  const productMap = new Map(serializedList.map((p) => [p.db_id, p]));

  const items: any[] = [];
  let subtotal = 0;
  let itemCount = 0;
  const vendorGroupsMap = new Map<
    string,
    { vendor: { id: string; name: string }; items: any[]; subtotal: number; delivery_fee: number }
  >();

  for (const ci of rawItems) {
    const serializedProd = productMap.get(ci.productId);
    if (!serializedProd) continue;

    let unitPrice = serializedProd.discounted_price;
    let selectedVariantExtId: string | undefined;
    if (ci.variantId) {
      const matchedVar = serializedProd.variants.find((v) => v.db_id === ci.variantId);
      if (matchedVar) {
        unitPrice = matchedVar.price;
        selectedVariantExtId = matchedVar.id;
      }
    }

    const totalPrice = unitPrice * ci.quantity;
    subtotal += totalPrice;
    itemCount += ci.quantity;

    const itemObj = {
      id: `ci-${ci.id}`,
      db_id: ci.id,
      product_id: serializedProd.id,
      product: serializedProd,
      quantity: ci.quantity,
      selected_variant_id: selectedVariantExtId,
      unit_price: unitPrice,
      total_price: totalPrice,
    };
    items.push(itemObj);

    const vId = serializedProd.vendor.id;
    if (!vendorGroupsMap.has(vId)) {
      vendorGroupsMap.set(vId, {
        vendor: { id: vId, name: serializedProd.vendor.name },
        items: [],
        subtotal: 0,
        delivery_fee: 0,
      });
    }
    const grp = vendorGroupsMap.get(vId)!;
    grp.items.push(itemObj);
    grp.subtotal += totalPrice;
  }

  const freeDeliveryThreshold = feeConfig.freeDeliveryThreshold;
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);
  const baseDeliveryFee =
    subtotal >= freeDeliveryThreshold || subtotal === 0 ? 0 : feeConfig.baseDeliveryFee;

  const vendorGroups = Array.from(vendorGroupsMap.values());
  if (baseDeliveryFee > 0 && vendorGroups.length > 0) {
    vendorGroups[0].delivery_fee = baseDeliveryFee;
  }

  let appliedCoupon: { code: string; discount_amount: number; description: string } | null = null;
  let discountAmount = 0;

  if (cartRow.appliedCouponCode) {
    const couponRows = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, cartRow.appliedCouponCode))
      .limit(1);
    if (couponRows.length > 0) {
      const computed = computeCouponDiscount(couponRows[0], subtotal, baseDeliveryFee);
      if (computed > 0) {
        discountAmount = computed;
        appliedCoupon = {
          code: couponRows[0].code,
          discount_amount: computed,
          description: couponRows[0].description,
        };
      }
    }
  }

  const handlingFee = items.length > 0 ? feeConfig.handlingFee : 0;
  const total = Math.max(0, subtotal + baseDeliveryFee + handlingFee - discountAmount);

  return {
    items,
    item_count: itemCount,
    vendor_groups: vendorGroups,
    subtotal,
    delivery_fee: baseDeliveryFee,
    free_delivery_threshold: freeDeliveryThreshold,
    amount_needed_for_free_delivery: amountNeededForFreeDelivery,
    handling_fee: handlingFee,
    coupon: appliedCoupon,
    total,
  };
}

export async function getCartItemCountMapByCategory() {
  const rows = await db
    .select({
      categoryId: products.categoryId,
      cnt: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(and(eq(products.isActive, true), eq(products.approvalStatus, 'approved')))
    .groupBy(products.categoryId);

  return new Map(rows.filter((r) => r.categoryId !== null).map((r) => [r.categoryId!, r.cnt]));
}
