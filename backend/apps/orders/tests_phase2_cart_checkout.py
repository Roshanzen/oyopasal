import uuid
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from apps.cart.models import Cart, CartItem
from apps.catalogue.models import Category, Product, ProductVariant
from apps.customers.models import CustomerProfile, Address
from apps.inventory.models import Warehouse, InventoryItem
from apps.orders.models import Order, VendorSubOrder, OrderItem
from apps.stores.models import Store
from apps.vendors.models import VendorProfile

User = get_user_model()


class Phase2CartAndCheckoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.password = 'SecureP@ssw0rd123!'

        # Users
        self.customer_a = User.objects.create_user(
            email='customer_a@example.com',
            phone_number='9800000010',
            password=self.password,
            role='CUSTOMER',
            first_name='Customer A'
        )
        self.profile_a, _ = CustomerProfile.objects.get_or_create(user=self.customer_a)
        self.address_a = Address.objects.create(
            customer=self.profile_a,
            title='Home A',
            recipient_name='Customer A',
            recipient_phone='9800000010',
            province='Bagmati',
            district='Kathmandu',
            municipality='Kathmandu',
            ward_number=1,
            tole_street='Putalisadak'
        )

        self.customer_b = User.objects.create_user(
            email='customer_b@example.com',
            phone_number='9800000020',
            password=self.password,
            role='CUSTOMER',
            first_name='Customer B'
        )
        self.profile_b, _ = CustomerProfile.objects.get_or_create(user=self.customer_b)
        self.address_b = Address.objects.create(
            customer=self.profile_b,
            title='Office B',
            recipient_name='Customer B',
            recipient_phone='9800000020',
            province='Bagmati',
            district='Lalitpur',
            municipality='Lalitpur',
            ward_number=3,
            tole_street='Kupondole'
        )

        # Vendors & Stores
        self.vendor_user_1 = User.objects.create_user(
            email='vendor1@example.com',
            phone_number='9800000030',
            password=self.password,
            role='VENDOR'
        )
        self.vendor_1 = VendorProfile.objects.create(
            user=self.vendor_user_1,
            business_name='Vendor One Store',
            slug='vendor-one-store',
            pan_vat_number='111111111',
            status='APPROVED'
        )
        self.store_1 = Store.objects.create(
            vendor=self.vendor_1,
            name='Store One',
            slug='store-one'
        )
        self.warehouse_1 = Warehouse.objects.create(
            vendor=self.vendor_1,
            name='Warehouse 1',
            code='WH-1',
            is_active=True
        )

        self.vendor_user_2 = User.objects.create_user(
            email='vendor2@example.com',
            phone_number='9800000040',
            password=self.password,
            role='VENDOR'
        )
        self.vendor_2 = VendorProfile.objects.create(
            user=self.vendor_user_2,
            business_name='Vendor Two Store',
            slug='vendor-two-store',
            pan_vat_number='222222222',
            status='APPROVED'
        )
        self.store_2 = Store.objects.create(
            vendor=self.vendor_2,
            name='Store Two',
            slug='store-two'
        )
        self.warehouse_2 = Warehouse.objects.create(
            vendor=self.vendor_2,
            name='Warehouse 2',
            code='WH-2',
            is_active=True
        )

        # Category
        self.category = Category.objects.create(name='Test Category', slug='test-category')

        # Product 1 & Variant 1 (Vendor 1)
        self.product_1 = Product.objects.create(
            vendor=self.vendor_1,
            store=self.store_1,
            category=self.category,
            name='Product 1',
            slug='product-1',
            base_sku='BASE-PROD-1',
            status='APPROVED'
        )
        self.variant_1 = ProductVariant.objects.create(
            product=self.product_1,
            sku='SKU-PROD-1',
            regular_price=Decimal('250.00'),
            selling_price=Decimal('200.00'),
            is_active=True
        )
        self.inv_1 = InventoryItem.objects.create(
            warehouse=self.warehouse_1,
            variant=self.variant_1,
            quantity_on_hand=20,
            quantity_reserved=0
        )

        # Product 2 & Variant 2 (Vendor 2)
        self.product_2 = Product.objects.create(
            vendor=self.vendor_2,
            store=self.store_2,
            category=self.category,
            name='Product 2',
            slug='product-2',
            base_sku='BASE-PROD-2',
            status='APPROVED'
        )
        self.variant_2 = ProductVariant.objects.create(
            product=self.product_2,
            sku='SKU-PROD-2',
            regular_price=Decimal('150.00'),
            selling_price=Decimal('100.00'),
            is_active=True
        )
        self.inv_2 = InventoryItem.objects.create(
            warehouse=self.warehouse_2,
            variant=self.variant_2,
            quantity_on_hand=15,
            quantity_reserved=0
        )

    # 1. Authenticated Cart Isolation
    def test_authenticated_cart_isolation(self):
        """Customer A's cart items are strictly isolated from Customer B."""
        self.client.force_authenticate(user=self.customer_a)
        resp_add = self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 2
        })
        self.assertEqual(resp_add.status_code, status.HTTP_200_OK)

        # Verify Customer A sees 1 item
        resp_a = self.client.get('/api/v1/cart/')
        self.assertEqual(resp_a.status_code, status.HTTP_200_OK)
        items_a = resp_a.data.get('items', [])
        self.assertEqual(len(items_a), 1)

        # Switch to Customer B
        self.client.force_authenticate(user=self.customer_b)
        resp_b = self.client.get('/api/v1/cart/')
        self.assertEqual(resp_b.status_code, status.HTTP_200_OK)
        items_b = resp_b.data.get('items', [])
        self.assertEqual(len(items_b), 0, "Customer B should have an empty cart, isolated from Customer A")

    # 2. Guest Cart Isolation via X-Session-Key
    def test_guest_cart_isolation(self):
        """Guests with distinct X-Session-Key headers maintain independent carts."""
        session_1 = 'session-guest-alpha-123'
        session_2 = 'session-guest-beta-456'

        # Guest 1 adds item
        resp_g1_add = self.client.post(
            '/api/v1/cart/items/',
            {'variant_id': str(self.variant_1.id), 'quantity': 1},
            HTTP_X_SESSION_KEY=session_1
        )
        self.assertEqual(resp_g1_add.status_code, status.HTTP_200_OK)

        # Guest 2 checks cart
        resp_g2 = self.client.get('/api/v1/cart/', HTTP_X_SESSION_KEY=session_2)
        self.assertEqual(resp_g2.status_code, status.HTTP_200_OK)
        items_g2 = resp_g2.data.get('items', [])
        self.assertEqual(len(items_g2), 0, "Guest 2 should not see items added by Guest 1")

        # Guest 1 checks cart
        resp_g1 = self.client.get('/api/v1/cart/', HTTP_X_SESSION_KEY=session_1)
        self.assertEqual(resp_g1.status_code, status.HTTP_200_OK)
        items_g1 = resp_g1.data.get('items', [])
        self.assertEqual(len(items_g1), 1)

    # 3. Prevent Cross-Cart Modification and Deletion
    def test_cart_item_cross_modification_prevented(self):
        """A user cannot modify or delete cart items belonging to another user's cart."""
        self.client.force_authenticate(user=self.customer_a)
        resp_add = self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 2
        })
        self.assertEqual(resp_add.status_code, status.HTTP_200_OK)

        cart_a = Cart.objects.get(user=self.customer_a)
        item_a = cart_a.items.first()
        self.assertIsNotNone(item_a)

        # Customer B attempts to modify Customer A's cart item
        self.client.force_authenticate(user=self.customer_b)
        resp_patch = self.client.patch(f'/api/v1/cart/items/{item_a.id}/', {'quantity': 10})
        self.assertEqual(resp_patch.status_code, status.HTTP_404_NOT_FOUND)

        # Customer B attempts to delete Customer A's cart item
        resp_del = self.client.delete(f'/api/v1/cart/items/{item_a.id}/')
        self.assertEqual(resp_del.status_code, status.HTTP_404_NOT_FOUND)

        # Verify Customer A's item is untouched
        item_a.refresh_from_db()
        self.assertEqual(item_a.quantity, 2)

    # 4. Missing Inventory Rejected (No Phantom Stock Minted)
    def test_missing_inventory_rejected(self):
        """Products without an InventoryItem cannot be added to cart or checked out."""
        # Create product variant with NO inventory record
        orphan_variant = ProductVariant.objects.create(
            product=self.product_1,
            sku='SKU-ORPHAN-NO-STOCK',
            regular_price=Decimal('600.00'),
            selling_price=Decimal('500.00'),
            is_active=True
        )
        self.assertEqual(InventoryItem.objects.filter(variant=orphan_variant).count(), 0)

        self.client.force_authenticate(user=self.customer_a)
        resp_add = self.client.post('/api/v1/cart/items/', {
            'variant_id': str(orphan_variant.id),
            'quantity': 1
        })
        self.assertEqual(resp_add.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('stock', resp_add.data.get('message', '').lower() or str(resp_add.data).lower())

        # Verify no phantom stock of 100 was minted
        self.assertEqual(InventoryItem.objects.filter(variant=orphan_variant).count(), 0)

    # 5. Insufficient Stock Rejected
    def test_insufficient_stock_rejected(self):
        """Requesting more quantity than available stock fails with 400 Bad Request."""
        # inv_2 has 15 on hand, 0 reserved => 15 available
        self.client.force_authenticate(user=self.customer_a)

        # Attempt to add 20 units (exceeds 15)
        resp_add = self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_2.id),
            'quantity': 20
        })
        self.assertEqual(resp_add.status_code, status.HTTP_400_BAD_REQUEST)

        # Add 10 units (succeeds)
        resp_add_ok = self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_2.id),
            'quantity': 10
        })
        self.assertEqual(resp_add_ok.status_code, status.HTTP_200_OK)

        cart_a = Cart.objects.get(user=self.customer_a)
        item = cart_a.items.first()

        # Attempt to update quantity to 25 units (exceeds 15)
        resp_update = self.client.patch(f'/api/v1/cart/items/{item.id}/', {'quantity': 25})
        self.assertEqual(resp_update.status_code, status.HTTP_400_BAD_REQUEST)

    # 6. Authoritative Pricing from Database at Checkout
    def test_authoritative_price_calculation(self):
        """Checkout calculates totals using the database variant price, ignoring frontend tampering."""
        self.client.force_authenticate(user=self.customer_a)
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 3
        })

        # Change DB price from 200.00 to 250.00
        self.variant_1.selling_price = Decimal('250.00')
        self.variant_1.save(update_fields=['selling_price'])

        # Checkout passing a tampered price or address
        checkout_payload = {
            'address_id': str(self.address_a.id),
            'payment_method': 'COD',
            'price': '10.00',  # Tampered frontend price should be ignored
            'subtotal': '30.00'
        }
        resp = self.client.post('/api/v1/orders/checkout/', checkout_payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        order_id = resp.data.get('id') or resp.data.get('data', {}).get('id')
        order = Order.objects.get(id=order_id)

        # Expected subtotal = 3 * 250.00 = 750.00 (>= 499 => delivery_total = 0.00, 13% VAT = 97.50)
        self.assertEqual(order.subtotal, Decimal('750.00'))
        self.assertEqual(order.delivery_total, Decimal('0.00'))
        self.assertEqual(order.tax_total, Decimal('97.50'))
        self.assertEqual(order.grand_total, Decimal('847.50'))

    # 7. Multi-Vendor Delivery Fee Consistency
    def test_multi_vendor_delivery_fee_consistency(self):
        """Parent delivery fee matches sum of vendor suborder delivery fees exactly."""
        self.client.force_authenticate(user=self.customer_a)

        # 1 unit of variant 1 (Vendor 1) @ 200.00
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 1
        })
        # 1 unit of variant 2 (Vendor 2) @ 100.00
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_2.id),
            'quantity': 1
        })

        # Subtotal = 300.00 (< 499 => delivery fee Rs. 35.00)
        checkout_payload = {
            'address_id': str(self.address_a.id),
            'payment_method': 'COD'
        }
        resp = self.client.post('/api/v1/orders/checkout/', checkout_payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        order_id = resp.data.get('id') or resp.data.get('data', {}).get('id')
        order = Order.objects.get(id=order_id)
        suborders = order.suborders.all()

        self.assertEqual(suborders.count(), 2)
        self.assertEqual(order.subtotal, Decimal('300.00'))
        self.assertEqual(order.delivery_total, Decimal('35.00'))

        # Suborder delivery fees must sum exactly to parent order delivery total
        sub_delivery_sum = sum(s.delivery_fee for s in suborders)
        self.assertEqual(sub_delivery_sum, order.delivery_total)

        # Suborder subtotals must sum exactly to parent order subtotal
        sub_subtotal_sum = sum(s.subtotal for s in suborders)
        self.assertEqual(sub_subtotal_sum, order.subtotal)

    # 8. Rollback on Checkout Failure
    def test_rollback_on_checkout_failure(self):
        """When checkout fails midway, zero order or suborder rows persist."""
        self.client.force_authenticate(user=self.customer_a)
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 2
        })

        # Deplete stock before checkout to trigger InsufficientStockError during reservation
        self.inv_1.quantity_on_hand = 1
        self.inv_1.quantity_reserved = 0
        self.inv_1.save()

        initial_orders = Order.objects.count()
        initial_suborders = VendorSubOrder.objects.count()
        initial_items = OrderItem.objects.count()

        checkout_payload = {
            'address_id': str(self.address_a.id),
            'payment_method': 'COD'
        }
        resp = self.client.post('/api/v1/orders/checkout/', checkout_payload)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify atomic rollback
        self.assertEqual(Order.objects.count(), initial_orders)
        self.assertEqual(VendorSubOrder.objects.count(), initial_suborders)
        self.assertEqual(OrderItem.objects.count(), initial_items)

        # Inventory reservation must not have leaked
        self.inv_1.refresh_from_db()
        self.assertEqual(self.inv_1.quantity_reserved, 0)

    # 9. Idempotency Key Prevents Duplicate Orders
    def test_idempotency_duplicate_checkout(self):
        """Replaying checkout with same Idempotency-Key returns existing order without creating a duplicate."""
        self.client.force_authenticate(user=self.customer_a)
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 1
        })

        idempotency_key = f"key-{uuid.uuid4().hex}"
        checkout_payload = {
            'address_id': str(self.address_a.id),
            'payment_method': 'COD'
        }

        # First checkout attempt
        resp1 = self.client.post(
            '/api/v1/orders/checkout/',
            checkout_payload,
            HTTP_IDEMPOTENCY_KEY=idempotency_key
        )
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        order1_id = resp1.data.get('id') or resp1.data.get('data', {}).get('id')

        initial_order_count = Order.objects.count()

        # Second checkout attempt with identical idempotency key (e.g. network retry / double-click)
        resp2 = self.client.post(
            '/api/v1/orders/checkout/',
            checkout_payload,
            HTTP_IDEMPOTENCY_KEY=idempotency_key
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        order2_id = resp2.data.get('id') or resp2.data.get('data', {}).get('id')

        self.assertEqual(str(order1_id), str(order2_id))
        self.assertEqual(Order.objects.count(), initial_order_count, "No duplicate order should be created")

    # 10. Customer Order and Address Ownership Validation
    def test_customer_order_ownership(self):
        """Customer B cannot view, cancel Customer A's order, or use Customer A's address ID."""
        self.client.force_authenticate(user=self.customer_a)
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_1.id),
            'quantity': 1
        })
        resp_order = self.client.post('/api/v1/orders/checkout/', {
            'address_id': str(self.address_a.id),
            'payment_method': 'COD'
        })
        self.assertEqual(resp_order.status_code, status.HTTP_201_CREATED)
        order_id = resp_order.data.get('id') or resp_order.data.get('data', {}).get('id')

        # Switch to Customer B
        self.client.force_authenticate(user=self.customer_b)

        # 1. Customer B attempts to view Customer A's order detail
        resp_view = self.client.get(f'/api/v1/orders/my-orders/{order_id}/')
        self.assertEqual(resp_view.status_code, status.HTTP_404_NOT_FOUND)

        # 2. Customer B attempts to cancel Customer A's order
        resp_cancel = self.client.post(f'/api/v1/orders/{order_id}/cancel/')
        self.assertEqual(resp_cancel.status_code, status.HTTP_404_NOT_FOUND)

        # 3. Customer B attempts to checkout using Customer A's address ID
        self.client.post('/api/v1/cart/items/', {
            'variant_id': str(self.variant_2.id),
            'quantity': 1
        })
        resp_bad_addr = self.client.post('/api/v1/orders/checkout/', {
            'address_id': str(self.address_a.id),  # Belongs to Customer A
            'payment_method': 'COD'
        })
        self.assertEqual(resp_bad_addr.status_code, status.HTTP_400_BAD_REQUEST)
        error_code = resp_bad_addr.data.get('error', {}).get('code')
        self.assertEqual(error_code, 'INVALID_ADDRESS')
