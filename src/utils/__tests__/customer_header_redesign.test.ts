import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Customer Header Redesign 1: Brand logo features 3D-inspired pin and OYO / Pasal. wordmark', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Header.tsx'),
    'utf-8'
  );

  // 3D location pin with #00875A emerald gradient and glossy highlight
  assert.ok(headerContent.includes('#00875A'), 'Must use primary emerald #00875A');
  assert.ok(headerContent.includes('oyoPin3d'), 'Must include 3D pin gradient');
  assert.ok(headerContent.includes('oyoGlossHighlight'), 'Must include glossy highlight');

  // Wordmark: OYO in badge, Pasal. with green accent dot
  assert.ok(headerContent.includes('OYO'));
  assert.ok(headerContent.includes('Pasal'));
  assert.ok(headerContent.includes('bg-[#00875A]'));
});

test('Customer Header Redesign 2: Delivery Location Selector matches #F0F7F4 rounded spec', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Header.tsx'),
    'utf-8'
  );

  assert.ok(headerContent.includes('#F0F7F4'), 'Must use #F0F7F4 background');
  assert.ok(headerContent.includes('rounded-[12px]'), 'Must use 12px border radius');
  assert.ok(headerContent.includes('DELIVERING TO'), 'Must include DELIVERING TO uppercase label');
  assert.ok(headerContent.includes('Select Location'), 'Must include Select Location fallback label');
  assert.ok(headerContent.includes('setLocationModalOpen(true)'), 'Must preserve location modal trigger');
});

test('Customer Header Redesign 3: Central Search Bar has #F3F4F6, placeholder, and ⌘K badge', () => {
  const searchBarContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/header/HeaderSearchBar.tsx'),
    'utf-8'
  );

  assert.ok(searchBarContent.includes('#F3F4F6'), 'Search container must use #F3F4F6 surface');
  assert.ok(searchBarContent.includes('rounded-[12px]'), 'Search container must use 12px border radius');
  assert.ok(
    searchBarContent.includes('Search fresh veggies, tech accessories, books...'),
    'Must use exact requested placeholder'
  );
  assert.ok(searchBarContent.includes('⌘'), 'Must include ⌘K shortcut badge');
  assert.ok(
    searchBarContent.includes('metaKey') && searchBarContent.includes('ctrlKey'),
    'Must support both Cmd+K and Ctrl+K keyboard shortcuts'
  );
});

test('Customer Header Redesign 4: Announcement bar is removed so header sits flush at top', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Header.tsx'),
    'utf-8'
  );

  // Assert AnnouncementBar is completely removed from Header.tsx
  assert.equal(headerContent.includes('<AnnouncementBar'), false, 'Header must not render AnnouncementBar');
  assert.equal(headerContent.includes("import AnnouncementBar"), false, 'Header must not import AnnouncementBar');
});

test('Customer Header Redesign 5: BECOME A Seller pill is positioned between search and action icons', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Header.tsx'),
    'utf-8'
  );

  assert.ok(headerContent.includes('#ECFDF5'), 'Must use #ECFDF5 mint background');
  assert.ok(headerContent.includes('#D1FAE5'), 'Must use #D1FAE5 circular icon container');
  assert.ok(headerContent.includes('rounded-full'), 'Must use rounded-full pill layout');
  assert.ok(headerContent.includes('BECOME A'), 'Must include BECOME A uppercase text');
  assert.ok(headerContent.includes('Seller'), 'Must include Seller text');
  assert.ok(headerContent.includes('/become-seller'), 'Must link to /become-seller route');

  // Verify order in JSX: SearchBar comes before Become a Seller, which comes before Action Icons
  const searchIndex = headerContent.indexOf('<HeaderSearchBar');
  const sellerIndex = headerContent.indexOf('to="/become-seller"');
  const actionIconsIndex = headerContent.indexOf('to="/account?tab=wishlist"');

  assert.ok(searchIndex < sellerIndex, 'Search bar must precede Become a Seller');
  assert.ok(sellerIndex < actionIconsIndex, 'Become a Seller must precede action icons');
});

test('Customer Header Redesign 6: Seller registration forms include Login as a Seller option', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/BecomeSellerModal.tsx'),
    'utf-8'
  );
  const pageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/BecomeSellerPage.tsx'),
    'utf-8'
  );

  // Assert modal has Login as a Seller
  assert.ok(modalContent.includes('Already have a seller account?'));
  assert.ok(modalContent.includes('Login as a Seller'));
  assert.ok(modalContent.includes("navigate('/seller')"));

  // Assert standalone page has Login as a Seller
  assert.ok(pageContent.includes('Already have a seller account?'));
  assert.ok(pageContent.includes('Login as a Seller'));
  assert.ok(pageContent.includes('to="/seller"'));
});

test('Customer Header Redesign 7: Right-side action icons feature Wishlist, User Profile, and Cart', () => {
  const headerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/Header.tsx'),
    'utf-8'
  );
  const userDropdownContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/header/UserMenuDropdown.tsx'),
    'utf-8'
  );

  // Wishlist button: #F3F4F6 12px rounded with Heart icon and link to wishlist
  assert.ok(headerContent.includes('to="/account?tab=wishlist"'), 'Must link to wishlist in account');
  assert.ok(headerContent.includes('<Heart'), 'Must render Heart icon for wishlist');
  assert.ok(headerContent.includes('wishlistIds.length'), 'Must dynamically bind wishlist count');
  assert.ok(headerContent.includes('bg-[#F3F4F6]'));
  assert.ok(headerContent.includes('rounded-[12px]'));

  // User Profile button: matching #F3F4F6 12px rounded with User icon
  assert.ok(userDropdownContent.includes('bg-[#F3F4F6]'));
  assert.ok(userDropdownContent.includes('rounded-[12px]'));
  assert.ok(headerContent.includes('setLoginModalOpen(true)'), 'Must preserve login modal trigger for guest users');

  // Shopping Cart button: solid #00875A rounded-square container with #FACC15 badge
  assert.ok(headerContent.includes('bg-[#00875A]'));
  assert.ok(headerContent.includes('#FACC15'), 'Must use yellow #FACC15 badge');
  assert.ok(headerContent.includes('totalItems'), 'Must dynamically bind cart item count');
  assert.ok(headerContent.includes('setCartDrawerOpen(true)'), 'Must trigger cart drawer on click');
});
