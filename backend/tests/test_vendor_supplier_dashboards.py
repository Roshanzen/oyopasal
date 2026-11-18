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
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    PurchaseOrderStatus,
    SupplierInvoice
)

User = get_user_model()

class VendorSupplierDashboardsTests(APITestCase):
    def setUp(self):
        # 1. Customer User
        self.customer = User.objects.create_user(
            email='customer@gmail.com',
            password='CustomerPass123!',
            role=UserRole.CUSTOMER,
            is_verified=True
        )

        # 2. Vendor User & Profile & Store
        self.vendor_user = User.objects.create_user(
            email='vendor@nepalcrafts.com',
            password='VendorPassword123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Nepal Handicrafts Co',
            slug='nepal-handicrafts',
            status=VendorStatus.APPROVED,
            bank_name='Nabil Bank Ltd',
            bank_account_number='0123456789012'
        )
        self.store = Store.objects.create(
            vendor=self.vendor,
            name='Handicrafts Official Store',
            slug='handicrafts-official-store'
        )

        # 3. Supplier User & Profile
        self.supplier_user = User.objects.create_user(
            email='supplier@textilewholesalers.com',
            password='SupplierPassword123!',
            role=UserRole.SUPPLIER_OWNER,
            is_verified=True
        )
        self.supplier = SupplierProfile.objects.create(
            user=self.supplier_user,
            company_name='Himalayan Textile Wholesalers',
            slug='himalayan-textile-wholesalers',
            status=SupplierStatus.APPROVED,
            credit_terms_days=45,
            bank_name='Global IME Bank',
            bank_account_number='9876543210987'
        )

        # 4. Vendor Products & SubOrders
        self.category = Category.objects.create(name='Handicrafts', slug='handicrafts')
        self.brand = Brand.objects.create(name='Nepal Art', slug='nepal-art')
        self.product = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.category,
            brand=self.brand,
            name='Singing Bowl Set',
            slug='singing-bowl-set',
            status=ProductStatus.APPROVED
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku='BOWL-SET-01',
            regular_price=Decimal('2500.00'),
            selling_price=Decimal('2000.00'),
            is_default=True
        )
        self.warehouse = Warehouse.objects.create(
            name='Patan Storage Hub',
            code='PAT-HUB-01',
            district='Lalitpur',
            city='Lalitpur'
        )
        self.inv_item = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.variant,
            quantity_on_hand=30,
            quantity_reserved=0,
            reorder_threshold=5
        )

        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-DASH-001',
            subtotal=Decimal('4000.00'),
            tax_total=Decimal('520.00'),
            delivery_total=Decimal('100.00'),
            grand_total=Decimal('4620.00'),
            status=OrderStatus.DELIVERED
        )
        self.suborder = VendorSubOrder.objects.create(
            parent_order=self.order,
            vendor=self.vendor,
            store=self.store,
            sub_order_number='ORD-DASH-001-SUB-1',
            subtotal=Decimal('4000.00'),
            delivery_fee=Decimal('100.00'),
            commission_rate=Decimal('10.00'),
            commission_amount=Decimal('400.00'),
            vendor_net_amount=Decimal('3600.00'),
            status=OrderStatus.DELIVERED
        )
        self.order_item = OrderItem.objects.create(
            sub_order=self.suborder,
            variant=self.variant,
            product_name=self.product.name,
            variant_sku=self.variant.sku,
            unit_price=Decimal('2000.00'),
            quantity=2,
            tax_rate=Decimal('13.00'),
            tax_amount=Decimal('520.00'),
            total_price=Decimal('4520.00')
        )

        # 5. Supplier Wholesale Data
        self.supp_product = SupplierProduct.objects.create(
            supplier=self.supplier,
            name='Raw Wool Fabric Bolt',
            slug='raw-wool-fabric-bolt',
            sku='WOOL-BOLT-100M',
            wholesale_price=Decimal('15000.00'),
            moq=5,
            lead_time_days=7
        )
        self.po = PurchaseOrder.objects.create(
            supplier=self.supplier,
            vendor=self.vendor,
            po_number='PO-DASH-001',
            destination_warehouse=self.warehouse,
            total_amount=Decimal('75000.00'),
            tax_amount=Decimal('9750.00'),
            grand_total=Decimal('84750.00'),
            status=PurchaseOrderStatus.DELIVERED
        )
        self.supp_invoice = SupplierInvoice.objects.create(
            supplier=self.supplier,
            vendor=self.vendor,
            purchase_order=self.po,
            invoice_number='INV-DASH-001',
            billed_amount=Decimal('84750.00'),
            paid_amount=Decimal('0.00'),
            payment_status='UNPAID',
            due_date=timezone.now().date()
        )

    def test_vendor_profile_retrieval_and_update(self):
        """Vendor can retrieve their profile and update banking information."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('vendors:vendor_profile')

        # Retrieve profile
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()['business_name'], 'Nepal Handicrafts Co')

        # Update profile
        patch_res = self.client.patch(url, {
            'bank_name': 'Nepal Investment Mega Bank',
            'bank_account_number': '1112223334445'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.vendor.refresh_from_db()
        self.assertEqual(self.vendor.bank_name, 'Nepal Investment Mega Bank')
        self.assertEqual(self.vendor.bank_account_number, '1112223334445')

    def test_vendor_document_upload_kyc(self):
        """Vendor can upload KYC documents."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('vendors:vendor_documents')

        post_res = self.client.post(url, {
            'document_type': 'PAN_CERTIFICATE',
            'document_url': 'https://imagekit.io/oyopasal/pan-cert.jpg'
        })
        self.assertEqual(post_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.vendor.documents.count(), 1)

    def test_vendor_dashboard_overview_metrics(self):
        """Vendor can retrieve their dedicated dashboard metrics."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('vendors:vendor_dashboard_overview')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertIn('sales', data)
        self.assertIn('orders', data)
        self.assertIn('products', data)
        self.assertIn('financials', data)

        self.assertEqual(Decimal(data['sales']['total_sales']), Decimal('4000.00'))
        self.assertEqual(data['orders']['total_orders'], 1)
        self.assertEqual(data['orders']['delivered_orders'], 1)
        self.assertEqual(Decimal(data['financials']['vendor_net_earnings']), Decimal('3600.00'))
        self.assertEqual(Decimal(data['financials']['platform_commission']), Decimal('400.00'))

    def test_vendor_sales_trends_and_top_products(self):
        """Vendor can retrieve timeseries trends and top-performing products."""
        self.client.force_authenticate(user=self.vendor_user)

        # Sales Trends
        trends_res = self.client.get(reverse('vendors:vendor_sales_trends'))
        self.assertEqual(trends_res.status_code, status.HTTP_200_OK)
        trends = trends_res.json()
        self.assertGreaterEqual(len(trends), 1)
        self.assertEqual(Decimal(trends[0]['gross_sales']), Decimal('4000.00'))

        # Top Products
        products_res = self.client.get(reverse('vendors:vendor_top_products'))
        self.assertEqual(products_res.status_code, status.HTTP_200_OK)
        top_prods = products_res.json()
        self.assertEqual(len(top_prods), 1)
        self.assertEqual(top_prods[0]['product_name'], 'Singing Bowl Set')
        self.assertEqual(top_prods[0]['units_sold'], 2)

    def test_supplier_profile_retrieval_and_update(self):
        """Supplier can retrieve and update their commercial terms."""
        self.client.force_authenticate(user=self.supplier_user)
        url = reverse('suppliers:supplier_profile')

        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()['company_name'], 'Himalayan Textile Wholesalers')

        patch_res = self.client.patch(url, {
            'credit_terms_days': 60,
            'company_description': 'Leading wholesale textile supplier in South Asia'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.credit_terms_days, 60)

    def test_supplier_dashboard_overview_metrics(self):
        """Supplier can view their wholesale operations dashboard."""
        self.client.force_authenticate(user=self.supplier_user)
        url = reverse('suppliers:supplier_dashboard_overview')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertEqual(data['catalog']['total_products'], 1)
        self.assertEqual(data['orders']['total_purchase_orders'], 1)
        self.assertEqual(data['orders']['delivered_pos'], 1)
        self.assertEqual(Decimal(data['orders']['total_wholesale_sales']), Decimal('84750.00'))
        self.assertEqual(data['invoices']['unpaid_invoices_count'], 1)
        self.assertEqual(Decimal(data['invoices']['unpaid_invoices_amount']), Decimal('84750.00'))
        self.assertEqual(len(data['top_vendors']), 1)
        self.assertEqual(data['top_vendors'][0]['business_name'], 'Nepal Handicrafts Co')

    def test_cross_role_access_boundaries(self):
        """Customers cannot access vendor or supplier dashboards; Vendors cannot access supplier dashboard."""
        # Customer blocked from vendor dashboard
        self.client.force_authenticate(user=self.customer)
        res_v = self.client.get(reverse('vendors:vendor_dashboard_overview'))
        self.assertEqual(res_v.status_code, status.HTTP_403_FORBIDDEN)

        # Customer blocked from supplier dashboard
        res_s = self.client.get(reverse('suppliers:supplier_dashboard_overview'))
        self.assertEqual(res_s.status_code, status.HTTP_403_FORBIDDEN)

        # Vendor blocked from supplier dashboard
        self.client.force_authenticate(user=self.vendor_user)
        res_vs = self.client.get(reverse('suppliers:supplier_dashboard_overview'))
        self.assertEqual(res_vs.status_code, status.HTTP_403_FORBIDDEN)

        # Supplier blocked from vendor dashboard
        self.client.force_authenticate(user=self.supplier_user)
        res_sv = self.client.get(reverse('vendors:vendor_dashboard_overview'))
        self.assertEqual(res_sv.status_code, status.HTTP_403_FORBIDDEN)
