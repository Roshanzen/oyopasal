import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { db } from './src/db/index.ts';
import { users, vendors, products, orders, orderItems } from './src/db/schema.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google Gemini Client with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// In-Memory Database representing Django REST Framework / MySQL storage
const VENDORS = [
  {
    id: 'v-himalayan',
    name: 'Himalayan Fresh Farms',
    slug: 'himalayan-fresh-farms',
    rating: 4.9,
    delivery_time_mins: '10-12 mins',
    verified: true,
    distance_km: 0.8,
    location: 'Baneshwor, Kathmandu',
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    tags: ['Organic', 'Farm Fresh', 'Daily Picked']
  },
  {
    id: 'v-patan-bakery',
    name: 'Patan Artisan Bakery & Dairy',
    slug: 'patan-artisan-bakery',
    rating: 4.8,
    delivery_time_mins: '12-15 mins',
    verified: true,
    distance_km: 1.2,
    location: 'Pulchowk, Lalitpur',
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    tags: ['Fresh Oven', 'Pure Milk', 'Artisanal']
  },
  {
    id: 'v-everest-pantry',
    name: 'Everest Organic & Dry Pantry',
    slug: 'everest-organic-pantry',
    rating: 4.7,
    delivery_time_mins: '15 mins',
    verified: true,
    distance_km: 1.5,
    location: 'Koteshwor, Kathmandu',
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    tags: ['Spices', 'Cold Pressed', 'Staples']
  },
  {
    id: 'v-green-valley',
    name: 'Green Valley Hydroponics',
    slug: 'green-valley-hydroponics',
    rating: 4.9,
    delivery_time_mins: '10 mins',
    verified: true,
    distance_km: 0.6,
    location: 'Thamel, Kathmandu',
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    tags: ['Pesticide Free', 'Crisp Greens', 'Superfoods']
  }
];

const CATEGORIES = [
  {
    id: 'cat-grocery',
    name: 'Grocery & Staples',
    slug: 'grocery',
    icon: 'Package',
    item_count: 148,
    accent: '#059669',
    description: 'Daily rice, lentils, organic flours, spices & oils'
  },
  {
    id: 'cat-fresh',
    name: 'Fruits & Vegetables',
    slug: 'fruits-vegetables',
    icon: 'Apple',
    item_count: 86,
    accent: '#16A34A',
    description: 'Crisp green farm harvests & seasonal fruits'
  },
  {
    id: 'cat-dairy',
    name: 'Dairy & Bakery',
    slug: 'dairy-bakery',
    icon: 'Milk',
    item_count: 62,
    accent: '#D97706',
    description: 'Pure cow milk, artisan sourdough, butter & paneer'
  },
  {
    id: 'cat-snacks',
    name: 'Snacks & Munchies',
    slug: 'snacks',
    icon: 'Cookie',
    item_count: 94,
    accent: '#EA580C',
    description: 'Roasted nuts, gourmet crisps & traditional namkeen'
  },
  {
    id: 'cat-beverages',
    name: 'Beverages',
    slug: 'beverages',
    icon: 'Coffee',
    item_count: 53,
    accent: '#0284C7',
    description: 'Chilled iced teas, organic juices & Himalayan coffees'
  },
  {
    id: 'cat-personal',
    name: 'Personal Care',
    slug: 'personal-care',
    icon: 'Sparkles',
    item_count: 45,
    accent: '#8B5CF6',
    description: 'Herbal skincare, bath essentials & grooming'
  },
  {
    id: 'cat-household',
    name: 'Household',
    slug: 'household',
    icon: 'Home',
    item_count: 58,
    accent: '#475569',
    description: 'Eco-cleaners, paper towels & kitchenware'
  },
  {
    id: 'cat-electronics',
    name: 'Electronics & Cables',
    slug: 'electronics',
    icon: 'Zap',
    item_count: 31,
    accent: '#2563EB',
    description: 'High-speed chargers, cables & battery packs'
  },
  {
    id: 'cat-fashion',
    name: 'Fashion & Basics',
    slug: 'fashion',
    icon: 'Shirt',
    item_count: 24,
    accent: '#BE185D',
    description: 'Everyday cotton tees, innerwear & socks'
  },
  {
    id: 'cat-health',
    name: 'Health & Wellness',
    slug: 'health-wellness',
    icon: 'HeartPulse',
    item_count: 39,
    accent: '#E11D48',
    description: 'Vitamins, herbal balms, first aid & masks'
  }
];

const PROMOTIONS = [
  {
    id: 'promo-1',
    title: 'Fast & Fresh in 10-15 Minutes',
    subtitle: 'Free delivery on all orders over Rs. 499 from verified local neighborhood sellers.',
    badge: 'SUPER SAVINGS',
    cta_text: 'Explore Fresh Produce',
    cta_category: 'fruits-vegetables',
    image: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    code: 'FREEDELIVERY',
    color_theme: 'emerald'
  },
  {
    id: 'promo-2',
    title: 'Farm Harvest Morning Festival',
    subtitle: 'Directly sourced from Kavre & Dhading organic farms. Up to 30% off today.',
    badge: 'FARM DIRECT',
    cta_text: 'Shop Farm Direct',
    cta_category: 'fruits-vegetables',
    image: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    code: 'FARM30',
    color_theme: 'amber'
  },
  {
    id: 'promo-3',
    title: 'Artisan Bakery & Fresh Morning Milk',
    subtitle: 'Warm butter croissants, rustic sourdough loaves & fresh organic whole milk.',
    badge: 'FRESH OVEN',
    cta_text: 'Order Bakery',
    cta_category: 'dairy-bakery',
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    code: 'BAKERY15',
    color_theme: 'orange'
  },
  {
    id: 'promo-4',
    title: 'Chilled Kombucha & Gourmet Snacks',
    subtitle: 'Beat the afternoon slump with cold-pressed beverages and artisan nut mixes.',
    badge: 'REFRESH & RECHARGE',
    cta_text: 'Stock Snacks',
    cta_category: 'snacks',
    image: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    code: 'SNACK20',
    color_theme: 'teal'
  }
];

export interface ProductItem {
  id: string;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string };
  vendor: { id: string; name: string; rating: number; delivery_time_mins: string };
  original_price: number;
  discounted_price: number;
  discount_percentage: number;
  unit: string;
  stock: number;
  in_stock: boolean;
  is_organic: boolean;
  rating: number;
  reviews_count: number;
  image_url: string;
  gallery: string[];
  description: string;
  origin: string;
  variants: { id: string; name: string; unit: string; price: number; original_price: number; stock: number }[];
  sections: string[];
}

