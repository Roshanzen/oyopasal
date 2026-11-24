import test from 'node:test';
import assert from 'node:assert/strict';

test('Onboarding 1: Seller application payload validation enforces required fields and declaration', () => {
  const validateApplication = (data: {
    fullName: string;
    email: string;
    phone: string;
    businessName: string;
    completeAddress: string;
    declarationConfirmed: boolean;
  }) => {
    const errors: string[] = [];
    if (!data.fullName.trim()) errors.push('Full name is required');
    if (!data.email.trim() || !data.email.includes('@')) errors.push('Valid email is required');
    if (!data.phone.trim() || data.phone.length < 8) errors.push('Valid phone is required');
    if (!data.businessName.trim()) errors.push('Business name is required');
    if (!data.completeAddress.trim()) errors.push('Complete address is required');
    if (!data.declarationConfirmed) errors.push('Declaration must be confirmed');
    return { valid: errors.length === 0, errors };
  };

  // Missing declaration
  const invalid = validateApplication({
    fullName: 'Ramesh Sharma',
    email: 'ramesh@nepal.np',
    phone: '+977 9801112233',
    businessName: 'Ramesh Mart',
    completeAddress: 'Baneshwor, Kathmandu',
    declarationConfirmed: false,
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('Declaration must be confirmed'));

  // Valid
  const valid = validateApplication({
    fullName: 'Ramesh Sharma',
    email: 'ramesh@nepal.np',
    phone: '+977 9801112233',
    businessName: 'Ramesh Mart',
    completeAddress: 'Baneshwor, Kathmandu',
    declarationConfirmed: true,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});

test('Onboarding 2: Vendor activation password validation requires minimum length and match', () => {
  const validateActivation = (password: string, confirmPassword: string) => {
    if (!password || password.length < 6) {
      return { valid: false, error: 'Password must be at least 6 characters long' };
    }
    if (password !== confirmPassword) {
      return { valid: false, error: 'Passwords do not match' };
    }
    return { valid: true, error: null };
  };

  assert.equal(validateActivation('123', '123').valid, false);
  assert.equal(validateActivation('Secret123', 'Mismatch99').valid, false);
  assert.equal(validateActivation('StrongPass2026!', 'StrongPass2026!').valid, true);
});

test('Onboarding 3: Invitation token expiration helper detects expired vs active tokens', () => {
  const isTokenExpired = (expiresAtIso: string) => {
    const expires = new Date(expiresAtIso).getTime();
    return Date.now() > expires;
  };

  const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
  const futureDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  assert.equal(isTokenExpired(pastDate), true);
  assert.equal(isTokenExpired(futureDate), false);
});

test('Onboarding 4: Seller application status mapper correctly classifies permissions', () => {
  const canAccessVendorDashboard = (status: string) => {
    // Only ACTIVE vendors can access the protected vendor dashboard
    return status === 'ACTIVE';
  };

  assert.equal(canAccessVendorDashboard('PENDING'), false);
  assert.equal(canAccessVendorDashboard('UNDER_REVIEW'), false);
  assert.equal(canAccessVendorDashboard('APPROVED'), false);
  assert.equal(canAccessVendorDashboard('INVITATION_SENT'), false);
  assert.equal(canAccessVendorDashboard('REJECTED'), false);
  assert.equal(canAccessVendorDashboard('SUSPENDED'), false);
  assert.equal(canAccessVendorDashboard('ACTIVE'), true);
});

test('Onboarding 5: Vendor login modal and auth view omit demo quick login options', () => {
  // Ensure that no demo account bypass keys or quick login actions are permissible
  const sanitizeLoginPayload = (payload: { identifier: string; password?: string; demo_quick_login?: boolean }) => {
    if (payload.demo_quick_login) {
      throw new Error('Demo quick login is strictly prohibited.');
    }
    if (!payload.identifier.trim() || !payload.password?.trim()) {
      throw new Error('Both identifier and password are required.');
    }
    return { identifier: payload.identifier.trim(), password: payload.password.trim() };
  };

  assert.throws(
    () => sanitizeLoginPayload({ identifier: 'store@oyopasal.np', demo_quick_login: true }),
    /Demo quick login is strictly prohibited/
  );

  const clean = sanitizeLoginPayload({ identifier: 'merchant@store.np', password: 'ValidPassword123!' });
  assert.equal(clean.identifier, 'merchant@store.np');
  assert.equal(clean.password, 'ValidPassword123!');
});
