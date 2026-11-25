import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Customer Account Screen 1: Zero internal DB telemetry or infrastructure metrics', () => {
  const profileTabContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/account/ProfileTab.tsx'),
    'utf-8'
  );
  const accountPortalHookContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/hooks/useAccountPortal.ts'),
    'utf-8'
  );

  // Assert no database status bar or Cloud SQL / Drizzle metrics exposed in ProfileTab
  assert.equal(profileTabContent.includes('Cloud SQL'), false);
  assert.equal(profileTabContent.includes('Drizzle ORM'), false);
  assert.equal(profileTabContent.includes('asia-southeast1'), false);
  assert.equal(profileTabContent.includes('account.dbTitle'), false);
  assert.equal(profileTabContent.includes('account.dbSub'), false);

  // Assert useAccountPortal no longer polls getDbStatus on mount
  assert.equal(accountPortalHookContent.includes('productService.getDbStatus()'), false);
});

test('Customer Account Screen 2: Removed duplicate app appearance & language settings block', () => {
  const profileTabContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/account/ProfileTab.tsx'),
    'utf-8'
  );

  // Assert duplicate App Settings block (Appearance & Language cards) is removed
  assert.equal(profileTabContent.includes('App Settings (Appearance & Language)'), false);
  assert.equal(profileTabContent.includes('एप सेटिङहरू (थिम र भाषा)'), false);
});

test('Customer Account Screen 3: Retains profile header, courier contact label, and save changes', () => {
  const profileTabContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/account/ProfileTab.tsx'),
    'utf-8'
  );

  assert.equal(profileTabContent.includes("t('account.fullName')"), true);
  assert.equal(profileTabContent.includes("t('account.emailAddress')"), true);
  assert.equal(profileTabContent.includes("t('account.phoneNumber')"), true);
  assert.equal(profileTabContent.includes("t('account.saveProfile')"), true);
});

test('Customer Account Screen 4: Displays Saved Delivery Addresses with default badge and + Add New Address', () => {
  const profileTabContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/account/ProfileTab.tsx'),
    'utf-8'
  );

  assert.equal(profileTabContent.includes("t('account.savedAddressesTitle')"), true);
  assert.equal(profileTabContent.includes("t('account.addNewAddress')"), true);
  assert.equal(profileTabContent.includes("t('account.defaultAddress')"), true);
});

test('Customer Account Screen 5: Provides Change Password & Sign Out action row', () => {
  const profileTabContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/account/ProfileTab.tsx'),
    'utf-8'
  );
  const authServiceContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/authService.ts'),
    'utf-8'
  );

  assert.equal(profileTabContent.includes('Change Password'), true);
  assert.equal(profileTabContent.includes("t('header.signOut')"), true);
  assert.equal(authServiceContent.includes('changePassword'), true);
});
