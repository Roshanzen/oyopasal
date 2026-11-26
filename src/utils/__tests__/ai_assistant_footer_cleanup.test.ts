import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('AI Assistant Footer Cleanup 1: Bottom metadata caption bar is completely removed', () => {
  const conciergeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
    'utf-8'
  );

  // Assert poweredBy and valleyGrounded captions are removed
  assert.equal(
    conciergeContent.includes("t('chat.poweredBy')"),
    false,
    "Must not render t('chat.poweredBy') in footer"
  );
  assert.equal(
    conciergeContent.includes("t('chat.valleyGrounded')"),
    false,
    "Must not render t('chat.valleyGrounded') in footer"
  );
  assert.equal(
    conciergeContent.includes('chat.poweredBy'),
    false,
    'Must not reference chat.poweredBy'
  );
  assert.equal(
    conciergeContent.includes('chat.valleyGrounded'),
    false,
    'Must not reference chat.valleyGrounded'
  );
});

test('AI Assistant Footer Cleanup 2: Input box and chat action controls remain intact at bottom', () => {
  const conciergeContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/layout/ChatConcierge.tsx'),
    'utf-8'
  );

  // Message input
  assert.ok(
    conciergeContent.includes('value={input}'),
    'Must preserve input value state'
  );
  assert.ok(
    conciergeContent.includes("placeholder={t('chat.placeholder')}"),
    'Must preserve input placeholder'
  );

  // Voice button in input bar
  assert.ok(
    conciergeContent.includes('liveVoice.toggleVoice'),
    'Must preserve voice toggle button in input bar'
  );

  // Send button
  assert.ok(
    conciergeContent.includes('<Send className="w-4 h-4" />'),
    'Must preserve Send icon button'
  );
  assert.ok(
    conciergeContent.includes('handleSendMessage();'),
    'Must preserve handleSendMessage submit trigger'
  );
});
