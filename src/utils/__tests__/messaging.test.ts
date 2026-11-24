import test from 'node:test';
import assert from 'node:assert/strict';

// Messaging payload validation & normalization unit tests
test('Messaging: enforces 2,000 character limit on message content', () => {
  const shortMessage = 'Namaste, is this item available in Patan?';
  const maxMessage = 'A'.repeat(2000);
  const tooLongMessage = 'A'.repeat(2001);

  const validateMessageContent = (content: string): string | null => {
    const trimmed = content.trim();
    if (!trimmed) return 'Message content cannot be blank.';
    if (trimmed.length > 2000) return 'Message exceeds 2,000 character limit.';
    return null;
  };

  assert.equal(validateMessageContent(shortMessage), null);
  assert.equal(validateMessageContent(maxMessage), null);
  assert.equal(validateMessageContent(tooLongMessage), 'Message exceeds 2,000 character limit.');
  assert.equal(validateMessageContent('   '), 'Message content cannot be blank.');
});

test('Messaging: prevents vendor from initiating customer chat with own store', () => {
  const currentSeller = { id: 'vendor-123', name: 'Organic Patan Mart' };
  const targetStoreVendorId = 'vendor-123';
  const targetStoreVendorId2 = 'vendor-456';

  const canMessageStore = (sellerId: string | undefined, storeVendorId: string) => {
    if (sellerId && sellerId === storeVendorId) {
      return { allowed: false, code: 'CANNOT_MESSAGE_OWN_STORE' };
    }
    return { allowed: true };
  };

  const selfCheck = canMessageStore(currentSeller.id, targetStoreVendorId);
  assert.equal(selfCheck.allowed, false);
  assert.equal(selfCheck.code, 'CANNOT_MESSAGE_OWN_STORE');

  const otherCheck = canMessageStore(currentSeller.id, targetStoreVendorId2);
  assert.equal(otherCheck.allowed, true);
});

test('Messaging: parses and sorts conversations by last_message_at descending', () => {
  const rawConversations = [
    {
      id: 'conv-1',
      store_name: 'Patan Organic Store',
      last_message_at: '2026-11-23T10:00:00Z',
      unread_count: 0,
    },
    {
      id: 'conv-2',
      store_name: 'Everest Electronics',
      last_message_at: '2026-11-24T08:00:00Z',
      unread_count: 2,
    },
    {
      id: 'conv-3',
      store_name: 'Himalayan Herbal',
      last_message_at: '2026-11-23T15:30:00Z',
      unread_count: 1,
    },
  ];

  const sorted = [...rawConversations].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  assert.equal(sorted[0].id, 'conv-2'); // Most recent
  assert.equal(sorted[1].id, 'conv-3');
  assert.equal(sorted[2].id, 'conv-1');

  // Verify total unread aggregation
  const totalUnread = rawConversations.reduce((sum, c) => sum + c.unread_count, 0);
  assert.equal(totalUnread, 3);
});

test('Messaging: formats relative timestamp accurately', () => {
  const formatRelative = (dateStr: string, mockNowMs: number) => {
    const d = new Date(dateStr);
    const diffMs = mockNowMs - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const nowMs = 1795500000000;
  assert.equal(formatRelative(new Date(nowMs - 20000).toISOString(), nowMs), 'Just now');
  assert.equal(formatRelative(new Date(nowMs - 5 * 60000).toISOString(), nowMs), '5m ago');
  assert.equal(formatRelative(new Date(nowMs - 3 * 3600000).toISOString(), nowMs), '3h ago');
});
