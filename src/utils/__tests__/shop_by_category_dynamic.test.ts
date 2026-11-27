import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getCategoryIcon } from '../categoryIcons';
import { resolveCategoryImageUrl } from '../categoryImage';
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

test('Shop by Category 3: ShopByCategorySection component implements Popular Categories square-tile layout', () => {
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

  // 2. Responsive Square-Tile Grid & Header Layout
  assert.ok(
    componentContent.includes('grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3.5'),
    'Component must use responsive 3 to 10 column grid (grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3.5)'
  );
  assert.ok(
    componentContent.includes('Popular Categories'),
    'Component must render bold Popular Categories title'
  );
  assert.ok(
    componentContent.includes('Explore All Categories'),
    'Component must render Explore All Categories link'
  );
  assert.ok(
    componentContent.includes('text-[#059669]'),
    'Explore link must use emerald accent styling'
  );

  // 3. Compact Square Image Tile & Centered Title
  assert.ok(
    componentContent.includes('aspect-square rounded-2xl bg-[#F3F4F6]'),
    'Tile must have aspect-square rounded-2xl bg-[#F3F4F6] styling'
  );
  assert.ok(
    componentContent.includes('object-contain'),
    'Tile image must use object-contain to display full cluster image'
  );
  assert.ok(
    componentContent.includes('group flex flex-col items-center text-center cursor-pointer'),
    'Each category item must use group flex flex-col items-center text-center'
  );
  assert.ok(
    componentContent.includes('mt-2 text-xs sm:text-[13px] font-semibold'),
    'Category title must use centered mt-2 text-xs sm:text-[13px] font-semibold'
  );

  // 4. Negative Constraints: No badges, dark overlays or arrow circles
  assert.equal(
    componentContent.includes('bg-gradient-to-t from-black/85'),
    false,
    'Component must not render dark overlay gradients'
  );
  assert.equal(
    componentContent.includes('backdrop-blur-md border border-white/15'),
    false,
    'Component must not render frosted item-count badges over images'
  );
  assert.equal(
    componentContent.includes('Explore →'),
    false,
    'Component must not render arrow action buttons over images'
  );

  // 5. Navigation & Click Handlers
  assert.ok(
    componentContent.includes('to="/categories"'),
    'Explore All link must navigate to /categories'
  );
  assert.ok(
    componentContent.includes('/category/'),
    'Tile click must navigate to category detail'
  );

  // 6. Loading, Empty, and Error States
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

test('Shop by Category 5: resolveCategoryImageUrl handles field priority, objects, relative URLs and CDNs', () => {
  // 1. Priority: image_url > imageUrl > image
  const catPriority1 = {
    image_url: 'https://images.unsplash.com/photo-p1',
    imageUrl: 'https://images.unsplash.com/photo-p2',
    image: 'https://images.unsplash.com/photo-p3',
  };
  assert.equal(resolveCategoryImageUrl(catPriority1), 'https://images.unsplash.com/photo-p1');

  // 2. Fallback to imageUrl if image_url is null or empty
  const catPriority2 = {
    image_url: '',
    imageUrl: 'https://images.unsplash.com/photo-p2',
    image: 'https://images.unsplash.com/photo-p3',
  };
  assert.equal(resolveCategoryImageUrl(catPriority2), 'https://images.unsplash.com/photo-p2');

  // 3. Fallback to image if image_url and imageUrl are null/empty
  const catPriority3 = {
    image_url: null,
    imageUrl: '   ',
    image: 'https://images.unsplash.com/photo-p3',
  };
  assert.equal(resolveCategoryImageUrl(catPriority3), 'https://images.unsplash.com/photo-p3');

  // 4. Object representation with url, src, file, or path
  const catObjUrl = { image: { url: 'https://ik.imagekit.io/oyopasal/cat.jpg' } };
  assert.equal(resolveCategoryImageUrl(catObjUrl), 'https://ik.imagekit.io/oyopasal/cat.jpg');

  const catObjSrc = { imageUrl: { src: 'https://res.cloudinary.com/oyopasal/cat.png' } };
  assert.equal(resolveCategoryImageUrl(catObjSrc), 'https://res.cloudinary.com/oyopasal/cat.png');

  // 5. Null, undefined, empty string, whitespace return null
  assert.equal(resolveCategoryImageUrl(null), null);
  assert.equal(resolveCategoryImageUrl(undefined), null);
  assert.equal(resolveCategoryImageUrl({ image_url: '', imageUrl: null, image: '  ' }), null);

  // 6. Relative Django media path normalization
  const catRelative = { image_url: '/media/categories/fruits.jpg' };
  assert.ok(resolveCategoryImageUrl(catRelative)?.endsWith('/media/categories/fruits.jpg'));

  const catRelativeNoSlash = { image_url: 'media/categories/bakery.jpg' };
  assert.ok(resolveCategoryImageUrl(catRelativeNoSlash)?.endsWith('/media/categories/bakery.jpg'));

  // 7. Protocol-relative URL
  const catProtocolRel = { image_url: '//images.unsplash.com/cat-proto.jpg' };
  assert.equal(resolveCategoryImageUrl(catProtocolRel), 'https://images.unsplash.com/cat-proto.jpg');
});

test('Shop by Category 6: ShopByCategorySection renders standard <img> with object-contain and neutral placeholder switching', () => {
  const componentContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/home/ShopByCategorySection.tsx'),
    'utf-8'
  );

  // Checks required img classes: w-full h-full object-contain group-hover:scale-105 transition-transform duration-200
  assert.ok(
    componentContent.includes('object-contain group-hover:scale-105 transition-transform duration-200'),
    'Image must have object-contain group-hover:scale-105 transition-transform duration-200'
  );
  assert.ok(
    componentContent.includes('loading="lazy"'),
    'Image must include loading="lazy"'
  );
  assert.ok(
    componentContent.includes('resolveCategoryImageUrl(cat)'),
    'Component must use resolveCategoryImageUrl helper'
  );
  assert.ok(
    componentContent.includes('setFailedImages'),
    'onError handler must record failed attempts to switch to neutral placeholder'
  );
  assert.ok(
    componentContent.includes('<Package'),
    'Component must render neutral Package placeholder icon when image is missing or broken'
  );
});

test('Shop by Category 10: Category images use exclusively Django backend data without hardcoded slug dictionaries', () => {
  const fallbacksPath = path.resolve(process.cwd(), 'src/utils/categoryFallbacks.ts');
  assert.equal(
    fs.existsSync(fallbacksPath),
    false,
    'categoryFallbacks.ts must be completely removed from the frontend'
  );

  const shopByCategoryContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/home/ShopByCategorySection.tsx'),
    'utf-8'
  );
  assert.equal(
    shopByCategoryContent.includes('getCuratedCategoryFallback'),
    false,
    'ShopByCategorySection must not import or use getCuratedCategoryFallback'
  );
});

