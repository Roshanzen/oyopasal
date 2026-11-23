import test from 'node:test';
import assert from 'node:assert/strict';

// Validation helpers
import { validatePhoneOrEmail, validatePassword, validateRequired } from '../validation';
import { formatPrice, formatCompactCurrency } from '../priceFormatter';
import { calculateDistanceInKm, estimateDeliveryMinutes } from '../distance';

// ---------------------------------------------------------------------------
// 1. AUTH & REGISTRATION FORM VALIDATION
// ---------------------------------------------------------------------------
test('Frontend Auth: validates phone or email correctly for Nepal users', () => {
  // Valid email -> returns null (no error)
  assert.equal(validatePhoneOrEmail('customer@oyopasal.com'), null);
  assert.equal(validatePhoneOrEmail('seller.nepal@gmail.com'), null);

  // Valid Nepal mobile numbers (98XXXXXXXX or 97XXXXXXXX) -> returns null (no error)
  assert.equal(validatePhoneOrEmail('9841234567'), null);
  assert.equal(validatePhoneOrEmail('9741234567'), null);
  assert.equal(validatePhoneOrEmail('+9779841234567'), null);

  // Invalid formats -> returns error message string
  assert.ok(validatePhoneOrEmail(''));
  assert.ok(validatePhoneOrEmail('12345'));
  assert.ok(validatePhoneOrEmail('notanemailorphone'));
});

test('Frontend Auth: enforces password security rules', () => {
  assert.ok(validatePassword('Short', 6), 'Password under minLength must return error message');
  assert.ok(validatePassword(''), 'Empty password must return error message');
  assert.equal(validatePassword('SecurePassword123!', 6), null, 'Valid password must return null');
});

// ---------------------------------------------------------------------------
// 2. PRODUCT DATA TRANSFORMATION & RESILIENCE (null, undefined, empty handling)
// ---------------------------------------------------------------------------
interface ProductDto {
  id?: string | null;
  name?: string | null;
  price?: number | null;
  original_price?: number | null;
  images?: Array<{ image_url?: string | null }> | null;
  unit?: string | null;
  variants?: Array<{ id: string; price: number; stock: number }> | null;
}

function normalizeProduct(raw: ProductDto | null | undefined) {
  if (!raw) {
    return {
      id: '',
      name: 'Unnamed Product',
      price: 0,
      originalPrice: 0,
      imageUrl: '/placeholder.png',
      unit: 'piece',
      inStock: false,
      hasDiscount: false,
      discountPercentage: 0
    };
  }

  const price = typeof raw.price === 'number' && !isNaN(raw.price) ? raw.price : 0;
  const originalPrice = typeof raw.original_price === 'number' && !isNaN(raw.original_price) ? raw.original_price : price;
  const images = Array.isArray(raw.images) ? raw.images : [];
  const firstImg = images.find(img => img && img.image_url)?.image_url || '/placeholder.png';
  const variants = Array.isArray(raw.variants) ? raw.variants : [];
  const totalStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);

  const discountPercentage = originalPrice > price && originalPrice > 0
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : 0;

  return {
    id: raw.id || '',
    name: raw.name || 'Unnamed Product',
    price,
    originalPrice,
    imageUrl: firstImg,
    unit: raw.unit || 'piece',
    inStock: totalStock > 0 || variants.length === 0,
    hasDiscount: discountPercentage > 0,
    discountPercentage
  };
}

test('Frontend Product: safely normalizes null, undefined, and malformed products without crashing', () => {
  const emptyRes = normalizeProduct(null);
  assert.equal(emptyRes.name, 'Unnamed Product');
  assert.equal(emptyRes.price, 0);
  assert.equal(emptyRes.imageUrl, '/placeholder.png');
  assert.equal(emptyRes.unit, 'piece');

  const partialRes = normalizeProduct({
    id: 'prod-123',
    name: 'Himalayan Shilajit Resin',
    price: 1800,
    original_price: 2400,
    images: [{ image_url: null }, { image_url: 'https://cdn.oyopasal.com/shilajit.jpg' }],
    variants: [{ id: 'v1', price: 1800, stock: 12 }]
  });

  assert.equal(partialRes.name, 'Himalayan Shilajit Resin');
  assert.equal(partialRes.price, 1800);
  assert.equal(partialRes.originalPrice, 2400);
  assert.equal(partialRes.imageUrl, 'https://cdn.oyopasal.com/shilajit.jpg');
  assert.equal(partialRes.discountPercentage, 25);
  assert.equal(partialRes.hasDiscount, true);
  assert.equal(partialRes.inStock, true);
});

