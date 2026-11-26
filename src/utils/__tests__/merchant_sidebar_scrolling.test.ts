import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Merchant Dashboard Sidebar 1: Desktop aside implements independent scrolling & sticky isolation', () => {
  const sellerPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/SellerPortalPage.tsx'),
    'utf-8'
  );

  // Desktop aside sticky and independent scroll container
  assert.ok(sellerPageContent.includes('<aside'), 'Must render desktop <aside>');
  assert.ok(
    sellerPageContent.includes('sticky'),
    'Sidebar must have position: sticky'
  );
  assert.ok(
    sellerPageContent.includes('h-[calc(100vh-64px)]') || sellerPageContent.includes('100vh'),
    'Sidebar must occupy viewport height accounting for header'
  );
  assert.ok(
    sellerPageContent.includes('overflow-y-auto'),
    'Sidebar must apply vertical overflow scrolling (overflow-y-auto)'
  );
  assert.ok(
    sellerPageContent.includes('overflow-x-hidden'),
    'Sidebar must strictly disallow horizontal overflow (overflow-x-hidden)'
  );
  assert.ok(
    sellerPageContent.includes('scroll-smooth'),
    'Sidebar must apply smooth scrolling behavior'
  );
  assert.ok(
    sellerPageContent.includes('overscroll-y-contain') || sellerPageContent.includes('overscroll-contain'),
    'Sidebar must isolate scroll chaining using overscroll-contain so main content never moves'
  );
  assert.ok(
    sellerPageContent.includes('sidebar-scrollbar'),
    'Sidebar must apply custom unobtrusive scrollbar'
  );
});

test('Merchant Dashboard Sidebar 2: Minimal unobtrusive scrollbar styling in globals.css', () => {
  const cssContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/styles/globals.css'),
    'utf-8'
  );

  assert.ok(cssContent.includes('.sidebar-scrollbar'), 'Must declare .sidebar-scrollbar class');
  assert.ok(cssContent.includes('scrollbar-width: thin'), 'Must declare thin scrollbar for standard browsers');
  assert.ok(cssContent.includes('scrollbar-color: #D1D5DB transparent'), 'Must declare #D1D5DB thumb with transparent track');
  assert.ok(cssContent.includes('width: 5px'), 'Must declare 5px width (within 4-6px spec)');
  assert.ok(cssContent.includes('background-color: #D1D5DB'), 'Must set thumb background color to #D1D5DB');
  assert.ok(cssContent.includes('border-radius: 9999px'), 'Must have rounded thumb edges');
  assert.ok(cssContent.includes('#9CA3AF'), 'Must have #9CA3AF thumb hover state');
  assert.ok(cssContent.includes('scroll-behavior: smooth'), 'Must specify smooth scroll behavior in CSS');
});

test('Merchant Dashboard Sidebar 3: Preserves Rahul Pasal Superstore vendor profile card and Market navigation', () => {
  const sellerPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/SellerPortalPage.tsx'),
    'utf-8'
  );

  // Vendor profile card
  assert.ok(sellerPageContent.includes('{storeFirstLetter}'), 'Must display store initial avatar');
  assert.ok(sellerPageContent.includes('{effectiveVendor.name}'), 'Must display store name');
  assert.ok(sellerPageContent.includes('Verified Vendor'), 'Must display verified vendor badge');
  assert.ok(sellerPageContent.includes('Store Online'), 'Must display store online status indicator');

  // Customer Shopping / Market button
  assert.ok(sellerPageContent.includes('Customer Shopping'), 'Must preserve Customer Shopping link');
  assert.ok(sellerPageContent.includes('Market'), 'Must preserve MARKET badge');
});

test('Merchant Dashboard Sidebar 4: Preserves all 9 navigation items, active highlighting & badges', () => {
  const sellerPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/SellerPortalPage.tsx'),
    'utf-8'
  );

  // All 9 menu tabs
  assert.ok(sellerPageContent.includes("'analytics'"), 'Must include Visual Summary & Charts');
  assert.ok(sellerPageContent.includes('Visual Summary'), 'Must label Visual Summary');
  assert.ok(sellerPageContent.includes("'add'"), 'Must include Add New Product tab id');
  assert.ok(sellerPageContent.includes('Add New Product'), 'Must label Add New Product');
  assert.ok(sellerPageContent.includes("'products'"), 'Must include Catalog & Inventory');
  assert.ok(sellerPageContent.includes("'orders'"), 'Must include Live Dispatch Orders');
  assert.ok(sellerPageContent.includes("'messages'"), 'Must include Messages');
  assert.ok(sellerPageContent.includes("'reviews'"), 'Must include Reviews');
  assert.ok(sellerPageContent.includes("'profile'"), 'Must include Store Profile Setup');
  assert.ok(sellerPageContent.includes("'ledger'"), 'Must include Inventory Ledger');
  assert.ok(sellerPageContent.includes("'settings'"), 'Must include Payouts & Settings');

  // Active state styling
  assert.ok(sellerPageContent.includes('bg-[#059669]'), 'Must apply active highlight background');
  assert.ok(sellerPageContent.includes('text-white'), 'Must apply white text to active tab');
});

test('Merchant Dashboard Sidebar 5: Preserves bottom quick actions and enables scrolling on small screens', () => {
  const sellerPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/SellerPortalPage.tsx'),
    'utf-8'
  );

  // Bottom action buttons
  assert.ok(sellerPageContent.includes('customerStoreUrl'), 'Must preserve View Customer Store link');
  assert.ok(sellerPageContent.includes('handleSync'), 'Must preserve Sync button and handler');
  assert.ok(sellerPageContent.includes('s.logoutSeller()'), 'Must preserve Sign Out button and handler');

  // Inner container expansion for small screen scrollability
  assert.ok(sellerPageContent.includes('min-h-full'), 'Must use min-h-full so bottom items are reachable on scroll');
});

test('Merchant Dashboard Sidebar 6: Preserves mobile slide-over drawer independent scrolling', () => {
  const sellerPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/SellerPortalPage.tsx'),
    'utf-8'
  );

  assert.ok(sellerPageContent.includes('mobileNavOpen'), 'Must retain mobile drawer state');
  assert.ok(sellerPageContent.includes('flex-1 overflow-y-auto'), 'Mobile drawer must retain overflow-y-auto');
  assert.ok(sellerPageContent.includes('sidebar-scrollbar'), 'Mobile drawer must use sidebar-scrollbar');
});
