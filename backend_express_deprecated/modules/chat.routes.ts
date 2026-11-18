import crypto from 'crypto';
import { Router } from 'express';
import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  addresses,
  cartItems,
  carts,
  categories,
  coupons,
  deliveryZones,
  orders,
  products,
  vendors,
} from '../../src/db/schema.ts';
import { ENV } from '../config/env.ts';
import {
  AuthRequest,
  getEffectiveSessionKey,
  optionalAuth,
  requireAuth,
} from '../middleware/auth.ts';
import {
  calculateAndSerializeCart,
  computeCouponDiscount,
  getPlatformFeesConfig,
  resolveProductByIdentifier,
} from '../services/catalogService.ts';
import { createTransactionalOrder } from '../services/orderService.ts';
import { ApiError, asyncHandler } from '../utils/errors.ts';

const router = Router();

const ai = new GoogleGenAI({
  apiKey: ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface EnrichedCatalogOffer {
  product_id: string;
  db_id: number;
  name: string;
  slug: string;
  category: string;
  category_slug: string;
  unit: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  stock: number;
  in_stock: boolean;
  rating: number;
  reviews_count: number;
  is_organic: boolean;
  sections: string[];
  description: string;
  origin: string;
  image_url: string;
  vendor_db_id: number;
  vendor_id: string;
  vendor_name: string;
  vendor_area: string;
  vendor_city: string;
  vendor_rating: number;
  vendor_is_online: boolean;
  vendor_is_verified: boolean;
  distance_km: number;
  eta_mins: number;
  value_score: number;
}

interface ResolvedDeliveryLocation {
  addressId?: string;
  title: string;
  street: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.2, Math.round(R * c * 10) / 10);
}

function estimateEtaMins(distanceKm: number, rawEta?: string | null): number {
  const parsed = parseInt(String(rawEta || ''), 10);
  const base = !Number.isNaN(parsed) && parsed > 0 ? parsed : 10;
  return Math.min(35, Math.max(8, Math.round(base + distanceKm * 1.8)));
}

const SYNONYM_MAP: Record<string, string[]> = {
  veggie: ['vegetable', 'vegetables', 'spinach', 'tomato', 'tomatoes', 'onion', 'potato', 'greens', 'avocado'],
  veggies: ['vegetable', 'vegetables', 'spinach', 'tomato', 'tomatoes', 'onion', 'potato', 'greens', 'avocado'],
  vegetable: ['vegetables', 'fruits-vegetables', 'spinach', 'tomato', 'avocado', 'greens'],
  vegetables: ['vegetable', 'fruits-vegetables', 'spinach', 'tomato', 'avocado', 'greens'],
  fruit: ['fruits', 'fruits-vegetables', 'avocado', 'banana', 'apple', 'orange', 'mango'],
  fruits: ['fruit', 'fruits-vegetables', 'avocado', 'banana', 'apple', 'orange', 'mango'],
  milk: ['dairy', 'dairy-bakery', 'cow', 'paneer', 'yogurt', 'butter'],
  bread: ['bakery', 'dairy-bakery', 'sourdough', 'croissant', 'loaf'],
  bakery: ['dairy-bakery', 'bread', 'sourdough', 'croissant'],
  rice: ['basmati', 'grocery', 'staples', 'lentil', 'dal'],
  snack: ['snacks', 'nuts', 'almond', 'cashew', 'chips', 'kombucha'],
  snacks: ['snack', 'nuts', 'almond', 'cashew', 'chips', 'kombucha'],
  drink: ['beverages', 'juice', 'tea', 'coffee', 'kombucha'],
  drinks: ['beverages', 'juice', 'tea', 'coffee', 'kombucha'],
  oil: ['mustard', 'olive', 'ghee', 'grocery'],
  egg: ['eggs', 'dairy-bakery'],
  eggs: ['egg', 'dairy-bakery'],
  tomato: ['tomatoes', 'fruits-vegetables'],
  tomatoes: ['tomato', 'fruits-vegetables'],
  sabji: ['vegetables', 'tomato', 'spinach', 'onion', 'potato'],
  tarkari: ['vegetables', 'tomato', 'spinach', 'onion', 'potato'],
  dudh: ['milk', 'dairy'],
  chamal: ['rice', 'basmati'],
};

function expandTokens(text: string): string[] {
  const clean = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const stopWords = new Set([
    'find', 'show', 'give', 'best', 'seller', 'sellers', 'price', 'cheapest', 'cheap',
    'nearest', 'near', 'deliver', 'delivery', 'assigned', 'location', 'address', 'direct',
    'buy', 'order', 'purchase', 'want', 'need', 'please', 'with', 'from', 'that', 'this',
    'what', 'which', 'for', 'and', 'the', 'are', 'you', 'can', 'today', 'now', 'under',
    'below', 'less', 'than', 'rs', 'npr', 'kg', 'ltr', 'pcs', 'pack', 'to', 'my', 'me',
  ]);
  const tokens: string[] = [];
  for (const w of clean) {
    if (stopWords.has(w)) continue;
    tokens.push(w);
    const syns = SYNONYM_MAP[w];
    if (syns) tokens.push(...syns);
  }
  return Array.from(new Set(tokens));
}

async function buildLiveMarketplaceContext(
  req: AuthRequest,
  userLocation?: {
    latitude?: number;
    longitude?: number;
    area?: string;
    street?: string;
    city?: string;
    addressId?: string;
  }
) {
  const now = new Date();
  const sessionKey = getEffectiveSessionKey(req);

  const [
    allProducts,
    allVendors,
    allCategories,
    activeCoupons,
    zones,
    feeConfig,
    cart,
    userAddresses,
    recentOrders,
  ] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.isActive, true), eq(products.approvalStatus, 'approved'))),
    db.select().from(vendors).where(eq(vendors.approvalStatus, 'approved')),
    db.select().from(categories).where(eq(categories.isActive, true)),
    db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.isActive, true),
          or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
          or(isNull(coupons.expiresAt), gte(coupons.expiresAt, now))
        )
      ),
    db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)),
    getPlatformFeesConfig(),
    calculateAndSerializeCart(sessionKey, req.authUser?.id),
    req.authUser
      ? db
          .select()
          .from(addresses)
          .where(eq(addresses.userId, req.authUser.id))
          .orderBy(desc(addresses.isDefault), desc(addresses.id))
      : Promise.resolve([]),
    req.authUser
      ? db
          .select()
          .from(orders)
          .where(eq(orders.userId, req.authUser.id))
          .orderBy(desc(orders.createdAt))
          .limit(3)
      : Promise.resolve([]),
  ]);

  // Resolve assigned delivery location cleanly
  const matchedSaved =
    (userLocation?.addressId
      ? userAddresses.find(
          (a) =>
            `addr-${a.id}` === userLocation.addressId || String(a.id) === String(userLocation.addressId)
        )
      : undefined) || userAddresses[0];

  const assignedLocation: ResolvedDeliveryLocation = {
    addressId: matchedSaved ? `addr-${matchedSaved.id}` : userLocation?.addressId,
    title: matchedSaved?.title || (userLocation?.area ? 'Assigned Location' : 'Kathmandu Central'),
    street: userLocation?.street || matchedSaved?.street || 'New Baneshwor Chowk',
    area: userLocation?.area || matchedSaved?.area || 'New Baneshwor',
    city: userLocation?.city || matchedSaved?.city || 'Kathmandu',
    lat:
      typeof userLocation?.latitude === 'number' && !Number.isNaN(userLocation.latitude)
        ? userLocation.latitude
        : matchedSaved?.lat
        ? parseFloat(matchedSaved.lat)
        : 27.6986,
    lng:
      typeof userLocation?.longitude === 'number' && !Number.isNaN(userLocation.longitude)
        ? userLocation.longitude
        : matchedSaved?.lng
        ? parseFloat(matchedSaved.lng)
        : 85.3292,
  };

  const vendorMap = new Map(allVendors.map((v) => [v.id, v]));
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  const offers: EnrichedCatalogOffer[] = allProducts.map((p) => {
    const vRow = p.vendorId ? vendorMap.get(p.vendorId) : undefined;
    const cRow = p.categoryId ? categoryMap.get(p.categoryId) : undefined;
    const vLat = vRow ? parseFloat(vRow.lat) : 27.701;
    const vLng = vRow ? parseFloat(vRow.lng) : 85.331;
    const distanceKm = calculateDistanceKm(assignedLocation.lat, assignedLocation.lng, vLat, vLng);
    const etaMins = estimateEtaMins(distanceKm, vRow?.eta);
    const vRating = vRow ? parseFloat(vRow.rating || '4.8') : 4.8;
    const pRating = parseFloat(p.rating || '4.8');
    const origPrice = p.originalPrice || p.price;
    const discountPct =
      origPrice > p.price ? Math.round(((origPrice - p.price) / origPrice) * 100) : p.discountPercent || 0;

    // Composite value score: lower price + higher discount + closer distance + higher seller rating + online & in-stock
    const priceFactor = Math.max(0, 100 - Math.min(100, p.price / 15));
    const distanceFactor = Math.max(0, 100 - distanceKm * 18);
    const ratingFactor = vRating * 14 + pRating * 6;
    const discountFactor = discountPct * 0.8;
    const availabilityBonus = p.inStock && p.stockCount > 0 ? 50 : -500;
    const onlineBonus = vRow?.isOnline !== false ? 25 : -200;
    const bestSellerBonus =
      (Array.isArray(p.sections) && p.sections.includes('best_sellers')) || p.isBestSeller ? 12 : 0;

    const valueScore = Math.round(
      priceFactor + distanceFactor + ratingFactor + discountFactor + availabilityBonus + onlineBonus + bestSellerBonus
    );

    return {
      product_id: p.externalKey || `prod-${p.id}`,
      db_id: p.id,
      name: p.name,
      slug: p.slug,
      category: cRow?.name || p.category,
      category_slug: cRow?.slug || p.subCategory || 'grocery',
      unit: p.unit,
      price: p.price,
      original_price: origPrice,
      discount_percentage: discountPct,
      stock: p.stockCount,
      in_stock: Boolean(p.inStock && p.stockCount > 0),
      rating: pRating,
      reviews_count: p.ratingCount,
      is_organic: Boolean(p.isOrganic),
      sections: Array.isArray(p.sections) ? p.sections : [],
      description: p.description || '',
      origin: p.origin || '',
      image_url: p.image,
      vendor_db_id: vRow?.id || p.vendorId || 1,
      vendor_id: vRow?.externalKey || `v-${p.vendorId || 1}`,
      vendor_name: vRow?.name || p.vendorName,
      vendor_area: vRow?.area || 'Kathmandu',
      vendor_city: vRow?.city || 'Kathmandu',
      vendor_rating: vRating,
      vendor_is_online: vRow ? Boolean(vRow.isOnline) : true,
      vendor_is_verified: vRow ? Boolean(vRow.isVerified) : true,
      distance_km: distanceKm,
      eta_mins: etaMins,
      value_score: valueScore,
    };
  });

  const eligibleCoupons = activeCoupons.filter(
    (c) => c.usageLimit === null || c.usedCount < c.usageLimit
  );

  return {
    assignedLocation,
    offers,
    vendors: allVendors,
    categories: allCategories,
    coupons: eligibleCoupons,
    zones,
    feeConfig,
    cart,
    userAddresses,
    recentOrders,
    sessionKey,
  };
}

