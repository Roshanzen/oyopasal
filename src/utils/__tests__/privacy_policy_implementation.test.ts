import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('OYOPASAL – Customer & Vendor Privacy Policy Implementation Suite', () => {
  const rootDir = process.cwd();
  const customerPolicyPath = path.join(rootDir, 'src', 'pages', 'legal', 'CustomerPrivacyPolicyPage.tsx');
  const vendorPolicyPath = path.join(rootDir, 'src', 'pages', 'legal', 'VendorPrivacyPolicyPage.tsx');
  const appRoutesPath = path.join(rootDir, 'src', 'routes', 'AppRoutes.tsx');
  const homePagePath = path.join(rootDir, 'src', 'pages', 'home', 'HomePage.tsx');
  const sellerAuthPath = path.join(rootDir, 'src', 'components', 'seller', 'SellerAuthView.tsx');
  const accountPagePath = path.join(rootDir, 'src', 'pages', 'profile', 'AccountPage.tsx');
  const backendViewsPath = path.join(rootDir, 'backend', 'apps', 'common', 'views.py');
  const backendUrlsPath = path.join(rootDir, 'backend', 'config', 'urls.py');

  it('1. Verifies Customer Privacy Policy file exists and covers the streamlined 6 concise sections', () => {
    assert.ok(fs.existsSync(customerPolicyPath), 'CustomerPrivacyPolicyPage.tsx must exist');
    const content = fs.readFileSync(customerPolicyPath, 'utf8');

    // Verification of Clean Header & Subtitle
    assert.ok(content.includes('Privacy Policy'), 'Must have clean Privacy Policy title');
    assert.ok(
      content.includes('Last updated: November 2026 • Effective for OyoPasal Customers & Partner Stores in Nepal'),
      'Must contain exact updated subtitle'
    );
    assert.ok(
      content.includes('Nepal Individual Privacy Act, 2075'),
      'Must cite statutory framework in Nepal'
    );

    // 6 Concise Required Section Titles
    const requiredSections = [
      'Overview & Privacy Guarantee',
      'Information We Collect',
      'How We Use & Share Information',
      'Payments & Data Security',
      'Data Retention & Your Rights',
      'Contact Us',
    ];

    for (const section of requiredSections) {
      assert.ok(
        content.includes(section),
        `Customer Privacy Policy must contain section heading: "${section}"`
      );
    }

    // Key Content & Business Logic Assertions
    assert.ok(content.includes('Core Privacy Guarantee'), 'Must feature Core Privacy Guarantee callout');
    assert.ok(content.includes('Cash on Delivery (COD)'), 'Must reflect Cash on Delivery payment model');
    assert.ok(content.includes('Store Pickup'), 'Must reflect Store Pickup option');
    assert.ok(
      content.includes('credit/debit card numbers') || content.includes('wallet MPINs'),
      'Must clearly state zero raw card/MPIN storage'
    );
    assert.ok(content.includes('privacy@oyopasal.com'), 'Must list customer privacy contact email');
    // Single-column full-width container & unified document card
    assert.ok(
      content.includes('w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8'),
      'Must use single-column max-w-5xl outer container'
    );
    assert.ok(
      content.includes('w-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 space-y-8'),
      'Must use unified full-width card with space-y-8'
    );

    // Completely removed sidebar assertions
    assert.ok(!content.includes('<aside'), 'Sidebar <aside> must be completely removed');
    assert.ok(!content.includes('QUICK NAVIGATION'), 'QUICK NAVIGATION must be completely removed');
    assert.ok(!content.includes('Filter sections (e.g. cookies, payment)...'), 'TOC search filter must be removed');
    assert.ok(!content.includes('Print Document'), 'Print Document button must be removed');
    assert.ok(!content.includes('Share Link'), 'Share Link button must be removed');
  });

  it('2. Verifies Vendor Privacy Policy file exists and covers all 15 required sections (A through O)', () => {
    assert.ok(fs.existsSync(vendorPolicyPath), 'VendorPrivacyPolicyPage.tsx must exist');
    const content = fs.readFileSync(vendorPolicyPath, 'utf8');

    // Verification of Title & Audience
    assert.ok(content.includes('Vendor Privacy Policy'), 'Must have Vendor Privacy Policy title');

    // 15 Distinct Required Section Titles for Vendors
    const requiredVendorSections = [
      'Introduction & Multi-Vendor Marketplace Model',
      'Vendor Information We Collect',
      'Vendor Account & Store Operations Activity',
      'Product, Inventory & Public Marketplace Display',
      'Vendor Order & Customer Information',
      'Sales, Commission & Financial Calculations',
      'Vendor Payout & Banking Information',
      'Store Visibility vs Confidential Business Data',
      'Vendor Notifications & Operational Alerts',
      'Vendor Data Security & Access Controls',
      'Vendor Data Retention Schedules',
      'Vendor Privacy & Account Rights',
      'Third-Party Data Sharing & Regulatory Disclosures',
      'Vendor Responsibilities & Contractual Compliance',
      'Contact & Merchant Grievance Desk',
    ];

    for (const section of requiredVendorSections) {
      assert.ok(
        content.includes(section),
        `Vendor Privacy Policy must contain section heading: "${section}"`
      );
    }

    // Verify all 15 section letters A through O are defined in the policy
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
    for (const l of letters) {
      assert.ok(
        content.includes(`letter: '${l}'`),
        `Vendor Privacy Policy must contain section letter '${l}'`
      );
    }

    // Strict custodian duties and data isolation
    assert.ok(
      content.includes('merchant-privacy@oyopasal.com'),
      'Must specify vendor privacy contact email'
    );
    assert.ok(
      content.includes('Strict Custodian Duty') || content.includes('Custodial Duties') || content.includes('Strict Custodian Duties'),
      'Must enforce strict custodian duties on customer information'
    );
    assert.ok(
      content.includes('7 years') || content.includes('Seven (7) Years') || content.includes('7 Years'),
      'Must specify 7-year statutory retention for financial transactions'
    );
  });

  it('3. Verifies AppRoutes.tsx contains dedicated routes for Customer and Vendor Privacy Policies', () => {
    assert.ok(fs.existsSync(appRoutesPath), 'AppRoutes.tsx must exist');
    const content = fs.readFileSync(appRoutesPath, 'utf8');

    assert.ok(
      content.includes('CustomerPrivacyPolicyPage') && content.includes('VendorPrivacyPolicyPage'),
      'AppRoutes must import both policy pages'
    );
    assert.ok(
      content.includes('path="/privacy-policy"'),
      'Must define /privacy-policy route'
    );
    assert.ok(
      content.includes('path="/vendor/privacy-policy"'),
      'Must define /vendor/privacy-policy route'
    );
    assert.ok(
      content.includes('path="/seller/privacy-policy"'),
      'Must define alias /seller/privacy-policy route'
    );
  });

  it('4. Verifies Navigation links in HomePage, SellerAuthView, and AccountPage', () => {
    // HomePage footer links
    const homeContent = fs.readFileSync(homePagePath, 'utf8');
    assert.ok(
      homeContent.includes('to="/privacy-policy"'),
      'HomePage footer must link to /privacy-policy'
    );
    assert.ok(
      homeContent.includes('to="/vendor/privacy-policy"'),
      'HomePage footer must link to /vendor/privacy-policy'
    );

    // SellerAuthView login footer
    const sellerContent = fs.readFileSync(sellerAuthPath, 'utf8');
    assert.ok(
      sellerContent.includes('to="/vendor/privacy-policy"'),
      'SellerAuthView must link to /vendor/privacy-policy'
    );

    // Customer AccountPage legal link
    const accountContent = fs.readFileSync(accountPagePath, 'utf8');
    assert.ok(
      accountContent.includes('to="/privacy-policy"'),
      'AccountPage must link to /privacy-policy'
    );
  });

  it('5. Verifies Django backend provides LegalPrivacyPolicyMetadataView endpoint', () => {
    const viewsContent = fs.readFileSync(backendViewsPath, 'utf8');
    const urlsContent = fs.readFileSync(backendUrlsPath, 'utf8');

    assert.ok(
      viewsContent.includes('LegalPrivacyPolicyMetadataView'),
      'backend/apps/common/views.py must define LegalPrivacyPolicyMetadataView'
    );
    assert.ok(
      viewsContent.includes('privacy@oyopasal.com') && viewsContent.includes('merchant-privacy@oyopasal.com'),
      'Backend legal view must include official contact emails'
    );
    assert.ok(
      urlsContent.includes('api/v1/legal/privacy-policies/'),
      'backend/config/urls.py must register /api/v1/legal/privacy-policies/ route'
    );
  });
});