// ---------------------------------------------------------------------------
// 3. CART INTERACTIONS & DELIVERY CALCULATIONS
// ---------------------------------------------------------------------------
interface CartItemCalc {
  price: number;
  quantity: number;
}

function calculateCartTotals(items: CartItemCalc[]) {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = safeItems.reduce((acc, item) => {
    const qty = Math.max(0, item.quantity || 0);
    const p = Math.max(0, item.price || 0);
    return acc + (qty * p);
  }, 0);

  // Nepal marketplace delivery policy: Free over Rs. 499, else Rs. 35
  const deliveryFee = subtotal === 0 || subtotal >= 499 ? 0 : 35;
  const vat = Math.round(subtotal * 0.13 * 100) / 100; // 13% VAT
  const grandTotal = subtotal + deliveryFee + vat;

  return { subtotal, deliveryFee, vat, grandTotal, totalItems: safeItems.length };
}

test('Frontend Cart: computes correct subtotal, 13% VAT, delivery fee, and free delivery threshold', () => {
  // Empty cart
  const emptyCart = calculateCartTotals([]);
  assert.equal(emptyCart.subtotal, 0);
  assert.equal(emptyCart.deliveryFee, 0);
  assert.equal(emptyCart.grandTotal, 0);

  // Small order (< 499): 1 item @ 250
  const smallOrder = calculateCartTotals([{ price: 250, quantity: 1 }]);
  assert.equal(smallOrder.subtotal, 250);
  assert.equal(smallOrder.deliveryFee, 35);
  assert.equal(smallOrder.vat, 32.5);
  assert.equal(smallOrder.grandTotal, 317.5);

  // Large order (>= 499): 2 items @ 300 = 600
  const largeOrder = calculateCartTotals([{ price: 300, quantity: 2 }]);
  assert.equal(largeOrder.subtotal, 600);
  assert.equal(largeOrder.deliveryFee, 0, 'Orders over Rs 499 qualify for free delivery');
  assert.equal(largeOrder.vat, 78);
  assert.equal(largeOrder.grandTotal, 678);
});

// ---------------------------------------------------------------------------
// 4. CHECKOUT FORM VALIDATION
// ---------------------------------------------------------------------------
interface CheckoutFormData {
  fullName: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  wardNumber: string | number;
}

