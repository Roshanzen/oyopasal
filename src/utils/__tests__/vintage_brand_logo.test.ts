import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Vintage Brand Logo 1: Left Wordmark Stack has OYO crest plaque with #1B4332 and #C5A869 borders', () => {
  const brandLogoContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/common/BrandLogo.tsx'),
    'utf-8'
  );

  // Deep forest-emerald green #1B4332 plaque
  assert.ok(
    brandLogoContent.includes('#1B4332'),
    'Brand logo must use deep forest-emerald green #1B4332'
  );
  // Antique gold #C5A869 border & filigree
  assert.ok(
    brandLogoContent.includes('#C5A869'),
    'Plaque must use antique gold #C5A869'
  );
  // Cream-ivory #F5EEDB or gradient
  assert.ok(
    brandLogoContent.includes('#F5EEDB') || brandLogoContent.includes('#F7F1E1'),
    'Plaque must use cream-ivory lettering fill'
  );
  // OYO lettering
  assert.ok(brandLogoContent.includes('OYO'), 'Plaque must contain bold OYO lettering');
  // Plaque ornamental filigree flourishes
  assert.ok(brandLogoContent.includes('plaqueShadow'), 'Plaque must implement dimensional drop shadow');
});

test('Vintage Brand Logo 2: Bottom Title displays Pasal. in vintage display script with swash and inner highlight', () => {
  const brandLogoContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/common/BrandLogo.tsx'),
    'utf-8'
  );

  // Pasal. title text
  assert.ok(brandLogoContent.includes('Pasal.'), 'Wordmark must include Pasal. display title');
  // Capital P decorative swash
  assert.ok(brandLogoContent.includes('swash') || brandLogoContent.includes('SWASH'), 'Must document or implement swash on capital P');
  // Matching emerald period
  assert.ok(brandLogoContent.includes('PERIOD') || brandLogoContent.includes('period'), 'Must include decorative vintage period');
});

test('Vintage Brand Logo 3: Right Emblem is an ornate vintage compass location pin with ribbon loop', () => {
  const brandLogoContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/common/BrandLogo.tsx'),
    'utf-8'
  );

  // VintageCompassPin component export
  assert.ok(brandLogoContent.includes('VintageCompassPin'), 'Must export VintageCompassPin component');
  // Antique brass/gold and deep forest emerald
  assert.ok(brandLogoContent.includes('vintageGoldBezel'), 'Must define antique brass/gold bezel gradient');
  assert.ok(brandLogoContent.includes('vintageEmeraldRibbon'), 'Must define deep emerald ribbon gradient');
  // Compass rose dial & needle points
  assert.ok(brandLogoContent.includes('compassDialBg'), 'Must include circular compass rose dial');
  assert.ok(brandLogoContent.includes('Needle') || brandLogoContent.includes('needle'), 'Must include compass rose needles');
  // Intertwined ribbon / figure-8 loop
  assert.ok(brandLogoContent.includes('Ribbon') || brandLogoContent.includes('ribbon') || brandLogoContent.includes('INFINITY'), 'Must include intertwined ribbon loop');
});

test('Vintage Brand Logo 4: Compact Header Variant integrates cleanly inside navigation bar', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Header.tsx'),
    'utf-8'
  );

  // Integrates BrandLogo in Header.tsx
  assert.ok(headerContent.includes('BrandLogo'), 'Header must import and render BrandLogo');
  assert.ok(headerContent.includes('variant="header"'), 'Header must use compact header variant');
  assert.ok(headerContent.includes('height={48}'), 'Header must specify compact height (44px-52px)');
  // Backward compatibility tokens remain intact
  assert.ok(headerContent.includes('OYO'), 'Must preserve OYO text token');
  assert.ok(headerContent.includes('Pasal'), 'Must preserve Pasal text token');
  assert.ok(headerContent.includes('oyoPin3d'), 'Must preserve oyoPin3d gradient token');
  assert.ok(headerContent.includes('oyoGlossHighlight'), 'Must preserve oyoGlossHighlight gradient token');
});

test('Vintage Brand Logo 5: Display Hero Variant implements warm parchment #F7F1E1, filigree & serif links', () => {
  const brandLogoContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/common/BrandLogo.tsx'),
    'utf-8'
  );

  // Warm parchment cream background #F7F1E1
  assert.ok(brandLogoContent.includes('#F7F1E1'), 'Hero variant must feature warm parchment cream #F7F1E1');
  // Subtle vintage corner botanical filigree accents
  assert.ok(brandLogoContent.includes('Filigree') || brandLogoContent.includes('filigree'), 'Hero variant must include corner botanical filigree accents');
  // Top-right vintage serif navigation links: Home • Explore • Locations • About Us • Contact
  assert.ok(brandLogoContent.includes('Home'), 'Hero nav must include Home');
  assert.ok(brandLogoContent.includes('Explore'), 'Hero nav must include Explore');
  assert.ok(brandLogoContent.includes('Locations'), 'Hero nav must include Locations');
  assert.ok(brandLogoContent.includes('About Us'), 'Hero nav must include About Us');
  assert.ok(brandLogoContent.includes('Contact'), 'Hero nav must include Contact');
});
