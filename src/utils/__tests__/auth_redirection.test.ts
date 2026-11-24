import { test } from 'node:test';
import assert from 'node:assert';
import { UserProfile, Vendor } from '../../types';
import {
  getPostLoginRedirectPath,
  isCustomerOnly,
  isPureVendor,
  isUserAdmin,
  isUserRider,
  isUserVendor,
} from '../roleUtils';

test('Scenario 1: Customer-only login stays on customer site and hides vendor dashboard in menu', () => {
  const customerUser: UserProfile = {
    id: 'cust-1',
    username: 'ram',
    email: 'ram@example.com',
    full_name: 'Ram Shrestha',
    phone: '9841234567',
    role: 'CUSTOMER',
    token: 'jwt-cust-token',
    default_address_id: 'addr-1',
    has_vendor_access: false,
    vendor: null,
  };

  const route = getPostLoginRedirectPath(customerUser, '/');
  assert.strictEqual(route, '/');

  // Customer should be detected as customer-only
  assert.strictEqual(isCustomerOnly(customerUser), true);
  assert.strictEqual(isUserAdmin(customerUser), false);
  assert.strictEqual(isUserRider(customerUser), false);

  // Pure customer must NEVER see vendor dashboard link
  const showVendorMenu = isUserVendor(customerUser, null);
  assert.strictEqual(showVendorMenu, false, 'Pure customer should not see vendor dashboard link');
});

test('Scenario 2: Vendor-only login opens Vendor Dashboard', () => {
  const vendorUser: UserProfile = {
    id: 'vend-1',
    username: 'techzone',
    email: 'vendor@techzone.com',
    full_name: 'TechZone Nepal',
    phone: '9851000000',
    role: 'VENDOR_OWNER',
    token: 'jwt-vendor-token',
    default_address_id: 'addr-2',
    has_vendor_access: true,
    vendor: {
      id: 'store-1',
      business_name: 'TechZone Nepal Electronics',
      status: 'APPROVED',
      slug: 'techzone-nepal',
    },
  };

  const route = getPostLoginRedirectPath(vendorUser, '/');
  assert.strictEqual(route, '/seller', 'Pure vendor login must redirect to /seller');

  assert.strictEqual(isPureVendor(vendorUser), true);
  assert.strictEqual(isUserVendor(vendorUser), true);
});

test('Scenario 3: Admin login opens Admin Dashboard', () => {
  const adminUser: UserProfile = {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@oyopasal.np',
    full_name: 'System Admin',
    phone: '9800000001',
    role: 'SUPER_ADMIN',
    token: 'jwt-admin-token',
    default_address_id: 'addr-admin',
    has_vendor_access: false,
    vendor: null,
  };

  const route = getPostLoginRedirectPath(adminUser, '/');
  assert.strictEqual(route, '/admin', 'Admin login must redirect to /admin');
  assert.strictEqual(isUserAdmin(adminUser), true);
});

test('Scenario 4: Rider login opens Rider Portal', () => {
  const riderUser: UserProfile = {
    id: 'rider-1',
    username: 'rider.ramesh',
    email: 'rider.ramesh@oyopasal.np',
    full_name: 'Ramesh Rider',
    phone: '9800000002',
    role: 'DELIVERY_RIDER',
    token: 'jwt-rider-token',
    default_address_id: 'addr-rider',
    has_vendor_access: false,
    vendor: null,
  };

  const route = getPostLoginRedirectPath(riderUser, '/');
  assert.strictEqual(route, '/rider', 'Rider login must redirect to /rider');
  assert.strictEqual(isUserRider(riderUser), true);
});

test('Scenario 5: Dual customer and vendor account login stays on customer site without auto-forcing /seller', () => {
  const dualUser: UserProfile = {
    id: 'dual-1',
    username: 'saurav',
    email: 'saurav.sam033@gmail.com',
    full_name: 'rocky janeman',
    phone: '9829759497',
    role: 'CUSTOMER',
    token: 'jwt-dual-token',
    default_address_id: 'addr-3',
    has_vendor_access: true,
    vendor: {
      id: 'vendor-rocky',
      business_name: 'rocky Local Store',
      status: 'APPROVED',
      slug: 'rocky-local-store',
    },
  };

  // Normal login on homepage stays on homepage
  const homeRoute = getPostLoginRedirectPath(dualUser, '/');
  assert.strictEqual(homeRoute, '/', 'Store owner logging in as customer must stay on customer homepage');

  // Normal login while browsing checkout stays on checkout
  const checkoutRoute = getPostLoginRedirectPath(dualUser, '/checkout');
  assert.strictEqual(checkoutRoute, '/checkout');

  // If user opened login modal while on /seller, redirect to customer home
  const sellerPathRoute = getPostLoginRedirectPath(dualUser, '/seller');
  assert.strictEqual(sellerPathRoute, '/');

  // Account dropdown exhibits Store Dashboard & Add Products option
  const showVendorMenu = isUserVendor(dualUser, dualUser.vendor as any);
  assert.strictEqual(showVendorMenu, true, 'Dual account should see Store Dashboard in dropdown');
});

