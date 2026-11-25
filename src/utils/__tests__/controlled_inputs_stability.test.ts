import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Controlled Inputs 1: RiderPortalPage GPS coords fallback draft & safe controlled inputs', () => {
  const content = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/admin/RiderPortalPage.tsx'),
    'utf-8'
  );

  assert.equal(content.includes('const defaultDraft = {'), true);
  assert.equal(content.includes('const draft = { ...defaultDraft, ...(gpsCoords[a.id] || {}) };'), true);
  assert.equal(content.includes('value={draft.lat ?? \'\'}'), true);
  assert.equal(content.includes('value={draft.lng ?? \'\'}'), true);
  assert.equal(content.includes('value={draft.speed ?? \'\'}'), true);
  assert.equal(content.includes('value={draft.eta ?? \'\'}'), true);
});

test('Controlled Inputs 2: StoreProfileSetupTab normalizes nullable API fields and prevents null in input value', () => {
  const content = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/seller/StoreProfileSetupTab.tsx'),
    'utf-8'
  );

  assert.equal(content.includes("setStoreName(data.store_name ?? '');"), true);
  assert.equal(content.includes("setShortDescription(data.short_description ?? '');"), true);
  assert.equal(content.includes("value={storeName ?? ''}"), true);
  assert.equal(content.includes("value={shortDescription ?? ''}"), true);
  assert.equal(content.includes("value={areaWard ?? ''}"), true);
  assert.equal(content.includes("value={openingTime ?? '09:00'}"), true);
  assert.equal(content.includes("value={closingTime ?? '21:00'}"), true);
});

test('Controlled Inputs 3: SellerSettingsTab protects operating hours and description', () => {
  const content = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/seller/SellerSettingsTab.tsx'),
    'utf-8'
  );

  assert.equal(content.includes("value={openTime ?? ''}"), true);
  assert.equal(content.includes("value={closeTime ?? ''}"), true);
  assert.equal(content.includes("value={storeEta ?? ''}"), true);
  assert.equal(content.includes("value={storeDesc ?? ''}"), true);
});

test('Controlled Inputs 4: SellerAddProductTab & SellerVariantsModal prevent uncontrolled matrix & pricing inputs', () => {
  const addProductContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/seller/SellerAddProductTab.tsx'),
    'utf-8'
  );
  const variantsModalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/seller/SellerVariantsModal.tsx'),
    'utf-8'
  );

  assert.equal(addProductContent.includes("value={productName ?? ''}"), true);
  assert.equal(addProductContent.includes("value={discountedPrice ?? ''}"), true);
  assert.equal(addProductContent.includes("value={originalPrice ?? ''}"), true);
  assert.equal(addProductContent.includes("value={stockCount ?? ''}"), true);
  assert.equal(addProductContent.includes("checked={Boolean(hasVariants)}"), true);
  assert.equal(addProductContent.includes("checked={Boolean(isOrganic)}"), true);
  assert.equal(addProductContent.includes("value={row.price ?? ''}"), true);
  assert.equal(addProductContent.includes("value={row.stock ?? ''}"), true);

  assert.equal(variantsModalContent.includes("value={row.price ?? ''}"), true);
  assert.equal(variantsModalContent.includes("value={row.stock ?? ''}"), true);
  assert.equal(variantsModalContent.includes("value={customColorCode ?? '#000000'}"), true);
  assert.equal(variantsModalContent.includes("value={customSizeInput ?? ''}"), true);
});

test('Controlled Inputs 5: LocationModal and CheckoutPage handle missing address and coupon states safely', () => {
  const locationContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );
  const checkoutContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/checkout/CheckoutPage.tsx'),
    'utf-8'
  );

  assert.equal(locationContent.includes("value={recipientName ?? ''}"), true);
  assert.equal(locationContent.includes("value={recipientPhone ?? ''}"), true);
  assert.equal(locationContent.includes("value={street ?? ''}"), true);
  assert.equal(locationContent.includes("value={area ?? ''}"), true);
  assert.equal(locationContent.includes("value={city ?? ''}"), true);
  assert.equal(locationContent.includes("value={landmark ?? ''}"), true);

  assert.equal(checkoutContent.includes("value={orderNotes ?? ''}"), true);
  assert.equal(checkoutContent.includes("value={couponCode ?? ''}"), true);
});

test('Controlled Inputs 6: Customer and Merchant Authentication and Onboarding Forms are strictly controlled', () => {
  const loginModalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LoginModal.tsx'),
    'utf-8'
  );
  const sellerLoginModalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/SellerLoginModal.tsx'),
    'utf-8'
  );
  const sellerAuthViewContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/seller/SellerAuthView.tsx'),
    'utf-8'
  );
  const becomeSellerModalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/BecomeSellerModal.tsx'),
    'utf-8'
  );
  const becomeSellerPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/seller/BecomeSellerPage.tsx'),
    'utf-8'
  );

  assert.equal(loginModalContent.includes("value={emailOrPhone ?? ''}"), true);
  assert.equal(loginModalContent.includes("value={password ?? ''}"), true);
  assert.equal(loginModalContent.includes("value={fullName ?? ''}"), true);

  assert.equal(sellerLoginModalContent.includes("value={identifier ?? ''}"), true);
  assert.equal(sellerLoginModalContent.includes("value={password ?? ''}"), true);

  assert.equal(sellerAuthViewContent.includes("value={customStoreId ?? ''}"), true);
  assert.equal(sellerAuthViewContent.includes("value={customPassword ?? ''}"), true);

  assert.equal(becomeSellerModalContent.includes("value={storeName ?? ''}"), true);
  assert.equal(becomeSellerModalContent.includes("value={area ?? ''}"), true);
  assert.equal(becomeSellerPageContent.includes("value={fullName ?? ''}"), true);
  assert.equal(becomeSellerPageContent.includes("checked={Boolean(declarationConfirmed)}"), true);
});

test('Controlled Inputs 7: useAccountPortal and ProfileTab asynchronously sanitize customer user attributes', () => {
  const accountPortalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/hooks/useAccountPortal.ts'),
    'utf-8'
  );
  const profileTabContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/account/ProfileTab.tsx'),
    'utf-8'
  );

  assert.equal(accountPortalContent.includes("setFullName(user.full_name ?? '');"), true);
  assert.equal(accountPortalContent.includes("setEmail(user.email ?? '');"), true);
  assert.equal(accountPortalContent.includes("setPhone(user.phone ?? '');"), true);

  assert.equal(profileTabContent.includes("value={fullName ?? ''}"), true);
  assert.equal(profileTabContent.includes("value={phone ?? ''}"), true);
  assert.equal(profileTabContent.includes("value={email ?? ''}"), true);
  assert.equal(profileTabContent.includes("value={oldPassword ?? ''}"), true);
  assert.equal(profileTabContent.includes("value={newPassword ?? ''}"), true);
  assert.equal(profileTabContent.includes("value={confirmNewPassword ?? ''}"), true);
});