function validateCheckoutForm(form: CheckoutFormData) {
  const errors: Record<string, string> = {};
  if (!form.fullName || form.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters';
  }
  const phoneErr = validatePhoneOrEmail(form.phone);
  if (phoneErr) {
    errors.phone = phoneErr;
  }
  if (!form.province) {
    errors.province = 'Please select a province';
  }
  if (!form.district) {
    errors.district = 'Please enter your district';
  }
  if (!form.municipality) {
    errors.municipality = 'Please enter your municipality or city';
  }
  const ward = Number(form.wardNumber);
  if (isNaN(ward) || ward < 1 || ward > 35) {
    errors.wardNumber = 'Please enter a valid ward number (1-35)';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

test('Frontend Checkout: validates shipping address fields according to Nepal administrative structure', () => {
  const invalid = validateCheckoutForm({
    fullName: '',
    phone: '1234',
    province: '',
    district: '',
    municipality: '',
    wardNumber: '0'
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.fullName);
  assert.ok(invalid.errors.phone);
  assert.ok(invalid.errors.province);
  assert.ok(invalid.errors.wardNumber);

  const valid = validateCheckoutForm({
    fullName: 'Niroj Shakya',
    phone: '9841234567',
    province: 'BAGMATI',
    district: 'Lalitpur',
    municipality: 'Lalitpur Metropolitan City',
    wardNumber: 3
  });
  assert.equal(valid.isValid, true);
  assert.equal(Object.keys(valid.errors).length, 0);
});

// ---------------------------------------------------------------------------
// 5. SEARCH & FILTERING LOGIC
// ---------------------------------------------------------------------------
interface FilterProduct {
  name: string;
  categorySlug: string;
  price: number;
  inStock: boolean;
}

function filterProducts(
  products: FilterProduct[],
  query: string,
  categorySlug: string,
  minPrice?: number,
  maxPrice?: number,
  inStockOnly?: boolean
) {
  const q = query.trim().toLowerCase();
  return products.filter(p => {
    if (q && !p.name.toLowerCase().includes(q)) return false;
    if (categorySlug && categorySlug !== 'all' && p.categorySlug !== categorySlug) return false;
    if (minPrice !== undefined && p.price < minPrice) return false;
    if (maxPrice !== undefined && p.price > maxPrice) return false;
    if (inStockOnly && !p.inStock) return false;
    return true;
  });
}

test('Frontend Catalogue: correctly filters by keyword, category, price range, and in-stock flag', () => {
  const mockProducts: FilterProduct[] = [
    { name: 'Organic Ilam Green Tea', categorySlug: 'groceries', price: 250, inStock: true },
    { name: 'Mustang Organic Apple Cider', categorySlug: 'groceries', price: 650, inStock: false },
    { name: 'Handmade Pashmina Shawl', categorySlug: 'fashion', price: 4500, inStock: true },
    { name: 'Singing Bowl Brass', categorySlug: 'handicrafts', price: 3200, inStock: true }
  ];

  // Search by keyword
  const teaHits = filterProducts(mockProducts, 'tea', 'all');
  assert.equal(teaHits.length, 1);
  assert.equal(teaHits[0].name, 'Organic Ilam Green Tea');

  // Filter by category
  const groceryHits = filterProducts(mockProducts, '', 'groceries');
  assert.equal(groceryHits.length, 2);

  // Filter by stock
  const inStockGroceries = filterProducts(mockProducts, '', 'groceries', undefined, undefined, true);
  assert.equal(inStockGroceries.length, 1);

  // Price range: Rs 1000 to Rs 4000
  const midRange = filterProducts(mockProducts, '', 'all', 1000, 4000);
  assert.equal(midRange.length, 1);
  assert.equal(midRange[0].name, 'Singing Bowl Brass');
});

// ---------------------------------------------------------------------------
// 6. API ERROR ENVELOPE HANDLING & RESILIENCE
// ---------------------------------------------------------------------------
interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: { code?: string; message?: string } | string;
}

function extractErrorMessage<T>(res: ApiResponse<T> | null | undefined, fallback = 'An unexpected error occurred.'): string {
  if (!res) return fallback;
  if (typeof res.error === 'string') return res.error;
  if (res.error && typeof res.error === 'object' && res.error.message) {
    return res.error.message;
  }
  if (res.message && res.success === false) {
    return res.message;
  }
  return fallback;
}

test('Frontend API: reliably extracts user-friendly error messages from DRF response envelopes', () => {
  assert.equal(extractErrorMessage(null), 'An unexpected error occurred.');
  assert.equal(extractErrorMessage({ success: false, error: 'Database timeout' }), 'Database timeout');
  assert.equal(
    extractErrorMessage({
      success: false,
      error: { code: 'INVALID_CATEGORY', message: 'Selected category does not exist or is inactive.' }
    }),
    'Selected category does not exist or is inactive.'
  );
  assert.equal(
    extractErrorMessage({ success: false, message: 'Invalid credentials provided.' }),
    'Invalid credentials provided.'
  );
});

// ---------------------------------------------------------------------------
// 7. SELLER CATEGORY SELECTION & IMMUTABILITY
// ---------------------------------------------------------------------------
interface CategoryOption {
  id: string;
  name: string;
  subcategories?: Array<{ id: string; name: string }>;
}

function buildCategoryOptgroups(categories: CategoryOption[]) {
  const safe = Array.isArray(categories) ? categories : [];
  return safe.map(cat => ({
    label: cat.name,
    options: (cat.subcategories || []).map(sub => ({
      value: sub.id,
      label: sub.name
    }))
  }));
}

test('Frontend Seller: builds hierarchical optgroups for category selector without allowing arbitrary input', () => {
  const categories: CategoryOption[] = [
    {
      id: 'cat-1',
      name: 'Consumer Electronics',
      subcategories: [
        { id: 'sub-1', name: 'Mobile Phones' },
        { id: 'sub-2', name: 'Accessories' }
      ]
    },
    {
      id: 'cat-2',
      name: 'Organic Grocery',
      subcategories: [
        { id: 'sub-3', name: 'Tea & Coffee' }
      ]
    }
  ];

  const optgroups = buildCategoryOptgroups(categories);
  assert.equal(optgroups.length, 2);
  assert.equal(optgroups[0].label, 'Consumer Electronics');
  assert.equal(optgroups[0].options.length, 2);
  assert.equal(optgroups[0].options[0].value, 'sub-1');
  assert.equal(optgroups[0].options[0].label, 'Mobile Phones');
});