const PRODUCTS: ProductItem[] = [
  {
    id: 'prod-avocado',
    name: 'Organic Hass Avocados',
    slug: 'organic-hass-avocados',
    category: { id: 'cat-fresh', name: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
    vendor: { id: 'v-himalayan', name: 'Himalayan Fresh Farms', rating: 4.9, delivery_time_mins: '10-12 mins' },
    original_price: 380,
    discounted_price: 295,
    discount_percentage: 22,
    unit: '2 pcs (approx 380g)',
    stock: 24,
    in_stock: true,
    is_organic: true,
    rating: 4.9,
    reviews_count: 142,
    image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: [
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
      '/src/assets/images/promo_fresh_produce_1794407354982.jpg'
    ],
    description: 'Creamy, rich Hass avocados with dark textured skin. Perfectly conditioned to ripen within 24-48 hours. Rich in healthy monounsaturated fats.',
    origin: 'Kavre Valley Organic Cooperative',
    variants: [
      { id: 'var-1', name: 'Pack of 2', unit: '2 pcs', price: 295, original_price: 380, stock: 24 },
      { id: 'var-2', name: 'Family Box (4 pcs)', unit: '4 pcs', price: 540, original_price: 720, stock: 12 }
    ],
    sections: ['best_sellers', 'recommended', 'fresh_arrivals']
  },
  {
    id: 'prod-milk',
    name: 'Fresh Cow Whole Milk (Glass Bottle)',
    slug: 'fresh-cow-whole-milk',
    category: { id: 'cat-dairy', name: 'Dairy & Bakery', slug: 'dairy-bakery' },
    vendor: { id: 'v-patan-bakery', name: 'Patan Artisan Bakery & Dairy', rating: 4.8, delivery_time_mins: '12-15 mins' },
    original_price: 130,
    discounted_price: 110,
    discount_percentage: 15,
    unit: '1 Litre',
    stock: 35,
    in_stock: true,
    is_organic: true,
    rating: 4.9,
    reviews_count: 310,
    image_url: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: [
      '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg'
    ],
    description: 'Pure, unadulterated pasture-raised whole milk delivered fresh every morning in sanitized reusable glass bottles. Pasteurized with care.',
    origin: 'Lalitpur Dairy Cooperative',
    variants: [
      { id: 'var-milk-1', name: '1 Litre Bottle', unit: '1L', price: 110, original_price: 130, stock: 35 },
      { id: 'var-milk-2', name: '2 Litres Value Pack', unit: '2L', price: 210, original_price: 250, stock: 15 }
    ],
    sections: ['best_sellers', 'daily_essentials', 'trending']
  },
  {
    id: 'prod-croissant',
    name: 'Artisanal French Butter Croissant',
    slug: 'artisanal-french-butter-croissant',
    category: { id: 'cat-dairy', name: 'Dairy & Bakery', slug: 'dairy-bakery' },
    vendor: { id: 'v-patan-bakery', name: 'Patan Artisan Bakery & Dairy', rating: 4.8, delivery_time_mins: '12-15 mins' },
    original_price: 220,
    discounted_price: 175,
    discount_percentage: 20,
    unit: 'Pack of 2',
    stock: 18,
    in_stock: true,
    is_organic: false,
    rating: 4.8,
    reviews_count: 88,
    image_url: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: [
      '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg'
    ],
    description: 'Handcrafted with 72 laminated butter layers, golden crispy flaky crust and honeycomb interior. Baked fresh three times daily.',
    origin: 'Patan Bakery Lab',
    variants: [
      { id: 'var-cr-1', name: 'Twin Pack', unit: '2 pcs', price: 175, original_price: 220, stock: 18 },
      { id: 'var-cr-2', name: 'Box of 4', unit: '4 pcs', price: 320, original_price: 410, stock: 9 }
    ],
    sections: ['fresh_arrivals', 'top_deals']
  },
  {
    id: 'prod-cherry-tomatoes',
    name: 'Hydroponic Sweet Cherry Tomatoes',
    slug: 'sweet-cherry-tomatoes',
    category: { id: 'cat-fresh', name: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
    vendor: { id: 'v-green-valley', name: 'Green Valley Hydroponics', rating: 4.9, delivery_time_mins: '10 mins' },
    original_price: 180,
    discounted_price: 135,
    discount_percentage: 25,
    unit: '250 g Punnet',
    stock: 42,
    in_stock: true,
    is_organic: true,
    rating: 4.9,
    reviews_count: 204,
    image_url: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: [
      '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg'
    ],
    description: 'Sun-ripened vine cherry tomatoes bursting with intense sweetness and crisp snap. Grown pesticide-free in climate-controlled greenhouses.',
    origin: 'Green Valley Greenhouses, Kathmandu',
    variants: [
      { id: 'var-ct-1', name: '250g Punnet', unit: '250g', price: 135, original_price: 180, stock: 42 },
      { id: 'var-ct-2', name: '500g Tub', unit: '500g', price: 250, original_price: 340, stock: 20 }
    ],
    sections: ['best_sellers', 'daily_essentials', 'top_deals']
  },
  {
    id: 'prod-kombucha',
    name: 'Sparkling Ginger Lime Kombucha',
    slug: 'sparkling-ginger-lime-kombucha',
    category: { id: 'cat-beverages', name: 'Beverages', slug: 'beverages' },
    vendor: { id: 'v-everest-pantry', name: 'Everest Organic & Dry Pantry', rating: 4.7, delivery_time_mins: '15 mins' },
    original_price: 240,
    discounted_price: 195,
    discount_percentage: 19,
    unit: '330 ml Glass Bottle',
    stock: 28,
    in_stock: true,
    is_organic: true,
    rating: 4.7,
    reviews_count: 67,
    image_url: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    gallery: [
      '/src/assets/images/promo_snacks_drinks_1794407356711.jpg'
    ],
    description: 'Naturally fermented live-culture probiotic brew with fresh cold-pressed hill ginger and aromatic Nepalese lime.',
    origin: 'Himalayan Brew Labs',
    variants: [
      { id: 'var-kb-1', name: 'Single Bottle', unit: '330ml', price: 195, original_price: 240, stock: 28 },
      { id: 'var-kb-2', name: 'Trio Pack', unit: '3x330ml', price: 540, original_price: 700, stock: 10 }
    ],
    sections: ['trending', 'top_deals']
  },
  {
    id: 'prod-almond-mix',
    name: 'Slow Roasted Himalayan Trail Nut Mix',
    slug: 'roasted-himalayan-trail-mix',
    category: { id: 'cat-snacks', name: 'Snacks & Munchies', slug: 'snacks' },
    vendor: { id: 'v-everest-pantry', name: 'Everest Organic & Dry Pantry', rating: 4.7, delivery_time_mins: '15 mins' },
    original_price: 490,
    discounted_price: 390,
    discount_percentage: 20,
    unit: '200 g Standup Pouch',
    stock: 19,
    in_stock: true,
    is_organic: true,
    rating: 4.8,
    reviews_count: 95,
    image_url: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    gallery: [
      '/src/assets/images/promo_snacks_drinks_1794407356711.jpg'
    ],
    description: 'Crisp roasted California almonds, Jumla walnuts, roasted pumpkin seeds and dried cranberries with light sea salt dusting.',
    origin: 'Everest Pantry Select',
    variants: [
      { id: 'var-tm-1', name: '200g Pouch', unit: '200g', price: 390, original_price: 490, stock: 19 },
      { id: 'var-tm-2', name: '500g Value Pack', unit: '500g', price: 890, original_price: 1100, stock: 8 }
    ],
    sections: ['best_sellers', 'recommended']
  },
  {
    id: 'prod-broccoli',
    name: 'Crisp Organic Mountain Broccoli',
    slug: 'crisp-mountain-broccoli',
    category: { id: 'cat-fresh', name: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
    vendor: { id: 'v-himalayan', name: 'Himalayan Fresh Farms', rating: 4.9, delivery_time_mins: '10-12 mins' },
    original_price: 160,
    discounted_price: 120,
    discount_percentage: 25,
    unit: '1 head (approx 450g)',
    stock: 22,
    in_stock: true,
    is_organic: true,
    rating: 4.8,
    reviews_count: 73,
    image_url: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: [
      '/src/assets/images/promo_fresh_produce_1794407354982.jpg'
    ],
    description: 'Dense, dark green florets harvested at sunrise in Kakani mountain terraces. Firm stalk, sweet tender crown, zero chemicals.',
    origin: 'Kakani Terraced Farms',
    variants: [
      { id: 'var-br-1', name: 'Single Crown', unit: 'approx 450g', price: 120, original_price: 160, stock: 22 }
    ],
    sections: ['daily_essentials', 'fresh_arrivals']
  },
  {
    id: 'prod-sourdough',
    name: 'Country Style Artisan Sourdough Batard',
    slug: 'artisan-sourdough-batard',
    category: { id: 'cat-dairy', name: 'Dairy & Bakery', slug: 'dairy-bakery' },
    vendor: { id: 'v-patan-bakery', name: 'Patan Artisan Bakery & Dairy', rating: 4.8, delivery_time_mins: '12-15 mins' },
    original_price: 320,
    discounted_price: 260,
    discount_percentage: 19,
    unit: '650 g Loaf',
    stock: 14,
    in_stock: true,
    is_organic: false,
    rating: 4.9,
    reviews_count: 112,
    image_url: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: [
      '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg'
    ],
    description: 'Fermented for 36 hours with our 7-year heirloom wild levain starter. Deep blistered crust, open tender crumb, subtle lactic tang.',
    origin: 'Patan Bakery Lab',
    variants: [
      { id: 'var-sd-1', name: 'Full Loaf', unit: '650g', price: 260, original_price: 320, stock: 14 }
    ],
    sections: ['best_sellers', 'trending']
  },
  {
    id: 'prod-cold-press-mustard',
    name: 'Chitwan Cold-Pressed Pure Mustard Oil',
    slug: 'cold-pressed-mustard-oil',
    category: { id: 'cat-grocery', name: 'Grocery & Staples', slug: 'grocery' },
    vendor: { id: 'v-everest-pantry', name: 'Everest Organic & Dry Pantry', rating: 4.7, delivery_time_mins: '15 mins' },
    original_price: 340,
    discounted_price: 285,
    discount_percentage: 16,
    unit: '1 Litre Pet Bottle',
    stock: 40,
    in_stock: true,
    is_organic: true,
    rating: 4.8,
    reviews_count: 180,
    image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: [
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg'
    ],
    description: 'Traditional wood-churned (kolhu) extraction retaining 100% natural nutrients, pungent kick, and golden amber clarity.',
    origin: 'Chitwan Mustard Mills',
    variants: [
      { id: 'var-mo-1', name: '1 Litre', unit: '1L', price: 285, original_price: 340, stock: 40 },
      { id: 'var-mo-2', name: '2 Litres Can', unit: '2L', price: 550, original_price: 660, stock: 18 }
    ],
    sections: ['daily_essentials', 'recommended']
  },
  {
    id: 'prod-basmati-rice',
    name: 'Himalayan Aged Long Grain Basmati Rice',
    slug: 'aged-basmati-rice',
    category: { id: 'cat-grocery', name: 'Grocery & Staples', slug: 'grocery' },
    vendor: { id: 'v-everest-pantry', name: 'Everest Organic & Dry Pantry', rating: 4.7, delivery_time_mins: '15 mins' },
    original_price: 850,
    discounted_price: 699,
    discount_percentage: 18,
    unit: '5 kg Bag',
    stock: 25,
    in_stock: true,
    is_organic: false,
    rating: 4.9,
    reviews_count: 220,
    image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: [
      '/src/assets/images/hero_groceries_fresh_1794407355931.jpg'
    ],
    description: '2-year aged royal basmati with slender aromatic grains that expand up to 2.5x upon cooking with non-sticky fluffiness.',
    origin: 'Terai Select Paddy Reserves',
    variants: [
      { id: 'var-br-5k', name: '5 kg Bag', unit: '5kg', price: 699, original_price: 850, stock: 25 },
      { id: 'var-br-1k', name: '1 kg Sample', unit: '1kg', price: 160, original_price: 190, stock: 50 }
    ],
    sections: ['best_sellers', 'daily_essentials']
  },
  {
    id: 'prod-greek-yogurt',
    name: 'Creamy Mountain Greek Yogurt',
    slug: 'creamy-mountain-greek-yogurt',
    category: { id: 'cat-dairy', name: 'Dairy & Bakery', slug: 'dairy-bakery' },
    vendor: { id: 'v-patan-bakery', name: 'Patan Artisan Bakery & Dairy', rating: 4.8, delivery_time_mins: '12-15 mins' },
    original_price: 280,
    discounted_price: 225,
    discount_percentage: 20,
    unit: '400 g Tub',
    stock: 16,
    in_stock: true,
    is_organic: true,
    rating: 4.9,
    reviews_count: 94,
    image_url: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    gallery: [
      '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg'
    ],
    description: 'Triple-strained high-protein Greek style whole milk curd with thick velvety texture. No added sugar or artificial thickeners.',
    origin: 'Patan Dairy Lab',
    variants: [
      { id: 'var-gy-1', name: '400g Tub', unit: '400g', price: 225, original_price: 280, stock: 16 }
    ],
    sections: ['recommended', 'fresh_arrivals']
  },
  {
    id: 'prod-organic-mint',
    name: 'Fresh Hill Mint & Coriander Bunch',
    slug: 'fresh-mint-coriander',
    category: { id: 'cat-fresh', name: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
    vendor: { id: 'v-green-valley', name: 'Green Valley Hydroponics', rating: 4.9, delivery_time_mins: '10 mins' },
    original_price: 60,
    discounted_price: 45,
    discount_percentage: 25,
    unit: '150 g Fresh Bunch',
    stock: 50,
    in_stock: true,
    is_organic: true,
    rating: 4.8,
    reviews_count: 53,
    image_url: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: [
      '/src/assets/images/promo_fresh_produce_1794407354982.jpg'
    ],
    description: 'Crisp aromatic field herbs packed with morning dew. Ideal for chutneys, marinades, garnishing and detox teas.',
    origin: 'Green Valley Hydroponics',
    variants: [
      { id: 'var-mint-1', name: '150g Bunch', unit: '150g', price: 45, original_price: 60, stock: 50 }
    ],
    sections: ['daily_essentials', 'top_deals']
  },
  {
    id: 'prod-honey',
    name: 'Wild Raw Himalayan Cliff Honey',
    slug: 'wild-raw-himalayan-honey',
    category: { id: 'cat-health', name: 'Health & Wellness', slug: 'health-wellness' },
    vendor: { id: 'v-himalayan', name: 'Himalayan Fresh Farms', rating: 4.9, delivery_time_mins: '10-12 mins' },
    original_price: 650,
    discounted_price: 520,
    discount_percentage: 20,
    unit: '500 g Glass Jar',
    stock: 20,
    in_stock: true,
    is_organic: true,
    rating: 4.9,
    reviews_count: 115,
    image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description: '100% pure unprocessed wild floral honey harvested from high altitude Himalayan bee reserves. Rich in natural enzymes and antioxidants.',
    origin: 'Solukhumbu High Altitude Apiaries',
    variants: [
      { id: 'var-honey-1', name: '500g Jar', unit: '500g', price: 520, original_price: 650, stock: 20 },
      { id: 'var-honey-2', name: '1kg Jar', unit: '1kg', price: 980, original_price: 1250, stock: 8 }
    ],
    sections: ['best_sellers', 'recommended']
  },
  {
    id: 'prod-aloe-gel',
    name: 'Organic Aloe Vera & Neem Soothing Gel',
    slug: 'organic-aloe-vera-neem-gel',
    category: { id: 'cat-personal', name: 'Personal Care', slug: 'personal-care' },
    vendor: { id: 'v-everest-pantry', name: 'Everest Organic & Dry Pantry', rating: 4.7, delivery_time_mins: '15 mins' },
    original_price: 320,
    discounted_price: 250,
    discount_percentage: 21,
    unit: '200 ml Dispenser',
    stock: 30,
    in_stock: true,
    is_organic: true,
    rating: 4.8,
    reviews_count: 76,
    image_url: '/src/assets/images/promo_fresh_produce_1794407354982.jpg',
    gallery: ['/src/assets/images/promo_fresh_produce_1794407354982.jpg'],
    description: 'Pure 99% organic aloe vera pulp with cooling hill neem extracts. Hydrates skin, calms redness, and conditions hair naturally.',
    origin: 'Terai Herbal Herbarium',
    variants: [
      { id: 'var-aloe-1', name: '200ml Bottle', unit: '200ml', price: 250, original_price: 320, stock: 30 }
    ],
    sections: ['trending', 'top_deals']
  },
  {
    id: 'prod-bio-cleaner',
    name: 'Citrus Bio-Enzyme Multi-Surface Cleaner',
    slug: 'citrus-bio-enzyme-cleaner',
    category: { id: 'cat-household', name: 'Household', slug: 'household' },
    vendor: { id: 'v-green-valley', name: 'Green Valley Hydroponics', rating: 4.9, delivery_time_mins: '10 mins' },
    original_price: 290,
    discounted_price: 220,
    discount_percentage: 24,
    unit: '500 ml Spray Bottle',
    stock: 25,
    in_stock: true,
    is_organic: true,
    rating: 4.7,
    reviews_count: 48,
    image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description: 'Natural fermented citrus peel bio-enzyme cleaner. Tough on kitchen grease and bathroom grime, 100% pet-safe and chemical-free.',
    origin: 'Kathmandu Eco-Solutions',
    variants: [
      { id: 'var-clean-1', name: '500ml Spray', unit: '500ml', price: 220, original_price: 290, stock: 25 }
    ],
    sections: ['daily_essentials', 'fresh_arrivals']
  },
  {
    id: 'prod-gan-charger',
    name: '65W GaN Dual USB-C Fast Wall Charger',
    slug: '65w-gan-fast-wall-charger',
    category: { id: 'cat-electronics', name: 'Electronics & Cables', slug: 'electronics' },
    vendor: { id: 'v-everest-pantry', name: 'Everest Organic & Dry Pantry', rating: 4.7, delivery_time_mins: '15 mins' },
    original_price: 1850,
    discounted_price: 1399,
    discount_percentage: 24,
    unit: '1 pc (Compact Foldable)',
    stock: 15,
    in_stock: true,
    is_organic: false,
    rating: 4.9,
    reviews_count: 62,
    image_url: '/src/assets/images/promo_snacks_drinks_1794407356711.jpg',
    gallery: ['/src/assets/images/promo_snacks_drinks_1794407356711.jpg'],
    description: 'Next-gen Gallium Nitride (GaN) high-speed charger capable of powering MacBooks, iPhones, and Android smartphones at top speed.',
    origin: 'Authorized Nepal Importer',
    variants: [
      { id: 'var-chg-1', name: 'Single Unit', unit: '1 pc', price: 1399, original_price: 1850, stock: 15 }
    ],
    sections: ['trending', 'top_deals']
  },
  {
    id: 'prod-cotton-socks',
    name: 'Organic Combed Cotton Crew Socks',
    slug: 'organic-combed-cotton-crew-socks',
    category: { id: 'cat-fashion', name: 'Fashion & Basics', slug: 'fashion' },
    vendor: { id: 'v-himalayan', name: 'Himalayan Fresh Farms', rating: 4.9, delivery_time_mins: '10-12 mins' },
    original_price: 450,
    discounted_price: 340,
    discount_percentage: 24,
    unit: 'Pack of 3 Pairs',
    stock: 35,
    in_stock: true,
    is_organic: true,
    rating: 4.8,
    reviews_count: 82,
    image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg',
    gallery: ['/src/assets/images/hero_groceries_fresh_1794407355931.jpg'],
    description: 'Super-soft combed organic cotton with cushioned arch support and breathable moisture-wicking weave. Neutral grey, black & navy tones.',
    origin: 'Patan Cotton Mills',
    variants: [
      { id: 'var-socks-1', name: 'Trio Pack', unit: '3 pairs', price: 340, original_price: 450, stock: 35 }
    ],
    sections: ['daily_essentials', 'recommended']
  }
];

// User Mock DB
interface UserProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  phone: string;
  token: string;
  default_address_id: string;
}

let CURRENT_USER: UserProfile = {
  id: 'usr-101',
  username: 'roshan_yadav',
  email: 'yadavroshan864@gmail.com',
  full_name: 'Roshan Yadav',
  phone: '+977 9841234567',
  token: 'drf-token-9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b',
  default_address_id: 'addr-1'
};

interface Address {
  id: string;
  title: string;
  recipient_name: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  landmark: string;
  is_default: boolean;
}

let SAVED_ADDRESSES: Address[] = [
  {
    id: 'addr-1',
    title: 'Home',
    recipient_name: 'Roshan Yadav',
    phone: '+977 9841234567',
    street: 'House #42, Shanti Marga',
    area: 'New Baneshwor',
    city: 'Kathmandu',
    landmark: 'Opposite Everest Bank ATM',
    is_default: true
  },
  {
    id: 'addr-2',
    title: 'Office',
    recipient_name: 'Roshan Yadav',
    phone: '+977 9841234567',
    street: 'Tech Hub Tower, Level 4',
    area: 'Jhamsikhel',
    city: 'Lalitpur',
    landmark: 'Near British School',
    is_default: false
  }
];

// Active Cart in memory
interface CartItem {
  id: string;
  product_id: string;
  product: ProductItem;
  quantity: number;
  selected_variant_id?: string;
  unit_price: number;
  total_price: number;
}

let CART_ITEMS: CartItem[] = [
  {
    id: 'cart-1',
    product_id: 'prod-avocado',
    product: PRODUCTS[0],
    quantity: 1,
    selected_variant_id: 'var-1',
    unit_price: PRODUCTS[0].discounted_price,
    total_price: PRODUCTS[0].discounted_price
  },
  {
    id: 'cart-2',
    product_id: 'prod-milk',
    product: PRODUCTS[1],
    quantity: 2,
    selected_variant_id: 'var-milk-1',
    unit_price: PRODUCTS[1].discounted_price,
    total_price: PRODUCTS[1].discounted_price * 2
  }
];

let APPLIED_COUPON: { code: string; discount_amount: number; description: string } | null = null;

// Wishlist
let WISHLIST_IDS: string[] = ['prod-sourdough', 'prod-cherry-tomatoes'];

// Orders storage
interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: 'ORDER_PLACED' | 'PACKED_BY_VENDOR' | 'RIDER_ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  estimated_delivery_mins: number;
  delivery_address: Address;
  delivery_option: 'EXPRESS_12_MINS' | 'SCHEDULED_TODAY';
  payment_method: 'CASH_ON_DELIVERY' | 'ESEWA' | 'KHALTI' | 'CARD';
  payment_status: 'PAID' | 'PENDING';
  items_by_vendor: {
    vendor: { id: string; name: string };
    items: { product_name: string; unit: string; quantity: number; unit_price: number; total: number; image_url: string }[];
    vendor_delivery_fee: number;
  }[];
  subtotal: number;
  delivery_fee: number;
  handling_fee: number;
  coupon_discount: number;
  total_amount: number;
  tracking_updates: { timestamp: string; title: string; description: string; done: boolean }[];
}

let ORDERS: Order[] = [
  {
    id: 'ord-84721',
    order_number: 'OP-84721',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    status: 'DELIVERED',
    estimated_delivery_mins: 14,
    delivery_address: SAVED_ADDRESSES[0],
    delivery_option: 'EXPRESS_12_MINS',
    payment_method: 'CASH_ON_DELIVERY',
    payment_status: 'PAID',
    items_by_vendor: [
      {
        vendor: { id: 'v-himalayan', name: 'Himalayan Fresh Farms' },
        items: [
          {
            product_name: 'Organic Hass Avocados',
            unit: '2 pcs',
            quantity: 1,
            unit_price: 295,
            total: 295,
            image_url: '/src/assets/images/hero_groceries_fresh_1794407355931.jpg'
          }
        ],
        vendor_delivery_fee: 0
      }
    ],
    subtotal: 295,
    delivery_fee: 0,
    handling_fee: 15,
    coupon_discount: 0,
    total_amount: 310,
    tracking_updates: [
      { timestamp: '2 hours ago', title: 'Order Confirmed', description: 'Your order was verified and sent to Himalayan Fresh Farms', done: true },
      { timestamp: '1 hour 50 mins ago', title: 'Packed with Care', description: 'Items packed in biodegradable temperature-sealed bag', done: true },
      { timestamp: '1 hour 42 mins ago', title: 'Rider Dispatched', description: 'Rider Ramesh picked up order on EV Scooter', done: true },
      { timestamp: '1 hour 30 mins ago', title: 'Delivered', description: 'Handed over at New Baneshwor', done: true }
    ]
  }
];

let NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: '⚡ Instant 12-Minute Express Live!',
    message: 'We have onboarded 3 new micro-fulfilment hubs near Baneshwor & Lalitpur. Get superfast deliveries now!',
    created_at: 'Just now',
    read: false,
    type: 'speed'
  },
  {
    id: 'notif-2',
    title: '🥬 Fresh Morning Harvest Arrived',
    message: 'Hydroponic cherry tomatoes, mountain broccoli and Haas avocados just arrived from Kavre.',
    created_at: '2 hours ago',
    read: true,
    type: 'fresh'
  },
  {
    id: 'notif-3',
    title: '🎉 Flat Rs. 50 OFF with code WELCOME50',
    message: 'Valid on orders above Rs. 299. Apply coupon during checkout.',
    created_at: '1 day ago',
    read: true,
    type: 'promo'
  }
];

