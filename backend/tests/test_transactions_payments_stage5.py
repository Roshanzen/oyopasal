import base64
import json
import uuid
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.vendors.models import VendorProfile
from apps.stores.models import Store
from apps.suppliers.models import SupplierProfile
from apps.warehouse.models import Warehouse
from apps.inventory.models import InventoryItem, StockMovement, StockMovementType, StockReservation
from apps.cart.models import Cart, CartItem
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.orders.services import CheckoutService, OrderService
from apps.payments.models import (
    Payment,
    PaymentStatus,
    PaymentProvider,
    FinancialLedgerEntry,
    LedgerEntryType,
    DebitCredit
)
from apps.payments.services import PaymentProcessingService
from apps.payments.gateways import EsewaGateway, KhaltiGateway, CODGateway
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    PurchaseOrderStatus,
    GoodsReceipt,
    SupplierInvoice,
    RFQStatus
)
from apps.procurement.services import ProcurementService

User = get_user_model()


class TransactionsAndPaymentsStage5Tests(APITestCase):
    def setUp(self):
        # 1. Platform Category
        self.category = Category.objects.create(name='Consumer Tech', slug='consumer-tech', is_active=True)

        # 2. Central Warehouse
        self.warehouse = Warehouse.objects.create(
            name='Kathmandu Central Logistics Hub',
            code='WH-KTM-MAIN',
            city='Kathmandu',
            district='Kathmandu',
            province='BAGMATI',
            address_line='Balaju Industrial Area',
            is_active=True
        )

        # 3. Customer User & Cart
        self.customer_user = User.objects.create_user(
            email='shopper.nepal@example.com',
            password='Password123!',
            first_name='Aayush',
            last_name='Shrestha',
            role=UserRole.CUSTOMER
        )
        self.cart = Cart.objects.create(user=self.customer_user)

        # 4. Vendor 1 (10% standard commission)
        self.vendor1_user = User.objects.create_user(
            email='merchant1@example.com',
            password='Password123!',
            first_name='Bikash',
            last_name='Adhikari',
            role=UserRole.VENDOR_OWNER
        )
        self.vendor1 = VendorProfile.objects.create(
            user=self.vendor1_user,
            business_name='Bikash Electronics Store',
            slug='bikash-electronics',
            pan_vat_number='102938475',
            status='APPROVED',
            commission_rate_override=Decimal('10.00')
        )
        self.store1 = Store.objects.create(
            vendor=self.vendor1,
            name='Bikash Electronics Official',
            slug='bikash-electronics-official',
            is_active=True
        )

        # 5. Vendor 2 (8% special negotiated commission)
        self.vendor2_user = User.objects.create_user(
            email='merchant2@example.com',
            password='Password123!',
            first_name='Sunita',
            last_name='Ghimire',
            role=UserRole.VENDOR_OWNER
        )
        self.vendor2 = VendorProfile.objects.create(
            user=self.vendor2_user,
            business_name='Sunita Accessories Mart',
            slug='sunita-accessories',
            pan_vat_number='987654321',
            status='APPROVED',
            commission_rate_override=Decimal('8.00')
        )
        self.store2 = Store.objects.create(
            vendor=self.vendor2,
            name='Sunita Accessories Official',
            slug='sunita-accessories-official',
            is_active=True
        )

        # 6. Supplier Profile
        self.supplier_user = User.objects.create_user(
            email='supplier.nepal@example.com',
            password='Password123!',
            first_name='Ramesh',
            last_name='Karki',
            role=UserRole.SUPPLIER_OWNER
        )
        self.supplier = SupplierProfile.objects.create(
            user=self.supplier_user,
            company_name='Himalayan Wholesale Distributors Ltd',
            slug='himalayan-wholesale-distributors',
            pan_vat_number='556677889',
            status='APPROVED',
            credit_terms_days=30
        )

        # 7. Products from Vendor 1 and Vendor 2
        self.prod1 = Product.objects.create(
            vendor=self.vendor1,
            store=self.store1,
            category=self.category,
            name='Wireless ANC Headphones',
            slug='wireless-anc-headphones',
            base_sku='ANC-HP-01',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        self.var1 = ProductVariant.objects.create(
            product=self.prod1,
            sku='ANC-HP-01-BLK',
            regular_price=Decimal('6000.00'),
            selling_price=Decimal('5000.00'),
            is_default=True,
            is_active=True
        )
        self.inv1 = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.var1,
            quantity_on_hand=50,
            quantity_reserved=0
        )

        self.prod2 = Product.objects.create(
            vendor=self.vendor2,
            store=self.store2,
            category=self.category,
            name='Magnetic Phone Mount',
            slug='magnetic-phone-mount',
            base_sku='MAG-MNT-01',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        self.var2 = ProductVariant.objects.create(
            product=self.prod2,
            sku='MAG-MNT-01-SILVER',
            regular_price=Decimal('1500.00'),
            selling_price=Decimal('1200.00'),
            is_default=True,
            is_active=True
        )
        self.inv2 = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.var2,
            quantity_on_hand=100,
            quantity_reserved=0
        )

        # Address data snapshot
        self.shipping_address = {
            'recipient_name': 'Aayush Shrestha',
            'recipient_phone': '9841234567',
            'province': 'BAGMATI',
            'district': 'Kathmandu',
            'municipality': 'Kathmandu Metropolitan',
            'ward_number': 3,
            'tole_street': 'Maharajgunj Tole',
            'landmark': 'Near Teaching Hospital'
        }

    def test_multi_vendor_order_splitting(self):
        """Checkout cart containing items from 2 vendors correctly splits into 2 SubOrders."""
        # Add 1 unit of prod1 and 2 units of prod2
        CartItem.objects.create(cart=self.cart, variant=self.var1, quantity=1)
        CartItem.objects.create(cart=self.cart, variant=self.var2, quantity=2)

        order = CheckoutService.process_checkout(
            user=self.customer_user,
            shipping_address_data=self.shipping_address,
            payment_method='ESEWA'
        )

        # Parent order assertions
        self.assertEqual(order.customer, self.customer_user)
        self.assertEqual(order.status, OrderStatus.PENDING_PAYMENT)
        self.assertEqual(order.subtotal, Decimal('7400.00'))  # 5000 + (1200 * 2) = 7400
        self.assertEqual(order.delivery_total, Decimal('0.00'))  # Orders >= Rs 499 receive free delivery
        self.assertEqual(order.tax_total, Decimal('962.00'))  # 13% VAT of 7400 = 962.00
        self.assertEqual(order.grand_total, Decimal('8362.00'))  # 7400 + 0 + 962 = 8362.00

        # Suborders assertions: Must be exactly 2
        suborders = list(order.suborders.all())
        self.assertEqual(len(suborders), 2)

        # Suborder 1 (Vendor 1)
        sub1 = next(s for s in suborders if s.vendor == self.vendor1)
        self.assertEqual(sub1.subtotal, Decimal('5000.00'))
        self.assertEqual(sub1.commission_rate, Decimal('10.00'))
        self.assertEqual(sub1.commission_amount, Decimal('500.00'))
        self.assertEqual(sub1.vendor_net_amount, Decimal('4500.00'))
        self.assertEqual(sub1.items.count(), 1)

        # Suborder 2 (Vendor 2)
        sub2 = next(s for s in suborders if s.vendor == self.vendor2)
        self.assertEqual(sub2.subtotal, Decimal('2400.00'))
        self.assertEqual(sub2.commission_rate, Decimal('8.00'))
        self.assertEqual(sub2.commission_amount, Decimal('192.00'))
        self.assertEqual(sub2.vendor_net_amount, Decimal('2208.00'))
        self.assertEqual(sub2.items.count(), 1)

        # Inventory holds
        self.inv1.refresh_from_db()
        self.inv2.refresh_from_db()
        self.assertEqual(self.inv1.quantity_reserved, 1)
        self.assertEqual(self.inv2.quantity_reserved, 2)

        # Cart is cleared
        self.assertEqual(self.cart.items.count(), 0)

    def test_esewa_payment_flow_and_ledger_entries(self):
        """Test eSewa v2 initiation, signature validation, ledger creation, and idempotency."""
        CartItem.objects.create(cart=self.cart, variant=self.var1, quantity=1)
        order = CheckoutService.process_checkout(
            user=self.customer_user,
            shipping_address_data=self.shipping_address,
            payment_method='ESEWA'
        )

        # 1. Initiate eSewa payment
        init_data = PaymentProcessingService.initiate_order_payment(order, provider='ESEWA')
        self.assertEqual(init_data['status'], PaymentStatus.INITIATED)
        fields = init_data['gateway_data']['fields']
        self.assertEqual(fields['product_code'], 'EPAYTEST')
        self.assertIn('signature', fields)

        # 2. Verify with valid HMAC signature
        esewa = EsewaGateway()
        amount_str = f"{order.grand_total:.2f}"
        txn_ref = init_data['transaction_reference']
        valid_sig = esewa._generate_signature(f"total_amount={amount_str},transaction_uuid={txn_ref},product_code=EPAYTEST")

        callback_payload = {
            'status': 'COMPLETE',
            'transaction_code': '0003ABCDEF',
            'transaction_uuid': txn_ref,
            'total_amount': amount_str,
            'signature': valid_sig
        }

        payment = PaymentProcessingService.verify_order_payment(txn_ref, callback_payload)
        self.assertEqual(payment.status, PaymentStatus.SUCCESS)

        # Order must now be confirmed
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CONFIRMED)
        self.assertEqual(order.payment_status, 'PAID')

        # Double-entry ledger verification
        ledgers = FinancialLedgerEntry.objects.filter(order=order)
        self.assertTrue(ledgers.filter(entry_type=LedgerEntryType.CUSTOMER_PAYMENT, direction=DebitCredit.DEBIT).exists())
        self.assertTrue(ledgers.filter(entry_type=LedgerEntryType.VENDOR_PAYABLE, direction=DebitCredit.CREDIT).exists())
        self.assertTrue(ledgers.filter(entry_type=LedgerEntryType.PLATFORM_COMMISSION, direction=DebitCredit.CREDIT).exists())
        self.assertTrue(ledgers.filter(entry_type=LedgerEntryType.TAX, direction=DebitCredit.CREDIT).exists())

        # 3. Idempotency test: repeating callback does NOT create duplicate ledgers
        ledger_count_before = ledgers.count()
        payment_retry = PaymentProcessingService.verify_order_payment(txn_ref, callback_payload)
        self.assertEqual(payment_retry.status, PaymentStatus.SUCCESS)
        self.assertEqual(FinancialLedgerEntry.objects.filter(order=order).count(), ledger_count_before)

    def test_esewa_invalid_signature_rejection(self):
        """Invalid eSewa signature marks payment as FAILED."""
        CartItem.objects.create(cart=self.cart, variant=self.var2, quantity=1)
        order = CheckoutService.process_checkout(
            user=self.customer_user,
            shipping_address_data=self.shipping_address,
            payment_method='ESEWA'
        )
        init_data = PaymentProcessingService.initiate_order_payment(order, provider='ESEWA')
        txn_ref = init_data['transaction_reference']

        bad_callback = {
            'status': 'COMPLETE',
            'transaction_uuid': txn_ref,
            'total_amount': '100.00',
            'signature': 'FORGED_INVALID_SIGNATURE'
        }
        payment = PaymentProcessingService.verify_order_payment(txn_ref, bad_callback)
        self.assertEqual(payment.status, PaymentStatus.FAILED)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'UNPAID')

    def test_cod_limit_protection(self):
        """COD accepts orders under threshold and rejects orders exceeding NPR 50,000."""
        # Expensive product
        expensive_prod = Product.objects.create(
            vendor=self.vendor1,
            store=self.store1,
            category=self.category,
            name='Enterprise Server Blade',
            slug='enterprise-server-blade',
            base_sku='SRV-BLD-01',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        expensive_var = ProductVariant.objects.create(
            product=expensive_prod,
            sku='SRV-BLD-01-X',
            regular_price=Decimal('60000.00'),
            selling_price=Decimal('55000.00'),
            is_default=True,
            is_active=True
        )
        InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=expensive_var,
            quantity_on_hand=5,
            quantity_reserved=0
        )

        CartItem.objects.create(cart=self.cart, variant=expensive_var, quantity=1)

        # Attempt checkout via COD
        with self.assertRaises(ValueError) as ctx:
            CheckoutService.process_checkout(
                user=self.customer_user,
                shipping_address_data=self.shipping_address,
                payment_method='COD'
            )
        self.assertIn('50,000', str(ctx.exception))

    def test_suborder_lifecycle_and_reservation_commit(self):
        """Transitioning SubOrder to SHIPPED commits the physical stock hold into permanent dispatch."""
        CartItem.objects.create(cart=self.cart, variant=self.var1, quantity=2)
        order = CheckoutService.process_checkout(
            user=self.customer_user,
            shipping_address_data=self.shipping_address,
            payment_method='COD'
        )
        sub_order = order.suborders.first()
        self.assertEqual(sub_order.status, OrderStatus.CONFIRMED)

        # Progression: CONFIRMED -> PROCESSING -> PACKED -> SHIPPED
        OrderService.transition_suborder(sub_order.id, OrderStatus.PROCESSING, user=self.vendor1_user)
        OrderService.transition_suborder(sub_order.id, OrderStatus.PACKED, user=self.vendor1_user)
        shipped_suborder = OrderService.transition_suborder(
            sub_order.id,
            OrderStatus.SHIPPED,
            user=self.vendor1_user,
            tracking_number='NPL-EXP-998811',
            delivery_provider='Nepal Express Logistics'
        )

        self.assertEqual(shipped_suborder.status, OrderStatus.SHIPPED)
        self.assertEqual(shipped_suborder.tracking_number, 'NPL-EXP-998811')

        # Stock reservation should now be committed
        self.inv1.refresh_from_db()
        self.assertEqual(self.inv1.quantity_on_hand, 48)  # 50 - 2 = 48
        self.assertEqual(self.inv1.quantity_reserved, 0)

        # Stock movement ledger check
        dispatch_movement = StockMovement.objects.filter(
            inventory_item=self.inv1,
            movement_type=StockMovementType.DISPATCH
        ).first()
        self.assertIsNotNone(dispatch_movement)
        self.assertEqual(dispatch_movement.quantity, -2)

    def test_b2b_wholesale_procurement_cycle(self):
        """End-to-end B2B procurement: RFQ -> Quote -> PO -> Dispatch -> GRN & Inventory Restock."""
        # 1. Supplier creates wholesale product
        sup_product = SupplierProduct.objects.create(
            supplier=self.supplier,
            category=self.category,
            name='Wholesale Type-C Fast Chargers (Pack of 50)',
            slug='wholesale-type-c-fast-chargers',
            sku='SUP-CHG-50PK',
            wholesale_price=Decimal('15000.00'),
            moq=5,
            available_stock=500
        )

        # 2. Vendor submits RFQ for 10 packs
        rfq = ProcurementService.create_rfq(
            vendor=self.vendor1,
            product=sup_product,
            quantity=10,
            target_price=Decimal('14000.00'),
            notes='Need high quality chargers for Kathmandu trade festival'
        )
        self.assertEqual(rfq.status, RFQStatus.SUBMITTED)

        # 3. Supplier provides quotation
        quote = ProcurementService.submit_quotation(
            supplier=self.supplier,
            rfq_id=rfq.id,
            unit_price=Decimal('14200.00'),
            lead_time_days=2,
            remarks='Special wholesale rate approved'
        )
        self.assertEqual(quote.status, RFQStatus.QUOTED)
        self.assertEqual(quote.total_amount, Decimal('142000.00'))

        # 4. Vendor accepts quotation -> creates official Purchase Order (PO)
        po = ProcurementService.accept_quotation_and_create_po(
            vendor=self.vendor1,
            quotation_id=quote.id,
            warehouse_id=self.warehouse.id
        )
        self.assertEqual(po.status, PurchaseOrderStatus.SUBMITTED)
        self.assertEqual(po.grand_total, Decimal('142000.00'))

        # 5. Supplier confirms & dispatches PO
        dispatched_po = ProcurementService.confirm_and_dispatch_po(
            supplier=self.supplier,
            po_id=po.id,
            tracking_number='HIM-TRK-77441'
        )
        self.assertEqual(dispatched_po.status, PurchaseOrderStatus.DISPATCHED)

        # 6. Vendor receives physical delivery at destination warehouse (GRN)
        item = po.items.first()
        grn = ProcurementService.process_goods_receipt(
            vendor=self.vendor1,
            po_id=po.id,
            accepted_items={str(item.id): 10},
            user=self.vendor1_user,
            remarks='All 10 packs received intact and tested'
        )
        self.assertTrue(grn.is_inventory_updated)

        po.refresh_from_db()
        self.assertEqual(po.status, PurchaseOrderStatus.DELIVERED)

        # Verifies SupplierInvoice was automatically generated
        self.assertTrue(SupplierInvoice.objects.filter(purchase_order=po, billed_amount=Decimal('142000.00')).exists())

        # Verifies incoming stock movement recorded in vendor warehouse
        incoming_movement = StockMovement.objects.filter(
            movement_type=StockMovementType.INCOMING,
            reference_id=po.po_number
        ).first()
        self.assertIsNotNone(incoming_movement)
        self.assertEqual(incoming_movement.quantity, 10)