function rankOffersForQuery(
  offers: EnrichedCatalogOffer[],
  params: {
    query?: string;
    category?: string;
    maxPrice?: number;
    priority?: 'balanced' | 'cheapest' | 'nearest' | 'top_rated';
    limit?: number;
  }
) {
  const inStock = offers.filter((o) => o.in_stock && o.stock > 0);
  const queryText = (params.query || '').trim();
  const tokens = expandTokens(queryText);

  let candidates = inStock;
  if (params.category) {
    const catLower = params.category.toLowerCase();
    const catMatched = candidates.filter(
      (o) =>
        o.category_slug.toLowerCase().includes(catLower) ||
        o.category.toLowerCase().includes(catLower)
    );
    if (catMatched.length > 0) candidates = catMatched;
  }

  if (typeof params.maxPrice === 'number' && params.maxPrice > 0) {
    const priceFiltered = candidates.filter((o) => o.price <= params.maxPrice!);
    if (priceFiltered.length > 0) candidates = priceFiltered;
  }

  const scored = candidates.map((o) => {
    let textMatchScore = 0;
    const nameLower = o.name.toLowerCase();
    const catLower = `${o.category} ${o.category_slug}`.toLowerCase();
    const vendorLower = `${o.vendor_name} ${o.vendor_area}`.toLowerCase();
    const descLower = `${o.description} ${o.origin}`.toLowerCase();

    if (queryText && nameLower.includes(queryText.toLowerCase())) {
      textMatchScore += 180;
    }

    for (const tok of tokens) {
      if (nameLower.includes(tok)) textMatchScore += 80;
      else if (catLower.includes(tok)) textMatchScore += 45;
      else if (vendorLower.includes(tok)) textMatchScore += 35;
      else if (descLower.includes(tok)) textMatchScore += 20;
    }

    return { offer: o, textMatchScore };
  });

  const hasQueryMatches = tokens.length > 0 && scored.some((s) => s.textMatchScore > 0);
  let filtered = hasQueryMatches ? scored.filter((s) => s.textMatchScore > 0) : scored;

  const priority = params.priority || 'balanced';
  filtered = [...filtered].sort((a, b) => {
    if (hasQueryMatches && Math.abs(b.textMatchScore - a.textMatchScore) >= 40) {
      return b.textMatchScore - a.textMatchScore;
    }
    if (priority === 'cheapest') {
      if (a.offer.price !== b.offer.price) return a.offer.price - b.offer.price;
      return a.offer.distance_km - b.offer.distance_km;
    }
    if (priority === 'nearest') {
      if (a.offer.distance_km !== b.offer.distance_km) {
        return a.offer.distance_km - b.offer.distance_km;
      }
      return a.offer.price - b.offer.price;
    }
    if (priority === 'top_rated') {
      if (b.offer.vendor_rating !== a.offer.vendor_rating) {
        return b.offer.vendor_rating - a.offer.vendor_rating;
      }
      return a.offer.price - b.offer.price;
    }
    return b.offer.value_score - a.offer.value_score;
  });

  const top = filtered.slice(0, params.limit || 6).map((s) => s.offer);
  if (top.length === 0) return [];

  const minPrice = Math.min(...top.map((o) => o.price));
  const minDist = Math.min(...top.map((o) => o.distance_km));
  const maxRating = Math.max(...top.map((o) => o.vendor_rating));

  return top.map((o, idx) => {
    let badge = 'Best Match';
    if (o.price === minPrice && o.distance_km === minDist) {
      badge = 'Best Price + Nearest';
    } else if (o.price === minPrice) {
      badge = 'Best Price';
    } else if (o.distance_km === minDist) {
      badge = `Nearest (${o.distance_km} km)`;
    } else if (o.vendor_rating === maxRating && idx === 0) {
      badge = 'Top Rated Seller';
    } else if (o.discount_percentage >= 15) {
      badge = `${o.discount_percentage}% OFF Deal`;
    }

    return {
      product_id: o.product_id,
      db_id: o.db_id,
      name: o.name,
      category: o.category,
      unit: o.unit,
      price: o.price,
      original_price: o.original_price,
      discount_percentage: o.discount_percentage,
      stock: o.stock,
      image_url: o.image_url,
      vendor_id: o.vendor_id,
      vendor_name: o.vendor_name,
      vendor_area: o.vendor_area,
      vendor_rating: o.vendor_rating,
      distance_km: o.distance_km,
      eta_mins: o.eta_mins,
      recommended_badge: badge,
      suggested_quantity: 1,
    };
  });
}