// Helper: DRF Paginated Response format
function drfPaginate<T>(items: T[], page: number = 1, pageSize: number = 10, req: express.Request) {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const results = items.slice(startIndex, endIndex);
  const total = items.length;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol;

  const next = endIndex < total ? `${protocol}://${host}${req.path}?page=${page + 1}&page_size=${pageSize}` : null;
  const previous = page > 1 ? `${protocol}://${host}${req.path}?page=${page - 1}&page_size=${pageSize}` : null;

  return {
    count: total,
    next,
    previous,
    results
  };
}

// DRF API Endpoints

// 1. Categories
app.get('/api/v1/categories/', (req, res) => {
  res.json({
    count: CATEGORIES.length,
    next: null,
    previous: null,
    results: CATEGORIES
  });
});

// 2. Promotions
app.get('/api/v1/promotions/', (req, res) => {
  res.json({
    count: PROMOTIONS.length,
    next: null,
    previous: null,
    results: PROMOTIONS
  });
});

// 3. Vendors
app.get('/api/v1/vendors/', (req, res) => {
  res.json({
    count: VENDORS.length,
    next: null,
    previous: null,
    results: VENDORS
  });
});

app.post('/api/v1/vendors/register/', async (req, res) => {
  const { store_name, category, city = 'Kathmandu', area, contact_person, phone, email, daily_orders = '20-50' } = req.body;
  if (!store_name || !contact_person || !phone) {
    return res.status(400).json({ detail: 'Store name, contact person, and phone are required.' });
  }

  const newVendor = {
    id: `v-${Date.now()}`,
    name: store_name,
    slug: store_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    rating: 5.0,
    delivery_time_mins: '10-15 mins',
    verified: false,
    distance_km: 1.0,
    location: `${area || 'Kathmandu'}, ${city}`,
    image: '/src/assets/images/vendor_bakery_dairy_1794407355670.jpg',
    tags: [category || 'Local Mart', 'New Merchant']
  };

  VENDORS.push(newVendor);

  // Asynchronously insert into Cloud SQL vendors table
  try {
    await db.insert(vendors).values({
      slug: newVendor.slug,
      name: newVendor.name,
      rating: '5.0',
      ratingCount: 1,
      eta: newVendor.delivery_time_mins,
      distance: `${newVendor.distance_km} km`,
      address: newVendor.location,
      image: newVendor.image,
      cuisine: category || 'Local Mart',
      isFeatured: false,
    }).onConflictDoNothing();
  } catch (sqlErr) {
    console.error('Failed to sync vendor to Cloud SQL:', sqlErr);
  }

  res.status(201).json({
    success: true,
    message: 'Application received! Our neighborhood merchant onboarding manager will visit your store within 24 hours.',
    vendor: newVendor
  });
});

