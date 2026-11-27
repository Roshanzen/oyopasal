import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('OYOPASAL – Site-Wide Shared Customer Layout & Footer Suite', () => {
  const rootDir = process.cwd();
  const footerPath = path.join(rootDir, 'src', 'components', 'layout', 'Footer.tsx');
  const customerLayoutPath = path.join(rootDir, 'src', 'components', 'layout', 'CustomerLayout.tsx');
  const appPath = path.join(rootDir, 'src', 'App.tsx');
  const homePagePath = path.join(rootDir, 'src', 'pages', 'home', 'HomePage.tsx');
  const appRoutesPath = path.join(rootDir, 'src', 'routes', 'AppRoutes.tsx');

  it('1. Verifies standalone Footer.tsx exists and renders official support and legal links', () => {
    assert.ok(fs.existsSync(footerPath), 'Footer.tsx must exist');
    const content = fs.readFileSync(footerPath, 'utf8');

    // Official support phone & email
    assert.ok(content.includes('tel:+9779818638565'), 'Must have clickable phone link with tel:+9779818638565');
    assert.ok(content.includes('+977 9818638565'), 'Must display +977 9818638565');
    assert.ok(content.includes('mailto:oyopasal@gmail.com'), 'Must have clickable email link with mailto:oyopasal@gmail.com');
    assert.ok(content.includes('oyopasal@gmail.com'), 'Must display oyopasal@gmail.com');

    // Matching icons
    assert.ok(content.includes('Phone'), 'Must import and render Phone icon');
    assert.ok(content.includes('Mail'), 'Must import and render Mail icon');
    assert.ok(content.includes('Clock'), 'Must import and render Clock icon');

    // Customer navigation & legal links
    assert.ok(content.includes('to="/account?tab=orders"'), 'Must link to orders');
    assert.ok(content.includes('to="/account?tab=addresses"'), 'Must link to addresses');
    assert.ok(content.includes('to="/privacy-policy"'), 'Must link to Customer Privacy Policy');
    assert.ok(content.includes('to="/vendor/privacy-policy"'), 'Must link to Vendor Privacy Policy');

    // Layout classes: mt-auto and responsive mobile padding
    assert.ok(content.includes('mt-auto'), 'Footer must use mt-auto to anchor to bottom on short pages');
    assert.ok(content.includes('border-t'), 'Footer must have top border');
  });

  it('2. Verifies CustomerLayout.tsx provides a shared flex layout with min-h-screen', () => {
    assert.ok(fs.existsSync(customerLayoutPath), 'CustomerLayout.tsx must exist');
    const content = fs.readFileSync(customerLayoutPath, 'utf8');

    // Core layout structure
    assert.ok(content.includes('min-h-screen'), 'Layout must have min-h-screen');
    assert.ok(content.includes('flex flex-col'), 'Layout must use flex flex-col');
    assert.ok(content.includes('<Header />') || content.includes('<Header'), 'Layout must render Header');
    assert.ok(content.includes('<CategoryBar'), 'Layout must render CategoryBar');
    assert.ok(content.includes('<main className="flex-1'), 'Layout must use flex-1 for main content area');
    assert.ok(content.includes('<Footer />') || content.includes('<Footer'), 'Layout must render Footer');
    assert.ok(content.includes('<MobileBottomNav />') || content.includes('<MobileBottomNav'), 'Layout must render MobileBottomNav');
    assert.ok(content.includes('<ChatConcierge />') || content.includes('<ChatConcierge'), 'Layout must render ChatConcierge');
  });

  it('3. Verifies App.tsx renders Footer on customer pages and isolates portal routes', () => {
    assert.ok(fs.existsSync(appPath), 'App.tsx must exist');
    const content = fs.readFileSync(appPath, 'utf8');

    // Imports Footer
    assert.ok(content.includes("import Footer from './components/layout/Footer'"), 'App.tsx must import Footer');

    // Portal route definitions
    assert.ok(content.includes("location.pathname.startsWith('/seller')"), 'Must guard seller portal');
    assert.ok(content.includes("location.pathname.startsWith('/admin')"), 'Must guard admin portal');
    assert.ok(content.includes("location.pathname.startsWith('/rider')"), 'Must guard rider portal');

    // Policy routes allowed
    assert.ok(content.includes('/privacy-policy'), 'Must recognize privacy policy route');
    assert.ok(content.includes('/vendor/privacy-policy'), 'Must recognize vendor privacy policy route');

    // Footer conditionally mounted
    assert.ok(
      content.includes('<Footer />'),
      'Footer must be mounted in App.tsx'
    );
    assert.ok(
      content.includes('!isPortalRoute'),
      'Footer must be guarded by !isPortalRoute'
    );
  });

  it('4. Verifies HomePage.tsx does NOT render duplicate <footer element', () => {
    assert.ok(fs.existsSync(homePagePath), 'HomePage.tsx must exist');
    const content = fs.readFileSync(homePagePath, 'utf8');

    // Must NOT contain literal <footer tag in JSX
    assert.ok(!content.includes('<footer className='), 'HomePage must not render a duplicate <footer className= tag');
  });

  it('5. Verifies all customer routes in AppRoutes.tsx receive customer shell layout', () => {
    assert.ok(fs.existsSync(appRoutesPath), 'AppRoutes.tsx must exist');
    const content = fs.readFileSync(appRoutesPath, 'utf8');

    const customerRoutes = [
      'path="/"',
      'path="/product/:id"',
      'path="/stores/:slug"',
      'path="/outlets/:slug"',
      'path="/categories"',
      'path="/category/:slug"',
      'path="/search"',
      'path="/checkout"',
      'path="/orders/:id"',
      'path="/account"',
      'path="/privacy-policy"',
      'path="/vendor/privacy-policy"',
    ];

    for (const route of customerRoutes) {
      assert.ok(content.includes(route), `AppRoutes must register customer route: ${route}`);
    }
  });
});