function buildOrderPreviewFromItems(
  requestedItems: { product_id: string; quantity: number }[],
  context: Awaited<ReturnType<typeof buildLiveMarketplaceContext>>,
  opts?: {
    payment_method?: string;
    delivery_option?: string;
    coupon_code?: string | null;
    isAuthenticated?: boolean;
  }
) {
  const offerById = new Map<string, EnrichedCatalogOffer>();
  for (const o of context.offers) {
    offerById.set(o.product_id, o);
    offerById.set(String(o.db_id), o);
    offerById.set(o.slug, o);
  }

  const lineItems: any[] = [];
  let subtotal = 0;
  let maxEta = 12;

  for (const reqItem of requestedItems) {
    const offer = offerById.get(String(reqItem.product_id));
    if (!offer || !offer.in_stock || offer.stock <= 0) continue;
    const qty = Math.min(offer.stock, Math.max(1, Math.round(Number(reqItem.quantity) || 1)));
    const lineTotal = offer.price * qty;
    subtotal += lineTotal;
    if (offer.eta_mins > maxEta) maxEta = offer.eta_mins;
    lineItems.push({
      product_id: offer.product_id,
      name: offer.name,
      unit: offer.unit,
      quantity: qty,
      unit_price: offer.price,
      line_total: lineTotal,
      stock: offer.stock,
      image_url: offer.image_url,
      vendor_id: offer.vendor_id,
      vendor_name: offer.vendor_name,
      vendor_rating: offer.vendor_rating,
      distance_km: offer.distance_km,
      eta_mins: offer.eta_mins,
    });
  }

  if (lineItems.length === 0) return null;

  const deliveryOption =
    opts?.delivery_option === 'SCHEDULED_TODAY' ? 'SCHEDULED_TODAY' : 'EXPRESS_12_MINS';
  const paymentMethod = opts?.payment_method || 'CASH_ON_DELIVERY';
  const deliveryFee =
    subtotal >= context.feeConfig.freeDeliveryThreshold ? 0 : context.feeConfig.baseDeliveryFee;
  const handlingFee = context.feeConfig.handlingFee;

  // Auto-select requested coupon or best eligible coupon
  let appliedCode: string | null = opts?.coupon_code?.toUpperCase() || null;
  let discount = 0;
  if (appliedCode) {
    const cRow = context.coupons.find((c) => c.code === appliedCode);
    if (cRow && subtotal >= cRow.minOrderAmount) {
      discount = computeCouponDiscount(cRow, subtotal, deliveryFee);
    } else {
      appliedCode = null;
    }
  } else if (context.coupons.length > 0) {
    for (const cRow of context.coupons) {
      if (subtotal >= cRow.minOrderAmount) {
        const comp = computeCouponDiscount(cRow, subtotal, deliveryFee);
        if (comp > discount) {
          discount = comp;
          appliedCode = cRow.code;
        }
      }
    }
  }

  const totalAmount = Math.max(0, subtotal + deliveryFee + handlingFee - discount);

  return {
    items: lineItems,
    assigned_address: {
      id: context.assignedLocation.addressId,
      title: context.assignedLocation.title,
      street: context.assignedLocation.street,
      area: context.assignedLocation.area,
      city: context.assignedLocation.city,
      lat: context.assignedLocation.lat,
      lng: context.assignedLocation.lng,
    },
    payment_method: paymentMethod,
    delivery_option: deliveryOption,
    coupon_code: appliedCode,
    subtotal,
    delivery_fee: deliveryFee,
    free_delivery_threshold: context.feeConfig.freeDeliveryThreshold,
    handling_fee: handlingFee,
    discount,
    total_amount: totalAmount,
    estimated_mins: deliveryOption === 'EXPRESS_12_MINS' ? maxEta : 35,
    requires_auth: !opts?.isAuthenticated,
  };
}