test('Shop by Category 7: Frontend contains zero hardcoded category demo Unsplash IDs', () => {
  const shopByCategoryContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/home/ShopByCategorySection.tsx'),
    'utf-8'
  );
  const categoryPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/categories/CategoryPage.tsx'),
    'utf-8'
  );

  // Checks that 1587049352847-4a222e784d38 is NOT present
  assert.equal(
    shopByCategoryContent.includes('1587049352847-4a222e784d38'),
    false,
    'ShopByCategorySection must not contain demo Unsplash ID 1587049352847-4a222e784d38'
  );
  assert.equal(
    categoryPageContent.includes('1587049352847-4a222e784d38'),
    false,
    'CategoryPage must not contain demo Unsplash ID 1587049352847-4a222e784d38'
  );

  // Checks that no hardcoded fallback Unsplash URLs exist in ShopByCategorySection
  assert.equal(
    shopByCategoryContent.includes('images.unsplash.com'),
    false,
    'ShopByCategorySection must not hardcode external Unsplash image URLs'
  );
});

test('Shop by Category 8: Empty state displays clean empty UI without inserting fake categories', () => {
  const componentContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/home/ShopByCategorySection.tsx'),
    'utf-8'
  );

  assert.ok(
    componentContent.includes('No categories found'),
    'Component must render clean empty state text'
  );
  assert.ok(
    componentContent.includes('Active categories will appear here once configured.'),
    'Component must render informative empty state subtitle'
  );
  // Ensure no fallback default category array is injected
  assert.equal(
    componentContent.includes('DEMO_CATEGORIES') || componentContent.includes('DEFAULT_CATEGORIES'),
    false,
    'Component must not inject fallback demo category arrays'
  );
});

test('Shop by Category 9: cover_image priority is respected in resolveCategoryImageUrl', () => {
  const catWithCover = {
    image_url: null,
    imageUrl: '',
    image: null,
    cover_image: 'https://images.example.com/cover.webp',
  };
  assert.equal(
    resolveCategoryImageUrl(catWithCover),
    'https://images.example.com/cover.webp',
    'resolveCategoryImageUrl must resolve cover_image when higher priority fields are null/empty'
  );
});
