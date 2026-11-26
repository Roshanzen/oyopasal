import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Cart Clear Integration 1: Backend CartClearView implements DELETE and POST handlers', () => {
  const viewsContent = fs.readFileSync(
    path.resolve(process.cwd(), 'backend/apps/cart/views.py'),
    'utf-8'
  );

  // CartClearView must define delete handler
  assert.ok(
    viewsContent.includes('class CartClearView(APIView):'),
    'CartClearView must exist in backend/apps/cart/views.py'
  );
  assert.ok(
    viewsContent.includes('def delete(self, request):'),
    'CartClearView must implement def delete(self, request)'
  );
  assert.ok(
    viewsContent.includes('def post(self, request):'),
    'CartClearView must implement def post(self, request)'
  );

  // Must delete cart items for the target customer cart only
  assert.ok(
    viewsContent.includes('cart.items.all().delete()'),
    'CartClearView must delete active cart items only'
  );
  assert.ok(
    viewsContent.includes('get_or_create_cart(request)'),
    'CartClearView must scope cart to current customer/session'
  );
});

test('Cart Clear Integration 2: Frontend cartService.clearCart targets /cart/clear/', () => {
  const serviceContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/services/cartService.ts'),
    'utf-8'
  );

  assert.ok(
    serviceContent.includes("httpClient.request<CartSummary>('/cart/clear/'"),
    'cartService.clearCart must send request to /cart/clear/'
  );
});

test('Cart Clear Integration 3: CartContext normalizes empty cart and handles errors without false success', () => {
  const contextContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/context/CartContext.tsx'),
    'utf-8'
  );

  // Check normalizeCart function exists
  assert.ok(
    contextContent.includes('function normalizeCart('),
    'CartContext must include normalizeCart helper'
  );

  // clearCart sets updated normalized cart on success
  assert.ok(
    contextContent.includes('const updated = await cartService.clearCart();'),
    'clearCart must call cartService.clearCart()'
  );
  assert.ok(
    contextContent.includes('setCart(normalizeCart(updated));'),
    'clearCart must set normalized cart state immediately'
  );

  // Error handling: catch block sets error toast and leaves cart untouched
  assert.ok(
    contextContent.includes("showToast(msg, 'error');"),
    'clearCart must display error toast on failure'
  );
});

test('Cart Clear Integration 4: CartDrawer renders Clear All button wired to clearCart', () => {
  const drawerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/modals/CartDrawer.tsx'),
    'utf-8'
  );

  assert.ok(
    drawerContent.includes('clearCart,'),
    'CartDrawer must import clearCart from useCart'
  );
  assert.ok(
    drawerContent.includes('onClick={clearCart}'),
    'Clear All button must trigger clearCart on click'
  );
  assert.ok(
    drawerContent.includes("{t('cart.clearAll')}"),
    'CartDrawer must render Clear All button'
  );
});