async function createDirectOrderFromItems(params: {
  authUser: NonNullable<AuthRequest['authUser']>;
  items: { product_id: string; quantity: number; variant_id?: string }[];
  addressId?: string;
  deliveryAddress?: any;
  paymentMethod?: string;
  deliveryOption?: string;
  couponCode?: string | null;
  notes?: string;
  ipAddress?: string;
}) {
  if (!params.items || params.items.length === 0) {
    throw new ApiError(400, 'At least one item is required for direct order.', 'EMPTY_ITEMS');
  }

  return createTransactionalOrder({
    sessionKey: `ai-direct-${params.authUser.id}`,
    authUser: params.authUser,
    addressId: params.addressId,
    deliveryAddressPayload: params.deliveryAddress,
    paymentMethod: params.paymentMethod || 'CASH_ON_DELIVERY',
    deliveryOption: params.deliveryOption || 'EXPRESS_12_MINS',
    notes: params.notes || 'Direct AI Concierge Purchase',
    ipAddress: params.ipAddress,
    directItems: params.items,
    couponCodeOverride: params.couponCode ? params.couponCode.trim().toUpperCase() : null,
  });
}

// Gemini Function Declarations
const findBestSellerOffersDecl: FunctionDeclaration = {
  name: 'find_best_seller_offers',
  description:
    'Search ALL active approved products across every vendor in PostgreSQL and rank them by best price, vendor rating, stock, and shortest distance to the customer assigned delivery address.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Product name, grocery keyword, dish/ingredient, or vendor name to search.',
      },
      category: {
        type: Type.STRING,
        description: 'Optional category slug such as fruits-vegetables, dairy-bakery, grocery, snacks, beverages.',
      },
      max_price: {
        type: Type.NUMBER,
        description: 'Optional maximum unit price filter in Rs.',
      },
      priority: {
        type: Type.STRING,
        description: 'Ranking strategy: balanced, cheapest, nearest, or top_rated.',
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum number of offers to return (default 5).',
      },
    },
    required: ['query'],
  },
};