// 4. Products listing with search, filters, ordering, pagination
app.get('/api/v1/products/', (req, res) => {
  let list = [...PRODUCTS];

  const category = req.query.category as string;
  if (category) {
    list = list.filter(p => p.category.slug === category || p.category.id === category);
  }

  const vendor = req.query.vendor as string;
  if (vendor) {
    list = list.filter(p => p.vendor.id === vendor);
  }

  const section = req.query.section as string;
  if (section) {
    list = list.filter(p => p.sections.includes(section));
  }

  const search = (req.query.search as string || '').toLowerCase().trim();
  if (search) {
    list = list.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.category.name.toLowerCase().includes(search) ||
      p.vendor.name.toLowerCase().includes(search) ||
      p.origin.toLowerCase().includes(search)
    );
  }

  const minPrice = parseFloat(req.query.min_price as string);
  if (!isNaN(minPrice)) {
    list = list.filter(p => p.discounted_price >= minPrice);
  }

  const maxPrice = parseFloat(req.query.max_price as string);
  if (!isNaN(maxPrice)) {
    list = list.filter(p => p.discounted_price <= maxPrice);
  }

  const inStock = req.query.in_stock as string;
  if (inStock === 'true') {
    list = list.filter(p => p.in_stock && p.stock > 0);
  }

  const ordering = req.query.ordering as string;
  if (ordering === 'price_asc') {
    list.sort((a, b) => a.discounted_price - b.discounted_price);
  } else if (ordering === 'price_desc') {
    list.sort((a, b) => b.discounted_price - a.discounted_price);
  } else if (ordering === 'rating') {
    list.sort((a, b) => b.rating - a.rating);
  } else if (ordering === 'discount') {
    list.sort((a, b) => b.discount_percentage - a.discount_percentage);
  }

  const page = parseInt(req.query.page as string || '1', 10);
  const pageSize = parseInt(req.query.page_size as string || '12', 10);

  res.json(drfPaginate(list, page, pageSize, req));
});

