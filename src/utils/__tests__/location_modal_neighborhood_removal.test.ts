import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('LocationModal Preset Removal 1: Neighborhood/Region Quick-Select Block is completely removed', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );

  // Assert neighborhoodPrompt heading is deleted
  assert.equal(
    modalContent.includes("t('loc.neighborhoodPrompt')"),
    false,
    "Must not render t('loc.neighborhoodPrompt')"
  );

  // Assert zone pill buttons and handleSelectZone caller are deleted
  assert.equal(
    modalContent.includes('handleSelectZone(zone)'),
    false,
    'Must not have zone selection pill buttons'
  );

  // Assert no leftover delivery zone pills label
  assert.equal(
    modalContent.includes('Loading active delivery zones'),
    false,
    'Must not render loading active delivery zones'
  );
  assert.equal(
    modalContent.includes('No active delivery zones configured yet'),
    false,
    'Must not render fallback text for zones'
  );
});

test('LocationModal Preset Removal 2: Flows cleanly from SELECTED DELIVERY LOCATION directly into CALCULATED DISTANCE TO LOCAL HUBS', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );

  const selectedLocIndex = modalContent.indexOf('Selected Delivery Location');
  const calcDistanceIndex = modalContent.indexOf("t('loc.calcDistance')");

  assert.ok(selectedLocIndex > 0, 'Selected Delivery Location section must exist');
  assert.ok(calcDistanceIndex > 0, 'Calculated distance section must exist');
  assert.ok(
    selectedLocIndex < calcDistanceIndex,
    'Selected Delivery Location must immediately precede Calculated Distance'
  );

  // Extract the text between Selected Delivery Location button and Calculated Distance heading
  const intermediateContent = modalContent.substring(selectedLocIndex, calcDistanceIndex);

  // Ensure there are no intermediate headers or zone pills between them
  assert.equal(
    intermediateContent.includes('neighborhoodPrompt'),
    false,
    'No neighborhood prompt between Selected Delivery Location and Calculated Distance'
  );
  assert.equal(
    intermediateContent.includes('safeZones.map'),
    false,
    'No zone map pills between Selected Delivery Location and Calculated Distance'
  );
});

test('LocationModal Preset Removal 3: Preserves Leaflet picker, tabs, details edit, hub distance cards, and Deliver to CTA', () => {
  const modalContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/LocationModal.tsx'),
    'utf-8'
  );

  // 1. Leaflet map picker
  assert.ok(
    modalContent.includes('<LeafletLocationPicker'),
    'Must preserve LeafletLocationPicker component'
  );

  // 2. Tabs: Saved Addresses and Manual Form
  assert.ok(
    modalContent.includes("t('loc.tabSaved'"),
    'Must preserve Saved Addresses tab'
  );
  assert.ok(
    modalContent.includes("t('loc.tabManual')"),
    'Must preserve Manual Form tab'
  );

  // 3. Edit Details button in Selected Delivery Location
  assert.ok(
    modalContent.includes('Edit Details'),
    'Must preserve Edit Details button'
  );

  // 4. CALCULATED DISTANCE TO LOCAL HUBS and vendor cards
  assert.ok(
    modalContent.includes("t('loc.calcDistance')"),
    'Must preserve Calculated Distance to local hubs'
  );
  assert.ok(
    modalContent.includes('safeVendors.slice(0, 4).map'),
    'Must preserve vendor cards grid'
  );

  // 5. Deliver to ... CTA confirmation button
  assert.ok(
    modalContent.includes("t('loc.deliverTo'"),
    'Must preserve Deliver to confirmation CTA'
  );
  assert.ok(
    modalContent.includes('handleConfirmMapLocation'),
    'Must preserve handleConfirmMapLocation trigger'
  );
});
