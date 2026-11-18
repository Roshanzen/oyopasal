from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.suppliers.models import SupplierProfile, SupplierStatus
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.warehouse.models import Warehouse
from apps.catalogue.models import Product, ProductVariant
from apps.inventory.models import InventoryItem
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    PurchaseOrderStatus,
    GoodsReceipt,
    SupplierInvoice
)

User = get_user_model()

class ProcurementB2BTests(APITestCase):
    def setUp(self):
        # 1. Supplier User & Profile
        self.supplier_user = User.objects.create_user(
            email='supplier@himalayandistributors.com',
            password='SupplierPass123!',
            role=UserRole.SUPPLIER_OWNER,
            is_verified=True
        )
        self.supplier_profile = SupplierProfile.objects.create(
            user=self.supplier_user,
            company_name='Himalayan Bulk Distributors Pvt Ltd',
            slug='himalayan-bulk-distributors',
            status=SupplierStatus.APPROVED,
            credit_terms_days=30
        )

        # 2. Vendor User & Profile & Warehouse
        self.vendor_user = User.objects.create_user(
            email='vendor@pashminamart.com',
            password='VendorPass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Pashmina Mart Nepal',
            slug='pashmina-mart',
            status=VendorStatus.APPROVED
        )
        self.vendor_warehouse = Warehouse.objects.create(
            vendor=self.vendor_profile,
            name='Pashmina Mart Depot',
            code='PASH-DEPOT-01',
            district='Kathmandu',
            city='Kathmandu',
            address_line='Chabahil, Kathmandu'
        )

        # 3. Vendor Product in Catalogue (to receive inventory upon GRN)
        self.store = Store.objects.create(
            vendor=self.vendor_profile,
            name='Pashmina Store',
            slug='pashmina-store'
        )
        from apps.catalogue.models import Category
        self.cat = Category.objects.create(name='Textiles', slug='textiles')
        self.vendor_product = Product.objects.create(
            vendor=self.vendor_profile,
            store=self.store,
            category=self.cat,
            name='Pure Cashmere Shawl',
            base_sku='CASH-SHW-01',
            status='APPROVED'
        )
        self.vendor_variant = ProductVariant.objects.create(
            product=self.vendor_product,
            sku='CASH-SHW-01-GRY',
            regular_price=Decimal('5000.00'),
            selling_price=Decimal('4500.00'),
            is_default=True
        )

        # 4. Supplier Wholesale Product
        self.wholesale_product = SupplierProduct.objects.create(
            supplier=self.supplier_profile,
            name='Grade A Cashmere Raw Yarn',
            slug='grade-a-cashmere-raw-yarn',
            sku='CASH-SHW-01-GRY', # Matching SKU for automatic inventory mapping
            wholesale_price=Decimal('2000.00'),
            moq=50,
            bulk_price_tiers=[
                {'min_qty': 100, 'price': '1800.00'},
                {'min_qty': 500, 'price': '1600.00'}
            ],
            available_stock=5000,
            lead_time_days=4,
            is_active=True
        )

    def test_vendor_rfq_submission_enforces_moq(self):
        """Verify vendor RFQ creation validates Minimum Order Quantity (MOQ)."""
        self.client.force_authenticate(user=self.vendor_user)
        rfq_url = reverse('procurement:vendor_rfqs')

        # Try below MOQ (MOQ is 50, requesting 20)
        res_fail = self.client.post(rfq_url, {
            'product_id': str(self.wholesale_product.id),
            'quantity': 20,
            'notes': 'Trial batch'
        })
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_fail.data['success'])

        # Valid RFQ meeting MOQ (50 units)
        res_ok = self.client.post(rfq_url, {
            'product_id': str(self.wholesale_product.id),
            'quantity': 50,
            'target_price': '1900.00',
            'notes': 'First commercial order'
        })
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_ok.data['success'])
        self.assertEqual(QuotationRequest.objects.count(), 1)

    def test_end_to_end_procurement_workflow(self):
        """
        Complete B2B Procurement Lifecycle:
        1. Vendor submits RFQ for 100 units.
        2. Supplier reviews RFQ and submits formal quote @ NPR 1800/unit.
        3. Vendor accepts quote and issues Purchase Order (PO).
        4. Supplier confirms and dispatches PO with tracking number.
        5. Vendor receives physical delivery:
           - 95 accepted, 5 damaged.
           - GRN verified.
           - Vendor warehouse inventory atomically increments by exactly 95 units!
           - Supplier invoice issued for 95 units @ 1800 = NPR 171,000.
        """
        # Step 1: Vendor creates RFQ
        self.client.force_authenticate(user=self.vendor_user)
        rfq_res = self.client.post(reverse('procurement:vendor_rfqs'), {
            'product_id': str(self.wholesale_product.id),
            'quantity': 100
        })
        rfq_id = rfq_res.data['data']['id']

        # Step 2: Supplier submits Quotation
        self.client.force_authenticate(user=self.supplier_user)
        quote_url = reverse('procurement:supplier_submit_quote', kwargs={'rfq_id': rfq_id})
        quote_res = self.client.post(quote_url, {
            'unit_price': '1800.00',
            'lead_time_days': 3,
            'validity_days': 10,
            'remarks': 'Discount applied for 100 unit tier'
        })
        self.assertEqual(quote_res.status_code, status.HTTP_201_CREATED)
        quote_id = quote_res.data['data']['id']
        self.assertEqual(Decimal(quote_res.data['data']['total_amount']), Decimal('180000.00'))

        # Step 3: Vendor accepts Quotation and issues Purchase Order
        self.client.force_authenticate(user=self.vendor_user)
        accept_url = reverse('procurement:vendor_accept_quote', kwargs={'quotation_id': quote_id})
        po_res = self.client.post(accept_url, {
            'destination_warehouse_id': str(self.vendor_warehouse.id),
            'payment_terms': '30_DAYS_CREDIT',
            'notes': 'Please deliver to Chabahil depot'
        })
        self.assertEqual(po_res.status_code, status.HTTP_201_CREATED)
        po_id = po_res.data['data']['id']
        po = PurchaseOrder.objects.get(id=po_id)
        self.assertEqual(po.status, PurchaseOrderStatus.SUBMITTED)

        # Step 4: Supplier Dispatches PO
        self.client.force_authenticate(user=self.supplier_user)
        dispatch_url = reverse('procurement:supplier_dispatch_po', kwargs={'id': po.id})
        dispatch_res = self.client.post(dispatch_url, {'tracking_number': 'HIMALAYAN-CARGO-7766'})
        self.assertEqual(dispatch_res.status_code, status.HTTP_200_OK)
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrderStatus.DISPATCHED)
        self.assertEqual(po.tracking_number, 'HIMALAYAN-CARGO-7766')

        # Step 5: Vendor receives Goods & confirms GRN
        self.client.force_authenticate(user=self.vendor_user)
        po_item = po.items.first()
        grn_url = reverse('procurement:vendor_process_grn', kwargs={'id': po.id})
        grn_res = self.client.post(grn_url, {
            'accepted_items': {str(po_item.id): 95},
            'damaged_items': {str(po_item.id): 5},
            'remarks': '5 packages torn in transit; 95 pristine'
        }, format='json')
        self.assertEqual(grn_res.status_code, status.HTTP_200_OK)
        self.assertTrue(grn_res.data['success'])

        # Verify PO marked DELIVERED
        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrderStatus.DELIVERED)

        # Verify Vendor Warehouse Inventory was updated ONLY for the 95 accepted units
        inv_item = InventoryItem.objects.get(
            warehouse=self.vendor_warehouse,
            variant=self.vendor_variant
        )
        self.assertEqual(inv_item.quantity_on_hand, 95)
        self.assertEqual(inv_item.quantity_available, 95)

        # Verify Supplier Invoice was generated for 95 units @ 1800 = 171,000 NPR
        invoice = SupplierInvoice.objects.get(purchase_order=po)
        self.assertEqual(invoice.billed_amount, Decimal('171000.00'))
        self.assertEqual(invoice.payment_status, 'UNPAID')