// Autocomplete suggestions
app.get('/api/v1/products/autocomplete/', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  if (!query) {
    return res.json({ suggestions: [], popular_categories: CATEGORIES.slice(0, 4) });
  }

  const matchedProducts = PRODUCTS.filter(p => p.name.toLowerCase().includes(query)).slice(0, 5).map(p => ({
    id: p.id,
    name: p.name,
    category: p.category.name,
    price: p.discounted_price,
    image_url: p.image_url,
    unit: p.unit
  }));

  const matchedCategories = CATEGORIES.filter(c => c.name.toLowerCase().includes(query)).slice(0, 3).map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug
  }));

  res.json({
    suggestions: matchedProducts,
    categories: matchedCategories
  });
});

// Single Product detail
app.get('/api/v1/products/:id/', (req, res) => {
  const prod = PRODUCTS.find(p => p.id === req.params.id || p.slug === req.params.id);
  if (!prod) {
    return res.status(404).json({ detail: 'Not found.' });
  }
  res.json(prod);
});

// Similar products
app.get('/api/v1/products/:id/similar/', (req, res) => {
  const prod = PRODUCTS.find(p => p.id === req.params.id || p.slug === req.params.id);
  if (!prod) {
    return res.json({ count: 0, results: [] });
  }
  const similar = PRODUCTS.filter(p => p.id !== prod.id && (p.category.slug === prod.category.slug || p.vendor.id === prod.vendor.id)).slice(0, 4);
  res.json({
    count: similar.length,
    results: similar
  });
});

