import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  addresses,
  adminProfiles,
  advertisements,
  categories,
  coupons,
  deliveryAgents,
  deliveryAssignments,
  deliveryTrackingEvents,
  deliveryZones,
  financialLedger,
  inventoryMovements,
  notifications,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  platformSettings,
  productImages,
  products,
  productVariants,
  promotions,
  reviews,
  sellerProfiles,
  supportTickets,
  ticketMessages,
  users,
  vendorFulfillments,
  vendors,
} from '../../src/db/schema.ts';
import { hashPassword } from '../utils/crypto.ts';

const SEED_CATEGORIES = [
  {
    externalKey: 'cat-grocery',
    name: 'Grocery & Staples',
    nameNe: 'किराना र दैनिक सामग्री',
    slug: 'grocery',
    icon: 'Package',
    accent: '#059669',
    description: 'Daily rice, lentils, organic flours, spices & oils',
    displayOrder: 1,
  },
  {
    externalKey: 'cat-fresh',
    name: 'Fruits & Vegetables',
    nameNe: 'ताजा फलफूल र तरकारी',
    slug: 'fruits-vegetables',
    icon: 'Apple',
    accent: '#16A34A',
    description: 'Crisp green farm harvests & seasonal fruits',
    displayOrder: 2,
  },
  {
    externalKey: 'cat-dairy',
    name: 'Dairy & Bakery',
    nameNe: 'डेरी र बेकरी',
    slug: 'dairy-bakery',
    icon: 'Milk',
    accent: '#D97706',
    description: 'Pure cow milk, artisan sourdough, butter & paneer',
    displayOrder: 3,
  },
  {
    externalKey: 'cat-snacks',
    name: 'Snacks & Munchies',
    nameNe: 'खाजा र मन्चिज',
    slug: 'snacks',
    icon: 'Cookie',
    accent: '#EA580C',
    description: 'Roasted nuts, gourmet crisps & traditional namkeen',
    displayOrder: 4,
  },
  {
    externalKey: 'cat-beverages',
    name: 'Beverages',
    nameNe: 'पेय पदार्थ',
    slug: 'beverages',
    icon: 'Coffee',
    accent: '#0284C7',
    description: 'Chilled iced teas, organic juices & Himalayan coffees',
    displayOrder: 5,
  },
  {
    externalKey: 'cat-personal',
    name: 'Personal Care',
    nameNe: 'व्यक्तिगत हेरचाह',
    slug: 'personal-care',
    icon: 'Sparkles',
    accent: '#8B5CF6',
    description: 'Herbal skincare, bath essentials & grooming',
    displayOrder: 6,
  },
  {
    externalKey: 'cat-household',
    name: 'Household',
    nameNe: 'घरायसी सामग्री',
    slug: 'household',
    icon: 'Home',
    accent: '#475569',
    description: 'Eco-cleaners, paper towels & kitchenware',
    displayOrder: 7,
  },
  {
    externalKey: 'cat-electronics',
    name: 'Electronics & Cables',
    nameNe: 'इलेक्ट्रोनिक्स र केबल',
    slug: 'electronics',
    icon: 'Zap',
    accent: '#2563EB',
    description: 'High-speed chargers, cables & battery packs',
    displayOrder: 8,
  },
  {
    externalKey: 'cat-fashion',
    name: 'Fashion & Basics',
    nameNe: 'फेसन र बेसिक्स',
    slug: 'fashion',
    icon: 'Shirt',
    accent: '#BE185D',
    description: 'Everyday cotton tees, innerwear & socks',
    displayOrder: 9,
  },
  {
    externalKey: 'cat-health',
    name: 'Health & Wellness',
    nameNe: 'स्वास्थ्य र कल्याण',
    slug: 'health-wellness',
    icon: 'HeartPulse',
    accent: '#E11D48',
    description: 'Vitamins, herbal balms, first aid & masks',
    displayOrder: 10,
  },
];

const SEED_VENDORS = [
  {
    externalKey: 'v-himalayan',
    slug: 'himalayan-fresh-farms',
    name: 'Himalayan Fresh Farms',
    rating: '4.9',
    ratingCount: 185,
    eta: '10-12 mins',
    distance: '0.8 km',
    address: 'Shanti Nagar Marg, Baneshwor, Kathmandu',
    area: 'New Baneshwor',
    city: 'Kathmandu',
    lat: '27.6915',
    lng: '85.3420',
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    cuisine: 'Organic Produce, Farm Fresh, Daily Harvest',
    tags: ['Organic', 'Farm Fresh', 'Daily Picked'],
    isFeatured: true,
    commissionRate: '10.00',
    phone: '+977 9801122334',
    email: 'seller.himalayan@oyopasal.np',
    zoneSlug: 'baneshwor-core',
  },
  {
    externalKey: 'v-patan-bakery',
    slug: 'patan-artisan-bakery',
    name: 'Patan Artisan Bakery & Dairy',
    rating: '4.8',
    ratingCount: 164,
    eta: '12-15 mins',
    distance: '1.2 km',
    address: 'Jhamsikhel Road, Pulchowk, Lalitpur',
    area: 'Pulchowk',
    city: 'Lalitpur',
    lat: '27.6740',
    lng: '85.3180',
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    cuisine: 'Fresh Oven, Pure Milk, Artisanal Bakery',
    tags: ['Fresh Oven', 'Pure Milk', 'Artisanal'],
    isFeatured: true,
    commissionRate: '12.00',
    phone: '+977 9802233445',
    email: 'seller.patan@oyopasal.np',
    zoneSlug: 'lalitpur-patan',
  },
  {
    externalKey: 'v-everest-pantry',
    slug: 'everest-organic-pantry',
    name: 'Everest Organic & Dry Pantry',
    rating: '4.7',
    ratingCount: 142,
    eta: '15 mins',
    distance: '1.5 km',
    address: 'Jadibuti Chowk, Koteshwor, Kathmandu',
    area: 'Koteshwor',
    city: 'Kathmandu',
    lat: '27.6780',
    lng: '85.3500',
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    cuisine: 'Spices, Cold Pressed Oils, Pantry Staples',
    tags: ['Spices', 'Cold Pressed', 'Staples'],
    isFeatured: true,
    commissionRate: '10.00',
    phone: '+977 9803344556',
    email: 'seller.everest@oyopasal.np',
    zoneSlug: 'koteshwor-east',
  },
  {
    externalKey: 'v-green-valley',
    slug: 'green-valley-hydroponics',
    name: 'Green Valley Hydroponics',
    rating: '4.9',
    ratingCount: 198,
    eta: '10 mins',
    distance: '0.6 km',
    address: 'Narsingh Chowk, Thamel, Kathmandu',
    area: 'Thamel',
    city: 'Kathmandu',
    lat: '27.7150',
    lng: '85.3120',
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    cuisine: 'Hydroponics, Pesticide Free Greens, Superfoods',
    tags: ['Pesticide Free', 'Crisp Greens', 'Superfoods'],
    isFeatured: true,
    commissionRate: '11.00',
    phone: '+977 9804455667',
    email: 'seller.greenvalley@oyopasal.np',
    zoneSlug: 'thamel-central',
  },
];

