import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

  test('OyoPasal AI Badge 1: Robot artwork banner, full-body character, and avatar assets exist', () => {
    const publicBanner = path.resolve(process.cwd(), 'public/assets/images/oyopasal_ai_robot_banner.jpg');
    const srcBanner = path.resolve(process.cwd(), 'src/assets/images/oyopasal_ai_robot_banner.jpg');
    const publicAvatar = path.resolve(process.cwd(), 'public/assets/images/oyopasal_ai_robot_avatar.png');
    const srcAvatar = path.resolve(process.cwd(), 'src/assets/images/oyopasal_ai_robot_avatar.png');
    const publicCharacter = path.resolve(process.cwd(), 'public/assets/images/oyopasal_robot_character.png');
    const srcCharacter = path.resolve(process.cwd(), 'src/assets/images/oyopasal_robot_character.png');

    assert.ok(fs.existsSync(publicBanner), 'public robot banner must exist');
    assert.ok(fs.existsSync(srcBanner), 'src robot banner must exist');
    assert.ok(fs.existsSync(publicAvatar), 'public robot avatar must exist');
    assert.ok(fs.existsSync(srcAvatar), 'src robot avatar must exist');
    assert.ok(fs.existsSync(publicCharacter), 'public robot character must exist');
    assert.ok(fs.existsSync(srcCharacter), 'src robot character must exist');

    const charStat = fs.statSync(publicCharacter);
    assert.ok(charStat.size > 10000, 'robot character image must be non-empty valid asset');
  });

  test('OyoPasal AI Badge 2: App.tsx strictly isolates ChatConcierge to Customer Storefront', () => {
    const appContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

    // Verify portal routes check
    assert.ok(appContent.includes("location.pathname.startsWith('/seller')"));
    assert.ok(appContent.includes("location.pathname.startsWith('/admin')"));
    assert.ok(appContent.includes("location.pathname.startsWith('/rider')"));

    // Verify ChatConcierge is conditionally mounted
    assert.ok(
      appContent.includes('{!isPortalRoute && <ChatConcierge />}'),
      'ChatConcierge must be guarded by {!isPortalRoute && <ChatConcierge />}'
    );
  });

  test('OyoPasal AI Badge 3: ChatConcierge.tsx implements internal route guard for strict isolation', () => {
    const conciergeContent = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
      'utf-8'
    );

    assert.ok(conciergeContent.includes('const location = useLocation();'));
    assert.ok(conciergeContent.includes("location.pathname.startsWith('/seller')"));
    assert.ok(conciergeContent.includes("location.pathname.startsWith('/admin')"));
    assert.ok(conciergeContent.includes("location.pathname.startsWith('/rider')"));
    assert.ok(conciergeContent.includes('if (isVendorOrPortalRoute) {'));
    assert.ok(conciergeContent.includes('return null;'));
  });

    test('OyoPasal AI Badge 4: Floating launcher badge uses full-body robot character, glowing styles, and tooltip', () => {
      const conciergeContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
        'utf-8'
      );

      assert.ok(conciergeContent.includes('/assets/images/oyopasal_robot_character.png'));
      assert.ok(conciergeContent.includes('data-testid="chat-concierge-trigger"'));
      assert.ok(conciergeContent.includes('Ask OyoPasal AI'));
      assert.ok(conciergeContent.includes('animate-gentle-float'));
      assert.ok(conciergeContent.includes('animate-drop-glow'));
      assert.ok(conciergeContent.includes('h-16 sm:h-20'));
    });

    test('OyoPasal AI Badge 5: Suggested quick actions and welcome message are customer-oriented', () => {
      const conciergeContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
        'utf-8'
      );
      const translationsContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/i18n/translations.ts'),
        'utf-8'
      );

      // Suggested actions
      assert.ok(conciergeContent.includes('Find Products'));
      assert.ok(conciergeContent.includes('Track My Order'));
      assert.ok(conciergeContent.includes('Find Stores'));
      assert.ok(conciergeContent.includes('Shopping Assistance'));

      // Welcome message
      assert.ok(
        translationsContent.includes("Namaste! Welcome to OyoPasal. I'm your AI shopping assistant. How can I help you today?")
      );
    });

    test('OyoPasal AI Badge 6: Zero chatbot triggers, links, or components in Vendor Portal', () => {
      const sellerFiles = [
        'src/pages/seller/SellerPortalPage.tsx',
        'src/components/seller/SellerAuthView.tsx',
        'src/components/seller/SellerOrdersTab.tsx',
        'src/components/seller/SellerCatalogTab.tsx',
        'src/components/seller/SellerSettingsTab.tsx',
        'src/components/seller/StoreProfileSetupTab.tsx',
      ];

      for (const file of sellerFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf-8');
        assert.equal(
          content.includes('<ChatConcierge'),
          false,
          `${file} must not include ChatConcierge`
        );
        assert.equal(
          content.includes('chat-concierge-trigger'),
          false,
          `${file} must not include chatbot launcher trigger`
        );
        assert.equal(
          content.includes('oyopasal_ai_robot_avatar'),
          false,
          `${file} must not reference chatbot avatar`
        );
      }
    });