// Helper: Calculate Cart Summary with Multi-Vendor Logic
function calculateCartPayload() {
  // Group by vendor
  const vendorGroupsMap: Record<string, { vendor: { id: string; name: string }; items: CartItem[]; subtotal: number; delivery_fee: number }> = {};

  let subtotal = 0;
  for (const item of CART_ITEMS) {
    subtotal += item.total_price;
    const vendorId = item.product.vendor.id;
    if (!vendorGroupsMap[vendorId]) {
      vendorGroupsMap[vendorId] = {
        vendor: { id: item.product.vendor.id, name: item.product.vendor.name },
        items: [],
        subtotal: 0,
        delivery_fee: 0
      };
    }
    vendorGroupsMap[vendorId].items.push(item);
    vendorGroupsMap[vendorId].subtotal += item.total_price;
  }

  // Delivery rules: If subtotal across cart >= 499, all delivery free. Else 35 per vendor.
  let totalDelivery = 0;
  const vendorGroups = Object.values(vendorGroupsMap).map(vg => {
    const fee = vg.subtotal >= 400 || subtotal >= 499 ? 0 : 35;
    vg.delivery_fee = fee;
    totalDelivery += fee;
    return vg;
  });

  const handlingFee = CART_ITEMS.length > 0 ? 15 : 0;
  let couponDiscount = 0;
  if (APPLIED_COUPON) {
    couponDiscount = APPLIED_COUPON.discount_amount;
  }

  const finalTotal = Math.max(0, subtotal + totalDelivery + handlingFee - couponDiscount);

  return {
    items: CART_ITEMS,
    item_count: CART_ITEMS.reduce((sum, item) => sum + item.quantity, 0),
    vendor_groups: vendorGroups,
    subtotal,
    delivery_fee: totalDelivery,
    free_delivery_threshold: 499,
    amount_needed_for_free_delivery: Math.max(0, 499 - subtotal),
    handling_fee: handlingFee,
    coupon: APPLIED_COUPON,
    total: finalTotal
  };
}

// 5. Cart Endpoints
app.get('/api/v1/cart/', (req, res) => {
  res.json(calculateCartPayload());
});

app.post('/api/v1/cart/items/', (req, res) => {
  const { product_id, quantity = 1, variant_id } = req.body;
  const product = PRODUCTS.find(p => p.id === product_id);
  if (!product) {
    return res.status(404).json({ detail: 'Product not found.' });
  }

  if (!product.in_stock || product.stock < 1) {
    return res.status(400).json({ detail: 'Product is currently out of stock.' });
  }

  const existingIndex = CART_ITEMS.findIndex(ci => ci.product_id === product_id && ci.selected_variant_id === variant_id);

  let unitPrice = product.discounted_price;
  if (variant_id && product.variants) {
    const v = product.variants.find(item => item.id === variant_id);
    if (v) unitPrice = v.price;
  }

  if (existingIndex > -1) {
    CART_ITEMS[existingIndex].quantity += quantity;
    CART_ITEMS[existingIndex].total_price = CART_ITEMS[existingIndex].quantity * unitPrice;
  } else {
    CART_ITEMS.push({
      id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      product_id: product.id,
      product,
      quantity,
      selected_variant_id: variant_id,
      unit_price: unitPrice,
      total_price: unitPrice * quantity
    });
  }

  res.status(201).json(calculateCartPayload());
});

app.put('/api/v1/cart/items/:id/', (req, res) => {
  const { quantity } = req.body;
  const itemIndex = CART_ITEMS.findIndex(ci => ci.id === req.params.id || ci.product_id === req.params.id);
  if (itemIndex === -1) {
    return res.status(404).json({ detail: 'Cart item not found.' });
  }

  if (quantity <= 0) {
    CART_ITEMS.splice(itemIndex, 1);
  } else {
    CART_ITEMS[itemIndex].quantity = quantity;
    CART_ITEMS[itemIndex].total_price = CART_ITEMS[itemIndex].quantity * CART_ITEMS[itemIndex].unit_price;
  }

  res.json(calculateCartPayload());
});

app.delete('/api/v1/cart/items/:id/', (req, res) => {
  const itemIndex = CART_ITEMS.findIndex(ci => ci.id === req.params.id || ci.product_id === req.params.id);
  if (itemIndex > -1) {
    CART_ITEMS.splice(itemIndex, 1);
  }
  res.json(calculateCartPayload());
});

app.delete('/api/v1/cart/clear/', (req, res) => {
  CART_ITEMS = [];
  APPLIED_COUPON = null;
  res.json(calculateCartPayload());
});

// 6. Coupons
app.post('/api/v1/coupons/apply/', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ detail: 'Coupon code is required.' });
  }

  const subtotal = CART_ITEMS.reduce((sum, item) => sum + item.total_price, 0);
  const normalized = code.trim().toUpperCase();

  if (normalized === 'OYOFRESH20') {
    if (subtotal < 300) {
      return res.status(400).json({ detail: 'Min cart total of Rs. 300 required for OYOFRESH20.' });
    }
    const discount = Math.min(150, Math.round(subtotal * 0.20));
    APPLIED_COUPON = { code: 'OYOFRESH20', discount_amount: discount, description: '20% discount up to Rs. 150' };
    return res.json({ success: true, coupon: APPLIED_COUPON, cart: calculateCartPayload() });
  }

  if (normalized === 'WELCOME50') {
    if (subtotal < 250) {
      return res.status(400).json({ detail: 'Min cart total of Rs. 250 required for WELCOME50.' });
    }
    APPLIED_COUPON = { code: 'WELCOME50', discount_amount: 50, description: 'Flat Rs. 50 OFF on first order' };
    return res.json({ success: true, coupon: APPLIED_COUPON, cart: calculateCartPayload() });
  }

  if (normalized === 'FREEDELIVERY') {
    const payload = calculateCartPayload();
    APPLIED_COUPON = { code: 'FREEDELIVERY', discount_amount: payload.delivery_fee, description: 'Delivery fee waiver' };
    return res.json({ success: true, coupon: APPLIED_COUPON, cart: calculateCartPayload() });
  }

  return res.status(400).json({ detail: 'Invalid or expired coupon code. Try OYOFRESH20 or WELCOME50.' });
});

app.delete('/api/v1/coupons/remove/', (req, res) => {
  APPLIED_COUPON = null;
  res.json({ success: true, cart: calculateCartPayload() });
});

// 7. Checkout & Orders (Backend price & stock validation enforcement)
app.post('/api/v1/checkout/validate/', (req, res) => {
  // Validate prices, stock and compute authoritative checkout bill
  if (CART_ITEMS.length === 0) {
    return res.status(400).json({ detail: 'Your cart is empty.' });
  }

  for (const item of CART_ITEMS) {
    const freshProduct = PRODUCTS.find(p => p.id === item.product_id);
    if (!freshProduct || !freshProduct.in_stock || freshProduct.stock < item.quantity) {
      return res.status(400).json({ detail: `Item ${item.product.name} is currently out of stock.` });
    }
  }

  res.json({
    valid: true,
    authoritative_cart: calculateCartPayload()
  });
});