const SEED_PRODUCTS = [
  {
    externalKey: 'prod-avocado',
    slug: 'organic-hass-avocados',
    name: 'Organic Hass Avocados',
    categorySlug: 'fruits-vegetables',
    vendorKey: 'v-himalayan',
    originalPrice: 380,
    price: 295,
    unit: '2 pcs (approx 380g)',
    stockCount: 24,
    isOrganic: true,
    rating: '4.9',
    ratingCount: 142,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: [
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
      '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    ],
    description:
      'Creamy, rich Hass avocados with dark textured skin. Perfectly conditioned to ripen within 24-48 hours. Rich in healthy monounsaturated fats.',
    origin: 'Kavre Valley Organic Cooperative',
    variants: [
      { externalKey: 'var-1', name: 'Pack of 2', unit: '2 pcs', price: 295, originalPrice: 380, stock: 24 },
      { externalKey: 'var-2', name: 'Family Box (4 pcs)', unit: '4 pcs', price: 540, originalPrice: 720, stock: 12 },
    ],
    sections: ['best_sellers', 'recommended', 'fresh_arrivals'],
  },
  {
    externalKey: 'prod-milk',
    slug: 'fresh-cow-whole-milk',
    name: 'Fresh Cow Whole Milk (Glass Bottle)',
    categorySlug: 'dairy-bakery',
    vendorKey: 'v-patan-bakery',
    originalPrice: 130,
    price: 110,
    unit: '1 Litre',
    stockCount: 35,
    isOrganic: true,
    rating: '4.9',
    ratingCount: 310,
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: [
      '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    ],
    description:
      'Pure, unadulterated pasture-raised whole milk delivered fresh every morning in sanitized reusable glass bottles. Pasteurized with care.',
    origin: 'Lalitpur Dairy Cooperative',
    variants: [
      { externalKey: 'var-milk-1', name: '1 Litre Bottle', unit: '1L', price: 110, originalPrice: 130, stock: 35 },
      { externalKey: 'var-milk-2', name: '2 Litres Value Pack', unit: '2L', price: 210, originalPrice: 250, stock: 15 },
    ],
    sections: ['best_sellers', 'daily_essentials', 'trending'],
  },
  {
    externalKey: 'prod-croissant',
    slug: 'artisanal-french-butter-croissant',
    name: 'Artisanal French Butter Croissant',
    categorySlug: 'dairy-bakery',
    vendorKey: 'v-patan-bakery',
    originalPrice: 220,
    price: 175,
    unit: 'Pack of 2',
    stockCount: 2,
    isOrganic: false,
    rating: '4.8',
    ratingCount: 88,
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: ['/src/assets/images/vendor_bakery_dairy_1794407355670.jpg'],
    description:
      'Handcrafted with 72 laminated butter layers, golden crispy flaky crust and honeycomb interior. Baked fresh three times daily.',
    origin: 'Patan Bakery Lab',
    variants: [
      { externalKey: 'var-cr-1', name: 'Twin Pack', unit: '2 pcs', price: 175, originalPrice: 220, stock: 18 },
      { externalKey: 'var-cr-2', name: 'Box of 4', unit: '4 pcs', price: 320, originalPrice: 410, stock: 9 },
    ],
    sections: ['fresh_arrivals', 'top_deals'],
  },
  {
    externalKey: 'prod-cherry-tomatoes',
    slug: 'sweet-cherry-tomatoes',
    name: 'Hydroponic Sweet Cherry Tomatoes',
    categorySlug: 'fruits-vegetables',
    vendorKey: 'v-green-valley',
    originalPrice: 180,
    price: 135,
    unit: '250 g Punnet',
    stockCount: 42,
    isOrganic: true,
    rating: '4.9',
    ratingCount: 204,
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: [
      '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    ],
    description:
      'Sun-ripened vine cherry tomatoes bursting with intense sweetness and crisp snap. Grown pesticide-free in climate-controlled greenhouses.',
    origin: 'Green Valley Greenhouses, Kathmandu',
    variants: [
      { externalKey: 'var-ct-1', name: '250g Punnet', unit: '250g', price: 135, originalPrice: 180, stock: 42 },
      { externalKey: 'var-ct-2', name: '500g Tub', unit: '500g', price: 250, originalPrice: 340, stock: 20 },
    ],
    sections: ['best_sellers', 'daily_essentials', 'top_deals'],
  },
  {
    externalKey: 'prod-kombucha',
    slug: 'sparkling-ginger-lime-kombucha',
    name: 'Sparkling Ginger Lime Kombucha',
    categorySlug: 'beverages',
    vendorKey: 'v-everest-pantry',
    originalPrice: 240,
    price: 195,
    unit: '330 ml Glass Bottle',
    stockCount: 28,
    isOrganic: true,
    rating: '4.7',
    ratingCount: 67,
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    gallery: ['/src/assets/images/promo_snacks_drinks_1794407356711.jpg'],
    description:
      'Naturally fermented live-culture probiotic brew with fresh cold-pressed hill ginger and aromatic Nepalese lime.',
    origin: 'Himalayan Brew Labs',
    variants: [
      { externalKey: 'var-kb-1', name: 'Single Bottle', unit: '330ml', price: 195, originalPrice: 240, stock: 28 },
      { externalKey: 'var-kb-2', name: 'Trio Pack', unit: '3x330ml', price: 540, originalPrice: 700, stock: 10 },
    ],
    sections: ['trending', 'top_deals'],
  },
  {
    externalKey: 'prod-almond-mix',
    slug: 'roasted-himalayan-trail-mix',
    name: 'Slow Roasted Himalayan Trail Nut Mix',
    categorySlug: 'snacks',
    vendorKey: 'v-everest-pantry',
    originalPrice: 490,
    price: 390,
    unit: '200 g Standup Pouch',
    stockCount: 19,
    isOrganic: true,
    rating: '4.8',
    ratingCount: 95,
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    gallery: ['/src/assets/images/promo_snacks_drinks_1794407356711.jpg'],
    description:
      'Crisp roasted California almonds, Jumla walnuts, roasted pumpkin seeds and dried cranberries with light sea salt dusting.',
    origin: 'Everest Pantry Select',
    variants: [
      { externalKey: 'var-tm-1', name: '200g Pouch', unit: '200g', price: 390, originalPrice: 490, stock: 19 },
      { externalKey: 'var-tm-2', name: '500g Value Pack', unit: '500g', price: 890, originalPrice: 1100, stock: 8 },
    ],
    sections: ['best_sellers', 'recommended'],
  },
  {
    externalKey: 'prod-broccoli',
    slug: 'crisp-mountain-broccoli',
    name: 'Crisp Organic Mountain Broccoli',
    categorySlug: 'fruits-vegetables',
    vendorKey: 'v-himalayan',
    originalPrice: 160,
    price: 120,
    unit: '1 head (approx 450g)',
    stockCount: 3,
    isOrganic: true,
    rating: '4.8',
    ratingCount: 73,
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: ['/src/assets/images/promo_fresh_produce_1794407354982.jpg'],
    description:
      'Dense, dark green florets harvested at sunrise in Kakani mountain terraces. Firm stalk, sweet tender crown, zero chemicals.',
    origin: 'Kakani Terraced Farms',
    variants: [
      { externalKey: 'var-br-1', name: 'Single Crown', unit: 'approx 450g', price: 120, originalPrice: 160, stock: 22 },
    ],
    sections: ['daily_essentials', 'fresh_arrivals'],
  },
  {
    externalKey: 'prod-sourdough',
    slug: 'artisan-sourdough-batard',
    name: 'Country Style Artisan Sourdough Batard',
    categorySlug: 'dairy-bakery',
    vendorKey: 'v-patan-bakery',
    originalPrice: 320,
    price: 260,
    unit: '650 g Loaf',
    stockCount: 14,
    isOrganic: false,
    rating: '4.9',
    ratingCount: 112,
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: [
      '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    ],
    description:
      'Fermented for 36 hours with our 7-year heirloom wild levain starter. Deep blistered crust, open tender crumb, subtle lactic tang.',
    origin: 'Patan Bakery Lab',
    variants: [
      { externalKey: 'var-sd-1', name: 'Full Loaf', unit: '650g', price: 260, originalPrice: 320, stock: 14 },
    ],
    sections: ['best_sellers', 'trending'],
  },
  {
    externalKey: 'prod-cold-press-mustard',
    slug: 'cold-pressed-mustard-oil',
    name: 'Chitwan Cold-Pressed Pure Mustard Oil',
    categorySlug: 'grocery',
    vendorKey: 'v-everest-pantry',
    originalPrice: 340,
    price: 285,
    unit: '1 Litre Pet Bottle',
    stockCount: 40,
    isOrganic: true,
    rating: '4.8',
    ratingCount: 180,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description:
      'Traditional wood-churned (kolhu) extraction retaining 100% natural nutrients, pungent kick, and golden amber clarity.',
    origin: 'Chitwan Mustard Mills',
    variants: [
      { externalKey: 'var-mo-1', name: '1 Litre', unit: '1L', price: 285, originalPrice: 340, stock: 40 },
      { externalKey: 'var-mo-2', name: '2 Litres Can', unit: '2L', price: 550, originalPrice: 660, stock: 18 },
    ],
    sections: ['daily_essentials', 'recommended'],
  },
  {
    externalKey: 'prod-basmati-rice',
    slug: 'aged-basmati-rice',
    name: 'Himalayan Aged Long Grain Basmati Rice',
    categorySlug: 'grocery',
    vendorKey: 'v-everest-pantry',
    originalPrice: 850,
    price: 699,
    unit: '5 kg Bag',
    stockCount: 25,
    isOrganic: false,
    rating: '4.9',
    ratingCount: 220,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description:
      '2-year aged royal basmati with slender aromatic grains that expand up to 2.5x upon cooking with non-sticky fluffiness.',
    origin: 'Terai Select Paddy Reserves',
    variants: [
      { externalKey: 'var-br-5k', name: '5 kg Bag', unit: '5kg', price: 699, originalPrice: 850, stock: 25 },
      { externalKey: 'var-br-1k', name: '1 kg Sample', unit: '1kg', price: 160, originalPrice: 190, stock: 50 },
    ],
    sections: ['best_sellers', 'daily_essentials'],
  },
  {
    externalKey: 'prod-greek-yogurt',
    slug: 'creamy-mountain-greek-yogurt',
    name: 'Creamy Mountain Greek Yogurt',
    categorySlug: 'dairy-bakery',
    vendorKey: 'v-patan-bakery',
    originalPrice: 280,
    price: 225,
    unit: '400 g Tub',
    stockCount: 16,
    isOrganic: true,
    rating: '4.9',
    ratingCount: 94,
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: ['/src/assets/images/vendor_bakery_dairy_1794407355670.jpg'],
    description:
      'Triple-strained high-protein Greek style whole milk curd with thick velvety texture. No added sugar or artificial thickeners.',
    origin: 'Patan Dairy Lab',
    variants: [
      { externalKey: 'var-gy-1', name: '400g Tub', unit: '400g', price: 225, originalPrice: 280, stock: 16 },
    ],
    sections: ['recommended', 'fresh_arrivals'],
  },
  {
    externalKey: 'prod-organic-mint',
    slug: 'fresh-mint-coriander',
    name: 'Fresh Hill Mint & Coriander Bunch',
    categorySlug: 'fruits-vegetables',
    vendorKey: 'v-green-valley',
    originalPrice: 60,
    price: 45,
    unit: '150 g Fresh Bunch',
    stockCount: 50,
    isOrganic: true,
    rating: '4.8',
    ratingCount: 53,
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: ['/src/assets/images/promo_fresh_produce_1794407354982.jpg'],
    description:
      'Crisp aromatic field herbs packed with morning dew. Ideal for chutneys, marinades, garnishing and detox teas.',
    origin: 'Green Valley Hydroponics',
    variants: [
      { externalKey: 'var-mint-1', name: '150g Bunch', unit: '150g', price: 45, originalPrice: 60, stock: 50 },
    ],
    sections: ['daily_essentials', 'top_deals'],
  },
  {
    externalKey: 'prod-honey',
    slug: 'wild-raw-himalayan-honey',
    name: 'Wild Raw Himalayan Cliff Honey',
    categorySlug: 'health-wellness',
    vendorKey: 'v-himalayan',
    originalPrice: 650,
    price: 520,
    unit: '500 g Glass Jar',
    stockCount: 20,
    isOrganic: true,
    rating: '4.9',
    ratingCount: 115,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description:
      '100% pure unprocessed wild floral honey harvested from high altitude Himalayan bee reserves. Rich in natural enzymes and antioxidants.',
    origin: 'Solukhumbu High Altitude Apiaries',
    variants: [
      { externalKey: 'var-honey-1', name: '500g Jar', unit: '500g', price: 520, originalPrice: 650, stock: 20 },
      { externalKey: 'var-honey-2', name: '1kg Jar', unit: '1kg', price: 980, originalPrice: 1250, stock: 8 },
    ],
    sections: ['best_sellers', 'recommended'],
  },
  {
    externalKey: 'prod-aloe-gel',
    slug: 'organic-aloe-vera-neem-gel',
    name: 'Organic Aloe Vera & Neem Soothing Gel',
    categorySlug: 'personal-care',
    vendorKey: 'v-everest-pantry',
    originalPrice: 320,
    price: 250,
    unit: '200 ml Dispenser',
    stockCount: 30,
    isOrganic: true,
    rating: '4.8',
    ratingCount: 76,
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: ['/src/assets/images/promo_fresh_produce_1794407354982.jpg'],
    description:
      'Pure 99% organic aloe vera pulp with cooling hill neem extracts. Hydrates skin, calms redness, and conditions hair naturally.',
    origin: 'Terai Herbal Herbarium',
    variants: [
      { externalKey: 'var-aloe-1', name: '200ml Bottle', unit: '200ml', price: 250, originalPrice: 320, stock: 30 },
    ],
    sections: ['trending', 'top_deals'],
  },
  {
    externalKey: 'prod-bio-cleaner',
    slug: 'citrus-bio-enzyme-cleaner',
    name: 'Citrus Bio-Enzyme Multi-Surface Cleaner',
    categorySlug: 'household',
    vendorKey: 'v-green-valley',
    originalPrice: 290,
    price: 220,
    unit: '500 ml Spray Bottle',
    stockCount: 25,
    isOrganic: true,
    rating: '4.7',
    ratingCount: 48,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description:
      'Natural fermented citrus peel bio-enzyme cleaner. Tough on kitchen grease and bathroom grime, 100% pet-safe and chemical-free.',
    origin: 'Kathmandu Eco-Solutions',
    variants: [
      { externalKey: 'var-clean-1', name: '500ml Spray', unit: '500ml', price: 220, originalPrice: 290, stock: 25 },
    ],
    sections: ['daily_essentials', 'fresh_arrivals'],
  },
  {
    externalKey: 'prod-gan-charger',
    slug: '65w-gan-fast-wall-charger',
    name: '65W GaN Dual USB-C Fast Wall Charger',
    categorySlug: 'electronics',
    vendorKey: 'v-everest-pantry',
    originalPrice: 1850,
    price: 1399,
    unit: '1 pc (Compact Foldable)',
    stockCount: 15,
    isOrganic: false,
    rating: '4.9',
    ratingCount: 62,
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    gallery: ['/src/assets/images/promo_snacks_drinks_1794407356711.jpg'],
    description:
      'Next-gen Gallium Nitride (GaN) high-speed charger capable of powering MacBooks, iPhones, and Android smartphones at top speed.',
    origin: 'Authorized Nepal Importer',
    variants: [
      { externalKey: 'var-chg-1', name: 'Single Unit', unit: '1 pc', price: 1399, originalPrice: 1850, stock: 15 },
    ],
    sections: ['trending', 'top_deals'],
  },
  {
    externalKey: 'prod-cotton-socks',
    slug: 'organic-combed-cotton-crew-socks',
    name: 'Organic Combed Cotton Crew Socks',
    categorySlug: 'fashion',
    vendorKey: 'v-himalayan',
    originalPrice: 450,
    price: 340,
    unit: 'Pack of 3 Pairs',
    stockCount: 35,
    isOrganic: true,
    rating: '4.8',
    ratingCount: 82,
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description:
      'Super-soft combed organic cotton with cushioned arch support and breathable moisture-wicking weave. Neutral grey, black & navy tones.',
    origin: 'Patan Cotton Mills',
    variants: [
      { externalKey: 'var-socks-1', name: 'Trio Pack', unit: '3 pairs', price: 340, originalPrice: 450, stock: 35 },
    ],
    sections: ['daily_essentials', 'recommended'],
  },
];

let seededAlready = false;

export async function seedInitialDatabase(): Promise<void> {
  if (seededAlready) return;

  try {
    // 1. Delivery Zones
    const zoneMap = new Map<string, number>();
    const zoneSeeds = [
      {
        name: 'New Baneshwor & Tinkune Hub',
        slug: 'baneshwor-core',
        city: 'Kathmandu',
        centerLat: '27.6948',
        centerLng: '85.3352',
        radiusKm: '4.50',
        baseDeliveryFee: 35,
        freeDeliveryThreshold: 499,
        estimatedMins: 12,
      },
      {
        name: 'Lalitpur Patan & Jhamsikhel',
        slug: 'lalitpur-patan',
        city: 'Lalitpur',
        centerLat: '27.6740',
        centerLng: '85.3180',
        radiusKm: '5.00',
        baseDeliveryFee: 35,
        freeDeliveryThreshold: 499,
        estimatedMins: 14,
      },
      {
        name: 'Thamel, Lazimpat & Baluwatar',
        slug: 'thamel-central',
        city: 'Kathmandu',
        centerLat: '27.7150',
        centerLng: '85.3120',
        radiusKm: '4.50',
        baseDeliveryFee: 35,
        freeDeliveryThreshold: 499,
        estimatedMins: 12,
      },
      {
        name: 'Koteshwor & Jadibuti Corridor',
        slug: 'koteshwor-east',
        city: 'Kathmandu',
        centerLat: '27.6780',
        centerLng: '85.3500',
        radiusKm: '5.50',
        baseDeliveryFee: 40,
        freeDeliveryThreshold: 499,
        estimatedMins: 15,
      },
    ];

    for (const z of zoneSeeds) {
      const existing = await db.select().from(deliveryZones).where(eq(deliveryZones.slug, z.slug)).limit(1);
      if (existing.length === 0) {
        const [ins] = await db.insert(deliveryZones).values(z).returning();
        zoneMap.set(z.slug, ins.id);
      } else {
        zoneMap.set(z.slug, existing[0].id);
      }
    }

    // 2. Categories
    const categoryMap = new Map<string, { id: number; name: string; slug: string }>();
    for (const c of SEED_CATEGORIES) {
      const existing = await db.select().from(categories).where(eq(categories.slug, c.slug)).limit(1);
      if (existing.length === 0) {
        const [ins] = await db.insert(categories).values(c).returning();
        categoryMap.set(c.slug, { id: ins.id, name: ins.name, slug: ins.slug });
      } else {
        categoryMap.set(c.slug, { id: existing[0].id, name: existing[0].name, slug: existing[0].slug });
      }
    }

    // 3. Core Users (Demo Customer, Sellers, Admin, Rider)
    const defaultPwHash = hashPassword('OyoPasal@2026');

    async function ensureUser(u: {
      uid: string;
      email: string;
      username: string;
      fullName: string;
      phone: string;
      role: string;
      isVerified?: boolean;
    }) {
      const existing = await db.select().from(users).where(eq(users.uid, u.uid)).limit(1);
      if (existing.length > 0) {
        if (!existing[0].passwordHash || !existing[0].username) {
          const [upd] = await db
            .update(users)
            .set({
              username: existing[0].username || u.username,
              passwordHash: existing[0].passwordHash || defaultPwHash,
              phone: existing[0].phone || u.phone,
              role: existing[0].role || u.role,
              isVerified: true,
            })
            .where(eq(users.id, existing[0].id))
            .returning();
          return upd;
        }
        return existing[0];
      }
      const [ins] = await db
        .insert(users)
        .values({
          uid: u.uid,
          email: u.email,
          username: u.username,
          passwordHash: defaultPwHash,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          isActive: true,
          isVerified: u.isVerified ?? true,
        })
        .returning();
      return ins;
    }

    const demoCustomer = await ensureUser({
      uid: 'demo-customer-roshan',
      email: 'yadavroshan864@gmail.com',
      username: 'roshan_yadav',
      fullName: 'Roshan Yadav',
      phone: '+977 9841234567',
      role: 'customer',
    });

    const adminUser = await ensureUser({
      uid: 'admin-oyopasal-root',
      email: 'admin@oyopasal.np',
      username: 'oyopasal_admin',
      fullName: 'Aarav Adhikari (Operations Admin)',
      phone: '+977 9801000001',
      role: 'admin',
    });

    const existingAdminProf = await db
      .select()
      .from(adminProfiles)
      .where(eq(adminProfiles.userId, adminUser.id))
      .limit(1);
    if (existingAdminProf.length === 0) {
      await db.insert(adminProfiles).values({
        userId: adminUser.id,
        department: 'Marketplace Operations',
        permissions: ['all'],
        isSuperAdmin: true,
      });
    }

    const riderUser = await ensureUser({
      uid: 'rider-ramesh-pandey',
      email: 'rider.ramesh@oyopasal.np',
      username: 'rider_ramesh',
      fullName: 'Ramesh Pandey',
      phone: '+977 9841889900',
      role: 'delivery_agent',
    });

    let riderAgentRow = (
      await db.select().from(deliveryAgents).where(eq(deliveryAgents.userId, riderUser.id)).limit(1)
    )[0];
    if (!riderAgentRow) {
      [riderAgentRow] = await db
        .insert(deliveryAgents)
        .values({
          userId: riderUser.id,
          fullName: 'Ramesh Pandey',
          phone: '+977 9841889900',
          vehicleType: 'EV Scooter (NIU NQi)',
          vehicleNumber: 'Ba 98 Pa 4412',
          licenseNumber: 'KTM-EV-88241',
          verificationStatus: 'approved',
          availabilityStatus: 'available',
          currentLat: '27.6942',
          currentLng: '85.3358',
          lastLocationAt: new Date(),
          zoneId: zoneMap.get('baneshwor-core') || null,
          rating: '4.92',
          totalDeliveries: 148,
        })
        .returning();
    }

    // 4. Customer Saved Addresses
    const existingAddresses = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, demoCustomer.id));
    let defaultAddrId: number | null = existingAddresses[0]?.id ?? null;

    if (existingAddresses.length === 0) {
      const [homeAddr] = await db
        .insert(addresses)
        .values({
          userId: demoCustomer.id,
          title: 'Home',
          recipientName: 'Roshan Yadav',
          phone: '+977 9841234567',
          street: 'House #42, Shanti Marga',
          area: 'New Baneshwor',
          city: 'Kathmandu',
          landmark: 'Opposite Everest Bank ATM',
          lat: '27.6986',
          lng: '85.3292',
          zoneId: zoneMap.get('baneshwor-core') || null,
          isDefault: true,
        })
        .returning();

      await db.insert(addresses).values({
        userId: demoCustomer.id,
        title: 'Office',
        recipientName: 'Roshan Yadav',
        phone: '+977 9841234567',
        street: 'Tech Hub Tower, Level 4',
        area: 'Jhamsikhel',
        city: 'Lalitpur',
        landmark: 'Near British School',
        lat: '27.6830',
        lng: '85.3090',
        zoneId: zoneMap.get('lalitpur-patan') || null,
        isDefault: false,
      });

      defaultAddrId = homeAddr.id;
      await db.update(users).set({ defaultAddressId: homeAddr.id }).where(eq(users.id, demoCustomer.id));
    }

    // 5. Vendors & Seller Users
    const vendorByKey = new Map<string, typeof vendors.$inferSelect>();
    for (const sv of SEED_VENDORS) {
      const sellerUser = await ensureUser({
        uid: `seller-uid-${sv.externalKey}`,
        email: sv.email,
        username: sv.slug.replace(/-/g, '_'),
        fullName: `${sv.name} Manager`,
        phone: sv.phone,
        role: 'seller',
      });

      const existingV = await db.select().from(vendors).where(eq(vendors.slug, sv.slug)).limit(1);
      let vRow: typeof vendors.$inferSelect;
      if (existingV.length === 0) {
        [vRow] = await db
          .insert(vendors)
          .values({
            externalKey: sv.externalKey,
            slug: sv.slug,
            name: sv.name,
            ownerUserId: sellerUser.id,
            phone: sv.phone,
            email: sv.email,
            rating: sv.rating,
            ratingCount: sv.ratingCount,
            eta: sv.eta,
            distance: sv.distance,
            address: sv.address,
            area: sv.area,
            city: sv.city,
            zoneId: zoneMap.get(sv.zoneSlug) || null,
            lat: sv.lat,
            lng: sv.lng,
            image: sv.image,
            coverImageUrl: sv.image,
            cuisine: sv.cuisine,
            tags: sv.tags,
            isFeatured: sv.isFeatured,
            isVerified: true,
            approvalStatus: 'approved',
            isOnline: true,
            commissionRate: sv.commissionRate,
          })
          .returning();
      } else {
        [vRow] = await db
          .update(vendors)
          .set({
            externalKey: existingV[0].externalKey || sv.externalKey,
            ownerUserId: existingV[0].ownerUserId || sellerUser.id,
            lat: sv.lat,
            lng: sv.lng,
            area: sv.area,
            city: sv.city,
            tags: sv.tags,
            phone: existingV[0].phone || sv.phone,
            email: existingV[0].email || sv.email,
            zoneId: existingV[0].zoneId || zoneMap.get(sv.zoneSlug) || null,
            approvalStatus: existingV[0].approvalStatus || 'approved',
          })
          .where(eq(vendors.id, existingV[0].id))
          .returning();
      }
      vendorByKey.set(sv.externalKey, vRow);

      const existingSP = await db
        .select()
        .from(sellerProfiles)
        .where(eq(sellerProfiles.vendorId, vRow.id))
        .limit(1);
      if (existingSP.length === 0) {
        await db.insert(sellerProfiles).values({
          userId: sellerUser.id,
          vendorId: vRow.id,
          businessName: sv.name,
          contactPerson: `${sv.name} Owner`,
          phone: sv.phone,
          email: sv.email,
          panVatNumber: `PAN-3049${vRow.id}812`,
          approvalStatus: 'approved',
          approvedBy: adminUser.id,
          approvedAt: new Date(),
        });
      }
    }

    // 6. Products, Variants & Images
    const productByKey = new Map<string, typeof products.$inferSelect>();
    for (const sp of SEED_PRODUCTS) {
      const catRef = categoryMap.get(sp.categorySlug) || categoryMap.values().next().value;
      const vRef = vendorByKey.get(sp.vendorKey) || vendorByKey.values().next().value;
      if (!vRef) {
        throw new Error(`Missing vendor seed for ${sp.vendorKey}`);
      }
      const discountPercent =
        sp.originalPrice > sp.price
          ? Math.round(((sp.originalPrice - sp.price) / sp.originalPrice) * 100)
          : 0;

      const existingP = await db.select().from(products).where(eq(products.slug, sp.slug)).limit(1);
      let pRow: typeof products.$inferSelect;
      if (existingP.length === 0) {
        [pRow] = await db
          .insert(products)
          .values({
            externalKey: sp.externalKey,
            slug: sp.slug,
            name: sp.name,
            category: catRef ? catRef.name : sp.categorySlug,
            subCategory: sp.categorySlug,
            categoryId: catRef ? catRef.id : null,
            sku: `OP-${sp.externalKey.toUpperCase()}`,
            price: sp.price,
            originalPrice: sp.originalPrice,
            discountPercent,
            unit: sp.unit,
            inStock: sp.stockCount > 0,
            stockCount: sp.stockCount,
            isOrganic: sp.isOrganic,
            origin: sp.origin,
            rating: sp.rating,
            ratingCount: sp.ratingCount,
            image: sp.image,
            description: sp.description,
            vendorId: vRef.id,
            vendorName: vRef.name,
            isBestSeller: sp.sections.includes('best_sellers'),
            isTrending: sp.sections.includes('trending'),
            isFresh: sp.sections.includes('fresh_arrivals'),
            isDeal: sp.sections.includes('top_deals'),
            isRecommended: sp.sections.includes('recommended'),
            sections: sp.sections,
            approvalStatus: 'approved',
            isActive: true,
          })
          .returning();

        await db.insert(inventoryMovements).values({
          productId: pRow.id,
          vendorId: vRef.id,
          delta: sp.stockCount,
          previousStock: 0,
          newStock: sp.stockCount,
          reason: 'initial',
          note: 'Initial catalog seed stock',
        });
      } else {
        [pRow] = await db
          .update(products)
          .set({
            externalKey: existingP[0].externalKey || sp.externalKey,
            categoryId: existingP[0].categoryId || (catRef ? catRef.id : null),
            subCategory: existingP[0].subCategory || sp.categorySlug,
            vendorId: existingP[0].vendorId || vRef.id,
            vendorName: vRef.name,
            isOrganic: sp.isOrganic,
            origin: existingP[0].origin === 'Kathmandu Valley' ? sp.origin : existingP[0].origin,
            sections:
              Array.isArray(existingP[0].sections) && existingP[0].sections.length > 0
                ? existingP[0].sections
                : sp.sections,
            isRecommended: sp.sections.includes('recommended'),
            approvalStatus: existingP[0].approvalStatus || 'approved',
          })
          .where(eq(products.id, existingP[0].id))
          .returning();
      }
      productByKey.set(sp.externalKey, pRow);

      const existingVars = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, pRow.id));
      if (existingVars.length === 0) {
        for (let idx = 0; idx < sp.variants.length; idx++) {
          const v = sp.variants[idx];
          await db.insert(productVariants).values({
            externalKey: v.externalKey,
            productId: pRow.id,
            name: v.name,
            unit: v.unit,
            price: v.price,
            originalPrice: v.originalPrice,
            stock: v.stock,
            isDefault: idx === 0,
          });
        }
      }

      const existingImgs = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, pRow.id));
      if (existingImgs.length === 0) {
        for (let idx = 0; idx < sp.gallery.length; idx++) {
          await db.insert(productImages).values({
            productId: pRow.id,
            imageUrl: sp.gallery[idx],
            altText: sp.name,
            sortOrder: idx,
            isPrimary: idx === 0,
          });
        }
      }
    }

    // 7. Promotions CMS
    const existingPromos = await db.select().from(promotions);
    if (existingPromos.length === 0) {
      await db.insert(promotions).values([
        {
          externalKey: 'promo-1',
          title: 'Fast & Fresh in 10-15 Minutes',
          titleNe: '१०-१५ मिनेटमै ताजा र छिटो डेलिभरी',
          subtitle: 'Free delivery on all orders over Rs. 499 from verified local neighborhood sellers.',
          subtitleNe: 'रु. ४९९ माथिका सबै अर्डरमा प्रमाणित स्थानीय पसलबाट निःशुल्क डेलिभरी।',
          badge: 'SUPER SAVINGS',
          badgeNe: 'सुपर बचत',
          ctaText: 'Explore Fresh Produce',
          ctaTextNe: 'ताजा तरकारी हेर्नुहोस्',
          ctaCategory: 'fruits-vegetables',
          imageUrl: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
          couponCode: 'FREEDELIVERY',
          colorTheme: 'emerald',
          sortOrder: 1,
          isActive: true,
        },
        {
          externalKey: 'promo-2',
          title: 'Farm Harvest Morning Festival',
          titleNe: 'फार्म ताजा बिहानी महोत्सव',
          subtitle: 'Directly sourced from Kavre & Dhading organic farms. Up to 30% off today.',
          subtitleNe: 'काभ्रे र धादिङका अर्गानिक फार्मबाट सिधै। आज ३०% सम्म छुट।',
          badge: 'FARM DIRECT',
          badgeNe: 'सिधै फार्मबाट',
          ctaText: 'Shop Farm Direct',
          ctaTextNe: 'फार्म सामग्री किन्नुहोस्',
          ctaCategory: 'fruits-vegetables',
          imageUrl: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
          couponCode: 'FARM30',
          colorTheme: 'amber',
          sortOrder: 2,
          isActive: true,
        },
        {
          externalKey: 'promo-3',
          title: 'Artisan Bakery & Fresh Morning Milk',
          titleNe: 'आर्टिसन बेकरी र बिहानी ताजा दूध',
          subtitle: 'Warm butter croissants, rustic sourdough loaves & fresh organic whole milk.',
          subtitleNe: 'तातो बटर क्रोइसाँ, सावरडो रोटी र ताजा अर्गानिक दूध।',
          badge: 'FRESH OVEN',
          badgeNe: 'ताजा ओभन',
          ctaText: 'Order Bakery',
          ctaTextNe: 'बेकरी अर्डर गर्नुहोस्',
          ctaCategory: 'dairy-bakery',
          imageUrl: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
          couponCode: 'BAKERY15',
          colorTheme: 'orange',
          sortOrder: 3,
          isActive: true,
        },
        {
          externalKey: 'promo-4',
          title: 'Chilled Kombucha & Gourmet Snacks',
          titleNe: 'चिसो कम्बुचा र गउर्मेट खाजा',
          subtitle: 'Beat the afternoon slump with cold-pressed beverages and artisan nut mixes.',
          subtitleNe: 'दिउँसोको खाजाको लागि कोल्ड-प्रेस्ड पेय र भुटिएका बदाम काजु मिक्स।',
          badge: 'REFRESH & RECHARGE',
          badgeNe: 'रिफ्रेस र रिचार्ज',
          ctaText: 'Stock Snacks',
          ctaTextNe: 'खाजा स्टक गर्नुहोस्',
          ctaCategory: 'snacks',
          imageUrl: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
          couponCode: 'SNACK20',
          colorTheme: 'teal',
          sortOrder: 4,
          isActive: true,
        },
      ]);
    }

    // 8. Coupons
    const couponSeeds = [
      {
        code: 'OYOFRESH20',
        description: '20% discount up to Rs. 150',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscountAmount: 150,
        minOrderAmount: 300,
        usageLimit: 1000,
      },
      {
        code: 'WELCOME50',
        description: 'Flat Rs. 50 OFF on orders above Rs. 250',
        discountType: 'flat',
        discountValue: 50,
        maxDiscountAmount: 50,
        minOrderAmount: 250,
        usageLimit: 1000,
      },
      {
        code: 'FREEDELIVERY',
        description: 'Delivery fee waiver',
        discountType: 'free_delivery',
        discountValue: 100,
        maxDiscountAmount: 200,
        minOrderAmount: 100,
        usageLimit: 5000,
      },
      {
        code: 'FARM30',
        description: 'Flat Rs. 75 OFF on farm fresh orders above Rs. 400',
        discountType: 'flat',
        discountValue: 75,
        maxDiscountAmount: 75,
        minOrderAmount: 400,
        usageLimit: 500,
      },
      {
        code: 'BAKERY15',
        description: '15% OFF up to Rs. 120 on Bakery & Dairy',
        discountType: 'percentage',
        discountValue: 15,
        maxDiscountAmount: 120,
        minOrderAmount: 200,
        usageLimit: 500,
      },
      {
        code: 'SNACK20',
        description: '20% OFF up to Rs. 100 on Snacks & Drinks',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscountAmount: 100,
        minOrderAmount: 250,
        usageLimit: 500,
      },
    ];
    for (const cp of couponSeeds) {
      await db.insert(coupons).values(cp).onConflictDoNothing();
    }

    // 9. Platform Settings & Advertisements
    await db
      .insert(platformSettings)
      .values([
        {
          key: 'delivery_pricing',
          value: { baseFeePerVendor: 35, freeDeliveryThreshold: 499, handlingFee: 15, defaultEtaMins: 12 },
          description: 'Core marketplace delivery and platform handling fee configuration',
        },
        {
          key: 'delivery_fees',
          value: { baseDeliveryFee: 35, freeDeliveryThreshold: 499, handlingFee: 15, defaultEtaMins: 12 },
          description: 'Dynamic checkout fee calculation rules',
        },
        {
          key: 'commission_policy',
          value: { defaultCommissionRate: 10, newSellerZeroCommissionDays: 30 },
          description: 'Marketplace seller commission defaults',
        },
        {
          key: 'store_support',
          value: {
            brandName: 'OyoPasal',
            tagline: '10–15 MIN DELIVERY',
            email: 'support@oyopasal.com.np',
            phone: '+977 1-4782910',
            address: 'New Baneshwor, Kathmandu, Nepal',
            hours: '6:00 AM – 11:00 PM Daily',
          },
          description: 'Public brand contact and customer support hours',
        },
      ])
      .onConflictDoNothing();

    const existingAds = await db.select().from(advertisements).limit(1);
    if (existingAds.length === 0) {
      await db.insert(advertisements).values([
        {
          title: 'Zero-Pesticide Kavre Harvest — Same Morning Dispatch',
          titleNe: 'काभ्रेको विषादीरहित ताजा तरकारी — बिहानै डेलिभरी',
          subtitle: 'Hand-picked hydroponic greens & ripe mountain avocados packed fresh on order.',
          subtitleNe: 'ताजा हाइड्रोपोनिक सागपात र पहाडी एभोकाडो अर्डरकै समयमा प्याक गरिन्छ।',
          imageUrl: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
          destinationUrl: '/category/fruits-vegetables',
          placement: 'homepage_mid',
          priority: 1,
          isActive: true,
        },
        {
          title: 'Morning Bakery + Farm Milk Express Combo',
          titleNe: 'बिहानी बेकरी र ताजा दूध एक्सप्रेस अफर',
          subtitle: 'Pair warm sourdough & French butter croissants with glass-bottle cow milk in 12 mins.',
          subtitleNe: 'तातो सावरडो, बटर क्रोइसाँ र सिसाको बोतलको गाईको दूध १२ मिनेटमै।',
          imageUrl: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
          destinationUrl: '/category/dairy-bakery',
          placement: 'homepage_bottom',
          priority: 2,
          isActive: true,
        },
      ]);
    }

    // 10. Notifications
    const existingNotifs = await db.select().from(notifications).limit(1);
    if (existingNotifs.length === 0) {
      await db.insert(notifications).values([
        {
          userId: demoCustomer.id,
          roleScope: 'customer',
          title: '⚡ Instant 12-Minute Express Live!',
          message:
            'We have onboarded 3 new micro-fulfilment hubs near Baneshwor & Lalitpur. Get superfast deliveries now!',
          type: 'speed',
          isRead: false,
        },
        {
          userId: demoCustomer.id,
          roleScope: 'customer',
          title: '🥬 Fresh Morning Harvest Arrived',
          message: 'Hydroponic cherry tomatoes, mountain broccoli and Hass avocados just arrived from Kavre.',
          type: 'fresh',
          isRead: true,
        },
        {
          userId: demoCustomer.id,
          roleScope: 'customer',
          title: '🎉 Flat Rs. 50 OFF with code WELCOME50',
          message: 'Valid on orders above Rs. 250. Apply coupon during checkout.',
          type: 'promo',
          isRead: true,
        },
      ]);
    }

    // 11. Sample Persistent Orders, Fulfillments, Payments & Reviews (if orders empty)
    const existingOrdersCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders);

    if ((existingOrdersCount[0]?.count ?? 0) === 0) {
      const himalayan = vendorByKey.get('v-himalayan')!;
      const patan = vendorByKey.get('v-patan-bakery')!;
      const avocado = productByKey.get('prod-avocado')!;
      const milk = productByKey.get('prod-milk')!;

      const [liveOrder] = await db
        .insert(orders)
        .values({
          externalKey: 'ord-live-902',
          orderNumber: 'OP-90248',
          userId: demoCustomer.id,
          userUid: demoCustomer.uid,
          status: 'OUT_FOR_DELIVERY',
          subtotal: 515,
          deliveryFee: 0,
          handlingFee: 15,
          discount: 0,
          totalAmount: 530,
          addressId: defaultAddrId,
          deliveryTitle: 'Home',
          deliveryAddress: 'House #42, Shanti Marga, New Baneshwor, Kathmandu',
          deliveryArea: 'New Baneshwor',
          deliveryCity: 'Kathmandu',
          deliveryLandmark: 'Opposite Everest Bank ATM',
          deliveryLat: '27.6986',
          deliveryLng: '85.3292',
          recipientName: 'Roshan Yadav',
          recipientPhone: '+977 9841234567',
          deliveryOption: 'EXPRESS_12_MINS',
          paymentMethod: 'ESEWA',
          paymentStatus: 'PAID',
          vendorName: `${himalayan.name}, ${patan.name}`,
          estimatedMinutes: 8,
        })
        .returning();

      const [ful1] = await db
        .insert(vendorFulfillments)
        .values({
          orderId: liveOrder.id,
          vendorId: himalayan.id,
          status: 'OUT_FOR_DELIVERY',
          subtotal: 295,
          deliveryFee: 0,
          commissionRate: '10.00',
          commissionAmount: 30,
          vendorNetPayout: 265,
          packedAt: new Date(Date.now() - 1000 * 60 * 4),
          dispatchedAt: new Date(Date.now() - 1000 * 60 * 2),
        })
        .returning();

      const [ful2] = await db
        .insert(vendorFulfillments)
        .values({
          orderId: liveOrder.id,
          vendorId: patan.id,
          status: 'OUT_FOR_DELIVERY',
          subtotal: 220,
          deliveryFee: 0,
          commissionRate: '12.00',
          commissionAmount: 26,
          vendorNetPayout: 194,
          packedAt: new Date(Date.now() - 1000 * 60 * 4),
          dispatchedAt: new Date(Date.now() - 1000 * 60 * 2),
        })
        .returning();

      await db.insert(orderItems).values([
        {
          orderId: liveOrder.id,
          vendorFulfillmentId: ful1.id,
          vendorId: himalayan.id,
          productId: avocado.id,
          productName: avocado.name,
          quantity: 1,
          unitPrice: 295,
          totalPrice: 295,
          image: avocado.image,
          unit: avocado.unit,
          commissionAmount: 30,
          vendorNetAmount: 265,
        },
        {
          orderId: liveOrder.id,
          vendorFulfillmentId: ful2.id,
          vendorId: patan.id,
          productId: milk.id,
          productName: milk.name,
          quantity: 2,
          unitPrice: 110,
          totalPrice: 220,
          image: milk.image,
          unit: milk.unit,
          commissionAmount: 26,
          vendorNetAmount: 194,
        },
      ]);

      await db.insert(orderStatusHistory).values([
        {
          orderId: liveOrder.id,
          status: 'ORDER_PLACED',
          title: 'Order Confirmed',
          description: 'Verified & transmitted to Himalayan Fresh Farms and Patan Artisan Bakery.',
          actorRole: 'system',
        },
        {
          orderId: liveOrder.id,
          status: 'PACKED_BY_VENDOR',
          title: 'Packed with Care',
          description: 'Items sealed in biodegradable temperature-safe bags.',
          actorRole: 'seller',
        },
        {
          orderId: liveOrder.id,
          status: 'OUT_FOR_DELIVERY',
          title: 'Rider Dispatched',
          description: 'Rider Ramesh Pandey picked up order on EV Scooter (Ba 98 Pa 4412).',
          actorUserId: riderUser.id,
          actorRole: 'delivery_agent',
        },
      ]);

      await db.insert(payments).values({
        orderId: liveOrder.id,
        userId: demoCustomer.id,
        method: 'ESEWA',
        provider: 'eSewa ePay',
        amount: 530,
        currency: 'NPR',
        status: 'paid',
        gatewayRefId: 'ESW-90248-VERIFIED',
        idempotencyKey: 'seed-pay-90248',
      });

      const [assign] = await db
        .insert(deliveryAssignments)
        .values({
          orderId: liveOrder.id,
          vendorFulfillmentId: ful1.id,
          agentId: riderAgentRow.id,
          status: 'in_transit',
          pickupLat: himalayan.lat,
          pickupLng: himalayan.lng,
          dropoffLat: '27.6986',
          dropoffLng: '85.3292',
          currentLat: '27.6948',
          currentLng: '85.3352',
          speedKmh: 26,
          etaMinutes: 4,
          assignedAt: new Date(Date.now() - 1000 * 60 * 3),
          pickedUpAt: new Date(Date.now() - 1000 * 60 * 2),
        })
        .returning();

      await db.insert(deliveryTrackingEvents).values({
        assignmentId: assign.id,
        orderId: liveOrder.id,
        lat: '27.6948',
        lng: '85.3352',
        speedKmh: 26,
        heading: 315,
        statusNote: 'Rider en route along Shanti Nagar -> New Baneshwor',
      });

      // Second historical delivered order for Seller analytics & Customer history
      const [pastOrder] = await db
        .insert(orders)
        .values({
          externalKey: 'ord-84721',
          orderNumber: 'OP-84721',
          userId: demoCustomer.id,
          userUid: demoCustomer.uid,
          status: 'DELIVERED',
          subtotal: 815,
          deliveryFee: 0,
          handlingFee: 15,
          discount: 0,
          totalAmount: 830,
          addressId: defaultAddrId,
          deliveryTitle: 'Home',
          deliveryAddress: 'House #42, Shanti Marga, New Baneshwor, Kathmandu',
          deliveryArea: 'New Baneshwor',
          deliveryCity: 'Kathmandu',
          deliveryLandmark: 'Opposite Everest Bank ATM',
          deliveryLat: '27.6986',
          deliveryLng: '85.3292',
          recipientName: 'Roshan Yadav',
          recipientPhone: '+977 9841234567',
          deliveryOption: 'EXPRESS_12_MINS',
          paymentMethod: 'CASH_ON_DELIVERY',
          paymentStatus: 'PAID',
          vendorName: himalayan.name,
          estimatedMinutes: 12,
          deliveredAt: new Date(Date.now() - 1000 * 60 * 120),
          createdAt: new Date(Date.now() - 1000 * 60 * 140),
        })
        .returning();

      const [pastFul] = await db
        .insert(vendorFulfillments)
        .values({
          orderId: pastOrder.id,
          vendorId: himalayan.id,
          status: 'DELIVERED',
          subtotal: 815,
          deliveryFee: 0,
          commissionRate: '10.00',
          commissionAmount: 82,
          vendorNetPayout: 733,
          packedAt: new Date(Date.now() - 1000 * 60 * 132),
          dispatchedAt: new Date(Date.now() - 1000 * 60 * 128),
          deliveredAt: new Date(Date.now() - 1000 * 60 * 120),
        })
        .returning();

      const honey = productByKey.get('prod-honey')!;
      await db.insert(orderItems).values([
        {
          orderId: pastOrder.id,
          vendorFulfillmentId: pastFul.id,
          vendorId: himalayan.id,
          productId: avocado.id,
          productName: avocado.name,
          quantity: 1,
          unitPrice: 295,
          totalPrice: 295,
          image: avocado.image,
          unit: avocado.unit,
          commissionAmount: 30,
          vendorNetAmount: 265,
        },
        {
          orderId: pastOrder.id,
          vendorFulfillmentId: pastFul.id,
          vendorId: himalayan.id,
          productId: honey.id,
          productName: honey.name,
          quantity: 1,
          unitPrice: 520,
          totalPrice: 520,
          image: honey.image,
          unit: honey.unit,
          commissionAmount: 52,
          vendorNetAmount: 468,
        },
      ]);

      await db.insert(financialLedger).values([
        {
          vendorId: himalayan.id,
          orderId: pastOrder.id,
          entryType: 'sale_credit',
          amount: 815,
          description: `Gross sales for order ${pastOrder.orderNumber}`,
        },
        {
          vendorId: himalayan.id,
          orderId: pastOrder.id,
          entryType: 'commission_debit',
          amount: -82,
          description: `Platform commission (10%) on ${pastOrder.orderNumber}`,
        },
      ]);

      await db.insert(orderStatusHistory).values([
        {
          orderId: pastOrder.id,
          status: 'ORDER_PLACED',
          title: 'Order Confirmed',
          description: 'Verified & sent to Himalayan Fresh Farms.',
          actorRole: 'system',
        },
        {
          orderId: pastOrder.id,
          status: 'DELIVERED',
          title: 'Delivered',
          description: 'Handed over at House #42, Shanti Marga, New Baneshwor.',
          actorRole: 'delivery_agent',
        },
      ]);

      await db.insert(reviews).values([
        {
          productId: avocado.id,
          vendorId: himalayan.id,
          userId: demoCustomer.id,
          orderId: pastOrder.id,
          rating: 5,
          title: 'Perfectly creamy & fresh!',
          comment: 'Arrived in 11 minutes in chilled packaging. Both avocados were ripe and spotless.',
          isVerifiedPurchase: true,
        },
        {
          productId: honey.id,
          vendorId: himalayan.id,
          userId: demoCustomer.id,
          orderId: pastOrder.id,
          rating: 5,
          title: 'Authentic Himalayan cliff honey',
          comment: 'Rich aroma and zero crystalized sugar. Great glass jar packaging.',
          isVerifiedPurchase: true,
        },
      ]);

      const [sampleTicket] = await db
        .insert(supportTickets)
        .values({
          ticketNumber: 'TKT-1042',
          userId: demoCustomer.id,
          orderId: pastOrder.id,
          vendorId: himalayan.id,
          category: 'packaging_feedback',
          subject: 'Appreciation for chilled avocado packaging',
          status: 'resolved',
          priority: 'low',
          assignedAdminId: adminUser.id,
        })
        .returning();

      await db.insert(ticketMessages).values([
        {
          ticketId: sampleTicket.id,
          senderUserId: demoCustomer.id,
          senderRole: 'customer',
          message: 'Loved the biodegradable insulated pouch on OP-84721!',
        },
        {
          ticketId: sampleTicket.id,
          senderUserId: adminUser.id,
          senderRole: 'admin',
          message: 'Thank you for the feedback, Roshan! Shared with our Himalayan Fresh Farms hub team.',
        },
      ]);
    }

    seededAlready = true;
    console.log('✅ Cloud SQL PostgreSQL production database seeded and verified.');
  } catch (err) {
    console.error('❌ Database seed error:', err);
  }
}
