import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  addresses,
  cartItems,
  categories,
  coupons,
  deliveryZones,
  orders,
  products,
  vendors,
} from '../../src/db/schema.ts';
import { ENV } from '../config/env.ts';
import { AuthRequest, AuthenticatedUser, getEffectiveSessionKey } from '../middleware/auth.ts';
import {
  calculateAndSerializeCart,
  computeCouponDiscount,
  getOrCreateCartRow,
  getPlatformFeesConfig,
  resolveProductByIdentifier,
} from './catalogService.ts';
import { createTransactionalOrder } from './orderService.ts';
import { ApiError } from '../utils/errors.ts';

export function createConciergeAiClient(apiKey?: string) {
  return new GoogleGenAI({
    apiKey: apiKey || ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export const conciergeAi = createConciergeAiClient();

export interface UserLocationInput {
  latitude?: number;
  longitude?: number;
  area?: string;
  street?: string;
  city?: string;
  addressId?: string;
}

export interface EnrichedCatalogOffer {
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

export interface RankedOfferResult {
  product_id: string;
  db_id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
  original_price: number;
  discount_percentage: number;
  stock: number;
  image_url: string;
  vendor_id: string;
  vendor_name: string;
  vendor_area: string;
  vendor_rating: number;
  distance_km: number;
  eta_mins: number;
  recommended_badge: string;
  suggested_quantity: number;
}

export interface ResolvedDeliveryLocation {
  addressId?: string;
  title: string;
  street: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
}

export type PriceTier = 'cheap' | 'medium' | 'premium' | 'balanced';

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export function estimateEtaMins(distanceKm: number, rawEta?: string | null): number {
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
    'budget', 'affordable', 'inexpensive', 'economy', 'medium', 'mid', 'range', 'tier',
    'moderate', 'reasonable', 'average', 'premium', 'expensive', 'luxury', 'product',
    'products', 'item', 'items', 'thing', 'things', 'something', 'anything', 'option',
    'options', 'nearest', 'near', 'deliver', 'delivered', 'delivery', 'assigned',
    'location', 'address', 'direct', 'directly', 'buy', 'order', 'place', 'purchase',
    'want', 'need', 'please', 'with', 'from', 'that', 'this', 'what', 'which', 'for',
    'and', 'the', 'are', 'you', 'can', 'today', 'now', 'under', 'below', 'less', 'than',
    'between', 'rs', 'npr', 'kg', 'ltr', 'pcs', 'pack', 'to', 'my', 'me', 'set', 'automatically',
    'detect', 'only', 'photo', 'photos', 'list', 'lists', 'chat', 'box', 'beyond', 'go',
  ]);
  const tokens: string[] = [];
  for (const w of clean) {
    if (stopWords.has(w)) continue;
    if (/^\d+$/.test(w)) continue;
    tokens.push(w);
    const syns = SYNONYM_MAP[w];
    if (syns) tokens.push(...syns);
  }
  return Array.from(new Set(tokens));
}

export function detectPriceTier(text: string): PriceTier | null {
  const lower = text.toLowerCase();
  if (/\b(cheap|cheapest|budget|affordable|low[\s-]?price|lowest|inexpensive|economy|सस्तो|कम मूल्य)\b/i.test(lower)) {
    return 'cheap';
  }
  if (/\b(medium[\s-]?range|medium|mid[\s-]?range|mid[\s-]?tier|moderate|mid[\s-]?price|reasonable|average price|मध्यम)\b/i.test(lower)) {
    return 'medium';
  }
  if (/\b(premium|expensive|luxury|high[\s-]?end|प्रिमियम|महँगो)\b/i.test(lower)) {
    return 'premium';
  }
  return null;
}

export function detectExplicitPriceBounds(text: string): { minPrice?: number; maxPrice?: number } {
  const betweenMatch = /\bbetween\s*(?:rs\.?|npr)?\s*(\d+)\s*(?:and|to|-)\s*(?:rs\.?|npr)?\s*(\d+)/i.exec(text);
  if (betweenMatch) {
    const a = Number(betweenMatch[1]);
    const b = Number(betweenMatch[2]);
    if (!Number.isNaN(a) && !Number.isNaN(b) && a > 0 && b >= a) {
      return { minPrice: a, maxPrice: b };
    }
  }
  const underMatch = /\b(?:under|below|less than|max|within|upto|up to)\s*(?:rs\.?|npr)?\s*(\d+)/i.exec(text);
  if (underMatch) {
    const maxPrice = Number(underMatch[1]);
    if (!Number.isNaN(maxPrice) && maxPrice > 0) {
      return { maxPrice };
    }
  }
  return {};
}

export function detectAutonomousOrderIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  // Ignore negative instructions or informational how-to questions
  if (/\b(don't|do not|never|cancel|without placing|how to order|how do i order|what can i order|just show|only show|show only)\b/i.test(lower)) {
    return false;
  }
  // Action command to place / buy / order / deliver product(s)
  return /\b(order|buy|purchase|place\s+(?:an?\s+)?order|checkout|get\s+me|send\s+(?:me)?|deliver\s+(?:to|it|for)|bring\s+me|अर्डर|मगाउनु|किन्नु|पठाउनु)\b/i.test(lower);
}

export async function buildLiveMarketplaceContext(
  authUser: AuthenticatedUser | undefined,
  sessionKey: string,
  userLocation?: UserLocationInput
) {
  const now = new Date();

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
    calculateAndSerializeCart(sessionKey, authUser?.id),
    authUser
      ? db
          .select()
          .from(addresses)
          .where(eq(addresses.userId, authUser.id))
          .orderBy(desc(addresses.isDefault), desc(addresses.id))
      : Promise.resolve([]),
    authUser
      ? db
          .select()
          .from(orders)
          .where(eq(orders.userId, authUser.id))
          .orderBy(desc(orders.createdAt))
          .limit(3)
      : Promise.resolve([]),
  ]);

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

export type MarketplaceContext = Awaited<ReturnType<typeof buildLiveMarketplaceContext>>;

export function rankOffersForQuery(
  offers: EnrichedCatalogOffer[],
  params: {
    query?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    priceTier?: PriceTier;
    priority?: 'balanced' | 'cheapest' | 'medium' | 'nearest' | 'top_rated';
    limit?: number;
  }
): RankedOfferResult[] {
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

  if (typeof params.minPrice === 'number' && params.minPrice > 0) {
    const minFiltered = candidates.filter((o) => o.price >= params.minPrice!);
    if (minFiltered.length > 0) candidates = minFiltered;
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

  const effectiveTier: PriceTier | 'nearest' | 'top_rated' =
    params.priceTier ||
    (params.priority === 'cheapest'
      ? 'cheap'
      : params.priority === 'medium'
      ? 'medium'
      : params.priority === 'nearest'
      ? 'nearest'
      : params.priority === 'top_rated'
      ? 'top_rated'
      : 'balanced');

  let medianPrice = 0;
  if (effectiveTier === 'medium' && filtered.length >= 3) {
    const sortedByPrice = [...filtered].sort((a, b) => a.offer.price - b.offer.price);
    const lowIdx = Math.floor(sortedByPrice.length * 0.25);
    const highIdx = Math.ceil(sortedByPrice.length * 0.75);
    medianPrice = sortedByPrice[Math.floor(sortedByPrice.length / 2)].offer.price;
    const midBand = sortedByPrice.slice(lowIdx, Math.max(lowIdx + 1, highIdx));
    if (midBand.length > 0) {
      filtered = midBand;
    }
  } else if (filtered.length > 0) {
    const prices = filtered.map((f) => f.offer.price).sort((a, b) => a - b);
    medianPrice = prices[Math.floor(prices.length / 2)];
  }

  filtered = [...filtered].sort((a, b) => {
    if (hasQueryMatches && Math.abs(b.textMatchScore - a.textMatchScore) >= 40) {
      return b.textMatchScore - a.textMatchScore;
    }
    if (effectiveTier === 'cheap') {
      if (a.offer.price !== b.offer.price) return a.offer.price - b.offer.price;
      return a.offer.distance_km - b.offer.distance_km;
    }
    if (effectiveTier === 'medium') {
      const distA = Math.abs(a.offer.price - medianPrice);
      const distB = Math.abs(b.offer.price - medianPrice);
      if (Math.abs(distA - distB) > 15) return distA - distB;
      return b.offer.value_score - a.offer.value_score;
    }
    if (effectiveTier === 'premium') {
      if (b.offer.price !== a.offer.price) return b.offer.price - a.offer.price;
      return b.offer.vendor_rating - a.offer.vendor_rating;
    }
    if (effectiveTier === 'nearest') {
      if (a.offer.distance_km !== b.offer.distance_km) {
        return a.offer.distance_km - b.offer.distance_km;
      }
      return a.offer.price - b.offer.price;
    }
    if (effectiveTier === 'top_rated') {
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
    if (effectiveTier === 'medium' && idx === 0) {
      badge = 'Best Medium Range';
    } else if (effectiveTier === 'cheap' && idx === 0) {
      badge = 'Best Budget Pick';
    } else if (o.price === minPrice && o.distance_km === minDist) {
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

export function buildOrderPreviewFromItems(
  requestedItems: { product_id: string; quantity: number }[],
  context: MarketplaceContext,
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

  const lineItems: Array<{
    product_id: string;
    name: string;
    unit: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    stock: number;
    image_url: string;
    vendor_id: string;
    vendor_name: string;
    vendor_rating: number;
    distance_km: number;
    eta_mins: number;
  }> = [];
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

export async function createDirectOrderFromItems(params: {
  authUser: NonNullable<AuthRequest['authUser']>;
  items: { product_id: string; quantity: number; variant_id?: string }[];
  addressId?: string;
  deliveryAddress?: Record<string, unknown>;
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

export const findBestSellerOffersDecl: FunctionDeclaration = {
  name: 'find_best_seller_offers',
  description:
    'Search ALL active approved products across every vendor in PostgreSQL and rank them by price tier (cheap, medium, premium, or balanced), vendor rating, stock, and shortest distance to the customer assigned delivery address.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Product name, grocery keyword, dish/ingredient, or empty string when picking across the catalog.',
      },
      category: {
        type: Type.STRING,
        description: 'Optional category slug such as fruits-vegetables, dairy-bakery, grocery, snacks, beverages.',
      },
      price_tier: {
        type: Type.STRING,
        description: 'Price tier filter: cheap, medium, premium, or balanced.',
      },
      min_price: {
        type: Type.NUMBER,
        description: 'Optional minimum unit price filter in Rs.',
      },
      max_price: {
        type: Type.NUMBER,
        description: 'Optional maximum unit price filter in Rs.',
      },
      priority: {
        type: Type.STRING,
        description: 'Ranking strategy: balanced, cheapest, medium, nearest, or top_rated.',
      },
      limit: {
        type: Type.INTEGER,
        description: 'Maximum number of offers to return (default 5).',
      },
    },
    required: ['query'],
  },
};

export const prepareDirectPurchaseDecl: FunctionDeclaration = {
  name: 'prepare_direct_purchase',
  description:
    'Build a checkout preview card in chat when browsing/asking to see prices before ordering, or when the customer is not signed in yet.',
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

export const placeDirectPurchaseDecl: FunctionDeclaration = {
  name: 'place_direct_purchase',
  description:
    'Immediately place a real order in PostgreSQL to the customer assigned delivery address. Call this whenever an authenticated customer commands to order, buy, purchase, or deliver cheap, medium-range, or specific products.',
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

export const addItemsToCartDecl: FunctionDeclaration = {
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

export interface ConciergeToolAccumulator {
  collectedOffers: RankedOfferResult[];
  orderPreview: ReturnType<typeof buildOrderPreviewFromItems>;
  placedOrder: Awaited<ReturnType<typeof createDirectOrderFromItems>> | null;
  cartUpdated: boolean;
}

export async function executeConciergeToolCall(
  name: string,
  args: Record<string, unknown>,
  opts: {
    authUser?: AuthenticatedUser;
    context: MarketplaceContext;
    ipAddress?: string;
    accumulator: ConciergeToolAccumulator;
  }
) {
  const { authUser, context, ipAddress, accumulator } = opts;

  if (name === 'find_best_seller_offers') {
    const results = rankOffersForQuery(context.offers, {
      query: String(args.query || ''),
      category: args.category ? String(args.category) : undefined,
      priceTier: args.price_tier ? (String(args.price_tier) as PriceTier) : undefined,
      minPrice: typeof args.min_price === 'number' ? args.min_price : undefined,
      maxPrice: typeof args.max_price === 'number' ? args.max_price : undefined,
      priority: (args.priority as 'balanced' | 'cheapest' | 'medium' | 'nearest' | 'top_rated') || 'balanced',
      limit: typeof args.limit === 'number' ? Math.min(8, Math.max(1, args.limit)) : 5,
    });
    for (const r of results) {
      if (!accumulator.collectedOffers.some((existing) => existing.product_id === r.product_id)) {
        accumulator.collectedOffers.push(r);
      }
    }
    return {
      assigned_delivery_location: context.assignedLocation,
      matched_count: results.length,
      offers: results,
    };
  }

  if (name === 'prepare_direct_purchase') {
    const reqItems = Array.isArray(args.items)
      ? (args.items as { product_id: string; quantity: number }[])
      : [];
    const preview = buildOrderPreviewFromItems(reqItems, context, {
      payment_method: args.payment_method ? String(args.payment_method) : 'CASH_ON_DELIVERY',
      delivery_option: args.delivery_option ? String(args.delivery_option) : 'EXPRESS_12_MINS',
      coupon_code: args.coupon_code ? String(args.coupon_code) : null,
      isAuthenticated: Boolean(authUser),
    });
    if (!preview) {
      return { error: 'No matching in-stock items could be matched for direct checkout.' };
    }
    accumulator.orderPreview = preview;
    return { success: true, order_preview: preview };
  }

  if (name === 'add_items_to_cart') {
    const reqItems = Array.isArray(args.items)
      ? (args.items as { product_id: string; quantity: number }[])
      : [];
    const sessionKey = context.sessionKey;
    const cartRow = await getOrCreateCartRow(sessionKey, authUser?.id);
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
    accumulator.cartUpdated = added.length > 0;
    const latestCart = await calculateAndSerializeCart(sessionKey, authUser?.id);
    return {
      success: accumulator.cartUpdated,
      added,
      cart_total: latestCart.total,
      item_count: latestCart.item_count,
    };
  }

  if (name === 'place_direct_purchase') {
    const reqItems = Array.isArray(args.items)
      ? (args.items as { product_id: string; quantity: number }[])
      : [];
    if (!authUser) {
      const preview = buildOrderPreviewFromItems(reqItems, context, {
        payment_method: args.payment_method ? String(args.payment_method) : 'CASH_ON_DELIVERY',
        delivery_option: args.delivery_option ? String(args.delivery_option) : 'EXPRESS_12_MINS',
        coupon_code: args.coupon_code ? String(args.coupon_code) : null,
        isAuthenticated: false,
      });
      accumulator.orderPreview = preview;
      return {
        requires_auth: true,
        message: 'Customer must sign in before finalizing direct purchase. Order preview prepared for 1-click checkout.',
        order_preview: preview,
      };
    }

    try {
      const order = await createDirectOrderFromItems({
        authUser,
        items: reqItems,
        addressId: context.assignedLocation.addressId,
        deliveryAddress: {
          title: context.assignedLocation.title,
          recipient_name: authUser.fullName || 'OyoPasal Customer',
          phone: authUser.phone || '+977 9800000000',
          street: context.assignedLocation.street,
          area: context.assignedLocation.area,
          city: context.assignedLocation.city,
          lat: context.assignedLocation.lat,
          lng: context.assignedLocation.lng,
        },
        paymentMethod: args.payment_method ? String(args.payment_method) : 'CASH_ON_DELIVERY',
        deliveryOption: args.delivery_option ? String(args.delivery_option) : 'EXPRESS_12_MINS',
        couponCode: args.coupon_code ? String(args.coupon_code) : null,
        notes: args.notes ? String(args.notes) : 'Placed autonomously via OyoPasal AI Concierge',
        ipAddress,
      });
      accumulator.placedOrder = order;
      accumulator.orderPreview = null;
      return {
        success: true,
        order_number: order.order_number,
        order_id: order.id,
        total_amount: order.total_amount,
        status: order.status,
        delivery_address: order.delivery_address,
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Failed to place direct order' };
    }
  }

  return { error: `Unknown tool: ${name}` };
}

export function buildConciergeSystemInstruction(params: {
  context: MarketplaceContext;
  authUser?: AuthenticatedUser;
  language: 'en' | 'ne';
  forVoice?: boolean;
}) {
  const { context, authUser, language, forVoice = false } = params;
  const assignedLocationSummary = `${context.assignedLocation.title}: ${context.assignedLocation.street}, ${context.assignedLocation.area}, ${context.assignedLocation.city} (${context.assignedLocation.lat.toFixed(4)}, ${context.assignedLocation.lng.toFixed(4)})`;

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

  return `You are OyoPasal AI Shopping Concierge for quick-commerce grocery delivery across Kathmandu Valley (Nepal).
Customer Language Preference: ${language === 'ne' ? 'Nepali (respond in natural Nepali with Rs. prices)' : 'English'}.
Customer Authentication Status: ${authUser ? `Signed in as ${authUser.fullName || authUser.email}` : 'Guest (not signed in yet)'}.
Customer Assigned Delivery Location: ${assignedLocationSummary}
Platform Fees: Base Delivery Rs. ${context.feeConfig.baseDeliveryFee} (FREE over Rs. ${context.feeConfig.freeDeliveryThreshold}), Handling Rs. ${context.feeConfig.handlingFee}.
Current Cart: ${context.cart.item_count} items (Total Rs. ${context.cart.total}).
Active Coupons: ${couponSummary}

Approved Partner Vendors (with real distance from assigned address):
${vendorSummary}

FULL LIVE PRODUCT CATALOG (${context.offers.length} active approved products in PostgreSQL):
${fullCatalogText}

Strict Shopping & Autonomous Ordering Rules:
1. ALWAYS use real products, prices, stock, vendor ratings, and distances from the catalog above. Never invent products, prices, or sellers.
2. When the customer asks to browse/show/find products, deals, cheap or medium-range options: call \`find_best_seller_offers\` with the appropriate \`price_tier\` (\`cheap\`, \`medium\`, \`premium\`, or \`balanced\`).
3. AUTONOMOUS ORDER EXECUTION: Whenever the customer commands to **order, buy, purchase, send, or get delivered** any product (including generic requests like "order cheap product for me", "order a medium range item to my location", or specific items):
   - Automatically detect the best matching in-stock product(s) using \`find_best_seller_offers\` (\`price_tier: 'cheap'\` for cheap/budget, \`price_tier: 'medium'\` for medium-range/moderate).
   - ${authUser ? `Because the customer is signed in, IMMEDIATELY call \`place_direct_purchase\` right away to place a real order in PostgreSQL delivered to "${context.assignedLocation.area}"—do NOT merely list photo cards when they asked to order!` : `Because the customer is a guest, call \`prepare_direct_purchase\` and politely ask them to sign in so the order can be finalized.`}
4. Keep responses ${forVoice ? 'natural, warm, concise, and easy to follow aloud (mention exact product name, Rs. price, vendor, and order number if placed)' : 'concise, practical, and reference exact Rs. prices, vendor names, distance (km), ETA, and order number when placed'}.`;
}

function selectBundleFromQuery(userQuery: string, context: MarketplaceContext) {
  const qLower = userQuery.toLowerCase();
  const detectedTier = detectPriceTier(userQuery) || 'balanced';
  const explicitBounds = detectExplicitPriceBounds(userQuery);
  const isNearestIntent = /\b(near|closest|fast|express|नजिक|छिटो)\b/i.test(qLower);

  const priority: 'balanced' | 'cheapest' | 'medium' | 'nearest' | 'top_rated' =
    detectedTier === 'cheap'
      ? 'cheapest'
      : detectedTier === 'medium'
      ? 'medium'
      : isNearestIntent
      ? 'nearest'
      : 'balanced';

  const segments = userQuery
    .split(/\s+(?:and|with|plus|\+|र)\s+|,/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);

  const collectedOffersMap = new Map<string, RankedOfferResult>();
  const bundleItems: { product_id: string; quantity: number }[] = [];

  const searchSegments = segments.length > 1 ? segments : [userQuery];
  for (const seg of searchSegments) {
    const qtyMatch = /\b(\d+)\s*(?:x|pcs|kg|l|ltr|pack|packs|bottle|bottles)?\b/i.exec(seg);
    const parsedQty = qtyMatch ? Math.min(10, Math.max(1, parseInt(qtyMatch[1], 10))) : 1;

    const ranked = rankOffersForQuery(context.offers, {
      query: seg,
      priceTier: detectedTier,
      minPrice: explicitBounds.minPrice,
      maxPrice: explicitBounds.maxPrice,
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

  return {
    detectedTier,
    recommendedOffers: Array.from(collectedOffersMap.values()).slice(0, 6),
    bundleItems,
    paymentMethod: /esewa/i.test(qLower)
      ? 'ESEWA'
      : /khalti/i.test(qLower)
      ? 'KHALTI'
      : 'CASH_ON_DELIVERY',
  };
}

async function runDeterministicShoppingFallback(
  userQuery: string,
  language: 'en' | 'ne',
  context: MarketplaceContext,
  authUser?: AuthenticatedUser,
  ipAddress?: string
) {
  const isAuthenticated = Boolean(authUser);
  const isBuyCommand = detectAutonomousOrderIntent(userQuery);
  const { detectedTier, recommendedOffers, bundleItems, paymentMethod } = selectBundleFromQuery(
    userQuery,
    context
  );

  let placedOrder: Awaited<ReturnType<typeof createDirectOrderFromItems>> | null = null;
  let orderPreview: ReturnType<typeof buildOrderPreviewFromItems> = null;
  let autoOrderError: string | null = null;

  if (isBuyCommand && bundleItems.length > 0) {
    if (authUser) {
      try {
        placedOrder = await createDirectOrderFromItems({
          authUser,
          items: bundleItems,
          addressId: context.assignedLocation.addressId,
          deliveryAddress: {
            title: context.assignedLocation.title,
            recipient_name: authUser.fullName || 'OyoPasal Customer',
            phone: authUser.phone || '+977 9800000000',
            street: context.assignedLocation.street,
            area: context.assignedLocation.area,
            city: context.assignedLocation.city,
            lat: context.assignedLocation.lat,
            lng: context.assignedLocation.lng,
          },
          paymentMethod,
          deliveryOption: 'EXPRESS_12_MINS',
          notes: `Autonomous AI Order (${detectedTier} tier) -> ${context.assignedLocation.area}`,
          ipAddress,
        });
      } catch (err: unknown) {
        autoOrderError = err instanceof Error ? err.message : 'Auto-order failed';
      }
    }
  }

  if (!placedOrder && bundleItems.length > 0) {
    orderPreview = buildOrderPreviewFromItems(bundleItems, context, {
      payment_method: paymentMethod,
      delivery_option: 'EXPRESS_12_MINS',
      isAuthenticated,
    });
  }

  const locLabel = `${context.assignedLocation.area}, ${context.assignedLocation.city}`;
  const tierLabel =
    detectedTier === 'cheap'
      ? language === 'ne'
        ? 'सस्तो (बजेट)'
        : 'budget / cheap'
      : detectedTier === 'medium'
      ? language === 'ne'
        ? 'मध्यम मूल्य (मेडियम रेन्ज)'
        : 'medium-range'
      : language === 'ne'
      ? 'उत्कृष्ट'
      : 'best-matched';

  const couponNote =
    context.coupons.length > 0
      ? language === 'ne'
        ? `\n\n🏷️ सक्रिय कुपन: **${context.coupons[0].code}** (${context.coupons[0].description})`
        : `\n\n🏷️ Active coupon available: **${context.coupons[0].code}** — ${context.coupons[0].description}`
      : '';

  let reply = '';
  if (placedOrder) {
    const orderedLines = bundleItems
      .map((bi) => {
        const match = recommendedOffers.find((o) => o.product_id === bi.product_id);
        return match
          ? `• **${match.name}** x${bi.quantity} (${match.unit}) — **Rs. ${match.price * bi.quantity}** via ${match.vendor_name}`
          : null;
      })
      .filter(Boolean)
      .join('\n');

    reply =
      language === 'ne'
        ? `✅ मैले तपाईंको लागि **${tierLabel}** सामान स्वचालित रूपमा छानेर **${locLabel}** मा अर्डर पक्का गरिदिएँ!\n\n${orderedLines}\n\n🧾 अर्डर नम्बर: **${placedOrder.order_number}** · जम्मा: **Rs. ${placedOrder.total_amount}** (${placedOrder.payment_method})। तलबाट लाइभ ट्र्याक गर्न सक्नुहुन्छ।`
        : `✅ I automatically detected the best **${tierLabel}** product(s) and placed your order straight to **${locLabel}**!\n\n${orderedLines}\n\n🧾 Order **${placedOrder.order_number}** confirmed · Total **Rs. ${placedOrder.total_amount}** (${placedOrder.payment_method}).`;
  } else if (recommendedOffers.length === 0) {
    reply =
      language === 'ne'
        ? `नमस्ते! "${locLabel}" को लागि हाल स्टकमा रहेका ताजा सामग्रीहरू उपलब्ध छन्, तर तपाईंले खोज्नुभएको सामग्री फेला परेन। कृपया अर्को नाम प्रयास गर्नुहोस्।`
        : `I checked all ${context.offers.length} live products across ${context.vendors.length} verified sellers near **${locLabel}**, but couldn't find an exact in-stock match. Try searching for vegetables, fresh milk, bread, snacks, or pantry staples!`;
  } else {
    const lines = recommendedOffers.slice(0, 4).map(
      (o) =>
        `• **${o.name}** (${o.unit}) — **Rs. ${o.price}** · ${o.vendor_name} (★ ${o.vendor_rating}, ${o.distance_km} km, ~${o.eta_mins} mins) [${o.recommended_badge}]`
    );
    if (isBuyCommand && !isAuthenticated) {
      reply =
        language === 'ne'
          ? `मैले **${locLabel}** का लागि उत्कृष्ट **${tierLabel}** सामान छानिसकेको छु:\n\n${lines.join('\n')}\n\nअर्डर स्वचालित रूपमा पक्का गर्न कृपया साइन इन गर्नुहोस्।`
          : `I selected the best **${tierLabel}** product(s) for **${locLabel}**:\n\n${lines.join('\n')}\n\nPlease sign in below so I can finalize and place this order automatically to your location.${autoOrderError ? ` (${autoOrderError})` : ''}`;
    } else if (language === 'ne') {
      reply =
        `तपाईंको डेलिभरी ठेगाना **${locLabel}** को लागि उत्कृष्ट मूल्य र नजिकको पसल फेला पर्यो:\n\n` +
        lines.join('\n') +
        `\n\nतलको कार्डबाट सीधै कार्टमा थप्न वा **तुरुन्तै अर्डर (Direct Buy)** गर्न सक्नुहुन्छ।${couponNote}`;
    } else {
      reply =
        `I analyzed all **${context.offers.length} live products** across **${context.vendors.length} local sellers** for delivery to **${locLabel}** and selected the best **${tierLabel}** matches:\n\n` +
        lines.join('\n') +
        `\n\nYou can add any item to cart or use the **Direct Purchase** card below to complete delivery straight to your assigned address.${couponNote}`;
    }
  }

  return {
    reply,
    recommendedOffers,
    orderPreview,
    placedOrder,
    requiresAuthForAutoOrder: isBuyCommand && !isAuthenticated && Boolean(orderPreview),
  };
}

export async function handleChatConciergeTurn(
  req: AuthRequest,
  params: {
    messages: { role: string; content: string }[];
    userLocation?: UserLocationInput;
    language?: 'en' | 'ne';
  }
) {
  const { messages, userLocation, language = 'en' } = params;
  const sessionKey = getEffectiveSessionKey(req);
  const context = await buildLiveMarketplaceContext(req.authUser, sessionKey, userLocation);
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const isAuthenticated = Boolean(req.authUser);
  const isBuyCommand = detectAutonomousOrderIntent(lastUserMessage);

  const accumulator: ConciergeToolAccumulator = {
    collectedOffers: [],
    orderPreview: null,
    placedOrder: null,
    cartUpdated: false,
  };

  try {
    const apiKey = ENV.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const systemInstruction = buildConciergeSystemInstruction({
      context,
      authUser: req.authUser,
      language,
      forVoice: false,
    });

    const contents: Array<Record<string, unknown>> = messages.map((m) => ({
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
      const response = await conciergeAi.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contents as never,
        config: {
          systemInstruction,
          tools,
          abortSignal: AbortSignal.timeout(12000),
        },
      });

      const functionCalls = response.functionCalls;
      const modelContent = response.candidates?.[0]?.content;

      if (!functionCalls || functionCalls.length === 0) {
        finalReply = response.text || '';
        break;
      }

      if (modelContent) {
        contents.push(modelContent as unknown as Record<string, unknown>);
      }

      const functionResponseParts: Array<Record<string, unknown>> = [];
      for (const fc of functionCalls) {
        const result = await executeConciergeToolCall(
          fc.name || '',
          (fc.args as Record<string, unknown>) || {},
          {
            authUser: req.authUser,
            context,
            ipAddress: req.ip,
            accumulator,
          }
        );
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

    if (accumulator.collectedOffers.length === 0 && lastUserMessage.trim().length > 2) {
      const { recommendedOffers } = selectBundleFromQuery(lastUserMessage, context);
      accumulator.collectedOffers.push(...recommendedOffers);
    }

    // Guarantee autonomous order placement when the user issued a buy/order command
    if (isBuyCommand && !accumulator.placedOrder) {
      const candidateItems =
        accumulator.orderPreview?.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) ||
        (accumulator.collectedOffers[0]
          ? [{ product_id: accumulator.collectedOffers[0].product_id, quantity: accumulator.collectedOffers[0].suggested_quantity || 1 }]
          : selectBundleFromQuery(lastUserMessage, context).bundleItems);

      if (candidateItems.length > 0) {
        if (req.authUser) {
          try {
            const autoOrder = await createDirectOrderFromItems({
              authUser: req.authUser,
              items: candidateItems,
              addressId: context.assignedLocation.addressId,
              deliveryAddress: {
                title: context.assignedLocation.title,
                recipient_name: req.authUser.fullName || 'OyoPasal Customer',
                phone: req.authUser.phone || '+977 9800000000',
                street: context.assignedLocation.street,
                area: context.assignedLocation.area,
                city: context.assignedLocation.city,
                lat: context.assignedLocation.lat,
                lng: context.assignedLocation.lng,
              },
              paymentMethod: accumulator.orderPreview?.payment_method || 'CASH_ON_DELIVERY',
              deliveryOption: accumulator.orderPreview?.delivery_option || 'EXPRESS_12_MINS',
              couponCode: accumulator.orderPreview?.coupon_code || null,
              notes: `Autonomous AI Order -> ${context.assignedLocation.area}`,
              ipAddress: req.ip,
            });
            accumulator.placedOrder = autoOrder;
            accumulator.orderPreview = null;
            if (!finalReply.includes(autoOrder.order_number)) {
              finalReply =
                language === 'ne'
                  ? `✅ अर्डर **${autoOrder.order_number}** स्वचालित रूपमा **${context.assignedLocation.area}** मा पठाइयो (जम्मा Rs. ${autoOrder.total_amount})!\n\n${finalReply}`
                  : `✅ Automatically placed order **${autoOrder.order_number}** to **${context.assignedLocation.area}** (Total **Rs. ${autoOrder.total_amount}**).\n\n${finalReply}`;
            }
          } catch {
            // Keep preview if placement threw an unexpected validation error
          }
        } else if (!accumulator.orderPreview) {
          accumulator.orderPreview = buildOrderPreviewFromItems(candidateItems, context, {
            payment_method: 'CASH_ON_DELIVERY',
            delivery_option: 'EXPRESS_12_MINS',
            isAuthenticated: false,
          });
        }
      }
    }

    return {
      reply:
        finalReply ||
        'Here are the best-priced sellers closest to your assigned delivery location.',
      groundingChunks: [],
      recommendedOffers: accumulator.collectedOffers,
      orderPreview: accumulator.placedOrder ? null : accumulator.orderPreview,
      placedOrder: accumulator.placedOrder,
      requiresAuthForAutoOrder: Boolean(
        isBuyCommand && !isAuthenticated && !accumulator.placedOrder && accumulator.orderPreview
      ),
      cartUpdated: accumulator.cartUpdated,
      assignedLocation: context.assignedLocation,
      catalogStats: {
        totalProducts: context.offers.length,
        totalVendors: context.vendors.length,
      },
    };
  } catch (error: unknown) {
    console.error(
      'Gemini chat fallback activated:',
      error instanceof Error ? error.message : error
    );
    const fallback = await runDeterministicShoppingFallback(
      lastUserMessage,
      language,
      context,
      req.authUser,
      req.ip
    );
    return {
      reply: fallback.reply,
      groundingChunks: [],
      recommendedOffers: fallback.recommendedOffers,
      orderPreview: fallback.orderPreview,
      placedOrder: fallback.placedOrder,
      requiresAuthForAutoOrder: fallback.requiresAuthForAutoOrder,
      cartUpdated: false,
      assignedLocation: context.assignedLocation,
      catalogStats: {
        totalProducts: context.offers.length,
        totalVendors: context.vendors.length,
      },
    };
  }
}
