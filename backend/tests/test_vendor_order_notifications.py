import json
from decimal import Decimal
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.core import mail
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.accounts.models import UserRole
from apps.catalogue.models import Category, Product, ProductVariant
from apps.notifications.models import VendorOrderNotificationLog
from apps.notifications.vendor_notifications import (
    VendorOrderNotificationService,
    VendorEmailDispatcher
)
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store

User = get_user_model()


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='notifications@oyopasal.com',
    FRONTEND_URL='http://localhost:3000'
)
class VendorOrderNotificationTests(TestCase):
    def setUp(self):
        mail.outbox.clear()
        VendorOrderNotificationLog.objects.all().delete()

        # Create Category
        self.category, _ = Category.objects.get_or_create(
            name="Groceries",
            slug="groceries"
        )

        # Create Customer
        self.customer_user = User.objects.create_user(
            username="customer_test",
            email="customer@example.com",
            password="Password123!",
            role=UserRole.CUSTOMER,
            first_name="Ramesh",
            last_name="Shrestha"
        )

        # Create Vendor 1: Rahul Pasal Superstore
        self.vendor1_user = User.objects.create_user(
            username="vendor_rahul",
            email="rahul.login@oyopasal.com",
            password="Password123!",
            role=UserRole.VENDOR
        )
        self.vendor1 = VendorProfile.objects.create(
            user=self.vendor1_user,
            business_name="Rahul Pasal Superstore",
            slug="rahul-pasal-superstore",
            status=VendorStatus.APPROVED
        )
        self.store1 = Store.objects.create(
            vendor=self.vendor1,
            name="Rahul Pasal Superstore",
            slug="rahul-pasal",
            contact_email="rahul.orders@oyopasal.com",
            contact_phone="9800000001",
            city="Kathmandu"
        )

        # Create Vendor 2: Patan Bakery
        self.vendor2_user = User.objects.create_user(
            username="vendor_patan",
            email="patan.login@oyopasal.com",
            password="Password123!",
            role=UserRole.VENDOR
        )
        self.vendor2 = VendorProfile.objects.create(
            user=self.vendor2_user,
            business_name="Patan Bakery & Sweets",
            slug="patan-bakery-sweets",
            status=VendorStatus.APPROVED
        )
        self.store2 = Store.objects.create(
            vendor=self.vendor2,
            name="Patan Bakery & Sweets",
            slug="patan-bakery",
            contact_email="patan.orders@oyopasal.com",
            contact_phone="9800000002",
            city="Lalitpur"
        )

        # Products for Vendor 1
        self.prod1 = Product.objects.create(
            vendor=self.vendor1,
            store=self.store1,
            category=self.category,
            name="Basmati Rice 5kg",
            slug="basmati-rice-5kg",
            base_price=Decimal("1200.00")
        )
        self.var1 = ProductVariant.objects.create(
            product=self.prod1,
            sku="RICE-BAS-5KG",
            price=Decimal("1200.00"),
            stock=50
        )

        self.prod2 = Product.objects.create(
            vendor=self.vendor1,
            store=self.store1,
            category=self.category,
            name="Pure Mustard Oil 1L",
            slug="mustard-oil-1l",
            base_price=Decimal("350.00")
        )
        self.var2 = ProductVariant.objects.create(
            product=self.prod2,
            sku="OIL-MUST-1L",
            price=Decimal("350.00"),
            stock=40
        )

        # Product for Vendor 2
        self.prod3 = Product.objects.create(
            vendor=self.vendor2,
            store=self.store2,
            category=self.category,
            name="Artisan Sourdough Loaf",
            slug="artisan-sourdough",
            base_price=Decimal("250.00")
        )
        self.var3 = ProductVariant.objects.create(
            product=self.prod3,
            sku="BREAD-SOUR-01",
            price=Decimal("250.00"),
            stock=20
        )

    def test_scenario_1_single_vendor_order(self):
        """
        Scenario 1: Single vendor order.
        Customer orders two products from Rahul Pasal Superstore.
        Vendor receives 1 email containing both products and vendor-specific subtotal.
        """
        order = Order.objects.create(
            order_number="ORD-TEST-001",
            customer=self.customer_user,
            total_amount=Decimal("1550.00"),
            payment_method="COD",
            payment_status="PENDING",
            status=OrderStatus.PENDING,
            shipping_address_snapshot={
                "recipient_name": "Ramesh Shrestha",
                "recipient_phone": "9841234567",
                "street": "Pulchowk Road",
                "area": "Lalitpur",
                "city": "Kathmandu"
            }
        )

        sub_order = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number="SO-TEST-001-A",
            vendor=self.vendor1,
            store=self.store1,
            subtotal=Decimal("1550.00"),
            delivery_fee=Decimal("0.00"),
            vendor_net_amount=Decimal("1550.00"),
            status=OrderStatus.PENDING
        )

        OrderItem.objects.create(
            sub_order=sub_order,
            variant=self.var1,
            product_name="Basmati Rice 5kg",
            variant_sku="RICE-BAS-5KG",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )
        OrderItem.objects.create(
            sub_order=sub_order,
            variant=self.var2,
            product_name="Pure Mustard Oil 1L",
            variant_sku="OIL-MUST-1L",
            unit_price=Decimal("350.00"),
            quantity=1,
            total_price=Decimal("350.00")
        )

        results = VendorOrderNotificationService.notify_vendors_for_order(order)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['status'], 'SENT')
        self.assertEqual(results[0]['recipient_email'], 'rahul.orders@oyopasal.com')

        # Check mail outbox: exactly 1 email sent
        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertEqual(sent_email.to, ['rahul.orders@oyopasal.com'])
        self.assertIn("SO-TEST-001-A", sent_email.subject)
        self.assertIn("Basmati Rice 5kg", sent_email.body)
        self.assertIn("Pure Mustard Oil 1L", sent_email.body)
        self.assertIn("1550.00", sent_email.body)
        self.assertIn("Rahul Pasal Superstore", sent_email.body)

        # Audit log record
        log = VendorOrderNotificationLog.objects.get(sub_order=sub_order)
        self.assertEqual(log.status, VendorOrderNotificationLog.NotificationStatus.SENT)
        self.assertEqual(log.items_count, 2)
        self.assertEqual(log.vendor_subtotal, Decimal("1550.00"))

    def test_scenario_2_and_6_multi_vendor_isolation(self):
        """
        Scenario 2 & 6: Multi-vendor checkout and strict vendor isolation.
        Customer orders items from Vendor 1 and Vendor 2 in 1 single checkout.
        - Vendor 1 receives exactly 1 email with ONLY Vendor 1's items and subtotal.
        - Vendor 2 receives exactly 1 email with ONLY Vendor 2's items and subtotal.
        - No cross-vendor data exposure!
        """
        order = Order.objects.create(
            order_number="ORD-TEST-002",
            customer=self.customer_user,
            total_amount=Decimal("1450.00"),
            payment_method="COD",
            payment_status="PENDING",
            status=OrderStatus.PENDING,
            shipping_address_snapshot={
                "recipient_name": "Ramesh Shrestha",
                "area": "Jhamsikhel"
            }
        )

        # Sub-order 1: Vendor 1 (Rice: 1200)
        sub1 = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number="SO-TEST-002-V1",
            vendor=self.vendor1,
            store=self.store1,
            subtotal=Decimal("1200.00"),
            delivery_fee=Decimal("0.00"),
            status=OrderStatus.PENDING
        )
        OrderItem.objects.create(
            sub_order=sub1,
            variant=self.var1,
            product_name="Basmati Rice 5kg",
            variant_sku="RICE-BAS-5KG",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )

        # Sub-order 2: Vendor 2 (Bread: 250)
        sub2 = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number="SO-TEST-002-V2",
            vendor=self.vendor2,
            store=self.store2,
            subtotal=Decimal("250.00"),
            delivery_fee=Decimal("0.00"),
            status=OrderStatus.PENDING
        )
        OrderItem.objects.create(
            sub_order=sub2,
            variant=self.var3,
            product_name="Artisan Sourdough Loaf",
            variant_sku="BREAD-SOUR-01",
            unit_price=Decimal("250.00"),
            quantity=1,
            total_price=Decimal("250.00")
        )

        results = VendorOrderNotificationService.notify_vendors_for_order(order)
        self.assertEqual(len(results), 2)

        # Exactly 2 separate emails sent
        self.assertEqual(len(mail.outbox), 2)

        email_v1 = next(m for m in mail.outbox if "rahul.orders@oyopasal.com" in m.to)
        email_v2 = next(m for m in mail.outbox if "patan.orders@oyopasal.com" in m.to)

        # Vendor 1 email verification
        self.assertIn("Basmati Rice 5kg", email_v1.body)
        self.assertIn("1200.00", email_v1.body)
        # CRITICAL ISOLATION CHECK: Vendor 1 MUST NOT see Vendor 2's bread or store name!
        self.assertNotIn("Artisan Sourdough Loaf", email_v1.body)
        self.assertNotIn("Patan Bakery", email_v1.body)
        self.assertNotIn("SO-TEST-002-V2", email_v1.body)

        # Vendor 2 email verification
        self.assertIn("Artisan Sourdough Loaf", email_v2.body)
        self.assertIn("250.00", email_v2.body)
        # CRITICAL ISOLATION CHECK: Vendor 2 MUST NOT see Vendor 1's rice or store name!
        self.assertNotIn("Basmati Rice 5kg", email_v2.body)
        self.assertNotIn("Rahul Pasal Superstore", email_v2.body)
        self.assertNotIn("SO-TEST-002-V1", email_v2.body)

    def test_scenario_3_duplicate_prevention_idempotency(self):
        """
        Scenario 3: Duplicate prevention.
        Repeated calls to notify_vendors_for_order must not send duplicate emails.
        """
        order = Order.objects.create(
            order_number="ORD-TEST-003",
            customer=self.customer_user,
            total_amount=Decimal("1200.00"),
            payment_method="COD",
            status=OrderStatus.PENDING
        )
        sub = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number="SO-TEST-003-A",
            vendor=self.vendor1,
            store=self.store1,
            subtotal=Decimal("1200.00"),
            status=OrderStatus.PENDING
        )
        OrderItem.objects.create(
            sub_order=sub,
            variant=self.var1,
            product_name="Basmati Rice 5kg",
            variant_sku="RICE-BAS-5KG",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )

        # 1st execution
        res1 = VendorOrderNotificationService.notify_vendors_for_order(order)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(res1[0]['status'], 'SENT')

        # 2nd execution (e.g. webhook or retry)
        res2 = VendorOrderNotificationService.notify_vendors_for_order(order)
        # Mail outbox must NOT increase!
        self.assertEqual(len(mail.outbox), 1)
        self.assertTrue(res2[0].get('skipped'))
        self.assertEqual(res2[0]['status'], 'ALREADY_SENT')

    def test_scenario_4_failed_or_unpaid_order_skipped(self):
        """
        Scenario 4: Failed order and unconfirmed online payment.
        Must not trigger vendor notifications.
        """
        # Failed order
        failed_order = Order.objects.create(
            order_number="ORD-TEST-004-FAIL",
            customer=self.customer_user,
            total_amount=Decimal("1200.00"),
            payment_method="COD",
            status=OrderStatus.FAILED
        )
        res_fail = VendorOrderNotificationService.notify_vendors_for_order(failed_order)
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(res_fail[0].get('skipped'))

        # Unpaid online payment order
        unpaid_order = Order.objects.create(
            order_number="ORD-TEST-004-UNPAID",
            customer=self.customer_user,
            total_amount=Decimal("1200.00"),
            payment_method="KHALTI",
            payment_status="PENDING",
            status=OrderStatus.PENDING
        )
        res_unpaid = VendorOrderNotificationService.notify_vendors_for_order(unpaid_order)
        self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(res_unpaid[0].get('skipped'))

    def test_scenario_5_email_failure_fail_safe_and_retry(self):
        """
        Scenario 5: Fail-safe checkout and retry mechanism.
        If email dispatcher fails, customer order does not crash,
        failure is logged as FAILED, and retry_failed_notifications processes it.
        """
        order = Order.objects.create(
            order_number="ORD-TEST-005",
            customer=self.customer_user,
            total_amount=Decimal("1200.00"),
            payment_method="COD",
            status=OrderStatus.PENDING
        )
        sub = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number="SO-TEST-005-A",
            vendor=self.vendor1,
            store=self.store1,
            subtotal=Decimal("1200.00"),
            status=OrderStatus.PENDING
        )
        OrderItem.objects.create(
            sub_order=sub,
            variant=self.var1,
            product_name="Basmati Rice 5kg",
            variant_sku="RICE-BAS-5KG",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )

        # Simulate email failure
        with patch.object(VendorEmailDispatcher, 'send', return_value=(False, "Connection timed out", "mock_failure")):
            res = VendorOrderNotificationService.notify_vendors_for_order(order)
            self.assertEqual(res[0]['status'], 'FAILED')

        # Check log was saved as FAILED
        log = VendorOrderNotificationLog.objects.get(sub_order=sub)
        self.assertEqual(log.status, VendorOrderNotificationLog.NotificationStatus.FAILED)
        self.assertIn("Connection timed out", log.error_message)

        # Now simulate recovery and test retry_failed_notifications
        retried = VendorOrderNotificationService.retry_failed_notifications()
        self.assertEqual(retried, 1)

        # After retry, email should have been sent
        self.assertEqual(len(mail.outbox), 1)
        log.refresh_from_db()
        self.assertEqual(log.status, VendorOrderNotificationLog.NotificationStatus.SENT)

    def test_scenario_7_dashboard_deep_link(self):
        """
        Scenario 7: Vendor Dashboard Deep Link.
        Email includes the exact deep link pointing to the vendor dashboard with sub_order_number.
        """
        order = Order.objects.create(
            order_number="ORD-TEST-007",
            customer=self.customer_user,
            total_amount=Decimal("1200.00"),
            payment_method="COD",
            status=OrderStatus.PENDING
        )
        sub = VendorSubOrder.objects.create(
            parent_order=order,
            sub_order_number="SO-TEST-007-DEEP",
            vendor=self.vendor1,
            store=self.store1,
            subtotal=Decimal("1200.00"),
            status=OrderStatus.PENDING
        )
        OrderItem.objects.create(
            sub_order=sub,
            variant=self.var1,
            product_name="Basmati Rice 5kg",
            variant_sku="RICE-BAS-5KG",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )

        VendorOrderNotificationService.notify_vendors_for_order(order)
        sent_email = mail.outbox[0]
        expected_deep_link = "http://localhost:3000/seller?tab=orders&order_id=SO-TEST-007-DEEP"
        self.assertIn(expected_deep_link, sent_email.body)
