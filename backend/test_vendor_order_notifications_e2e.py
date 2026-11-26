import sys
import os
import uuid
from decimal import Decimal
from unittest.mock import patch

# Setup django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from django.conf import settings
from django.core import mail
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User, UserRole
from apps.catalogue.models import Category, Product, ProductVariant
from apps.notifications.models import VendorOrderNotificationLog
from apps.notifications.vendor_notifications import (
    VendorOrderNotificationService,
    VendorEmailDispatcher
)
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store


def run_all_tests():
    print("=" * 70)
    print("  OYOPASAL VENDOR ORDER EMAIL NOTIFICATIONS - E2E VERIFICATION")
    print("=" * 70)

    # Use in-memory mailbox for tracking dispatched emails in test
    settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
    settings.DEFAULT_FROM_EMAIL = 'notifications@oyopasal.com'
    settings.FRONTEND_URL = 'http://localhost:3000'
    if not hasattr(mail, 'outbox'):
        mail.outbox = []
    else:
        mail.outbox.clear()

    run_id = uuid.uuid4().hex[:6]

    # Setup test fixtures (reuse clean primary Groceries category)
    category = Category.objects.filter(name__iexact="Groceries", parent__isnull=True).first()
    if not category:
        category, _ = Category.objects.get_or_create(name="Groceries", defaults={"slug": "groceries"})

    unique_phone = f"98{int(run_id, 16) % 100000000:08d}"[:10]

    customer = User.objects.create_user(
        email=f"customer_{run_id}@example.com",
        password="Password123!",
        role=UserRole.CUSTOMER,
        first_name="Ramesh",
        last_name="Shrestha",
        phone_number=unique_phone
    )

    # Vendor 1: Rahul Pasal Superstore
    v1_user = User.objects.create_user(
        email=f"rahul_login_{run_id}@oyopasal.com",
        password="Password123!",
        role=UserRole.VENDOR
    )
    vendor1 = VendorProfile.objects.create(
        user=v1_user,
        business_name=f"Rahul Pasal Superstore {run_id}",
        slug=f"rahul-pasal-{run_id}",
        status=VendorStatus.APPROVED
    )
    store1 = Store.objects.create(
        vendor=vendor1,
        name=f"Rahul Pasal Superstore {run_id}",
        slug=f"rahul-store-{run_id}",
        contact_email=f"rahul.orders_{run_id}@oyopasal.com",
        contact_phone="9800000001",
        address="Kathmandu"
    )

    # Vendor 2: Patan Bakery & Sweets
    v2_user = User.objects.create_user(
        email=f"patan_login_{run_id}@oyopasal.com",
        password="Password123!",
        role=UserRole.VENDOR
    )
    vendor2 = VendorProfile.objects.create(
        user=v2_user,
        business_name=f"Patan Bakery & Sweets {run_id}",
        slug=f"patan-bakery-{run_id}",
        status=VendorStatus.APPROVED
    )
    store2 = Store.objects.create(
        vendor=vendor2,
        name=f"Patan Bakery & Sweets {run_id}",
        slug=f"patan-store-{run_id}",
        contact_email=f"patan.orders_{run_id}@oyopasal.com",
        contact_phone="9800000002",
        address="Lalitpur"
    )

    # Products for Vendor 1
    prod1 = Product.objects.create(
        vendor=vendor1,
        store=store1,
        category=category,
        name="Basmati Rice 5kg",
        slug=f"basmati-rice-5kg-{run_id}",
        base_sku=f"SKU-PROD1-{run_id}"
    )
    var1 = ProductVariant.objects.create(
        product=prod1,
        sku=f"RICE-{run_id}",
        regular_price=Decimal("1200.00"),
        selling_price=Decimal("1200.00"),
        is_default=True
    )

    prod2 = Product.objects.create(
        vendor=vendor1,
        store=store1,
        category=category,
        name="Pure Mustard Oil 1L",
        slug=f"mustard-oil-1l-{run_id}",
        base_sku=f"SKU-PROD2-{run_id}"
    )
    var2 = ProductVariant.objects.create(
        product=prod2,
        sku=f"OIL-{run_id}",
        regular_price=Decimal("350.00"),
        selling_price=Decimal("350.00"),
        is_default=True
    )

    # Product for Vendor 2
    prod3 = Product.objects.create(
        vendor=vendor2,
        store=store2,
        category=category,
        name="Artisan Sourdough Loaf",
        slug=f"sourdough-{run_id}",
        base_sku=f"SKU-PROD3-{run_id}"
    )
    var3 = ProductVariant.objects.create(
        product=prod3,
        sku=f"BREAD-{run_id}",
        regular_price=Decimal("250.00"),
        selling_price=Decimal("250.00"),
        is_default=True
    )

    print(f"✓ Fixtures initialized: Vendor 1 ({vendor1.business_name}), Vendor 2 ({vendor2.business_name})")

    try:
        # =====================================================================
        # SCENARIO 1: Single Vendor Order (2 products from 1 vendor)
        # =====================================================================
        print("\n--- Testing Scenario 1: Single Vendor Order ---")
        mail.outbox.clear()
        ord1 = Order.objects.create(
            order_number=f"ORD-S1-{run_id}",
            customer=customer,
            subtotal=Decimal("1550.00"),
            grand_total=Decimal("1550.00"),
            payment_method="COD",
            payment_status="PENDING",
            status=OrderStatus.CONFIRMED,
            shipping_address_snapshot={
                "recipient_name": "Ramesh Shrestha",
                "recipient_phone": "9841234567",
                "street": "Pulchowk Road",
                "area": "Lalitpur",
                "city": "Kathmandu"
            }
        )
        so1 = VendorSubOrder.objects.create(
            parent_order=ord1,
            sub_order_number=f"SO-S1-{run_id}",
            vendor=vendor1,
            store=store1,
            subtotal=Decimal("1550.00"),
            delivery_fee=Decimal("0.00"),
            vendor_net_amount=Decimal("1550.00"),
            status=OrderStatus.CONFIRMED
        )
        OrderItem.objects.create(
            sub_order=so1,
            variant=var1,
            product_name="Basmati Rice 5kg",
            variant_sku=f"RICE-{run_id}",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )
        OrderItem.objects.create(
            sub_order=so1,
            variant=var2,
            product_name="Pure Mustard Oil 1L",
            variant_sku=f"OIL-{run_id}",
            unit_price=Decimal("350.00"),
            quantity=1,
            total_price=Decimal("350.00")
        )

        res1 = VendorOrderNotificationService.notify_vendors_for_order(ord1)
        assert len(res1) == 1, f"Expected 1 suborder result, got {len(res1)}"
        assert res1[0]['status'] == 'SENT', f"Expected SENT, got {res1[0]['status']}"
        assert len(mail.outbox) == 1, f"Expected exactly 1 email sent, got {len(mail.outbox)}"

        email1 = mail.outbox[0]
        assert store1.contact_email in email1.to, f"Expected recipient {store1.contact_email}, got {email1.to}"
        assert f"Order #{so1.sub_order_number}" in email1.subject
        assert "Basmati Rice 5kg" in email1.body
        assert "Pure Mustard Oil 1L" in email1.body
        assert "1550.00" in email1.body
        print("✓ Scenario 1 Passed: Vendor received exactly 1 email containing both products and correct subtotal.")

        # =====================================================================
        # SCENARIO 2 & 6: Multi-Vendor Order & Data Isolation
        # =====================================================================
        print("\n--- Testing Scenario 2 & 6: Multi-Vendor Order & Data Isolation ---")
        mail.outbox.clear()
        ord2 = Order.objects.create(
            order_number=f"ORD-S2-{run_id}",
            customer=customer,
            subtotal=Decimal("1450.00"),
            grand_total=Decimal("1450.00"),
            payment_method="COD",
            payment_status="PENDING",
            status=OrderStatus.CONFIRMED,
            shipping_address_snapshot={"recipient_name": "Ramesh Shrestha", "area": "Jhamsikhel"}
        )
        # Sub-order 1 for Vendor 1 (Rice: 1200)
        so2_v1 = VendorSubOrder.objects.create(
            parent_order=ord2,
            sub_order_number=f"SO-S2-V1-{run_id}",
            vendor=vendor1,
            store=store1,
            subtotal=Decimal("1200.00"),
            delivery_fee=Decimal("0.00"),
            status=OrderStatus.CONFIRMED
        )
        OrderItem.objects.create(
            sub_order=so2_v1,
            variant=var1,
            product_name="Basmati Rice 5kg",
            variant_sku=f"RICE-{run_id}",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )
        # Sub-order 2 for Vendor 2 (Bread: 250)
        so2_v2 = VendorSubOrder.objects.create(
            parent_order=ord2,
            sub_order_number=f"SO-S2-V2-{run_id}",
            vendor=vendor2,
            store=store2,
            subtotal=Decimal("250.00"),
            delivery_fee=Decimal("0.00"),
            status=OrderStatus.CONFIRMED
        )
        OrderItem.objects.create(
            sub_order=so2_v2,
            variant=var3,
            product_name="Artisan Sourdough Loaf",
            variant_sku=f"BREAD-{run_id}",
            unit_price=Decimal("250.00"),
            quantity=1,
            total_price=Decimal("250.00")
        )

        res2 = VendorOrderNotificationService.notify_vendors_for_order(ord2)
        assert len(res2) == 2, f"Expected 2 results, got {len(res2)}"
        assert len(mail.outbox) == 2, f"Expected exactly 2 separate emails, got {len(mail.outbox)}"

        email_v1 = next(m for m in mail.outbox if store1.contact_email in m.to)
        email_v2 = next(m for m in mail.outbox if store2.contact_email in m.to)

        # Check Vendor 1 Isolation
        assert "Basmati Rice 5kg" in email_v1.body
        assert "1200.00" in email_v1.body
        assert "Artisan Sourdough Loaf" not in email_v1.body, "LEAK: Vendor 1 email contained Vendor 2's product!"
        assert "250.00" not in email_v1.body, "LEAK: Vendor 1 email contained Vendor 2's financial data!"
        assert vendor2.business_name not in email_v1.body, "LEAK: Vendor 1 email exposed Vendor 2's store name!"

        # Check Vendor 2 Isolation
        assert "Artisan Sourdough Loaf" in email_v2.body
        assert "250.00" in email_v2.body
        assert "Basmati Rice 5kg" not in email_v2.body, "LEAK: Vendor 2 email contained Vendor 1's product!"
        assert "1200.00" not in email_v2.body, "LEAK: Vendor 2 email contained Vendor 1's financial data!"
        assert vendor1.business_name not in email_v2.body, "LEAK: Vendor 2 email exposed Vendor 1's store name!"
        print("✓ Scenario 2 & 6 Passed: Multi-vendor checkout sends 2 isolated emails. Zero cross-vendor data exposure.")

        # =====================================================================
        # SCENARIO 3: Duplicate Prevention & Idempotency
        # =====================================================================
        print("\n--- Testing Scenario 3: Duplicate Prevention ---")
        mail_count_before = len(mail.outbox)
        res_dup = VendorOrderNotificationService.notify_vendors_for_order(ord1)
        assert len(mail.outbox) == mail_count_before, "Duplicate email was erroneously sent!"
        assert res_dup[0].get('status') == 'ALREADY_SENT'
        assert res_dup[0].get('skipped') is True
        print("✓ Scenario 3 Passed: Idempotency check prevents duplicate email notifications.")

        # =====================================================================
        # SCENARIO 4: Failed or Unconfirmed Order Skipped
        # =====================================================================
        print("\n--- Testing Scenario 4: Failed / Unpaid Order Skipped ---")
        mail.outbox.clear()
        failed_ord = Order.objects.create(
            order_number=f"ORD-FAIL-{run_id}",
            customer=customer,
            subtotal=Decimal("1200.00"),
            grand_total=Decimal("1200.00"),
            payment_method="COD",
            status=OrderStatus.FAILED
        )
        res_f = VendorOrderNotificationService.notify_vendors_for_order(failed_ord)
        assert len(mail.outbox) == 0, "Email sent for failed order!"
        assert res_f[0].get('skipped') is True

        unpaid_ord = Order.objects.create(
            order_number=f"ORD-UNPAID-{run_id}",
            customer=customer,
            subtotal=Decimal("1200.00"),
            grand_total=Decimal("1200.00"),
            payment_method="KHALTI",
            payment_status="PENDING",
            status=OrderStatus.PENDING_PAYMENT
        )
        res_u = VendorOrderNotificationService.notify_vendors_for_order(unpaid_ord)
        assert len(mail.outbox) == 0, "Email sent for unpaid online order!"
        assert res_u[0].get('skipped') is True
        print("✓ Scenario 4 Passed: Failed and unpaid online orders safely skip vendor notification.")

        # =====================================================================
        # SCENARIO 5: Email Service Failure Non-Blocking & Retry
        # =====================================================================
        print("\n--- Testing Scenario 5: Email Failure Fail-Safe & Retry ---")
        mail.outbox.clear()
        ord5 = Order.objects.create(
            order_number=f"ORD-S5-{run_id}",
            customer=customer,
            subtotal=Decimal("1200.00"),
            grand_total=Decimal("1200.00"),
            payment_method="COD",
            status=OrderStatus.CONFIRMED
        )
        so5 = VendorSubOrder.objects.create(
            parent_order=ord5,
            sub_order_number=f"SO-S5-{run_id}",
            vendor=vendor1,
            store=store1,
            subtotal=Decimal("1200.00"),
            status=OrderStatus.CONFIRMED
        )
        OrderItem.objects.create(
            sub_order=so5,
            variant=var1,
            product_name="Basmati Rice 5kg",
            variant_sku=f"RICE-{run_id}",
            unit_price=Decimal("1200.00"),
            quantity=1,
            total_price=Decimal("1200.00")
        )

        with patch.object(VendorEmailDispatcher, 'send', return_value=(False, "SMTP Timeout", "mock_err")):
            res5 = VendorOrderNotificationService.notify_vendors_for_order(ord5)
            assert res5[0]['status'] == 'FAILED'

        log5 = VendorOrderNotificationLog.objects.get(sub_order=so5)
        assert log5.status == VendorOrderNotificationLog.NotificationStatus.FAILED
        assert "SMTP Timeout" in log5.error_message

        # Test safe retry
        retried = VendorOrderNotificationService.retry_failed_notifications()
        assert retried >= 1, "Failed notification was not retried!"
        assert len(mail.outbox) == 1, "Retried email was not dispatched!"
        log5.refresh_from_db()
        assert log5.status == VendorOrderNotificationLog.NotificationStatus.SENT
        print("✓ Scenario 5 Passed: Checkout never fails when email service is down. Failed logs safely retried.")

        # =====================================================================
        # SCENARIO 7: Dashboard Navigation Deep Link
        # =====================================================================
        print("\n--- Testing Scenario 7: Vendor Dashboard Deep Link ---")
        expected_deep_link = f"http://localhost:3000/seller?tab=orders&order_id={so1.sub_order_number}"
        print("Full email body:")
        print(email1.body)
        assert expected_deep_link in email1.body, f"Expected deep link {expected_deep_link} not found in email!"
        print(f"✓ Scenario 7 Passed: Deep link accurately constructed: {expected_deep_link}")

        print("\n" + "=" * 70)
        print("  ALL 7 VENDOR EMAIL NOTIFICATION SCENARIOS PASSED WITH 100% SUCCESS!")
        print("=" * 70)

    finally:
        # Cleanup test records
        VendorOrderNotificationLog.objects.filter(idempotency_key__contains=run_id).delete()
        OrderItem.objects.filter(variant_sku__contains=run_id).delete()
        VendorSubOrder.objects.filter(sub_order_number__contains=run_id).delete()
        Order.objects.filter(order_number__contains=run_id).delete()
        ProductVariant.objects.filter(sku__contains=run_id).delete()
        Product.objects.filter(slug__contains=run_id).delete()
        Store.objects.filter(slug__contains=run_id).delete()
        VendorProfile.objects.filter(slug__contains=run_id).delete()
        User.objects.filter(email__contains=run_id).delete()
        Category.objects.filter(slug__contains=run_id).delete()
        print(f"✓ Test fixtures cleaned up for run ID: {run_id}")


if __name__ == '__main__':
    run_all_tests()