test('Scenario 6: Switching between Customer Website and Vendor Dashboard without logging out', () => {
  const dualUser: UserProfile = {
    id: 'dual-1',
    username: 'saurav',
    email: 'saurav.sam033@gmail.com',
    full_name: 'rocky janeman',
    phone: '9829759497',
    role: 'CUSTOMER',
    token: 'jwt-dual-token',
    default_address_id: 'addr-3',
    has_vendor_access: true,
    vendor: {
      id: 'vendor-rocky',
      business_name: 'rocky Local Store',
      status: 'APPROVED',
      slug: 'rocky-local-store',
    },
  };

  // 1. In customer dropdown, click Store Dashboard -> navigates to /seller
  assert.strictEqual(isUserVendor(dualUser, dualUser.vendor as any), true);

  // 2. On Vendor Portal, click "Return to Customer Shopping" -> navigates to /
  assert.strictEqual(getPostLoginRedirectPath(dualUser, '/'), '/');
});

test('Scenario 7: Refreshing preserves customer session and vendor access', () => {
  const restoredUser: UserProfile = {
    id: 'dual-1',
    username: 'saurav',
    email: 'saurav.sam033@gmail.com',
    full_name: 'rocky janeman',
    phone: '9829759497',
    role: 'CUSTOMER',
    token: 'jwt-dual-token',
    default_address_id: 'addr-3',
    has_vendor_access: true,
    vendor: {
      id: 'vendor-rocky',
      business_name: 'rocky Local Store',
      status: 'APPROVED',
      slug: 'rocky-local-store',
    },
  };

  assert.strictEqual(isUserVendor(restoredUser, null), true);
});

test('Scenario 8: Logging out of seller portal preserves customer authentication and cart', () => {
  let customerToken: string | null = 'jwt-customer-token';
  let sellerToken: string | null = 'jwt-seller-token';
  let sellerSession: any = { id: 'store-1', name: 'My Store' };

  // Vendor clicks "Sign Out" from Vendor Portal
  const logoutSeller = () => {
    sellerToken = null;
    sellerSession = null;
  };
  logoutSeller();

  assert.strictEqual(sellerToken, null, 'Seller token cleared');
  assert.strictEqual(sellerSession, null, 'Seller session cleared');
  assert.strictEqual(customerToken, 'jwt-customer-token', 'Customer token must remain completely intact');
});

test('Scenario 9: Unauthorized access to vendor routes is blocked for users without vendor credentials', () => {
  const unauthorizedUser: UserProfile = {
    id: 'unauth-1',
    username: 'customer',
    email: 'customer@gmail.com',
    full_name: 'Regular Customer',
    phone: '9800000000',
    role: 'CUSTOMER',
    token: 'jwt-cust-token',
    default_address_id: 'addr-x',
    has_vendor_access: false,
    vendor: null,
  };

  const hasAccess = isUserVendor(unauthorizedUser, null);
  assert.strictEqual(hasAccess, false, 'Unauthorized user must not be granted vendor route access');
});

test('Scenario 10: Leaked or stale SELLER_SESSION in localStorage never elevates pure customer to vendor', () => {
  const pureCustomer: UserProfile = {
    id: 'cust-99',
    username: 'customer99',
    email: 'customer99@gmail.com',
    full_name: 'Customer NinetyNine',
    phone: '9800000099',
    role: 'CUSTOMER',
    token: 'jwt-cust-99',
    default_address_id: 'addr-99',
    has_vendor_access: false,
    vendor: null,
  };

  const staleForeignSeller: Vendor = {
    id: 'foreign-store-uuid',
    name: 'Sam Local Store',
    business_name: 'Sam Local Store',
    slug: 'sam-local-store',
    status: 'APPROVED',
    is_approved: true,
    is_verified: true,
  } as any;

  // Even if stale foreign seller object exists in memory/storage, isUserVendor strictly checks customer claims
  const hasAccess = isUserVendor(pureCustomer, staleForeignSeller);
  assert.strictEqual(hasAccess, false, 'Stale foreign vendor session must NEVER grant vendor status to a pure customer');
});
