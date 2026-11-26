import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getCategoryIcon } from '../categoryIcons';
import { BookOpen, PenTool, Palette, Zap, Apple, Milk, Shirt, Home, Package } from 'lucide-react';

test('Shop by Category 1: getCategoryIcon maps distinct icons for each category', () => {
  // Books -> BookOpen
  assert.equal(getCategoryIcon({ name: 'Books', slug: 'books' }), BookOpen);
  assert.equal(getCategoryIcon({ name: 'School Textbooks', slug: 'textbooks' }), BookOpen);

  // Stationary -> PenTool
  assert.equal(getCategoryIcon({ name: 'Stationary', slug: 'stationary' }), PenTool);
  assert.equal(getCategoryIcon({ name: 'Office Stationery', slug: 'office-stationery' }), PenTool);

  // Handicrafts & Art -> Palette
  assert.equal(getCategoryIcon({ name: 'Handicrafts & Art', slug: 'handicrafts-art' }), Palette);
  assert.equal(getCategoryIcon({ name: 'Nepalese Crafts', slug: 'nepalese-crafts' }), Palette);

  // Consumer Electronics -> Zap
  assert.equal(getCategoryIcon({ name: 'Consumer Electronics', slug: 'consumer-electronics' }), Zap);
  assert.equal(getCategoryIcon({ name: 'Tech & Gadgets', slug: 'tech-gadgets' }), Zap);

  // Additional categories
  assert.equal(getCategoryIcon({ name: 'Fresh Fruits', slug: 'fruits-vegetables' }), Apple);
  assert.equal(getCategoryIcon({ name: 'Dairy & Milk', slug: 'dairy-bakery' }), Milk);
  assert.equal(getCategoryIcon({ name: 'Apparel', slug: 'fashion-apparel' }), Shirt);
  assert.equal(getCategoryIcon({ name: 'Home Essentials', slug: 'home-kitchen' }), Home);

  // Fallback
  assert.equal(getCategoryIcon({ name: 'Miscellaneous', slug: 'misc' }), Package);
});

test('Shop by Category 2: Backend CategoryTreeSerializer computes live product count and distinct icons', () => {
  const serializerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'backend/apps/catalogue/serializers.py'),
    'utf-8'
  );

  // Checks that serializer defines product_count and item_count dynamically
  assert.ok(
    serializerContent.includes('product_count = serializers.SerializerMethodField()'),
    'Serializer must define product_count method field'
  );
  assert.ok(
    serializerContent.includes('def get_product_count(self, obj):'),
    'Serializer must implement dynamic get_product_count'
  );
  assert.ok(
    serializerContent.includes('Product.objects.filter'),
    'Serializer must query live Product objects for count'
  );

  // Checks that serializer does not return hardcoded 12 items
  assert.equal(
    serializerContent.includes('return getattr(obj, \'product_count\', 12)'),
    false,
    'Serializer must not hardcode 12 items'
  );

  // Checks icon mapping in serializer
  assert.ok(serializerContent.includes("'books': 'BookOpen'"));
  assert.ok(serializerContent.includes("'stationary': 'PenTool'"));
  assert.ok(serializerContent.includes("'consumer-electronics': 'Zap'"));
});

test('Shop by Category 3: ShopByCategorySection component implements dynamic API fetching, grid, and navigation', () => {
  const componentContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/home/ShopByCategorySection.tsx'),
    'utf-8'
  );

  // 1. Dynamic API fetching
  assert.ok(
    componentContent.includes('categoryService.getCategories'),
    'Component must query category API service'
  );
  assert.ok(
    componentContent.includes("categories:updated"),
    'Component must listen for category update events'
  );

  // 2. Responsive Multi-Column Grid
  assert.ok(
    componentContent.includes('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5'),
    'Component must use responsive multi-column grid handling >4 categories'
  );

  // 3. Dynamic Card Content
  assert.ok(
    componentContent.includes('getCategoryIcon(cat)'),
    'Component must use dynamic icon mapping'
  );
  assert.ok(
    componentContent.includes('cat.image_url'),
    'Component must support uploaded category thumbnails'
  );
  assert.ok(
    componentContent.includes('#00875A'),
    'Component must style item counts with emerald green (#00875A)'
  );
  assert.ok(
    componentContent.includes('formatItemCount'),
    'Component must format dynamic item counts'
  );

  // 4. Navigation & Click Handlers
  assert.ok(
    componentContent.includes('to="/categories"'),
    'All categories link must navigate to /categories'
  );
  assert.ok(
    componentContent.includes('/category/'),
    'Card click must navigate to category detail'
  );

  // 5. Loading, Empty, and Error States
  assert.ok(
    componentContent.includes('cat-skeleton-'),
    'Component must render skeleton cards while loading'
  );
  assert.ok(
    componentContent.includes('animate-pulse'),
    'Skeleton cards must have animate-pulse styling'
  );
  assert.ok(
    componentContent.includes('No categories found'),
    'Component must render graceful empty state'
  );
  assert.ok(
    componentContent.includes('Try Again'),
    'Component must render retry action on error'
  );
});

test('Shop by Category 4: HomePage cleanly mounts ShopByCategorySection', () => {
  const homeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/home/HomePage.tsx'),
    'utf-8'
  );

  assert.ok(
    homeContent.includes('<ShopByCategorySection'),
    'HomePage must render ShopByCategorySection'
  );
});