app.post('/api/v1/orders/', async (req, res) => {
  const { address_id, payment_method = 'CASH_ON_DELIVERY', delivery_option = 'EXPRESS_12_MINS', notes = '' } = req.body;

  if (CART_ITEMS.length === 0) {
    return res.status(400).json({ detail: 'Cannot place order with empty cart.' });
  }

  const selectedAddress = SAVED_ADDRESSES.find(a => a.id === address_id) || SAVED_ADDRESSES[0];
  const cartSummary = calculateCartPayload();

  const orderNum = `OP-${Math.floor(10000 + Math.random() * 90000)}`;
  const orderId = `ord-${Date.now()}`;

  const newOrder: Order = {
    id: orderId,
    order_number: orderNum,
    created_at: new Date().toISOString(),
    status: 'ORDER_PLACED',
    estimated_delivery_mins: 12,
    delivery_address: selectedAddress,
    delivery_option,
    payment_method,
    payment_status: payment_method === 'CASH_ON_DELIVERY' ? 'PENDING' : 'PAID',
    items_by_vendor: cartSummary.vendor_groups.map(vg => ({
      vendor: vg.vendor,
      vendor_delivery_fee: vg.delivery_fee,
      items: vg.items.map(i => ({
        product_name: i.product.name,
        unit: i.product.unit,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.total_price,
        image_url: i.product.image_url
      }))
    })),
    subtotal: cartSummary.subtotal,
    delivery_fee: cartSummary.delivery_fee,
    handling_fee: cartSummary.handling_fee,
    coupon_discount: cartSummary.coupon ? cartSummary.coupon.discount_amount : 0,
    total_amount: cartSummary.total,
    tracking_updates: [
      { timestamp: 'Just now', title: 'Order Confirmed', description: 'Your order was verified and broadcast to neighborhood fulfilment centers', done: true },
      { timestamp: 'In ~3 mins', title: 'Packaging by Local Vendors', description: 'Sellers packaging your items with freshness seals', done: false },
      { timestamp: 'In ~7 mins', title: 'Rider Pickup & Dispatch', description: 'Fast EV delivery rider on the way', done: false },
      { timestamp: 'In ~12 mins', title: 'Arriving at Your Door', description: 'Contactless handover at your address', done: false }
    ]
  };

  ORDERS.unshift(newOrder);

  // Asynchronously persist order into Cloud SQL PostgreSQL database
  try {
    const insertedOrders = await db.insert(orders).values({
      orderNumber: orderNum,
      status: 'placed',
      totalAmount: cartSummary.total,
      subtotal: cartSummary.subtotal,
      deliveryFee: cartSummary.delivery_fee,
      discount: cartSummary.coupon ? cartSummary.coupon.discount_amount : 0,
      deliveryAddress: `${selectedAddress.street}, ${selectedAddress.area}, ${selectedAddress.city}`,
      recipientName: selectedAddress.recipient_name,
      recipientPhone: selectedAddress.phone,
      paymentMethod: payment_method,
      paymentStatus: payment_method === 'CASH_ON_DELIVERY' ? 'pending' : 'paid',
      vendorName: cartSummary.vendor_groups.map(vg => vg.vendor.name).join(', ') || 'OyoPasal Express',
      estimatedMinutes: 12,
    }).returning();

    if (insertedOrders.length > 0) {
      const sqlOrderId = insertedOrders[0].id;
      for (const item of CART_ITEMS) {
        await db.insert(orderItems).values({
          orderId: sqlOrderId,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          image: item.product.image_url,
          unit: item.product.unit,
        });
      }
    }
  } catch (sqlErr) {
    console.error('Failed to persist order to Cloud SQL:', sqlErr);
  }

  // Clear cart on successful order
  CART_ITEMS = [];
  APPLIED_COUPON = null;

  res.status(201).json(newOrder);
});

// Orders List & Detail
app.get('/api/v1/orders/', (req, res) => {
  res.json({
    count: ORDERS.length,
    next: null,
    previous: null,
    results: ORDERS
  });
});

app.get('/api/v1/orders/:id/', (req, res) => {
  const order = ORDERS.find(o => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) {
    return res.status(404).json({ detail: 'Order not found.' });
  }
  res.json(order);
});

app.post('/api/v1/orders/:id/cancel/', (req, res) => {
  const order = ORDERS.find(o => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) {
    return res.status(404).json({ detail: 'Order not found.' });
  }
  if (order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED') {
    return res.status(400).json({ detail: 'Order has already left the fulfilment hub and cannot be cancelled.' });
  }
  order.status = 'CANCELLED';
  order.tracking_updates.push({
    timestamp: 'Just now',
    title: 'Order Cancelled',
    description: 'Order cancelled upon customer request. Refund initiated if prepaid.',
    done: true
  });
  res.json(order);
});

// 8. User Auth & Profile
app.get('/api/v1/auth/user/', (req, res) => {
  res.json(CURRENT_USER);
});

app.post('/api/v1/auth/login/', (req, res) => {
  const { phone_or_email, password } = req.body;
  if (!phone_or_email) {
    return res.status(400).json({ detail: 'Phone or email is required.' });
  }
  res.json({
    token: CURRENT_USER.token,
    user: CURRENT_USER
  });
});

app.put('/api/v1/auth/user/', (req, res) => {
  const { full_name, email, phone } = req.body;
  if (full_name) CURRENT_USER.full_name = full_name;
  if (email) CURRENT_USER.email = email;
  if (phone) CURRENT_USER.phone = phone;
  res.json(CURRENT_USER);
});

// Seller Auth & Portal Endpoints
app.post('/api/v1/auth/seller/login/', (req, res) => {
  const { identifier, password, vendor_id } = req.body;

  let selectedVendor = VENDORS[0];
  if (vendor_id) {
    const found = VENDORS.find(v => v.id === vendor_id || v.slug === vendor_id);
    if (found) selectedVendor = found;
  } else if (identifier) {
    const found = VENDORS.find(v => 
      v.name.toLowerCase().includes(identifier.toLowerCase()) || 
      v.slug.includes(identifier.toLowerCase())
    );
    if (found) selectedVendor = found;
  }

  const sellerPayload = {
    token: `drf-seller-${selectedVendor.id}-${Date.now()}`,
    vendor: {
      ...selectedVendor,
      status: 'ONLINE',
      today_orders: 42,
      today_revenue: 16850,
      pending_dispatch: 3,
      active_products_count: PRODUCTS.filter(p => p.vendor.id === selectedVendor.id).length
    }
  };

  res.json(sellerPayload);
});

app.get('/api/v1/seller/dashboard/', (req, res) => {
  const vendorId = (req.query.vendor_id as string) || VENDORS[0].id;
  const vendor = VENDORS.find(v => v.id === vendorId) || VENDORS[0];
  const vendorProducts = PRODUCTS.filter(p => p.vendor.id === vendor.id);

  res.json({
    vendor,
    status: 'ONLINE',
    stats: {
      today_orders: 42,
      today_revenue: 16850,
      avg_packing_time: '4.2 mins',
      rider_rating: 4.9,
      pending_orders_count: 2
    },
    pending_orders: [
      {
        order_number: 'OP-92144',
        items: ['Organic Hass Avocados (2 pcs)', 'Fresh Mountain Broccoli (1 pc)'],
        customer_area: 'New Baneshwor',
        created_at: '3 mins ago',
        status: 'READY_FOR_RIDER_PICKUP',
        rider: 'Kiran Thapa (Arriving in 2 mins)'
      },
      {
        order_number: 'OP-92150',
        items: ['Hydroponic Sweet Cherry Tomatoes (250g)'],
        customer_area: 'Patan',
        created_at: 'Just now',
        status: 'PACKING_IN_PROGRESS',
        rider: 'Assigning nearest EV rider'
      }
    ],
    products: vendorProducts
  });
});

