import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('OYOPASAL – Footer Contact Information & Product Carousel Enhancement Suite', () => {
  const rootDir = process.cwd();
  const homePagePath = path.join(rootDir, 'src', 'pages', 'home', 'HomePage.tsx');
  const productSectionPath = path.join(rootDir, 'src', 'components', 'common', 'ProductSection.tsx');
  const backendViewsPath = path.join(rootDir, 'backend', 'apps', 'common', 'views.py');

  it('1. Verifies Footer Official Support Contact Details in HomePage.tsx', () => {
    assert.ok(fs.existsSync(homePagePath), 'HomePage.tsx must exist');
    const content = fs.readFileSync(homePagePath, 'utf8');

    // Official Support Details
    assert.ok(
      content.includes('tel:+9779818638565'),
      'Footer must have clickable phone link with tel:+9779818638565'
    );
    assert.ok(
      content.includes('+977 9818638565'),
      'Footer must display official helpline number +977 9818638565'
    );
    assert.ok(
      content.includes('mailto:oyopasal@gmail.com'),
      'Footer must have clickable email link with mailto:oyopasal@gmail.com'
    );
    assert.ok(
      content.includes('oyopasal@gmail.com'),
      'Footer must display official helpdesk email oyopasal@gmail.com'
    );

    // Matching Icons
    assert.ok(content.includes('Phone'), 'Must import and render Phone icon');
    assert.ok(content.includes('Mail'), 'Must import and render Mail icon');
  });

  it('2. Verifies backend platform support defaults in PublicSettingsView', () => {
    assert.ok(fs.existsSync(backendViewsPath), 'backend/apps/common/views.py must exist');
    const content = fs.readFileSync(backendViewsPath, 'utf8');

    assert.ok(
      content.includes("'email': 'oyopasal@gmail.com'"),
      "PublicSettingsView store_support must default email to 'oyopasal@gmail.com'"
    );
    assert.ok(
      content.includes("'phone': '+977 9818638565'"),
      "PublicSettingsView store_support must default phone to '+977 9818638565'"
    );
  });

  it('3. Verifies ProductSection.tsx horizontal carousel track and responsive controls', () => {
    assert.ok(fs.existsSync(productSectionPath), 'ProductSection.tsx must exist');
    const content = fs.readFileSync(productSectionPath, 'utf8');

    // Horizontal sliding classes
    assert.ok(
      content.includes('overflow-x-auto'),
      'Carousel container must enable horizontal overflow scrolling'
    );
    assert.ok(
      content.includes('no-scrollbar'),
      'Carousel container must hide default scrollbars with no-scrollbar utility'
    );
    assert.ok(
      content.includes('scroll-smooth'),
      'Carousel container must enable smooth scrolling'
    );
    assert.ok(
      content.includes('snap-x snap-mandatory'),
      'Carousel container must support CSS scroll snapping for neat card alignment'
    );

    // Card sizing and snapping
    assert.ok(
      content.includes('shrink-0 snap-start flex flex-col'),
      'Carousel items must be shrink-0 snap-start with consistent height'
    );

    // Desktop navigation arrows
    assert.ok(
      content.includes('ChevronLeft') && content.includes('ChevronRight'),
      'Must import and use ChevronLeft and ChevronRight navigation arrows'
    );
    assert.ok(
      content.includes('canScrollLeft') && content.includes('canScrollRight'),
      'Must track scrollability state to disable or hide navigation arrows at boundaries'
    );
    assert.ok(
      content.includes("handleScroll('left')") && content.includes("handleScroll('right')"),
      'Must provide left and right navigation handlers'
    );

    // Loading skeleton and card integration
    assert.ok(
      content.includes('<ProductCard product={product} />'),
      'Must render existing ProductCard with all interactive capabilities'
    );
  });

  it('4. Verifies Popular Nearby Vendors horizontal slidable gesture and controls on HomePage.tsx', () => {
    assert.ok(fs.existsSync(homePagePath), 'HomePage.tsx must exist');
    const content = fs.readFileSync(homePagePath, 'utf8');

    // Vendor carousel container
    assert.ok(
      content.includes('ref={vendorScrollRef}'),
      'Vendors row must be attached to vendorScrollRef for programmatic scrolling'
    );
    assert.ok(
      content.includes('group/vendor-carousel'),
      'Vendors section must use relative carousel wrapper'
    );

    // Gestures and snapping classes
    assert.ok(
      content.includes('overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory'),
      'Vendors row must have horizontal overflow, no scrollbar, smooth scroll, and snap-x snap-mandatory'
    );

    // Vendor card responsive width and snapping
    assert.ok(
      content.includes('w-[260px] sm:w-[280px] md:w-[300px] lg:w-[320px] shrink-0 snap-start'),
      'Vendor cards must have consistent horizontal width, shrink-0, and snap-start'
    );

    // Navigation arrows and state
    assert.ok(
      content.includes('canVendorScrollLeft') && content.includes('canVendorScrollRight'),
      'Must track scrollability state for vendor carousel'
    );
    assert.ok(
      content.includes("handleVendorScroll('left')") && content.includes("handleVendorScroll('right')"),
      'Must provide left and right scroll handlers for vendor carousel'
    );

    // Preservation of actions
    assert.ok(
      content.includes("navigate(`/stores/${vendor.slug || vendor.id}`)"),
      'Vendor cards must navigate to store detail page on click'
    );
    assert.ok(
      content.includes('setVendorMapOpen(true)'),
      'Must preserve Explore Maps action button'
    );
  });
});
