import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Credential Isolation 1: Customer login inputs use isolated IDs, names, and placeholders', () => {
  const loginModalPath = path.resolve(process.cwd(), 'src/components/modals/LoginModal.tsx');
  const content = fs.readFileSync(loginModalPath, 'utf-8');

  // Form wrapper has autoComplete="off"
  assert.ok(
    content.includes('autoComplete="off"'),
    'Customer login form wrapper must specify autoComplete="off"'
  );

  // Identifier input isolation
  assert.ok(
    content.includes('id="customer-login-identifier"'),
    'Customer login identifier must have id="customer-login-identifier"'
  );
  assert.ok(
    content.includes('name="customer_identifier"'),
    'Customer login identifier must have name="customer_identifier"'
  );
  assert.ok(
    content.includes('placeholder="Enter your mobile number or email"'),
    'Customer login identifier placeholder must be "Enter your mobile number or email"'
  );

  // Password input isolation
  assert.ok(
    content.includes('id="customer-login-password"'),
    'Customer login password must have id="customer-login-password"'
  );
  assert.ok(
    content.includes('name="customer_password"'),
    'Customer login password must have name="customer_password"'
  );
  assert.ok(
    content.includes('placeholder="Enter your password"'),
    'Customer login password placeholder must be "Enter your password"'
  );

  // Registration password has autoComplete="new-password"
  assert.ok(
    content.includes("mode === 'create' ? 'new-password' : 'off'"),
    'Registration password input must specify autoComplete="new-password"'
  );

  // State initialization check
  assert.ok(
    content.includes("const [emailOrPhone, setEmailOrPhone] = useState('');"),
    'Customer emailOrPhone state must be initialized with empty string'
  );
  assert.ok(
    content.includes("const [password, setPassword] = useState('');"),
    'Customer password state must be initialized with empty string'
  );
});

test('Credential Isolation 2: Merchant login inputs use isolated IDs, names, and placeholders in SellerAuthView and SellerLoginModal', () => {
  const sellerAuthPath = path.resolve(process.cwd(), 'src/components/seller/SellerAuthView.tsx');
  const sellerAuthContent = fs.readFileSync(sellerAuthPath, 'utf-8');

  const sellerModalPath = path.resolve(process.cwd(), 'src/components/modals/SellerLoginModal.tsx');
  const sellerModalContent = fs.readFileSync(sellerModalPath, 'utf-8');

  for (const [name, content] of [['SellerAuthView', sellerAuthContent], ['SellerLoginModal', sellerModalContent]]) {
    // Form wrapper
    assert.ok(
      content.includes('autoComplete="off"'),
      `${name} form wrapper must specify autoComplete="off"`
    );

    // Identifier
    assert.ok(
      content.includes('id="merchant-store-identifier"'),
      `${name} must have id="merchant-store-identifier"`
    );
    assert.ok(
      content.includes('name="merchant_identifier"'),
      `${name} must have name="merchant_identifier"`
    );
    assert.ok(
      content.includes('placeholder="Enter your registered store ID, email, or phone"'),
      `${name} identifier placeholder must be "Enter your registered store ID, email, or phone"`
    );

    // Password
    assert.ok(
      content.includes('id="merchant-secret-password"'),
      `${name} must have id="merchant-secret-password"`
    );
    assert.ok(
      content.includes('name="merchant_password"'),
      `${name} must have name="merchant_password"`
    );
    assert.ok(
      content.includes('placeholder="Enter your seller password"'),
      `${name} password placeholder must be "Enter your seller password"`
    );
  }
});

test('Credential Isolation 3: Zero shared IDs or names between Customer and Merchant login', () => {
  const customerIds = ['customer-login-identifier', 'customer-login-password'];
  const customerNames = ['customer_identifier', 'customer_password'];

  const merchantIds = ['merchant-store-identifier', 'merchant-secret-password'];
  const merchantNames = ['merchant_identifier', 'merchant_password'];

  const commonIds = customerIds.filter((id) => merchantIds.includes(id));
  const commonNames = customerNames.filter((name) => merchantNames.includes(name));

  assert.equal(commonIds.length, 0, 'Customer and Merchant input IDs must have 0 overlap');
  assert.equal(commonNames.length, 0, 'Customer and Merchant input names must have 0 overlap');
});

test('Credential Isolation 4: No hardcoded credentials or demo login buttons in Customer modal', () => {
  const loginModalPath = path.resolve(process.cwd(), 'src/components/modals/LoginModal.tsx');
  const content = fs.readFileSync(loginModalPath, 'utf-8');

  assert.ok(!content.includes('Roshan Yadav'), 'LoginModal must not contain "Roshan Yadav"');
  assert.ok(!content.includes('roshanyadav'), 'LoginModal must not contain "roshanyadav"');
  assert.ok(!content.includes('handleDemoLogin'), 'LoginModal must not contain handleDemoLogin');
  assert.ok(!content.includes('9841234567'), 'LoginModal must not contain hardcoded demo phone');

  // Verify Google sign-in and seller portal link are preserved
  assert.ok(content.includes('handleGoogleSignIn'), 'Google sign-in must be preserved in LoginModal');
  assert.ok(content.includes('login.goSellerPortal'), 'Seller portal link must be preserved in LoginModal');
});

test('Credential Isolation 5: useSellerPortal initializes storeId and password with empty strings without localStorage prefill', () => {
  const hookPath = path.resolve(process.cwd(), 'src/hooks/useSellerPortal.ts');
  const content = fs.readFileSync(hookPath, 'utf-8');

  assert.ok(
    content.includes("const [customStoreId, setCustomStoreId] = useState('');"),
    'customStoreId must initialize to empty string'
  );
  assert.ok(
    content.includes("const [customPassword, setCustomPassword] = useState('');"),
    'customPassword must initialize to empty string'
  );

  // Ensure no localStorage retrieval is populating login fields
  assert.ok(
    !content.includes('customStoreId, setCustomStoreId] = useState(safeStorage') &&
    !content.includes('customPassword, setCustomPassword] = useState(safeStorage') &&
    !content.includes('setCustomStoreId(safeStorage') &&
    !content.includes('setCustomPassword(safeStorage'),
    'Login credentials must never be read from or restored from localStorage'
  );
});
