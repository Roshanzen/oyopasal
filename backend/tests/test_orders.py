from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.warehouse.models import Warehouse
from apps.inventory.models import InventoryItem
from apps.cart.models import Cart, CartItem
from apps.orders.models import Order, VendorSubOrder, OrderStatus, OrderStatusHistory

User = get_user_model()

class MultiVendorCartAndCheckoutTests(APITestCase):
    def setUp(self):
        # 1. Customer
        self.customer_user = User.objects.create_user(
            email='customer@oyopasal.com',
            password='CustomerPassword123!',
            role=UserRole.CUSTOMER,
            is_verified=True
        )

        # 2. Vendor 1 (Clothing)
        self.vendor1_user = User.objects.create_user(
            email='vendor1@himalayanwear.com',
            password='Vendor1Pass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor1_profile = VendorProfile.objects.create(
            user=self.vendor1_user,
            business_name='Himalayan Outdoor Wear',
            slug='himalayan-wear',
            status=VendorStatus.APPROVED,
            commission_rate_override=Decimal('8.00') # 8% commission
        )
        self.store1 = Store.objects.create(
            vendor=self.vendor1_profile,
            name='Himalayan Wear Thamel',
            slug='himalayan-wear-thamel',
            is_active=True
        )

        # 3. Vendor 2 (Tea / Grocery)
        self.vendor2_user = User.objects.create_user(
            email='vendor2@ilamtea.com',
            password='Vendor2Pass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor2_profile = VendorProfile.objects.create(
            user=self.vendor2_user,
            business_name='Ilam Organic Tea Estate',
            slug='ilam-tea',
            status=VendorStatus.APPROVED,
            commission_rate_override=Decimal('12.00') # 12% commission
        )
        self.store2 = Store.objects.create(
            vendor=self.vendor2_profile,
            name='Ilam Tea Direct',
            slug='ilam-tea-direct',
            is_active=True
        )

        # 4. Warehouse & Products
        self.warehouse = Warehouse.objects.create(
            name='Platform Central Hub',
            code='KTM-HUB',
            district='Kathmandu',
            city='Kathmandu',
            address_line='Balwatar, Kathmandu'
        )
        self.category = Category.objects.create(name='General', slug='general')

        # Product 1 from Vendor 1 (Jacket)
        self.prod1 = Product.objects.create(
            vendor=self.vendor1_profile,
            store=self.store1,
            category=self.category,
            name='Everest Down Jacket',
            base_sku='EVR-JCK-01',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        self.var1 = ProductVariant.objects.create(
            product=self.prod1,
            sku='EVR-JCK-01-L',
            regular_price=Decimal('12000.00'),
            selling_price=Decimal('10000.00'),
            is_default=True
        )
        self.inv1 = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.var1,
            quantity_on_hand=20,
            quantity_reserved=0
        )

        # Product 2 from Vendor 2 (Tea)
        self.prod2 = Product.objects.create(
            vendor=self.vendor2_profile,
            store=self.store2,
            category=self.category,
            name='Ilam Golden Tips Tea',
            base_sku='ILAM-TEA-01',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        self.var2 = ProductVariant.objects.create(
            product=self.prod2,
            sku='ILAM-TEA-01-500G',
            regular_price=Decimal('1500.00'),
            selling_price=Decimal('1200.00'),
            is_default=True
        )
        self.inv2 = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.var2,
            quantity_on_hand=50,
            quantity_reserved=0
        )

    def test_cart_operations_and_vendor_grouping(self):
        """Verify adding multi-vendor products to cart, updating quantity, and vendor grouping."""
        self.client.force_authenticate(user=self.customer_user)
        cart_url = reverse('cart:cart_detail')

        # Add 1 Jacket (Vendor 1)
        res1 = self.client.post(cart_url, {'variant_id': str(self.var1.id), 'quantity': 1})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Add 2 Teas (Vendor 2)
        res2 = self.client.post(cart_url, {'variant_id': str(self.var2.id), 'quantity': 2})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # Check cart grouping
        get_res = self.client.get(cart_url)
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        cart_data = get_res.data['data']
        self.assertEqual(cart_data['total_items'], 3)
        self.assertEqual(cart_data['vendor_count'], 2)
        # Expected subtotal: (1 * 10000) + (2 * 1200) = 12400.00
        self.assertEqual(Decimal(cart_data['subtotal']), Decimal('12400.00'))
        self.assertEqual(len(cart_data['grouped_by_vendor']), 2)

    def test_multi_vendor_checkout_and_order_splitting(self):
        """
        Verify multi-vendor checkout:
        1. 1 Parent Order is created.
        2. 2 VendorSubOrders are created with accurate vendor commission rates.
        3. Stock is reserved atomically.
        4. Cart is cleared.
        """
        # Prepopulate cart
        cart = Cart.objects.create(user=self.customer_user)
        CartItem.objects.create(cart=cart, variant=self.var1, quantity=1) # 10,000 NPR
        CartItem.objects.create(cart=cart, variant=self.var2, quantity=2) # 2,400 NPR

        self.client.force_authenticate(user=self.customer_user)
        checkout_url = reverse('orders:checkout')

        payload = {
            'shipping_address': {
                'recipient_name': 'Aayush Shrestha',
                'recipient_phone': '9841234567',
                'province': 'BAGMATI',
                'district': 'Kathmandu',
                'municipality': 'Kathmandu Metropolitan City',
                'ward_number': 3,
                'tole_street': 'Maharajgunj'
            },
            'payment_method': 'COD',
            'customer_notes': 'Please call before delivery'
        }

        response = self.client.post(checkout_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        order_data = response.data['data']

        # 1. Parent Order Checks
        self.assertEqual(Order.objects.count(), 1)
        parent_order = Order.objects.first()
        self.assertEqual(parent_order.status, OrderStatus.CONFIRMED)
        self.assertEqual(parent_order.subtotal, Decimal('12400.00'))
        self.assertEqual(parent_order.delivery_total, Decimal('200.00')) # 2 vendors * 100
        # Tax: 13% on 12400 = 1612.00
        self.assertEqual(parent_order.tax_total, Decimal('1612.00'))
        self.assertEqual(parent_order.grand_total, Decimal('14212.00'))

        # 2. Vendor Sub-Orders Checks
        self.assertEqual(parent_order.suborders.count(), 2)
        sub1 = parent_order.suborders.get(vendor=self.vendor1_profile)
        sub2 = parent_order.suborders.get(vendor=self.vendor2_profile)

        # Vendor 1: subtotal 10000, 8% commission = 800
        self.assertEqual(sub1.subtotal, Decimal('10000.00'))
        self.assertEqual(sub1.commission_rate, Decimal('8.00'))
        self.assertEqual(sub1.commission_amount, Decimal('800.00'))
        self.assertEqual(sub1.vendor_net_amount, Decimal('9200.00'))

        # Vendor 2: subtotal 2400, 12% commission = 288
        self.assertEqual(sub2.subtotal, Decimal('2400.00'))
        self.assertEqual(sub2.commission_rate, Decimal('12.00'))
        self.assertEqual(sub2.commission_amount, Decimal('288.00'))
        self.assertEqual(sub2.vendor_net_amount, Decimal('2112.00'))

        # 3. Stock Reservations
        self.inv1.refresh_from_db()
        self.inv2.refresh_from_db()
        self.assertEqual(self.inv1.quantity_reserved, 1)
        self.assertEqual(self.inv1.quantity_available, 19)
        self.assertEqual(self.inv2.quantity_reserved, 2)
        self.assertEqual(self.inv2.quantity_available, 48)

        # 4. Cart Emptied
        cart.refresh_from_db()
        self.assertEqual(cart.items.count(), 0)

    def test_independent_suborder_fulfillment_lifecycle(self):
        """
        Verify independent vendor suborder fulfillment:
        - Vendor 1 packs and ships -> commits Vendor 1 inventory reservation.
        - Vendor 2 remains in processing (partial fulfillment).
        - Parent order reflects ongoing progress.
        - When both Vendor 1 and Vendor 2 deliver -> Parent order automatically advances to DELIVERED.
        """
        # Create order with 2 suborders
        cart = Cart.objects.create(user=self.customer_user)
        CartItem.objects.create(cart=cart, variant=self.var1, quantity=1)
        CartItem.objects.create(cart=cart, variant=self.var2, quantity=1)

        self.client.force_authenticate(user=self.customer_user)
        res = self.client.post(reverse('orders:checkout'), {
            'shipping_address': {'recipient_name': 'Test', 'recipient_phone': '9800000000'},
            'payment_method': 'COD'
        }, format='json')
        order = Order.objects.get(id=res.data['data']['id'])
        sub1 = order.suborders.get(vendor=self.vendor1_profile)
        sub2 = order.suborders.get(vendor=self.vendor2_profile)

        # Vendor 1 logs in and advances fulfillment
        self.client.force_authenticate(user=self.vendor1_user)
        trans_url_1 = reverse('orders:vendor_suborder_transition', kwargs={'id': sub1.id})

        # CONFIRMED -> PROCESSING -> PACKED -> SHIPPED
        self.client.post(trans_url_1, {'new_status': OrderStatus.PROCESSING})
        self.client.post(trans_url_1, {'new_status': OrderStatus.PACKED})
        ship_res = self.client.post(trans_url_1, {
            'new_status': OrderStatus.SHIPPED,
            'tracking_number': 'NEX-98765',
            'delivery_provider': 'Nepal Express Logistics'
        })
        self.assertEqual(ship_res.status_code, status.HTTP_200_OK)

        # Verify Vendor 1 reservation committed (quantity_on_hand decremented from 20 to 19)
        self.inv1.refresh_from_db()
        self.assertEqual(self.inv1.quantity_on_hand, 19)
        self.assertEqual(self.inv1.quantity_reserved, 0)

        # Verify Parent order status advanced to SHIPPED
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.SHIPPED)

        # Vendor 1 Delivers
        self.client.post(trans_url_1, {'new_status': OrderStatus.DELIVERED})
        sub1.refresh_from_db()
        self.assertEqual(sub1.status, OrderStatus.DELIVERED)

        # Parent is still SHIPPED because Vendor 2 hasn't delivered yet
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.SHIPPED)

        # Vendor 2 now processes, ships, and delivers
        self.client.force_authenticate(user=self.vendor2_user)
        trans_url_2 = reverse('orders:vendor_suborder_transition', kwargs={'id': sub2.id})
        self.client.post(trans_url_2, {'new_status': OrderStatus.PROCESSING})
        self.client.post(trans_url_2, {'new_status': OrderStatus.PACKED})
        self.client.post(trans_url_2, {'new_status': OrderStatus.SHIPPED})
        self.client.post(trans_url_2, {'new_status': OrderStatus.DELIVERED})

        # Now BOTH suborders are delivered -> Parent order becomes DELIVERED!
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.DELIVERED)

    def test_suborder_cancellation_releases_reservation(self):
        """Verify cancelling a suborder releases its reserved stock."""
        cart = Cart.objects.create(user=self.customer_user)
        CartItem.objects.create(cart=cart, variant=self.var1, quantity=2)

        self.client.force_authenticate(user=self.customer_user)
        res = self.client.post(reverse('orders:checkout'), {
            'shipping_address': {'recipient_name': 'Test', 'recipient_phone': '9800000000'},
            'payment_method': 'COD'
        }, format='json')
        order = Order.objects.get(id=res.data['data']['id'])
        sub = order.suborders.first()

        self.inv1.refresh_from_db()
        self.assertEqual(self.inv1.quantity_reserved, 2)
        self.assertEqual(self.inv1.quantity_available, 18)

        # Vendor cancels suborder
        self.client.force_authenticate(user=self.vendor1_user)
        trans_url = reverse('orders:vendor_suborder_transition', kwargs={'id': sub.id})
        cancel_res = self.client.post(trans_url, {
            'new_status': OrderStatus.CANCELLED,
            'remarks': 'Item defective in warehouse'
        })
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)

        # Stock reservation must be released!
        self.inv1.refresh_from_db()
        self.assertEqual(self.inv1.quantity_reserved, 0)
        self.assertEqual(self.inv1.quantity_available, 20)