const prepareDirectPurchaseDecl: FunctionDeclaration = {
  name: 'prepare_direct_purchase',
  description:
    'Build an interactive 1-tap Direct Purchase checkout card in chat for one or more selected best-seller products delivered to the customer assigned delivery address.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: 'List of product_id and quantity to include in direct checkout.',
        items: {
          type: Type.OBJECT,
          properties: {
            product_id: { type: Type.STRING },
            quantity: { type: Type.INTEGER },
          },
          required: ['product_id', 'quantity'],
        },
      },
      payment_method: {
        type: Type.STRING,
        description: 'CASH_ON_DELIVERY, ESEWA, or KHALTI (default CASH_ON_DELIVERY).',
      },
      delivery_option: {
        type: Type.STRING,
        description: 'EXPRESS_12_MINS or SCHEDULED_TODAY (default EXPRESS_12_MINS).',
      },
      coupon_code: {
        type: Type.STRING,
        description: 'Optional coupon code to apply.',
      },
    },
    required: ['items'],
  },
};

const placeDirectPurchaseDecl: FunctionDeclaration = {
  name: 'place_direct_purchase',
  description:
    'Place a real order immediately in PostgreSQL ONLY when the authenticated customer explicitly confirms they want to finalize/place the purchase right now.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            product_id: { type: Type.STRING },
            quantity: { type: Type.INTEGER },
          },
          required: ['product_id', 'quantity'],
        },
      },
      payment_method: {
        type: Type.STRING,
        description: 'CASH_ON_DELIVERY, ESEWA, or KHALTI.',
      },
      delivery_option: {
        type: Type.STRING,
        description: 'EXPRESS_12_MINS or SCHEDULED_TODAY.',
      },
      coupon_code: {
        type: Type.STRING,
      },
      notes: {
        type: Type.STRING,
      },
    },
    required: ['items'],
  },
};

const addItemsToCartDecl: FunctionDeclaration = {
  name: 'add_items_to_cart',
  description: 'Add one or more best-seller products to the customer shopping cart.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            product_id: { type: Type.STRING },
            quantity: { type: Type.INTEGER },
          },
          required: ['product_id', 'quantity'],
        },
      },
    },
    required: ['items'],
  },
};

