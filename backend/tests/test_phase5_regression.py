import decimal
from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.customers.models import CustomerProfile
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.warehouse.models import Warehouse
from apps.inventory.models import InventoryItem
from apps.cart.models import Cart, CartItem
from apps.orders.models import Order, VendorSubOrder, OrderStatus
from apps.orders.services import CheckoutService

User = get_user_model()


class CategoryAndProductWorkflowRegressionTests(APITestCase):
    """
    Phase 5: Automated tests verifying centralized category management
    and product creation workflows.
    """
    def setUp(self):
        # 1. Super Admin
        self.admin_user = User.objects.create_superuser(
            email='phase5_admin@oyopasal.com',
            password='AdminPassword123!',
            first_name='Platform',
            last_name='Admin',
            role=UserRole.SUPER_ADMIN
        )

        # 2. Seller / Vendor
        self.seller_user = User.objects.create_user(
            email='phase5_seller@oyopasal.com',
            password='SellerPassword123!',
            first_name='Hari',
            last_name='Vendor',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.seller_user,
            business_name='Phase5 Electronics Nepal',
            slug='phase5-electronics-nepal',
            pan_vat_number='609123456',
            status=VendorStatus.APPROVED
        )
        self.store = Store.objects.create(
            vendor=self.vendor_profile,
            name='Phase5 Store',
            slug='phase5-store',
            is_active=True,
            is_verified=True
        )

        # 3. Warehouse for inventory
        self.warehouse = Warehouse.objects.create(
            name='Kathmandu Central Logistics',
            code='KTM-P5-01',
            city='Kathmandu',
            is_active=True
        )

    def test_admin_can_create_parent_and_subcategories(self):
        """Super Admin / Admin can create top-level categories and subcategories with auto-slugs."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('catalogue:public_category_list')

        # Create parent category
        res = self.client.post(url, {
            'name': 'Home Appliances',
            'ordering': 1,
            'is_active': True
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        parent_id = res.data['category']['id']
        self.assertEqual(res.data['category']['slug'], 'home-appliances')

        # Create subcategory
        res_sub = self.client.post(url, {
            'name': 'Air Purifiers',
            'parent_id': parent_id,
            'ordering': 1,
            'is_active': True
        }, format='json')
        self.assertEqual(res_sub.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_sub.data['category']['parent_id'], parent_id)
        self.assertTrue(Category.objects.filter(slug='air-purifiers', parent_id=parent_id).exists())

    def test_seller_cannot_create_or_mutate_categories(self):
        """Sellers are strictly forbidden from creating, updating, or deleting marketplace categories."""
        self.client.force_authenticate(user=self.seller_user)
        url = reverse('catalogue:public_category_list')

        # 1. Seller POST attempt
        res_create = self.client.post(url, {
            'name': 'Rogue Category',
            'is_active': True
        }, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_403_FORBIDDEN)

        # Create an existing category via ORM
        cat = Category.objects.create(name='Valid Category', is_active=True)
        detail_url = reverse('catalogue:public_category_detail', kwargs={'slug': cat.slug})

        # 2. Seller PUT / PATCH attempt
        res_update = self.client.patch(detail_url, {'name': 'Mutated by Seller'}, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Seller DELETE attempt
        res_delete = self.client.delete(detail_url)
        self.assertEqual(res_delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_seller_can_list_active_categories(self):
        """Sellers and customers can freely view active categories and their subcategories."""
        Category.objects.create(name='Stationery', slug='stationery', is_active=True)
        Category.objects.create(name='Inactive Archival', slug='inactive-archival', is_active=False)

        self.client.force_authenticate(user=self.seller_user)
        url = reverse('catalogue:public_category_list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        slugs = [c['slug'] for c in res.data]
        self.assertIn('stationery', slugs)
        self.assertNotIn('inactive-archival', slugs)

    def test_seller_product_creation_with_valid_and_invalid_categories(self):
        """Verify product creation succeeds with active categories, but is rejected for invalid or inactive categories."""
        active_cat = Category.objects.create(name='Smart Tech', slug='smart-tech', is_active=True)
        inactive_cat = Category.objects.create(name='Deprecated Tech', slug='deprecated-tech', is_active=False)

        self.client.force_authenticate(user=self.seller_user)
        url = reverse('catalogue:vendor_product_list_create')

        # A. Successful creation with active category
        valid_payload = {
            'store': str(self.store.id),
            'category': str(active_cat.id),
            'name': 'Himalayan Smart Sensor',
            'base_sku': 'HSS-01',
            'short_description': 'High precision sensor',
            'variants': [{
                'sku': 'HSS-01-STD',
                'regular_price': '1500.00',
                'selling_price': '1200.00',
                'is_default': True
            }]
        }
        res_valid = self.client.post(url, valid_payload, format='json')
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Product.objects.filter(base_sku='HSS-01', category=active_cat).exists())

        # B. Rejection with inactive category
        invalid_cat_payload = {
            'store': str(self.store.id),
            'category': str(inactive_cat.id),
            'name': 'Himalayan Dead Sensor',
            'base_sku': 'HSS-DEAD',
            'variants': [{
                'sku': 'HSS-DEAD-01',
                'selling_price': '500.00',
                'is_default': True
            }]
        }
        res_invalid = self.client.post(url, invalid_cat_payload, format='json')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)


class SecurityAndCrossVendorIsolationTests(APITestCase):
    """
    Phase 5: Security regression tests ensuring multi-tenant isolation,
    tamper prevention, and token validity.
    """
    def setUp(self):
        # Vendor 1
        self.vendor1_user = User.objects.create_user(
            email='p5_v1@oyopasal.com', password='Password123!', role=UserRole.VENDOR_OWNER, is_verified=True
        )
        self.vendor1 = VendorProfile.objects.create(
            user=self.vendor1_user, business_name='Kathmandu Gadgets', slug='ktm-gadgets', status=VendorStatus.APPROVED
        )
        self.store1 = Store.objects.create(vendor=self.vendor1, name='KTM Store', slug='ktm-store', is_active=True, is_verified=True)

        # Vendor 2
        self.vendor2_user = User.objects.create_user(
            email='p5_v2@oyopasal.com', password='Password123!', role=UserRole.VENDOR_OWNER, is_verified=True
        )
        self.vendor2 = VendorProfile.objects.create(
            user=self.vendor2_user, business_name='Pokhara Crafts', slug='pokhara-crafts', status=VendorStatus.APPROVED
        )
        self.store2 = Store.objects.create(vendor=self.vendor2, name='Pokhara Store', slug='pokhara-store', is_active=True, is_verified=True)

        # Category & Warehouse
        self.cat = Category.objects.create(name='P5 General', slug='p5-general', is_active=True)
        self.warehouse = Warehouse.objects.create(name='Central Hub', code='P5-HUB-01', city='Kathmandu', is_active=True)

        # Vendor 1's Product
        self.prod1 = Product.objects.create(
            vendor=self.vendor1, store=self.store1, category=self.cat, name='KTM Audio Headset', base_sku='KTM-AUD-01'
        )
        self.var1 = ProductVariant.objects.create(
            product=self.prod1, sku='KTM-AUD-01-BLK', selling_price=Decimal('2500.00'), regular_price=Decimal('3000.00')
        )
        self.inv1 = InventoryItem.objects.create(
            variant=self.var1, warehouse=self.warehouse, quantity_on_hand=50, quantity_reserved=0
        )

    def test_unauthenticated_requests_blocked(self):
        """Endpoints requiring authentication return 401 Unauthorized when unauthenticated."""
        url = reverse('catalogue:vendor_product_list_create')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_and_expired_tokens_rejected(self):
        """Tampered or invalid Bearer tokens are rejected with 401."""
        url = reverse('catalogue:vendor_product_list_create')
        res = self.client.get(url, HTTP_AUTHORIZATION='Bearer invalid.expired.token')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_vendor_product_mutation_blocked(self):
        """Vendor 2 cannot edit or delete Vendor 1's product."""
        self.client.force_authenticate(user=self.vendor2_user)
        detail_url = reverse('catalogue:vendor_product_detail', kwargs={'id': str(self.prod1.id)})

        # Try to rename Vendor 1's product
        res_patch = self.client.patch(detail_url, {'name': 'Hacked by Vendor 2'}, format='json')
        self.assertIn(res_patch.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])
        self.prod1.refresh_from_db()
        self.assertEqual(self.prod1.name, 'KTM Audio Headset')

        # Try to delete Vendor 1's product
        res_del = self.client.delete(detail_url)
        self.assertIn(res_del.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])
        self.assertTrue(Product.objects.filter(id=self.prod1.id).exists())

    def test_cross_vendor_inventory_modification_blocked(self):
        """Vendor 2 cannot update inventory or restock Vendor 1's product variant."""
        self.client.force_authenticate(user=self.vendor2_user)
        adjust_url = reverse('inventory:inventory_adjust', kwargs={'id': str(self.inv1.id)})

        res = self.client.post(adjust_url, {
            'variant_id': str(self.var1.id),
            'quantity_delta': -40,
            'reason': 'Theft by competitor'
        }, format='json')
        # DRF permission / service layer must block cross-vendor modification
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST])
        self.inv1.refresh_from_db()
        self.assertEqual(self.inv1.quantity_on_hand, 50)


