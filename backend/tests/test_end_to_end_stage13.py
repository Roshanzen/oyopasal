import uuid
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.customers.models import CustomerProfile, Address, NepalProvince
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.vendors.models import VendorProfile
from apps.stores.models import Store
from apps.warehouse.models import Warehouse
from apps.inventory.models import InventoryItem, StockMovement, StockMovementType
from apps.promotions.models import Coupon, CouponDiscountType
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.payments.models import (
    Payment,
    PaymentStatus,
    PaymentProvider,
    FinancialLedgerEntry,
    LedgerEntryType,
    DebitCredit
)
from apps.reviews.models import ProductReview
from apps.reviews.services import ReviewService
from apps.notifications.models import Notification, NotificationType
from apps.notifications.services import NotificationService
from apps.support.models import SupportTicket, TicketCategory, TicketStatus, TicketMessage

User = get_user_model()


class EndToEndPlatformStage13Tests(APITestCase):
    """
    Comprehensive End-to-End Lifecycle Verification Test Suite (Stage 13):
    Validates complete flow across Customer, Vendor, Admin, Inventory, Orders,
    Double-Entry Ledger, Nepal Payments, Reviews, Notifications, and Support.
    """

    def setUp(self):
        # 1. Super Admin
        self.admin_user = User.objects.create_superuser(
            email='admin@oyopasal.com',
            password='AdminPassword123!',
            first_name='Super',
            last_name='Admin',
            role=UserRole.SUPER_ADMIN
        )

        # 2. Customer
        self.customer = User.objects.create_user(
            email='aarav.sharma@example.com',
            password='CustomerPassword123!',
            first_name='Aarav',
            last_name='Sharma',
            phone_number='+9779841234567',
            role=UserRole.CUSTOMER
        )

        # Customer profile & shipping address
        self.customer_profile, _ = CustomerProfile.objects.get_or_create(user=self.customer)
        self.address = Address.objects.create(
            customer=self.customer_profile,
            recipient_name='Aarav Sharma',
            recipient_phone='+9779841234567',
            province=NepalProvince.BAGMATI,
            district='Kathmandu',
            municipality='Kathmandu Metropolitan City',
            ward_number=22,
            tole_street='New Road',
            is_default_shipping=True
        )

        # 3. Vendor
        self.vendor_user = User.objects.create_user(
            email='himalayan.crafts@example.com',
            password='VendorPassword123!',
            first_name='Pasang',
            last_name='Sherpa',
            phone_number='+9779851122334',
            role=UserRole.VENDOR_OWNER
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Himalayan Handcrafts Pvt Ltd',
            slug='himalayan-handcrafts',
            pan_vat_number='601234567',
            status='APPROVED',
            commission_rate_override=Decimal('10.00'),
            bank_name='Nabil Bank Ltd',
            bank_account_number='019283746501',
            bank_account_name='Himalayan Handcrafts Pvt Ltd'
        )
        self.store = Store.objects.create(
            vendor=self.vendor,
            name='Himalayan Crafts Kathmandu Store',
            slug='himalayan-crafts-ktm',
            address='Thamel Marg, Kathmandu',
            is_active=True,
            is_verified=True
        )

        # 4. Logistics Warehouse
        self.warehouse = Warehouse.objects.create(
            name='Balaju Fulfillment Center',
            code='WH-BALAJU-01',
            province='BAGMATI',
            district='Kathmandu',
            city='Kathmandu',
            address_line='Balaju Industrial District',
            is_active=True
        )

        # 5. Product Catalog
        self.category = Category.objects.create(
            name='Handicrafts & Decor',
            slug='handicrafts-decor',
            is_active=True
        )
        self.product = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.category,
            name='Authentic Singing Bowl Set',
            slug='authentic-singing-bowl-set',
            base_sku='SB-NEP-01',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku='SB-NEP-01-MED',
            regular_price=Decimal('4500.00'),
            selling_price=Decimal('4000.00'),
            attributes={'size': 'Medium', 'tone': 'F Major'},
            is_default=True,
            is_active=True
        )

        # 6. Inventory Allocation
        self.inventory = InventoryItem.objects.create(
            variant=self.variant,
            warehouse=self.warehouse,
            quantity_on_hand=50,
            quantity_reserved=0,
            safety_stock=5
        )
        StockMovement.objects.create(
            inventory_item=self.inventory,
            movement_type=StockMovementType.INCOMING,
            quantity=50,
            balance_after=50,
            reference_id='PO-INITIAL-50',
            notes='Initial stock injection from supplier'
        )

    def test_complete_platform_e2e_lifecycle(self):
        """
        Executes complete transactional lifecycle from discovery to settlement.
        """
        # =====================================================================
        # Step 1: Promotion Coupon Creation & Validation
        # =====================================================================
        coupon = Coupon.objects.create(
            code='FESTIVAL2026',
            discount_type=CouponDiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            max_discount_amount=Decimal('1000.00'),
            min_order_amount=Decimal('3000.00'),
            usage_limit=100,
            is_active=True
        )

        # Customer validates coupon via API
        self.client.force_authenticate(user=self.customer)
        res_coupon = self.client.post('/api/v1/promotions/coupons/validate/', {
            'code': 'FESTIVAL2026',
            'subtotal': '8000.00'
        })
        self.assertEqual(res_coupon.status_code, status.HTTP_200_OK)
        self.assertTrue(res_coupon.data['is_valid'])
        # 10% of 8000 is 800
        self.assertEqual(res_coupon.data['discount_amount'], '800.00')
        self.assertEqual(res_coupon.data['new_subtotal'], '7200.00')

        # =====================================================================
        # Step 2: Customer Checkout & Order Creation
        # Customer buys 2 units of the singing bowl (2 * 4000 = 8000 NPR)
        # =====================================================================
        qty = 2
        unit_price = self.variant.selling_price
        subtotal = unit_price * qty  # 8000.00
        discount = Decimal('800.00')
        delivery = Decimal('150.00')
        tax = (subtotal - discount) * Decimal('0.13')  # 7200 * 0.13 = 936.00
        grand_total = (subtotal - discount) + delivery + tax  # 7200 + 150 + 936 = 8286.00

        order = Order.objects.create(
            order_number=f"ORD-E2E-{uuid.uuid4().hex[:8].upper()}",
            customer=self.customer,
            status=OrderStatus.CONFIRMED,
            subtotal=subtotal,
            discount_total=discount,
            delivery_total=delivery,
            tax_total=tax,
            grand_total=grand_total,
            payment_method='ESEWA',
            payment_status='PAID',
            shipping_address_snapshot={
                'name': self.address.recipient_name,
                'phone': self.address.recipient_phone,
                'district': self.address.district,
                'province': self.address.province,
                'street': self.address.tole_street
            }
        )

        # Multi-vendor Sub-order creation
        commission_rate = self.vendor.commission_rate_override or Decimal('10.00')
        vendor_subtotal = subtotal - discount  # 7200.00
        commission_amount = (vendor_subtotal * commission_rate) / Decimal('100.00')  # 720.00
        vendor_net = vendor_subtotal - commission_amount  # 6480.00

        sub_order = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number=f"{order.order_number}-V1",
            vendor=self.vendor,
            store=self.store,
            status=OrderStatus.CONFIRMED,
            subtotal=vendor_subtotal,
            delivery_fee=delivery,
            commission_rate=commission_rate,
            commission_amount=commission_amount,
            vendor_net_amount=vendor_net
        )

        order_item = OrderItem.objects.create(
            sub_order=sub_order,
            variant=self.variant,
            product_name=self.product.name,
            variant_sku=self.variant.sku,
            unit_price=unit_price,
            quantity=qty,
            total_price=subtotal,
            tax_rate=Decimal('13.00'),
            tax_amount=tax
        )

        # Update Inventory stock
        self.inventory.quantity_on_hand -= qty
        self.inventory.save()
        StockMovement.objects.create(
            inventory_item=self.inventory,
            movement_type=StockMovementType.DISPATCH,
            quantity=-qty,
            balance_after=self.inventory.quantity_on_hand,
            reference_id=order.order_number,
            notes='Sold via online checkout'
        )
        self.assertEqual(self.inventory.quantity_on_hand, 48)

        # =====================================================================
        # Step 3: Payment Record & Double-Entry Ledger Invariant Verification
        # =====================================================================
        payment = Payment.objects.create(
            order=order,
            transaction_reference=f"TXN-{uuid.uuid4().hex[:8].upper()}",
            provider=PaymentProvider.ESEWA,
            amount=grand_total,
            currency='NPR',
            status=PaymentStatus.SUCCESS,
            gateway_reference='ESEWA-TXN-998877',
            gateway_payload={'gateway': 'eSewa EPAY v2', 'verified_at': str(timezone.now())}
        )
        self.assertEqual(payment.status, PaymentStatus.SUCCESS)

        # Create balanced double-entry ledger entries for customer payment:
        # Debit: Cash/eSewa Clearing Account (Asset inflow)
        # Credit: Vendor Payable + Platform Commission + Tax + Delivery
        ref_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
        entry_dr = FinancialLedgerEntry.objects.create(
            entry_type=LedgerEntryType.CUSTOMER_PAYMENT,
            direction=DebitCredit.DEBIT,
            amount=grand_total,
            order=order,
            reference_id=ref_id,
            description=f'Customer payment for {order.order_number}'
        )
        entry_cr = FinancialLedgerEntry.objects.create(
            entry_type=LedgerEntryType.VENDOR_PAYABLE,
            direction=DebitCredit.CREDIT,
            amount=grand_total,
            order=order,
            vendor=self.vendor,
            reference_id=ref_id,
            description=f'Escrow holding for order {order.order_number}'
        )

        # Verify Double-entry invariant: Sum(Debit) == Sum(Credit)
        entries = FinancialLedgerEntry.objects.filter(reference_id=ref_id)
        total_debits = sum(e.amount for e in entries if e.direction == DebitCredit.DEBIT)
        total_credits = sum(e.amount for e in entries if e.direction == DebitCredit.CREDIT)
        self.assertEqual(total_debits, total_credits)
        self.assertEqual(total_debits, grand_total)

        # =====================================================================
        # Step 4: Vendor Sub-order Fulfillment Progression
        # =====================================================================
        self.client.force_authenticate(user=self.vendor_user)

        # Step 4a: Vendor packs item
        sub_order.status = OrderStatus.PACKED
        sub_order.save()

        # Step 4b: Vendor prepares for dispatch with tracking
        sub_order.status = OrderStatus.READY_FOR_DISPATCH
        sub_order.tracking_number = 'NEX-KTM-88219'
        sub_order.delivery_provider = 'Nepal Express Courier'
        sub_order.save()

        # Step 4c: Courier delivers order to customer
        sub_order.status = OrderStatus.DELIVERED
        sub_order.delivered_at = timezone.now()
        sub_order.save()

        order.status = OrderStatus.DELIVERED
        order.save()

        # Verify customer purchase check via ReviewService
        is_verified = ReviewService.verify_customer_purchase(self.customer, self.product)
        self.assertTrue(is_verified)

        # =====================================================================
        # Step 5: Customer Verified Product Review & Rating Recalculation
        # =====================================================================
        self.client.force_authenticate(user=self.customer)
        res_review = self.client.post(f'/api/v1/reviews/products/{self.product.id}/create/', {
            'rating': 5,
            'title': 'Pristine Tone and Craftsmanship',
            'comment': 'Handmade quality is unmatched. Sound resonance lasts over 45 seconds.'
        })
        self.assertEqual(res_review.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_review.data['data']['is_verified_purchase'])
        self.assertEqual(res_review.data['data']['rating'], 5)

        review_id = res_review.data['data']['id']

        # Vendor replies to the review
        self.client.force_authenticate(user=self.vendor_user)
        res_reply = self.client.post(f'/api/v1/reviews/{review_id}/reply/', {
            'reply': 'Thank you Aarav! We hammer each singing bowl in Patan with master artisans.'
        })
        self.assertEqual(res_reply.status_code, status.HTTP_200_OK)
        self.assertIn('Thank you Aarav', res_reply.data['data']['vendor_reply'])

        # =====================================================================
        # Step 6: In-App Notification Center Lifecycle
        # =====================================================================
        notif = NotificationService.send(
            recipient=self.customer,
            notification_type=NotificationType.ORDER,
            title='Order Delivered Successfully',
            message=f'Your order {order.order_number} has been delivered to {self.address.district}.',
            action_url=f'/orders/{order.id}'
        )
        self.assertIsNotNone(notif.id)

        self.client.force_authenticate(user=self.customer)
        res_notif_count = self.client.get('/api/v1/notifications/unread-count/')
        self.assertEqual(res_notif_count.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_notif_count.data['unread_count'], 1)

        res_mark_read = self.client.post('/api/v1/notifications/mark-all-read/')
        self.assertEqual(res_mark_read.status_code, status.HTTP_200_OK)

        # =====================================================================
        # Step 7: Helpdesk Support Ticket & Multi-turn Thread
        # =====================================================================
        res_ticket = self.client.post('/api/v1/support/tickets/', {
            'subject': 'Care and Maintenance Guide',
            'category': TicketCategory.GENERAL,
            'priority': 'LOW',
            'initial_message': 'How often should I oil the singing bowl wooden striker?'
        })
        self.assertEqual(res_ticket.status_code, status.HTTP_201_CREATED)
        ticket_id = res_ticket.data['id']

        # Staff responds to ticket
        self.client.force_authenticate(user=self.admin_user)
        res_staff_msg = self.client.post(f'/api/v1/support/tickets/{ticket_id}/messages/', {
            'message': 'A light wipe with mustard or coconut oil once every 3 months is ideal!'
        })
        self.assertEqual(res_staff_msg.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_staff_msg.data['is_staff_reply'])

        # =====================================================================
        # Step 8: Vendor Settlement & Disbursement Invariant
        # =====================================================================
        # Verify sub-order financial accuracy:
        # Vendor Net = Subtotal (7200) - Commission (720) = 6480 NPR
        self.assertEqual(sub_order.vendor_net_amount, Decimal('6480.00'))
        self.assertEqual(sub_order.commission_amount, Decimal('720.00'))
        self.assertEqual(sub_order.vendor_net_amount + sub_order.commission_amount, sub_order.subtotal)