function runDeterministicShoppingFallback(
  userQuery: string,
  language: 'en' | 'ne',
  context: Awaited<ReturnType<typeof buildLiveMarketplaceContext>>,
  isAuthenticated: boolean
) {
  const qLower = userQuery.toLowerCase();
  const isCheapestIntent = /cheap|lowest|best price|budget|सस्तो|कम मूल्य/.test(qLower);
  const isNearestIntent = /near|closest|fast|express|नजिक|छिटो/.test(qLower);
  const isBuyIntent = /buy|order|purchase|checkout|deliver|send|किन्नु|अर्डर|पठाउनु/.test(qLower);

  const priority = isCheapestIntent
    ? 'cheapest'
    : isNearestIntent
    ? 'nearest'
    : 'balanced';

  // Support multi-item queries separated by "and", "&", ",", or "+"
  const segments = userQuery
    .split(/\s+(?:and|with|plus|\+|र)\s+|,/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  const collectedOffersMap = new Map<string, any>();
  const bundleItems: { product_id: string; quantity: number }[] = [];

  const searchSegments = segments.length > 1 ? segments : [userQuery];
  for (const seg of searchSegments) {
    const qtyMatch = /\b(\d+)\s*(?:x|pcs|kg|l|ltr|pack|packs|bottle|bottles)?\b/i.exec(seg);
    const parsedQty = qtyMatch ? Math.min(10, Math.max(1, parseInt(qtyMatch[1], 10))) : 1;

    const ranked = rankOffersForQuery(context.offers, {
      query: seg,
      priority,
      limit: segments.length > 1 ? 2 : 5,
    });

    if (ranked.length > 0) {
      const topPick = ranked[0];
      if (!bundleItems.some((b) => b.product_id === topPick.product_id)) {
        bundleItems.push({ product_id: topPick.product_id, quantity: parsedQty });
      }
      for (const offer of ranked) {
        if (!collectedOffersMap.has(offer.product_id)) {
          collectedOffersMap.set(offer.product_id, {
            ...offer,
            suggested_quantity: offer.product_id === topPick.product_id ? parsedQty : 1,
          });
        }
      }
    }
  }

  const recommendedOffers = Array.from(collectedOffersMap.values()).slice(0, 6);
  const orderPreview =
    (isBuyIntent || segments.length > 1 || recommendedOffers.length > 0) && bundleItems.length > 0
      ? buildOrderPreviewFromItems(bundleItems, context, {
          payment_method: /esewa/i.test(qLower)
            ? 'ESEWA'
            : /khalti/i.test(qLower)
            ? 'KHALTI'
            : 'CASH_ON_DELIVERY',
          delivery_option: 'EXPRESS_12_MINS',
          isAuthenticated,
        })
      : null;

  const locLabel = `${context.assignedLocation.area}, ${context.assignedLocation.city}`;
  const couponNote =
    context.coupons.length > 0
      ? language === 'ne'
        ? `\n\n🏷️ सक्रिय कुपन: **${context.coupons[0].code}** (${context.coupons[0].description})`
        : `\n\n🏷️ Active coupon available: **${context.coupons[0].code}** — ${context.coupons[0].description}`
      : '';

  let reply = '';
  if (recommendedOffers.length === 0) {
    reply =
      language === 'ne'
        ? `नमस्ते! "${locLabel}" को लागि हाल स्टकमा रहेका ताजा सामग्रीहरू उपलब्ध छन्, तर तपाईंले खोज्नुभएको सामग्री फेला परेन। कृपया अर्को नाम प्रयास गर्नुहोस्।`
        : `I checked all ${context.offers.length} live products across ${context.vendors.length} verified sellers near **${locLabel}**, but couldn't find an exact in-stock match. Try searching for vegetables, fresh milk, bread, snacks, or pantry staples!`;
  } else {
    const lines = recommendedOffers.slice(0, 4).map(
      (o) =>
        `• **${o.name}** (${o.unit}) — **Rs. ${o.price}** · ${o.vendor_name} (★ ${o.vendor_rating}, ${o.distance_km} km, ~${o.eta_mins} mins) [${o.recommended_badge}]`
    );
    if (language === 'ne') {
      reply =
        `तपाईंको डेलिभरी ठेगाना **${locLabel}** को लागि उत्कृष्ट मूल्य र नजिकको पसल फेला पर्यो:\n\n` +
        lines.join('\n') +
        `\n\nतलको कार्डबाट सीधै कार्टमा थप्न वा **तुरुन्तै अर्डर (Direct Buy)** गर्न सक्नुहुन्छ।${couponNote}`;
    } else {
      reply =
        `I analyzed all **${context.offers.length} live products** across **${context.vendors.length} local sellers** for delivery to **${locLabel}** and selected the best seller & best price options:\n\n` +
        lines.join('\n') +
        `\n\nYou can add any item to cart or use the **Direct Purchase** card below to complete delivery straight to your assigned address.${couponNote}`;
    }
  }

  return { reply, recommendedOffers, orderPreview };
}

// POST /api/v1/chat/ (Gemini 4 Hydrogen + Full PostgreSQL Data + Function Calling + Direct Checkout)
router.post(
  '/chat/',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const { messages, userLocation, language = 'en' } = req.body as {
      messages?: { role: string; content: string }[];
      userLocation?: {
        latitude?: number;
        longitude?: number;
        area?: string;
        street?: string;
        city?: string;
        addressId?: string;
      };
      language?: 'en' | 'ne';
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new ApiError(400, 'messages array is required', 'MISSING_MESSAGES');
    }

    const context = await buildLiveMarketplaceContext(req, userLocation);
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const isAuthenticated = Boolean(req.authUser);

    const assignedLocationSummary = `${context.assignedLocation.title}: ${context.assignedLocation.street}, ${context.assignedLocation.area}, ${context.assignedLocation.city} (${context.assignedLocation.lat.toFixed(4)}, ${context.assignedLocation.lng.toFixed(4)})`;

    // Full catalog summary ordered by distance + value so Gemini sees EVERY active product & seller in DB
    const fullCatalogText = context.offers
      .slice()
      .sort((a, b) => b.value_score - a.value_score)
      .map(
        (o) =>
          `[${o.product_id}] ${o.name} | Cat: ${o.category} | Price: Rs.${o.price} (Orig Rs.${o.original_price}, -${o.discount_percentage}%) | Unit: ${o.unit} | Stock: ${o.in_stock ? o.stock : 0} | Seller: ${o.vendor_name} (${o.vendor_area}, ★${o.vendor_rating}, ${o.distance_km}km, ~${o.eta_mins}m ETA)`
      )
      .join('\n');

    const couponSummary =
      context.coupons.length > 0
        ? context.coupons
            .map((c) => `${c.code}: ${c.description} (Min Rs.${c.minOrderAmount})`)
            .join(' | ')
        : 'None';

    const vendorSummary = context.vendors
      .map((v) => {
        const dist = calculateDistanceKm(
          context.assignedLocation.lat,
          context.assignedLocation.lng,
          parseFloat(v.lat),
          parseFloat(v.lng)
        );
        return `${v.name} (${v.area}, ★${v.rating}, ${dist}km away, ETA ${estimateEtaMins(dist, v.eta)}m, Online: ${v.isOnline})`;
      })
      .join('\n');

    const collectedOffers: any[] = [];
    let orderPreview: any = null;
    let placedOrder: any = null;
    let cartUpdated = false;

    const executeToolCall = async (name: string, args: Record<string, any>) => {
      if (name === 'find_best_seller_offers') {
        const results = rankOffersForQuery(context.offers, {
          query: String(args.query || ''),
          category: args.category ? String(args.category) : undefined,
          maxPrice: typeof args.max_price === 'number' ? args.max_price : undefined,
          priority: (args.priority as any) || 'balanced',
          limit: typeof args.limit === 'number' ? Math.min(8, Math.max(1, args.limit)) : 5,
        });
        for (const r of results) {
          if (!collectedOffers.some((existing) => existing.product_id === r.product_id)) {
            collectedOffers.push(r);
          }
        }
        return {
          assigned_delivery_location: context.assignedLocation,
          matched_count: results.length,
          offers: results,
        };
      }

      if (name === 'prepare_direct_purchase') {
        const reqItems = Array.isArray(args.items) ? args.items : [];
        const preview = buildOrderPreviewFromItems(reqItems, context, {
          payment_method: args.payment_method ? String(args.payment_method) : 'CASH_ON_DELIVERY',
          delivery_option: args.delivery_option ? String(args.delivery_option) : 'EXPRESS_12_MINS',
          coupon_code: args.coupon_code ? String(args.coupon_code) : null,
          isAuthenticated,
        });
        if (!preview) {
          return { error: 'No matching in-stock items could be matched for direct checkout.' };
        }
        orderPreview = preview;
        return { success: true, order_preview: preview };
      }

      if (name === 'add_items_to_cart') {
        const reqItems = Array.isArray(args.items) ? args.items : [];
        const sessionKey = context.sessionKey;
        const { getOrCreateCartRow } = await import('../services/catalogService.ts');
        const cartRow = await getOrCreateCartRow(sessionKey, req.authUser?.id);
        const added: string[] = [];

        for (const item of reqItems) {
          const pRow = await resolveProductByIdentifier(String(item.product_id || ''));
          if (!pRow || !pRow.isActive || !pRow.inStock || pRow.stockCount <= 0) continue;
          const qty = Math.min(pRow.stockCount, Math.max(1, Math.round(Number(item.quantity) || 1)));
          const existing = await db
            .select()
            .from(cartItems)
            .where(and(eq(cartItems.cartId, cartRow.id), eq(cartItems.productId, pRow.id)))
            .limit(1);
          if (existing.length > 0) {
            await db
              .update(cartItems)
              .set({ quantity: Math.min(pRow.stockCount, existing[0].quantity + qty), updatedAt: new Date() })
              .where(eq(cartItems.id, existing[0].id));
          } else {
            await db.insert(cartItems).values({
              cartId: cartRow.id,
              productId: pRow.id,
              variantId: null,
              quantity: qty,
              unitPriceSnapshot: pRow.price,
            });
          }
          added.push(`${pRow.name} x${qty}`);
        }
        cartUpdated = added.length > 0;
        const latestCart = await calculateAndSerializeCart(sessionKey, req.authUser?.id);
        return { success: cartUpdated, added, cart_total: latestCart.total, item_count: latestCart.item_count };
      }

      if (name === 'place_direct_purchase') {
        const reqItems = Array.isArray(args.items) ? args.items : [];
        if (!req.authUser) {
          const preview = buildOrderPreviewFromItems(reqItems, context, {
            payment_method: args.payment_method ? String(args.payment_method) : 'CASH_ON_DELIVERY',
            delivery_option: args.delivery_option ? String(args.delivery_option) : 'EXPRESS_12_MINS',
            coupon_code: args.coupon_code ? String(args.coupon_code) : null,
            isAuthenticated: false,
          });
          orderPreview = preview;
          return {
            requires_auth: true,
            message: 'Customer must sign in before finalizing direct purchase. Order preview prepared for 1-click checkout.',
            order_preview: preview,
          };
        }

        try {
          const order = await createDirectOrderFromItems({
            authUser: req.authUser,
            items: reqItems,
            addressId: context.assignedLocation.addressId,
            deliveryAddress: {
              title: context.assignedLocation.title,
              street: context.assignedLocation.street,
              area: context.assignedLocation.area,
              city: context.assignedLocation.city,
              lat: context.assignedLocation.lat,
              lng: context.assignedLocation.lng,
            },
            paymentMethod: args.payment_method ? String(args.payment_method) : 'CASH_ON_DELIVERY',
            deliveryOption: args.delivery_option ? String(args.delivery_option) : 'EXPRESS_12_MINS',
            couponCode: args.coupon_code ? String(args.coupon_code) : null,
            notes: args.notes ? String(args.notes) : 'Placed directly via OyoPasal AI Concierge',
            ipAddress: req.ip,
          });
          placedOrder = order;
          return {
            success: true,
            order_number: order.order_number,
            order_id: order.id,
            total_amount: order.total_amount,
            status: order.status,
            delivery_address: order.delivery_address,
          };
        } catch (err: any) {
          return { error: err?.message || 'Failed to place direct order' };
        }
      }

      return { error: `Unknown tool: ${name}` };
    };

    try {
      const apiKey = ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const systemInstruction = `You are OyoPasal AI Shopping Concierge for quick-commerce grocery delivery across Kathmandu Valley (Nepal).
Customer Language Preference: ${language === 'ne' ? 'Nepali (respond in natural Nepali with Rs. prices)' : 'English'}.
Customer Authentication Status: ${isAuthenticated ? `Signed in as ${req.authUser!.fullName}` : 'Guest (not signed in yet)'}.
Customer Assigned Delivery Location: ${assignedLocationSummary}
Platform Fees: Base Delivery Rs. ${context.feeConfig.baseDeliveryFee} (FREE over Rs. ${context.feeConfig.freeDeliveryThreshold}), Handling Rs. ${context.feeConfig.handlingFee}.
Current Cart: ${context.cart.item_count} items (Total Rs. ${context.cart.total}).
Active Coupons: ${couponSummary}

Approved Partner Vendors (with real distance from assigned address):
${vendorSummary}

FULL LIVE PRODUCT CATALOG (${context.offers.length} active approved products in PostgreSQL):
${fullCatalogText}

Strict Shopping Rules:
1. ALWAYS use the real products, prices, stock, vendor ratings, and distances above. Never invent products, prices, or sellers.
2. When the customer asks for products, deals, cheapest options, or nearest sellers: call \`find_best_seller_offers\` so the UI renders interactive offer cards, and compare sellers highlighting the best price + closest seller to "${context.assignedLocation.area}".
3. When the customer expresses intent to buy/order/deliver items ("buy", "order", "get me", "deliver to my location"):
   - Automatically select the best seller + best price in-stock match(es).
   - Call \`prepare_direct_purchase\` with those items so the UI displays a ready-to-confirm Direct Purchase bundle card to "${context.assignedLocation.area}".
   - ONLY call \`place_direct_purchase\` if the customer explicitly confirms placing the order right now (e.g., "confirm and place order now", "yes buy it now") AND is signed in.
4. Keep replies concise, practical, and reference exact Rs. prices, vendor names, distance (km), and ETA.`;

      const contents: any[] = messages.map((m) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const tools = [
        {
          functionDeclarations: [
            findBestSellerOffersDecl,
            prepareDirectPurchaseDecl,
            placeDirectPurchaseDecl,
            addItemsToCartDecl,
          ],
        },
      ];

      let finalReply = '';
      for (let round = 0; round < 3; round++) {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools,
          },
        });

        const functionCalls = response.functionCalls;
        const modelContent = response.candidates?.[0]?.content;

        if (!functionCalls || functionCalls.length === 0) {
          finalReply = response.text || '';
          break;
        }

        if (modelContent) {
          contents.push(modelContent);
        }

        const functionResponseParts: any[] = [];
        for (const fc of functionCalls) {
          const result = await executeToolCall(fc.name || '', (fc.args as Record<string, any>) || {});
          functionResponseParts.push({
            functionResponse: {
              id: fc.id,
              name: fc.name,
              response: result,
            },
          });
        }

        contents.push({
          role: 'user',
          parts: functionResponseParts,
        });
      }

      // If Gemini responded directly without calling find_best_seller_offers on a shopping query,
      // enrich with best matching offers from the full DB so the customer always gets actionable cards
      if (collectedOffers.length === 0 && lastUserMessage.trim().length > 2) {
        const autoOffers = rankOffersForQuery(context.offers, {
          query: lastUserMessage,
          priority: 'balanced',
          limit: 4,
        });
        collectedOffers.push(...autoOffers);
      }

      res.json({
        reply:
          finalReply ||
          'Here are the best-priced sellers closest to your assigned delivery location.',
        groundingChunks: [],
        recommendedOffers: collectedOffers,
        orderPreview,
        placedOrder,
        cartUpdated,
        assignedLocation: context.assignedLocation,
        catalogStats: {
          totalProducts: context.offers.length,
          totalVendors: context.vendors.length,
        },
      });
    } catch (error: any) {
      console.error('Gemini chat fallback activated:', error?.message || error);
      const fallback = runDeterministicShoppingFallback(
        lastUserMessage,
        language,
        context,
        isAuthenticated
      );
      res.status(200).json({
        reply: fallback.reply,
        groundingChunks: [],
        recommendedOffers: fallback.recommendedOffers,
        orderPreview: fallback.orderPreview,
        placedOrder: null,
        cartUpdated: false,
        assignedLocation: context.assignedLocation,
        catalogStats: {
          totalProducts: context.offers.length,
          totalVendors: context.vendors.length,
        },
      });
    }
  })
);

// POST /api/v1/chat/direct-order/ (1-tap Direct Checkout from AI Concierge to Assigned Delivery Address)
router.post(
  '/chat/direct-order/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const {
      items,
      address_id,
      delivery_address,
      payment_method,
      delivery_option,
      coupon_code,
      notes,
    } = req.body as {
      items?: { product_id: string; quantity: number; variant_id?: string }[];
      address_id?: string;
      delivery_address?: any;
      payment_method?: string;
      delivery_option?: string;
      coupon_code?: string | null;
      notes?: string;
    };

    const order = await createDirectOrderFromItems({
      authUser: req.authUser!,
      items: items || [],
      addressId: address_id,
      deliveryAddress: delivery_address,
      paymentMethod: payment_method,
      deliveryOption: delivery_option,
      couponCode: coupon_code,
      notes,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      order,
    });
  })
);

export default router;