class CartInventoryAndCheckoutRegressionTests(APITestCase):
    """
    Phase 5: Cart isolation, stock deduction, delivery fee rules, and order splitting.
    """
    def setUp(self):
        # Customer 1 & 2
        self.cust1 = User.objects.create_user(email='p5_c1@oyopasal.com', password='Password123!', role=UserRole.CUSTOMER, is_verified=True)
        self.cust2 = User.objects.create_user(email='p5_c2@oyopasal.com', password='Password123!', role=UserRole.CUSTOMER, is_verified=True)

        # Vendors
        self.vendor_user = User.objects.create_user(email='p5_v@oyopasal.com', password='Password123!', role=UserRole.VENDOR_OWNER, is_verified=True)
        self.vendor = VendorProfile.objects.create(user=self.vendor_user, business_name='Himalayan Organic Tea', slug='him-tea', status=VendorStatus.APPROVED)
        self.store = Store.objects.create(vendor=self.vendor, name='Tea Store', slug='tea-store', is_active=True, is_verified=True)

        self.cat = Category.objects.create(name='Beverages', slug='beverages', is_active=True)
        self.warehouse = Warehouse.objects.create(name='P5 Hub', code='P5-HUB-02', city='Kathmandu', is_active=True)

        # Product with 5 in stock and APPROVED status
        self.prod = Product.objects.create(
            vendor=self.vendor, store=self.store, category=self.cat, name='Ilam Green Tea', base_sku='TEA-01', status=ProductStatus.APPROVED
        )
        self.var = ProductVariant.objects.create(product=self.prod, sku='TEA-01-100G', selling_price=Decimal('250.00'), regular_price=Decimal('300.00'))
        self.inv = InventoryItem.objects.create(variant=self.var, warehouse=self.warehouse, quantity_on_hand=5, quantity_reserved=0)

        self.shipping_address = {
            'full_name': 'Ram Bahadur',
            'phone': '9841234567',
            'province': 'BAGMATI',
            'district': 'Kathmandu',
            'municipality': 'Kathmandu Metropolitan City',
            'ward_number': 4,
            'tole_street': 'Baluwatar'
        }

    def test_customer_cart_isolation(self):
        """Customer carts are strictly private; Customer 1 cannot access or see Customer 2's cart items."""
        cart1, _ = Cart.objects.get_or_create(user=self.cust1)
        cart2, _ = Cart.objects.get_or_create(user=self.cust2)

        CartItem.objects.create(cart=cart1, variant=self.var, quantity=2)

        self.client.force_authenticate(user=self.cust2)
        url = reverse('cart:cart_detail')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Customer 2's cart must be completely empty
        self.assertEqual(len(res.data.get('items', [])), 0)

    def test_checkout_delivery_fee_policy(self):
        """
        Standard delivery policy:
        Orders >= Rs 499 receive free delivery (0.00).
        Orders < Rs 499 incur the standard delivery fee (Rs 35.00).
        """
        # Order A: 1 unit @ 250 = 250 (< 499) -> delivery fee 35.00
        cart_small, _ = Cart.objects.get_or_create(user=self.cust1)
        CartItem.objects.create(cart=cart_small, variant=self.var, quantity=1)

        order_small = CheckoutService.process_checkout(
            user=self.cust1,
            shipping_address_data=self.shipping_address,
            payment_method='COD'
        )
        self.assertEqual(order_small.subtotal, Decimal('250.00'))
        self.assertEqual(order_small.delivery_total, Decimal('35.00'))
        self.assertEqual(order_small.tax_total, Decimal('32.50'))  # 13% VAT on 250.00
        self.assertEqual(order_small.grand_total, Decimal('317.50'))  # 250 + 35 + 32.50

        # Order B: 2 units @ 250 = 500 (>= 499) -> delivery fee 0.00
        cart_large, _ = Cart.objects.get_or_create(user=self.cust2)
        CartItem.objects.create(cart=cart_large, variant=self.var, quantity=2)

        order_large = CheckoutService.process_checkout(
            user=self.cust2,
            shipping_address_data=self.shipping_address,
            payment_method='COD'
        )
        self.assertEqual(order_large.subtotal, Decimal('500.00'))
        self.assertEqual(order_large.delivery_total, Decimal('0.00'))
        self.assertEqual(order_large.tax_total, Decimal('65.00'))  # 13% VAT on 500.00
        self.assertEqual(order_large.grand_total, Decimal('565.00'))  # 500 + 0 + 65.00

    def test_checkout_with_insufficient_stock_fails(self):
        """Checkout is rejected when requested quantity exceeds available inventory."""
        cart, _ = Cart.objects.get_or_create(user=self.cust1)
        # Stock is 5; request 10 units
        CartItem.objects.create(cart=cart, variant=self.var, quantity=10)

        with self.assertRaises(Exception):
            CheckoutService.process_checkout(
                user=self.cust1,
                shipping_address_data=self.shipping_address,
                payment_method='COD'
            )
