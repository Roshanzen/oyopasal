from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.suppliers.models import SupplierProfile, SupplierStatus
from apps.stores.models import Store
from apps.warehouse.models import Warehouse
from apps.catalogue.models import Category, Brand, Product, ProductVariant, ProductStatus
from apps.inventory.models import InventoryItem
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.payments.models import Payment, PaymentStatus
from apps.commissions.models import CommissionRecord
from apps.settlements.models import VendorSettlement, SettlementStatus

User = get_user_model()

class AnalyticsAndReportingTests(APITestCase):
    def setUp(self):
        # 1. Super Admin
        self.superadmin = User.objects.create_superuser(
            email='superadmin@oyopasal.com',
            password='AdminPassword123!',
            role=UserRole.SUPER_ADMIN,
            is_verified=True
        )

        # 2. Customer
        self.customer = User.objects.create_user(
            email='customer@example.com',
            password='CustomerPass123!',
            role=UserRole.CUSTOMER,
            is_verified=True
        )

        # 3. Vendor
        self.vendor_user = User.objects.create_user(
            email='vendor@testmart.com',
            password='VendorPass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Top Himalaya Traders',
            slug='top-himalaya-traders',
            status=VendorStatus.APPROVED
        )
        self.store = Store.objects.create(
            vendor=self.vendor,
            name='Himalaya Official Store',
            slug='himalaya-official-store'
        )

        # 4. Catalog & Inventory
        self.category = Category.objects.create(name='Clothing', slug='clothing')
        self.brand = Brand.objects.create(name='Yak Outfitters', slug='yak-outfitters')
        self.product = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.category,
            brand=self.brand,
            name='Handmade Wool Beanie',
            slug='handmade-wool-beanie',
            status=ProductStatus.APPROVED
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku='WOOL-BEANIE-BLK',
            regular_price=Decimal('1000.00'),
            selling_price=Decimal('800.00'),
            is_default=True
        )
        self.warehouse = Warehouse.objects.create(
            name='Kathmandu Central Hub',
            code='KTM-HUB-01',
            district='Kathmandu',
            city='Kathmandu'
        )
        self.inventory = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.variant,
            quantity_on_hand=50,
            quantity_reserved=0,
            reorder_threshold=10
        )

        # 5. Orders & Payments & Settlements
        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-ANALYTICS-001',
            subtotal=Decimal('1600.00'),
            tax_total=Decimal('208.00'),
            delivery_total=Decimal('100.00'),
            grand_total=Decimal('1908.00'),
            status=OrderStatus.DELIVERED
        )
        self.suborder = VendorSubOrder.objects.create(
            parent_order=self.order,
            vendor=self.vendor,
            store=self.store,
            sub_order_number='ORD-ANALYTICS-001-SUB-1',
            subtotal=Decimal('1600.00'),
            delivery_fee=Decimal('100.00'),
            commission_rate=Decimal('10.00'),
            commission_amount=Decimal('160.00'),
            vendor_net_amount=Decimal('1440.00'),
            status=OrderStatus.DELIVERED
        )
        self.order_item = OrderItem.objects.create(
            sub_order=self.suborder,
            variant=self.variant,
            product_name=self.product.name,
            variant_sku=self.variant.sku,
            unit_price=Decimal('800.00'),
            quantity=2,
            tax_rate=Decimal('13.00'),
            tax_amount=Decimal('208.00'),
            total_price=Decimal('1808.00')
        )
        self.payment = Payment.objects.create(
            order=self.order,
            provider='ESEWA',
            amount=Decimal('1908.00'),
            transaction_reference='TXN-ANALYTICS-001',
            status=PaymentStatus.SUCCESS,
            idempotency_key='IDEMP-ANALYTICS-TEST'
        )
        self.commission = CommissionRecord.objects.create(
            sub_order=self.suborder,
            gross_amount=Decimal('1600.00'),
            commission_rate=Decimal('10.00'),
            commission_amount=Decimal('160.00'),
            net_vendor_earning=Decimal('1440.00')
        )
        self.settlement = VendorSettlement.objects.create(
            vendor=self.vendor,
            settlement_number='SETTLE-ANALYTICS-001',
            gross_amount=Decimal('1600.00'),
            platform_commission=Decimal('160.00'),
            net_payout=Decimal('1440.00'),
            status=SettlementStatus.APPROVED
        )

    def test_admin_kpis_endpoint_authorized(self):
        """Super Admin can retrieve platform-wide aggregated KPIs."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('analytics:admin_kpis')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        self.assertIn('business', data)
        self.assertIn('sales', data)
        self.assertIn('financial', data)
        self.assertIn('procurement', data)

        self.assertEqual(data['business']['total_vendors'], 1)
        self.assertEqual(data['business']['active_vendors'], 1)
        self.assertEqual(data['business']['total_products'], 1)
        self.assertEqual(data['sales']['completed_orders'], 1)
        self.assertEqual(Decimal(data['sales']['total_gmv']), Decimal('1908.00'))
        self.assertEqual(Decimal(data['financial']['total_platform_revenue']), Decimal('160.00'))

    def test_admin_kpis_endpoint_forbidden_for_regular_customer(self):
        """Customers or unauthorized roles are denied access to executive KPIs."""
        self.client.force_authenticate(user=self.customer)
        url = reverse('analytics:admin_kpis')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_sales_trends_timeseries(self):
        """Super Admin can query daily timeseries sales trends."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('analytics:admin_sales_trends')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        trends = response.json()
        self.assertIsInstance(trends, list)
        self.assertGreaterEqual(len(trends), 1)
        self.assertEqual(Decimal(trends[0]['gmv']), Decimal('1908.00'))
        self.assertEqual(trends[0]['order_count'], 1)

    def test_admin_top_vendors_ranking(self):
        """Super Admin can query vendor leaderboard."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('analytics:admin_top_vendors')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        top_vendors = response.json()
        self.assertEqual(len(top_vendors), 1)
        self.assertEqual(top_vendors[0]['business_name'], 'Top Himalaya Traders')
        self.assertEqual(Decimal(top_vendors[0]['total_sales']), Decimal('1600.00'))

    def test_admin_top_products_ranking(self):
        """Super Admin can query top-selling products leaderboard."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('analytics:admin_top_products')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        top_products = response.json()
        self.assertEqual(len(top_products), 1)
        self.assertEqual(top_products[0]['product_name'], 'Handmade Wool Beanie')
        self.assertEqual(top_products[0]['total_units_sold'], 2)

    def test_sales_report_csv_export(self):
        """Super Admin can export sales CSV containing detailed financial breakdown."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('reports:sales_csv')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        self.assertIn('attachment; filename="sales_report_', response['Content-Disposition'])

        csv_body = response.content.decode('utf-8')
        self.assertIn('SubOrder Number,Parent Order Number', csv_body)
        self.assertIn('ORD-ANALYTICS-001-SUB-1', csv_body)
        self.assertIn('Top Himalaya Traders', csv_body)
        self.assertIn('1600.00', csv_body)

    def test_tax_vat_report_csv_export(self):
        """Finance Admin or Super Admin can export Nepal VAT compliance audit CSV."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('reports:tax_csv')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')

        csv_body = response.content.decode('utf-8')
        self.assertIn('Taxable Subtotal (NPR),VAT Rate (%)', csv_body)
        self.assertIn('13.00', csv_body)
        self.assertIn('1600.00', csv_body)

    def test_settlements_and_inventory_reports_csv_export(self):
        """Super Admin can export vendor settlements and inventory audits."""
        self.client.force_authenticate(user=self.superadmin)

        # Settlements CSV
        res_settle = self.client.get(reverse('reports:settlements_csv'))
        self.assertEqual(res_settle.status_code, status.HTTP_200_OK)
        self.assertIn('SETTLE-ANALYTICS-001', res_settle.content.decode('utf-8'))

        # Inventory CSV
        res_inv = self.client.get(reverse('reports:inventory_csv'))
        self.assertEqual(res_inv.status_code, status.HTTP_200_OK)
        self.assertIn('WOOL-BEANIE-BLK', res_inv.content.decode('utf-8'))
