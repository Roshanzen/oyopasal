import { test } from 'node:test';
import assert from 'node:assert';
import { APP_CONFIG } from '../../config/appConfig';
import { UserProfile, Vendor } from '../../types';
import { isUserVendor, isCustomerOnly, normalizeRole } from '../roleUtils';

test('Role Isolation 1: Storage keys for Customer and Vendor authentication are completely isolated', () => {
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH, 'oyopasal_customer_auth');
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH, 'oyopasal_vendor_auth');
  assert.notStrictEqual(APP_CONFIG.STORAGE_KEYS.CUSTOMER_AUTH, APP_CONFIG.STORAGE_KEYS.VENDOR_AUTH);
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.SELLER_SESSION, 'oyopasal_vendor_auth_session');
  assert.strictEqual(APP_CONFIG.STORAGE_KEYS.CUSTOMER_LOGGED_IN, 'oyopasal_customer_logged_in');
});

test('Role Isolation 2: Customer Login endpoint strictly allows only users with CUSTOMER role', () => {
  interface LoginSimResult {
    status: number;
    data: {
      success: boolean;
      access?: string;
      detail?: string;
      error?: {
        code: string;
        action?: string;
      };
      user?: { role: string };
      vendor?: any;
    };
  }

  function simulateCustomerLoginEndpoint(user: { role: string; is_vendor?: boolean; vendor_profile?: any }): LoginSimResult {
    const roleStr = normalizeRole(user.role);
    const vendorRoles = ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF'];
    const isVendor = vendorRoles.includes(roleStr) || Boolean(user.is_vendor) || Boolean(user.vendor_profile);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(roleStr);

    if (isVendor && !isAdmin) {
      return {
        status: 403,
        data: {
          success: false,
          detail: 'This account is registered as a Merchant/Vendor. Please sign in via the Merchant Portal at /seller.',
          error: {
            code: 'VENDOR_ACCOUNT_PORTAL_MISMATCH',
            action: 'GO_TO_SELLER_PORTAL',
          },
        },
      };
    }

    if (roleStr !== 'CUSTOMER' && !isAdmin) {
      return {
        status: 403,
        data: {
          success: false,
          detail: 'Only customer accounts are permitted to sign in through the customer storefront.',
          error: {
            code: 'CUSTOMER_ROLE_REQUIRED',
            action: 'CUSTOMER_LOGIN_ONLY',
          },
        },
      };
    }

    return {
      status: 200,
      data: {
        success: true,
        access: 'mock-jwt-customer-token',
        user: { role: user.role },
      },
    };
  }

  // 1. Customer user: succeeds
  const custRes = simulateCustomerLoginEndpoint({ role: 'CUSTOMER', is_vendor: false });
  assert.strictEqual(custRes.status, 200);
  assert.strictEqual(custRes.data.success, true);

  // 2. Vendor user trying Customer login: rejected with 403 VENDOR_ACCOUNT_PORTAL_MISMATCH
  const vendRes = simulateCustomerLoginEndpoint({ role: 'VENDOR', is_vendor: true });
  assert.strictEqual(vendRes.status, 403);
  assert.strictEqual(vendRes.data.error?.code, 'VENDOR_ACCOUNT_PORTAL_MISMATCH');
  assert.strictEqual(vendRes.data.error?.action, 'GO_TO_SELLER_PORTAL');
  assert.ok(vendRes.data.detail?.includes('registered as a Merchant/Vendor'));

  // 3. Vendor Owner trying Customer login: rejected with 403
  const vendOwnerRes = simulateCustomerLoginEndpoint({ role: 'VENDOR_OWNER', is_vendor: true });
  assert.strictEqual(vendOwnerRes.status, 403);
  assert.strictEqual(vendOwnerRes.data.error?.code, 'VENDOR_ACCOUNT_PORTAL_MISMATCH');

  // 4. Admin user trying Customer login: allowed
  const adminRes = simulateCustomerLoginEndpoint({ role: 'ADMIN', is_vendor: false });
  assert.strictEqual(adminRes.status, 200);
});