// 9. Addresses
app.get('/api/v1/account/addresses/', (req, res) => {
  res.json({
    count: SAVED_ADDRESSES.length,
    results: SAVED_ADDRESSES
  });
});

app.post('/api/v1/account/addresses/', (req, res) => {
  const { title = 'Home', recipient_name, phone, street, area, city = 'Kathmandu', landmark = '', is_default = false } = req.body;
  const newAddr: Address = {
    id: `addr-${Date.now()}`,
    title,
    recipient_name: recipient_name || CURRENT_USER.full_name,
    phone: phone || CURRENT_USER.phone,
    street,
    area,
    city,
    landmark,
    is_default
  };
  if (is_default) {
    SAVED_ADDRESSES.forEach(a => { a.is_default = false; });
  }
  SAVED_ADDRESSES.push(newAddr);
  res.status(201).json(newAddr);
});

// 10. Wishlist
app.get('/api/v1/wishlist/', (req, res) => {
  const items = PRODUCTS.filter(p => WISHLIST_IDS.includes(p.id));
  res.json({
    count: items.length,
    results: items
  });
});

app.post('/api/v1/wishlist/toggle/', (req, res) => {
  const { product_id } = req.body;
  if (!product_id) {
    return res.status(400).json({ detail: 'product_id is required' });
  }
  const index = WISHLIST_IDS.indexOf(product_id);
  let isWishlisted = false;
  if (index > -1) {
    WISHLIST_IDS.splice(index, 1);
    isWishlisted = false;
  } else {
    WISHLIST_IDS.push(product_id);
    isWishlisted = true;
  }
  res.json({
    product_id,
    is_wishlisted: isWishlisted,
    wishlist_ids: WISHLIST_IDS
  });
});

// 11. Notifications
app.get('/api/v1/notifications/', (req, res) => {
  res.json({
    count: NOTIFICATIONS.length,
    results: NOTIFICATIONS
  });
});

// 12. Gemini AI Chatbot with Google Maps Grounding (Quick-Commerce Concierge)
app.post('/api/v1/chat/', async (req, res) => {
  try {
    const { messages, userLocation } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Convert messages history to Gemini contents format
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const lat = userLocation?.latitude || 27.7172;
    const lng = userLocation?.longitude || 85.3240;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: `You are the OyoPasal Concierge, an expert quick-commerce shopping & grocery assistant for OyoPasal in Nepal (delivering fresh produce, dairy, bakery, snacks, and daily essentials across Kathmandu, Lalitpur, and Bhaktapur in 10-15 minutes).
Your responsibilities:
1. Help customers find and select fresh groceries, fruits, vegetables, artisan sourdough, mountain dairy, spices, and beverages.
2. Suggest recipes and grocery lists based on requested meals (e.g. Nepali Dal Bhat, Momos, Thukpa, Fresh Salads, Avocado Toast, Sandwiches).
3. Recommend top-rated neighborhood stores (Himalayan Fresh Farms, Patan Artisan Bakery & Dairy, Everest Organic Pantry, Green Valley Hydroponics).
4. Use Google Maps grounding to locate neighborhood markets, stores, delivery hubs, and verify areas in Kathmandu Valley.
5. Answer questions on express delivery (10-15 minutes), payment methods (Cash on Delivery, Fonepay/eSewa/Khalti, Card), and active coupons (OYOFRESH20 for 20% off, WELCOME50 for Rs. 50 off, FREEDELIVERY).
Be warm, concise, helpful, and format responses cleanly with markdown bullet points and emojis. When mentioning locations or places, leverage Google Maps.`,
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng,
            }
          }
        }
      }
    });

    const reply = response.text || '';
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    res.json({
      reply,
      groundingChunks
    });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate response.',
      reply: "Hello! I am having a brief moment connecting to our grocery catalog. Here are some quick things you can explore:\n- **Fresh Farm Produce**: Organic spinach, hill avocados, ripe tomatoes\n- **Artisan Bakery**: Butter croissants, whole wheat sourdough\n- **Deals**: Use coupon **OYOFRESH20** for 20% off your order!"
    });
  }
});

// 13. Firebase Auth User Synchronization to Cloud SQL PostgreSQL
app.post('/api/v1/auth/firebase-login/', async (req, res) => {
  const { id_token, full_name, phone } = req.body;
  if (!id_token) {
    return res.status(400).json({ error: 'id_token is required' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(id_token);
    const uid = decoded.uid;
    const email = decoded.email || `${uid}@oyopasal.np`;
    const name = full_name || decoded.name || email.split('@')[0];

    const dbUser = await getOrCreateUser(uid, email, name);

    CURRENT_USER.id = `usr-${dbUser.id}`;
    CURRENT_USER.full_name = dbUser.fullName || name;
    CURRENT_USER.email = dbUser.email;
    if (phone) CURRENT_USER.phone = phone;

    res.json({
      success: true,
      token: id_token,
      user: {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        full_name: dbUser.fullName,
        phone: dbUser.phone || CURRENT_USER.phone,
        role: dbUser.role
      }
    });
  } catch (error: any) {
    console.error('Firebase Auth sync error:', error);
    res.status(401).json({ error: 'Invalid Firebase ID token' });
  }
});

// 14. Cloud SQL Database Status & Health
app.get('/api/v1/db/status/', async (req, res) => {
  try {
    const dbVendors = await db.select().from(vendors);
    const dbProducts = await db.select().from(products);
    const dbOrders = await db.select().from(orders);
    const dbUsers = await db.select().from(users);

    res.json({
      status: 'connected',
      database: process.env.SQL_DB_NAME || 'cloudsql',
      engine: 'PostgreSQL (Cloud SQL)',
      counts: {
        vendors: dbVendors.length,
        products: dbProducts.length,
        orders: dbOrders.length,
        users: dbUsers.length,
      }
    });
  } catch (error: any) {
    res.json({
      status: 'disconnected',
      error: error.message || 'Database error',
    });
  }
});

// Seed initial products and vendors into Cloud SQL PostgreSQL if empty
async function seedInitialDatabase() {
  try {
    const existingVendors = await db.select().from(vendors);
    if (existingVendors.length === 0) {
      console.log('Seeding initial vendors into Cloud SQL PostgreSQL...');
      for (const v of VENDORS) {
        await db.insert(vendors).values({
          slug: v.slug,
          name: v.name,
          rating: String(v.rating),
          ratingCount: 150,
          eta: v.delivery_time_mins,
          distance: `${v.distance_km} km`,
          address: v.location,
          image: v.image,
          cuisine: v.tags.join(', '),
          isFeatured: true,
        }).onConflictDoNothing();
      }

      console.log('Seeding initial products into Cloud SQL PostgreSQL...');
      for (const p of PRODUCTS) {
        await db.insert(products).values({
          slug: p.slug,
          name: p.name,
          category: p.category.name,
          subCategory: p.category.slug,
          price: p.discounted_price,
          originalPrice: p.original_price,
          discountPercent: p.discount_percentage,
          unit: p.unit,
          inStock: p.in_stock,
          stockCount: p.stock,
          rating: String(p.rating),
          ratingCount: p.reviews_count,
          image: p.image_url,
          description: p.description,
          vendorName: p.vendor.name,
          isBestSeller: p.sections.includes('best_sellers'),
          isTrending: p.sections.includes('trending'),
          isFresh: p.sections.includes('fresh_arrivals'),
          isDeal: p.sections.includes('top_deals'),
        }).onConflictDoNothing();
      }
      console.log('Cloud SQL PostgreSQL seeded successfully!');
    }
  } catch (err) {
    console.warn('Initial DB seeding skipped or deferred:', err);
  }
}

// Vite middleware in dev or static files in production
async function startServer() {
  await seedInitialDatabase();

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OyoPasal Quick-Commerce Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
