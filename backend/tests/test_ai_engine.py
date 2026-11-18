from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.warehouse.models import Warehouse
from apps.catalogue.models import Category, Brand, Product, ProductVariant, ProductStatus
from apps.inventory.models import InventoryItem
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus

User = get_user_model()

class AIEngineAndForecastingTests(APITestCase):
    def setUp(self):
        # 1. Super Admin & Customer
        self.superadmin = User.objects.create_superuser(
            email='superadmin@oyopasal.com',
            password='AdminPassword123!',
            role=UserRole.SUPER_ADMIN,
            is_verified=True
        )
        self.customer = User.objects.create_user(
            email='buyer@gmail.com',
            password='BuyerPassword123!',
            role=UserRole.CUSTOMER,
            is_verified=True
        )

        # 2. Vendor, Store & Warehouse
        self.vendor_user = User.objects.create_user(
            email='merchant@techzone.com',
            password='MerchantPass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='TechZone Nepal',
            slug='techzone-nepal',
            status=VendorStatus.APPROVED
        )
        self.store = Store.objects.create(
            vendor=self.vendor,
            name='TechZone Flagship Store',
            slug='techzone-flagship-store'
        )
        self.warehouse = Warehouse.objects.create(
            name='Kathmandu Central Logistics',
            code='KTM-LOG-01',
            district='Kathmandu',
            city='Kathmandu'
        )

        # 3. Categories & Products
        self.category = Category.objects.create(name='Computers & Accessories', slug='computers-accessories')
        self.brand = Brand.objects.create(name='LogiTech Nepal', slug='logitech-nepal')

        # Product A: Mechanical Keyboard
        self.product_a = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.category,
            brand=self.brand,
            name='RGB Mechanical Keyboard',
            slug='rgb-mechanical-keyboard',
            base_sku='PROD-KEY-001',
            status=ProductStatus.APPROVED
        )
        self.variant_a = ProductVariant.objects.create(
            product=self.product_a,
            sku='KEY-RGB-01',
            regular_price=Decimal('5000.00'),
            selling_price=Decimal('4500.00'),
            is_default=True
        )
        self.inv_a = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.variant_a,
            quantity_on_hand=20,
            quantity_reserved=0,
            reorder_threshold=10
        )

        # Product B: Ergonomic Mouse (Frequently bought with Keyboard)
        self.product_b = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.category,
            brand=self.brand,
            name='Wireless Ergonomic Mouse',
            slug='wireless-ergonomic-mouse',
            base_sku='PROD-MOU-002',
            status=ProductStatus.APPROVED
        )
        self.variant_b = ProductVariant.objects.create(
            product=self.product_b,
            sku='MOU-ERGO-01',
            regular_price=Decimal('2500.00'),
            selling_price=Decimal('2200.00'),
            is_default=True
        )
        self.inv_b = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.variant_b,
            quantity_on_hand=50,
            quantity_reserved=0,
            reorder_threshold=15
        )

        # 4. Create Historical Co-Purchases
        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-AI-CO-001',
            subtotal=Decimal('6700.00'),
            delivery_total=Decimal('100.00'),
            tax_total=Decimal('871.00'),
            grand_total=Decimal('7671.00'),
            status=OrderStatus.DELIVERED
        )
        self.suborder = VendorSubOrder.objects.create(
            parent_order=self.order,
            vendor=self.vendor,
            store=self.store,
            sub_order_number='ORD-AI-CO-001-SUB-1',
            subtotal=Decimal('6700.00'),
            delivery_fee=Decimal('100.00'),
            commission_rate=Decimal('10.00'),
            commission_amount=Decimal('670.00'),
            vendor_net_amount=Decimal('6030.00'),
            status=OrderStatus.DELIVERED
        )
        # Add both Product A and Product B to same suborder
        OrderItem.objects.create(
            sub_order=self.suborder,
            variant=self.variant_a,
            product_name=self.product_a.name,
            variant_sku=self.variant_a.sku,
            unit_price=Decimal('4500.00'),
            quantity=1,
            tax_rate=Decimal('13.00'),
            tax_amount=Decimal('585.00'),
            total_price=Decimal('5085.00')
        )
        OrderItem.objects.create(
            sub_order=self.suborder,
            variant=self.variant_b,
            product_name=self.product_b.name,
            variant_sku=self.variant_b.sku,
            unit_price=Decimal('2200.00'),
            quantity=1,
            tax_rate=Decimal('13.00'),
            tax_amount=Decimal('286.00'),
            total_price=Decimal('2486.00')
        )

    def test_frequently_bought_together_affinity(self):
        """Calling recommendations for Product A returns Product B with high confidence."""
        url = reverse('ai:frequently_bought_together', kwargs={'product_id': self.product_a.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['product_id'], str(self.product_b.id))
        self.assertEqual(data[0]['name'], 'Wireless Ergonomic Mouse')
        self.assertGreaterEqual(data[0]['confidence_score'], 0.5)

    def test_trending_products_velocity(self):
        """Trending endpoint ranks products by recent units sold."""
        url = reverse('ai:trending_products')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertGreaterEqual(len(data), 1)
        prod_names = [p['name'] for p in data]
        self.assertIn('RGB Mechanical Keyboard', prod_names)

    def test_personalized_recommendations(self):
        """Personalized feed matches user's historical category affinities."""
        self.client.force_authenticate(user=self.customer)
        url = reverse('ai:personalized_recommendations')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertGreaterEqual(len(data), 1)
        self.assertEqual(data[0]['category_name'], 'Computers & Accessories')

    def test_predictive_demand_forecast_calculation(self):
        """Computes run-rate, days to stockout, and procurement suggestions."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('ai:demand_forecast', kwargs={'variant_id': self.variant_a.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertEqual(data['sku'], 'KEY-RGB-01')
        self.assertEqual(data['current_available_stock'], 20)
        self.assertIn('daily_run_rate_velocity', data)
        self.assertIn('days_until_stockout', data)
        self.assertIn('stockout_risk_level', data)
        self.assertIn('recommended_reorder_units', data)

    def test_fraud_risk_scoring_signals(self):
        """High-value or velocity anomalies trigger risk flags for manual review."""
        self.client.force_authenticate(user=self.superadmin)

        # Create high-value order (> NPR 50,000)
        high_risk_order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-HIGH-RISK-001',
            subtotal=Decimal('60000.00'),
            delivery_total=Decimal('100.00'),
            tax_total=Decimal('7800.00'),
            grand_total=Decimal('67900.00'),
            payment_method='COD',
            status=OrderStatus.CONFIRMED
        )

        url = reverse('ai:order_risk_score', kwargs={'order_id': high_risk_order.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertGreaterEqual(data['risk_score'], 25)
        self.assertIn('HIGH_TRANSACTION_VALUE_ABOVE_NPR_50K', data['risk_signals'])