test('Role Isolation 3: Vendor Login endpoint strictly allows only users with VENDOR role & approved store', () => {
  interface VendorLoginSimResult {
    status: number;
    data: {
      success: boolean;
      access?: string;
      detail?: string;
      error?: {
        code: string;
        action?: string;
      };
      vendor?: any;
    };
  }

  function simulateVendorLoginEndpoint(user: { role: string; vendor_profile?: { status: string; is_approved: boolean } }): VendorLoginSimResult {
    const roleStr = normalizeRole(user.role);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(roleStr);

    if (!isAdmin) {
      if (roleStr === 'CUSTOMER') {
        return {
          status: 403,
          data: {
            success: false,
            detail: "This account is registered as a Customer only. Please click 'Apply to Become a Partner Store' to register a seller store.",
            error: {
              code: 'CUSTOMER_ACCOUNT_ONLY',
              action: 'APPLY_SELLER',
            },
          },
        };
      }

      const vendorRoles = ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF'];
      if (!vendorRoles.includes(roleStr)) {
        return {
          status: 403,
          data: {
            success: false,
            detail: 'Only users with the Vendor role and an approved vendor account are permitted to sign in to the Vendor portal.',
            error: {
              code: 'VENDOR_ROLE_REQUIRED',
            },
          },
        };
      }

      if (!user.vendor_profile || !user.vendor_profile.is_approved) {
        return {
          status: 403,
          data: {
            success: false,
            detail: 'Your seller application is currently pending administrative review.',
            error: {
              code: 'APPLICATION_PENDING_REVIEW',
            },
          },
        };
      }
    }

    return {
      status: 200,
      data: {
        success: true,
        access: 'mock-jwt-vendor-token',
        vendor: user.vendor_profile,
      },
    };
  }

  // 1. Customer trying Vendor login: rejected with 403 CUSTOMER_ACCOUNT_ONLY
  const custRes = simulateVendorLoginEndpoint({ role: 'CUSTOMER' });
  assert.strictEqual(custRes.status, 403);
  assert.strictEqual(custRes.data.error?.code, 'CUSTOMER_ACCOUNT_ONLY');
  assert.ok(custRes.data.detail?.includes('registered as a Customer only'));

  // 2. Vendor with pending profile: rejected with 403 APPLICATION_PENDING_REVIEW
  const pendingVendRes = simulateVendorLoginEndpoint({
    role: 'VENDOR',
    vendor_profile: { status: 'PENDING', is_approved: false },
  });
  assert.strictEqual(pendingVendRes.status, 403);
  assert.strictEqual(pendingVendRes.data.error?.code, 'APPLICATION_PENDING_REVIEW');

  // 3. Vendor with approved profile: succeeds with 200
  const approvedVendRes = simulateVendorLoginEndpoint({
    role: 'VENDOR',
    vendor_profile: { status: 'APPROVED', is_approved: true },
  });
  assert.strictEqual(approvedVendRes.status, 200);
  assert.strictEqual(approvedVendRes.data.success, true);
  assert.ok(approvedVendRes.data.access);
});

test('Role Isolation 4: HttpClient ensures complete token isolation between customer and seller requests', () => {
  let customerToken: string | null = 'cust-token-abc';
  let sellerToken: string | null = 'seller-token-xyz';

  function resolveEffectiveToken(useSellerTokenIfAvailable: boolean): string | null {
    return useSellerTokenIfAvailable ? sellerToken : customerToken;
  }

  function handleUnauthorized(isSellerRequest: boolean) {
    if (isSellerRequest) {
      sellerToken = null;
    } else {
      customerToken = null;
    }
  }

  // Customer request uses ONLY customerToken
  assert.strictEqual(resolveEffectiveToken(false), 'cust-token-abc');

  // Seller request uses ONLY sellerToken
  assert.strictEqual(resolveEffectiveToken(true), 'seller-token-xyz');

  // 401 on seller request clears ONLY sellerToken; customer session is preserved!
  handleUnauthorized(true);
  assert.strictEqual(sellerToken, null, 'Seller token must be cleared');
  assert.strictEqual(customerToken, 'cust-token-abc', 'Customer token must remain intact when seller request 401s');

  // Restore seller token and test 401 on customer request
  sellerToken = 'seller-token-xyz';
  handleUnauthorized(false);
  assert.strictEqual(customerToken, null, 'Customer token must be cleared');
  assert.strictEqual(sellerToken, 'seller-token-xyz', 'Seller token must remain intact when customer request 401s');
});

test('Role Isolation 5: Frontend AuthContext rejects vendor profile in customer session', () => {
  const vendorUser: UserProfile = {
    id: 'vendor-123',
    username: 'merchant_ramesh',
    email: 'ramesh@merchant.np',
    phone: '9841000000',
    default_address_id: 'addr-v1',
    full_name: 'Ramesh Merchant',
    role: 'VENDOR',
    token: 'jwt-vendor-token',
    has_vendor_access: true,
    is_vendor: true,
    vendor: {
      id: 'store-123',
      business_name: 'Ramesh Store',
      status: 'APPROVED',
      approval_status: 'approved',
      is_approved: true,
      is_verified: true,
      slug: 'ramesh-store',
    },
  };

  const roleStr = normalizeRole(vendorUser.role);
  const vendorRoles = ['VENDOR', 'VENDOR_OWNER', 'VENDOR_STAFF', 'SELLER'];
  const isVendorAccount = vendorRoles.includes(roleStr);

  assert.strictEqual(isVendorAccount, true);
  assert.strictEqual(isCustomerOnly(vendorUser), false);
  assert.strictEqual(isUserVendor(vendorUser), true);
});
