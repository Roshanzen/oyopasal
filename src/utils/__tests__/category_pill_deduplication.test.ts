import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('OYOPASAL – Category Pill Deduplication & Integrity Suite', () => {
  const rootDir = process.cwd();
  const categoryBarPath = path.join(rootDir, 'src', 'components', 'common', 'CategoryBar.tsx');
  const shopByCategoryPath = path.join(rootDir, 'src', 'components', 'home', 'ShopByCategorySection.tsx');
  const categoryModelPath = path.join(rootDir, 'backend', 'apps', 'catalogue', 'models.py');
  const categoryViewsPath = path.join(rootDir, 'backend', 'apps', 'catalogue', 'views.py');
  const categorySerializerPath = path.join(rootDir, 'backend', 'apps', 'catalogue', 'serializers.py');
  const cleanupCommandPath = path.join(
    rootDir,
    'backend',
    'apps',
    'catalogue',
    'management',
    'commands',
    'cleanup_duplicate_categories.py'
  );

  it('1. Verifies CategoryBar.tsx implements dynamic case-insensitive & trimmed name deduplication', () => {
    assert.ok(fs.existsSync(categoryBarPath), 'CategoryBar.tsx must exist');
    const content = fs.readFileSync(categoryBarPath, 'utf8');

    // Must use trim().toLowerCase() normalization
    assert.ok(
      content.includes('.trim().toLowerCase()'),
      'CategoryBar must normalize category names using trim().toLowerCase()'
    );

    // Must retain first occurrence and use displayCategories in render loop
    assert.ok(
      content.includes('displayCategories') || content.includes('uniqueCategories'),
      'CategoryBar must compute deduplicated categories'
    );
    assert.ok(
      content.includes('displayCategories.map') || content.includes('(displayCategories || []).map'),
      'CategoryBar must render the deduplicated categories list'
    );

    // Must handle missing or non-string names safely
    assert.ok(
      content.includes("typeof cat.name === 'string'") || content.includes('cat.name ||'),
      'CategoryBar must safely guard against missing or non-string category names'
    );

    // Dynamic solution (no hardcoded 'Groceries' filter)
    assert.ok(
      !content.includes("cat.name !== 'Groceries'") && !content.includes("cat.slug !== 'groceries'"),
      'CategoryBar must not hardcode exclusion of Groceries'
    );
  });

  it('2. Pure logic test: Category deduplication algorithm retains original objects and discards duplicates', () => {
    interface MockCategory {
      id: string;
      name: string;
      slug: string;
      icon: string;
    }

    const mockApiResponse: MockCategory[] = [
      { id: '1', name: 'Groceries', slug: 'groceries', icon: 'Package' },
      { id: '2', name: 'groceries', slug: 'groceries-dup1', icon: 'Package' },
      { id: '3', name: '  GROCERIES  ', slug: 'groceries-dup2', icon: 'Package' },
      { id: '4', name: 'Consumer Electronics', slug: 'consumer-electronics', icon: 'Zap' },
      { id: '5', name: 'consumer electronics', slug: 'consumer-electronics-dup', icon: 'Zap' },
      { id: '6', name: 'Handicrafts & Art', slug: 'handicrafts-art', icon: 'Palette' },
    ];

    // Replicate the deduplication algorithm
    const seenNames = new Set<string>();
    const deduplicated: MockCategory[] = [];

    for (const cat of mockApiResponse) {
      if (!cat) continue;
      const rawName = typeof cat.name === 'string' ? cat.name : '';
      const normalized = rawName.trim().toLowerCase();

      if (normalized) {
        if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          deduplicated.push(cat);
        }
      } else if (cat.id) {
        deduplicated.push(cat);
      }
    }

    // Assertions
    assert.strictEqual(deduplicated.length, 3, 'Should reduce 6 categories with duplicates to exactly 3 unique');
    assert.strictEqual(deduplicated[0].id, '1', 'Must retain the first Groceries category');
    assert.strictEqual(deduplicated[0].slug, 'groceries', 'Must preserve original slug');
    assert.strictEqual(deduplicated[1].id, '4', 'Must retain Consumer Electronics');
    assert.strictEqual(deduplicated[2].id, '6', 'Must retain Handicrafts & Art');
  });

  it('3. Verifies Backend Category model enforces case-insensitive top-level uniqueness constraint', () => {
    assert.ok(fs.existsSync(categoryModelPath), 'Category models.py must exist');
    const content = fs.readFileSync(categoryModelPath, 'utf8');

    // UniqueConstraint on Lower('name') where parent is null
    assert.ok(
      content.includes('UniqueConstraint') && content.includes('Lower') && content.includes('parent__isnull'),
      'Category model Meta must define UniqueConstraint on Lower(name) where parent__isnull=True'
    );

    // Application-level clean() / save() validation
    assert.ok(
      content.includes('name__iexact') && content.includes('parent__isnull=True'),
      'Category model clean/save must check name__iexact for top-level categories'
    );
  });

  it('4. Verifies Backend PublicCategoryListView filters active top-level categories and ensures distinct results', () => {
    assert.ok(fs.existsSync(categoryViewsPath), 'Category views.py must exist');
    const content = fs.readFileSync(categoryViewsPath, 'utf8');

    assert.ok(
      content.includes('parent__isnull=True') && content.includes('is_active=True'),
      'PublicCategoryListView must query parent__isnull=True and is_active=True'
    );
    assert.ok(
      content.includes('.distinct()'),
      'PublicCategoryListView must apply distinct() to prevent duplicate rows from joins'
    );
  });

  it('5. Verifies CategoryCreateSerializer validates case-insensitive top-level name uniqueness', () => {
    assert.ok(fs.existsSync(categorySerializerPath), 'Category serializers.py must exist');
    const content = fs.readFileSync(categorySerializerPath, 'utf8');

    assert.ok(
      content.includes('name__iexact') && content.includes('parent__isnull=True'),
      'CategoryCreateSerializer must validate name__iexact for root categories'
    );
  });

  it('6. Verifies Django management command cleanup_duplicate_categories exists and handles foreign-key reassignments', () => {
    assert.ok(fs.existsSync(cleanupCommandPath), 'cleanup_duplicate_categories.py must exist');
    const content = fs.readFileSync(cleanupCommandPath, 'utf8');

    assert.ok(
      content.includes('.trim().toLowerCase()') || content.includes('.strip().lower()'),
      'Command must group categories by normalized name'
    );
    assert.ok(
      content.includes('Product.objects.filter(category=dup).update(category=primary)'),
      'Command must reassign dependent products to primary category'
    );
    assert.ok(
      content.includes('Category.objects.filter(parent=dup).update(parent=primary)'),
      'Command must reassign child subcategories to primary category'
    );
    assert.ok(
      content.includes('dup.hard_delete()') || content.includes('Category.all_objects.filter(id=dup.id).delete()'),
      'Command must delete duplicate category records'
    );
  });
});
