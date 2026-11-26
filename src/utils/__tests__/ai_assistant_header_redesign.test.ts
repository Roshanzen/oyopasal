import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('AI Assistant Header Redesign 1: Emerald-to-forest gradient, 24px rounded corners, and padding', () => {
  const conciergeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
    'utf-8'
  );

  // Gradient background
  assert.ok(
    conciergeContent.includes('linear-gradient(90deg, #065F46 0%, #064E3B 100%)'),
    'Must use exact emerald-to-forest gradient: linear-gradient(90deg, #065F46 0%, #064E3B 100%)'
  );

  // 24px rounded corners
  assert.ok(
    conciergeContent.includes('rounded-t-[24px]'),
    'Header must have rounded top corners of 24px'
  );
  assert.ok(
    conciergeContent.includes('rounded-[24px]'),
    'Drawer must have 24px rounded corners'
  );

  // Padding 20px 24px
  assert.ok(
    conciergeContent.includes('md:py-[20px] md:px-[24px]'),
    'Header must use 20px 24px padding on desktop'
  );

  // Subtle curved background accents
  assert.ok(
    conciergeContent.includes('<svg') && conciergeContent.includes('opacity-10'),
    'Header must feature subtle curved background accents'
  );
});

test('AI Assistant Header Redesign 2: 56x56 mascot, bold Ai Assistant title, and mint-green online indicator', () => {
  const conciergeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
    'utf-8'
  );

  // 56x56 mascot container
  assert.ok(
    conciergeContent.includes('md:w-[56px] md:h-[56px]'),
    'Must include 56x56px mascot container'
  );
  assert.ok(
    conciergeContent.includes('/assets/images/oyopasal_ai_robot_avatar.png'),
    'Must render robot mascot avatar'
  );

  // Ai Assistant ✨ title in 26-28px
  assert.ok(
    conciergeContent.includes('Ai Assistant'),
    'Must display Ai Assistant title'
  );
  assert.ok(
    conciergeContent.includes('md:text-[27px]'),
    'Must use 26-28px typography (27px)'
  );
  assert.ok(
    conciergeContent.includes('text-[#FACC15] fill-[#FACC15]'),
    'Must display sparkle next to title'
  );

  // Mint-green online status indicator
  assert.ok(
    conciergeContent.includes('bg-emerald-400') || conciergeContent.includes('bg-emerald-300'),
    'Must feature mint-green online indicator'
  );
  assert.ok(
    conciergeContent.includes('Online'),
    'Must render Online status text'
  );
});

test('AI Assistant Header Redesign 3: Strict negative constraints (no subtitles, OYO branding, Gemini labels, or Live Sellers text)', () => {
  const conciergeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
    'utf-8'
  );

  // Extract the header block
  const headerStart = conciergeContent.indexOf('Redesigned Emerald-to-Forest Gradient Header');
  const headerEnd = conciergeContent.indexOf('{!isMinimized && (', headerStart);
  assert.ok(headerStart > 0 && headerEnd > headerStart, 'Header block must exist');

  const headerBlock = conciergeContent.substring(headerStart, headerEnd);

  // No Gemini labels
  assert.equal(
    headerBlock.includes('Gemini 3.8'),
    false,
    'Header must not contain Gemini labels'
  );
  assert.equal(
    headerBlock.includes('Gemini 4'),
    false,
    'Header must not contain Gemini labels'
  );

  // No Live Sellers / live items text
  assert.equal(
    headerBlock.includes('Live Items'),
    false,
    'Header must not contain Live Sellers / live items text'
  );
  assert.equal(
    headerBlock.includes('Live Sellers'),
    false,
    'Header must not contain Live Sellers text'
  );
});

test('AI Assistant Header Redesign 4: Right-side controls (Voice pill with yellow waveform, Refresh, Collapse, Close)', () => {
  const conciergeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
    'utf-8'
  );

  const headerStart = conciergeContent.indexOf('Redesigned Emerald-to-Forest Gradient Header');
  const headerEnd = conciergeContent.indexOf('{!isMinimized && (', headerStart);
  const headerBlock = conciergeContent.substring(headerStart, headerEnd);

  // 1. Voice button: Translucent glass pill with yellow waveform icon and white Voice label
  assert.ok(
    headerBlock.includes('rounded-full'),
    'Voice button must be a rounded pill'
  );
  assert.ok(
    headerBlock.includes('AudioLines'),
    'Voice button must include waveform icon'
  );
  assert.ok(
    headerBlock.includes('text-[#FACC15]'),
    'Waveform icon must be yellow (#FACC15)'
  );
  assert.ok(
    headerBlock.includes('Voice'),
    'Voice button must display Voice label'
  );

  // 2. Refresh icon
  assert.ok(
    headerBlock.includes('RefreshCw'),
    'Must include outline refresh icon'
  );
  assert.ok(
    headerBlock.includes('handleClearHistory'),
    'Refresh button must call handleClearHistory'
  );

  // 3. Collapse downward chevron
  assert.ok(
    headerBlock.includes('ChevronDown'),
    'Must include downward chevron icon'
  );
  assert.ok(
    headerBlock.includes('setIsMinimized'),
    'Collapse button must toggle minimize state'
  );

  // 4. Close X icon
  assert.ok(
    headerBlock.includes('<X'),
    'Must include white X close icon'
  );
  assert.ok(
    headerBlock.includes('setIsOpen(false)'),
    'Close button must close the drawer'
  );
});
