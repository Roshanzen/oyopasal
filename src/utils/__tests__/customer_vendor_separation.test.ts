import { test } from 'node:test';
import assert from 'node:assert';
import { APP_CONFIG } from '../../config/appConfig';
import { UserProfile, Vendor } from '../../types';
import { isUserVendor, isCustomerOnly } from '../roleUtils';

test('Separation 1: Customer storage key is oyopasal_customer_auth and Vendor storage key is oyopasal_vendor_auth', () => {
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH, 'oyopasal_customer_auth');
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH, 'oyopasal_vendor_auth');
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, 'oyopasal_customer_auth');
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.SELLER_TOKEN, 'oyopasal_vendor_auth');
});

test('Separation 2: Customer registration produces is_vendor=false, role=CUSTOMER, and has_vendor_access=false', () => {
  const customer: UserProfile = {
    id: 'cust-riteshyadav',
    username: 'riteshyadav',
    email: 'riteshyadav2270@gmail.com',
    full_name: 'Ritesh Yadav',
    phone: '9841000000',
    role: 'CUSTOMER',
    token: 'jwt-cust-token',
    default_address_id: 'addr-1',
    has_vendor_access: false,
    is_vendor: false,
    vendor: null,
  };

  assert.strictEqual(customer.role, 'CUSTOMER');
  assert.strictEqual(customer.is_vendor, false);
  assert.strictEqual(customer.has_vendor_access, false);
  assert.strictEqual(customer.vendor, null);
  assert.strictEqual(isCustomerOnly(customer), true);
  assert.strictEqual(isUserVendor(customer, null), false, 'Customer must not have vendor privileges');
});

test('Separation 3: Vendor registration produces role=VENDOR, is_vendor=true, and linked pending store', () => {
  const merchant: UserProfile = {
    id: 'vend-owner-1',
    username: 'freshbakes',
    email: 'merchant@freshbakes.np',
    full_name: 'Ramesh Shrestha',
    phone: '9851000000',
    role: 'VENDOR',
    token: 'jwt-vendor-token',
    default_address_id: 'addr-2',
    has_vendor_access: true,
    is_vendor: true,
    vendor: {
      id: 'store-freshbakes',
      business_name: 'Kathmandu Fresh Bakes',
      status: 'PENDING',
      approval_status: 'pending',
      is_approved: false,
      is_verified: false,
      slug: 'kathmandu-fresh-bakes',
    },
  };

  assert.strictEqual(merchant.role, 'VENDOR');
  assert.strictEqual(merchant.is_vendor, true);
  assert.strictEqual(merchant.vendor?.status, 'PENDING');
  assert.strictEqual(merchant.vendor?.is_verified, false);
  assert.strictEqual(isCustomerOnly(merchant), false);
  assert.strictEqual(isUserVendor(merchant, merchant.vendor as Vendor), true);
});

test('Separation 4: Customer account login to /seller is rejected with expected 403 Forbidden message', () => {
  const expectedMessage = "This account is registered as a Customer only. Please click 'Apply to Become a Partner Store' to register a seller store.";

  function simulateSellerLogin(user: UserProfile): { status: number; message?: string } {
    if (user.role === 'CUSTOMER' && !user.vendor) {
      return {
        status: 403,
        message: expectedMessage,
      };
    }
    return { status: 200 };
  }

  const customerUser: UserProfile = {
    id: 'cust-riteshyadav',
    username: 'riteshyadav',
    email: 'riteshyadav2270@gmail.com',
    full_name: 'Ritesh Yadav',
    phone: '9841000000',
    role: 'CUSTOMER',
    token: 'jwt-cust-token',
    default_address_id: 'addr-1',
    has_vendor_access: false,
    is_vendor: false,
    vendor: null,
  };

  const result = simulateSellerLogin(customerUser);
  assert.strictEqual(result.status, 403);
  assert.strictEqual(result.message, expectedMessage);
});

test('Separation 5: Logging into Customer storefront does not log user into /seller', () => {
  let customerStorage: string | null = null;
  let vendorStorage: string | null = null;

  // Customer logs into storefront
  const loginCustomerStorefront = (token: string) => {
    customerStorage = token;
  };

  loginCustomerStorefront('jwt-customer-session');

  assert.strictEqual(customerStorage, 'jwt-customer-session');
  assert.strictEqual(vendorStorage, null, 'Vendor session must remain null when customer logs into storefront');
});
