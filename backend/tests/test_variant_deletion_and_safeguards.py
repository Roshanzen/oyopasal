import os
import sys
import uuid
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.db import transaction

from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductImage
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.inventory.models import InventoryItem, Warehouse
from apps.cart.models import Cart, CartItem
from apps.catalogue.admin import ProductVariantAdmin, safe_delete_or_archive_variants
from apps.catalogue.services import ProductVariantCleanupService

User = get_user_model()


def setup_request(user, post_data=None):
    factory = RequestFactory()
    req = factory.post('/admin/catalogue/productvariant/', data=post_data or {})
    req.user = user
    setattr(req, 'session', {})
    messages = FallbackStorage(req)
    setattr(req, '_messages', messages)
    return req


def run_tests():
    print("=== STARTING PRODUCT VARIANT CLEANUP & SAFEGUARDS TEST SUITE ===")
    unique_run = uuid.uuid4().hex[:6]

    # Setup base users
    superuser = User.objects.create_user(
        email=f"super_var_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="ADMIN",
        is_superuser=True,
        is_staff=True
    )
    vendor_user = User.objects.create_user(
        email=f"vendor_var_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="VENDOR"
    )
    customer_user = User.objects.create_user(
        email=f"cust_var_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="CUSTOMER"
    )

    vendor = VendorProfile.objects.create(
        user=vendor_user,
        business_name=f"Var Test Merchant {unique_run}",
        slug=f"var-test-merchant-{unique_run}",
        status=VendorStatus.APPROVED
    )
    store = Store.objects.create(
        vendor=vendor,
        name=f"Var Test Store {unique_run}",
        slug=f"var-test-store-{unique_run}",
        is_active=True
    )
    category = Category.objects.create(
        name=f"Var Test Cat {unique_run}",
        slug=f"var-test-cat-{unique_run}"
    )
    warehouse = Warehouse.objects.create(
        name=f"Var WH {unique_run}",
        code=f"VWH-{unique_run}"
    )
    cart = Cart.objects.create(user=customer_user)

    admin_site = AdminSite()
    variant_admin = ProductVariantAdmin(ProductVariant, admin_site)

    # -------------------------------------------------------------------------
    # TEST 1: Deleting a variant with NO order history
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Delete variant with NO order history ---")
    product_1 = Product.objects.create(
        vendor=vendor,
        store=store,
        category=category,
        name=f"Product For Safe Deletion {unique_run}",
        base_sku=f"SKU-BASE1-{unique_run}"
    )
    var_1_default = ProductVariant.objects.create(
        product=product_1,
        sku=f"VAR1-DEF-{unique_run}",
        regular_price=Decimal("1000.00"),
        selling_price=Decimal("900.00"),
        is_default=True
    )
    var_1_secondary = ProductVariant.objects.create(
        product=product_1,
        sku=f"VAR1-SEC-{unique_run}",
        regular_price=Decimal("1200.00"),
        selling_price=Decimal("1100.00"),
        is_default=False
    )
    # Add inventory and cart item for secondary
    InventoryItem.objects.create(
        warehouse=warehouse,
        variant=var_1_secondary,
        quantity_on_hand=50
    )
    CartItem.objects.create(
        cart=cart,
        variant=var_1_secondary,
        quantity=2
    )

    # Analyze
    analysis_sec = ProductVariantCleanupService.analyze_variant(var_1_secondary)
    assert analysis_sec.action_recommendation == 'DELETE', "Recommendation must be DELETE"
    assert analysis_sec.has_historical_orders is False

    # Execute cleanup on secondary
    results_1 = ProductVariantCleanupService.execute_cleanup(
        ProductVariant.all_objects.filter(id=var_1_secondary.id),
        user=superuser
    )
    assert len(results_1['deleted']) == 1, "Secondary variant must be deleted"
    assert ProductVariant.all_objects.filter(id=var_1_secondary.id).exists() is False, "Row must be gone"
    assert CartItem.objects.filter(variant_id=var_1_secondary.id).exists() is False, "CartItem must be removed"
    assert InventoryItem.objects.filter(variant_id=var_1_secondary.id).exists() is False, "Inventory must be removed"

    # CRITICAL: Parent product must remain completely intact and active!
    product_1.refresh_from_db()
    assert product_1.is_deleted is False, "Parent product must NOT be deleted"
    assert ProductVariant.objects.filter(id=var_1_default.id).exists() is True, "Default variant must remain"
    print("PASS: Variant with 0 orders hard-deleted; parent product preserved.")

    # -------------------------------------------------------------------------
    # TEST 2: Deleting default variant reassigns default to remaining variant
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Deleting default variant reassigns default ---")
    var_1_third = ProductVariant.objects.create(
        product=product_1,
        sku=f"VAR1-THIRD-{unique_run}",
        regular_price=Decimal("1500.00"),
        selling_price=Decimal("1400.00"),
        is_default=False
    )
    # Delete default variant
    results_2 = ProductVariantCleanupService.execute_cleanup(
        ProductVariant.all_objects.filter(id=var_1_default.id),
        user=superuser
    )
    assert len(results_2['deleted']) == 1
    assert ProductVariant.all_objects.filter(id=var_1_default.id).exists() is False
    var_1_third.refresh_from_db()
    assert var_1_third.is_default is True, "Remaining variant must become default"
    print("PASS: Default flag reassigned to remaining variant.")

    # -------------------------------------------------------------------------
    # TEST 3: Deleting a variant referenced by historical OrderItems -> ARCHIVE
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Deleting variant with historical OrderItems -> ARCHIVE ONLY ---")
    product_2 = Product.objects.create(
        vendor=vendor,
        store=store,
        category=category,
        name=f"Product With Ordered Variant {unique_run}",
        base_sku=f"SKU-BASE2-{unique_run}"
    )
    var_2_ordered = ProductVariant.objects.create(
        product=product_2,
        sku=f"VAR2-ORDERED-{unique_run}",
        regular_price=Decimal("2000.00"),
        selling_price=Decimal("1800.00"),
        is_default=True
    )

    # Create historical order and sub-order
    order = Order.objects.create(
        order_number=f"ORD-VAR-{unique_run}",
        customer=customer_user,
        subtotal=Decimal("1800.00"),
        grand_total=Decimal("1800.00"),
        status=OrderStatus.DELIVERED
    )
    suborder = VendorSubOrder.objects.create(
        sub_order_number=f"SUB-VAR-{unique_run}",
        parent_order=order,
        vendor=vendor,
        store=store,
        status=OrderStatus.DELIVERED,
        subtotal=Decimal("1800.00"),
        commission_amount=Decimal("180.00"),
        vendor_net_amount=Decimal("1620.00")
    )
    order_item = OrderItem.objects.create(
        sub_order=suborder,
        store=store,
        variant=var_2_ordered,
        product_name=product_2.name,
        variant_sku=var_2_ordered.sku,
        unit_price=Decimal("1800.00"),
        quantity=1,
        total_price=Decimal("1800.00")
    )

    # Cart item exists
    CartItem.objects.create(
        cart=cart,
        variant=var_2_ordered,
        quantity=1
    )

    analysis_ordered = ProductVariantCleanupService.analyze_variant(var_2_ordered)
    assert analysis_ordered.has_historical_orders is True
    assert analysis_ordered.action_recommendation == 'ARCHIVE'

    # Execute cleanup
    results_3 = ProductVariantCleanupService.execute_cleanup(
        ProductVariant.all_objects.filter(id=var_2_ordered.id),
        user=superuser
    )
    assert len(results_3['archived']) == 1, "Must be archived"
    assert len(results_3['deleted']) == 0, "Must NOT be hard deleted"

    # Verify OrderItem and Order remain 100% intact
    order_item.refresh_from_db()
    assert order_item.variant_id == var_2_ordered.id, "OrderItem variant FK preserved"
    assert order_item.product_title_snapshot == product_2.name, "Product title snapshot populated"
    assert order_item.variant_sku == var_2_ordered.sku, "Variant SKU snapshot populated"
    assert order_item.unit_price == Decimal("1800.00")

    # Verify Variant state
    var_2_ordered.refresh_from_db()
    assert var_2_ordered.is_deleted is True, "Variant must be soft-deleted"
    assert var_2_ordered.is_active is False, "Variant must be deactivated"
    assert ProductVariant.objects.filter(id=var_2_ordered.id).exists() is False, "Excluded from active queryset"
    assert ProductVariant.all_objects.filter(id=var_2_ordered.id).exists() is True, "Row preserved in database"

    # Verify CartItem removed so shoppers cannot buy
    assert CartItem.objects.filter(variant_id=var_2_ordered.id).exists() is False

    # Verify Parent product is still active
    product_2.refresh_from_db()
    assert product_2.is_deleted is False, "Parent product must remain active"
    print("PASS: Historical OrderItem preserved, snapshots verified, variant archived, parent product intact.")

    # -------------------------------------------------------------------------
    # TEST 4: Admin action confirmation workflow
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Admin action confirmation workflow ---")
    var_unconfirmed = ProductVariant.objects.create(
        product=product_2,
        sku=f"VAR-UNCONF-{unique_run}",
        regular_price=Decimal("500.00"),
        selling_price=Decimal("450.00")
    )

    req_unconf = setup_request(superuser, post_data={})
    resp_unconf = safe_delete_or_archive_variants(
        variant_admin,
        req_unconf,
        ProductVariant.all_objects.filter(id=var_unconfirmed.id)
    )
    assert resp_unconf.template_name == 'admin/catalogue/confirm_variant_cleanup.html', "Must show confirmation page"
    assert ProductVariant.all_objects.filter(id=var_unconfirmed.id).exists() is True, "Variant must not be touched yet"

    # Confirmed request
    req_conf = setup_request(superuser, post_data={'confirmed': 'yes'})
    safe_delete_or_archive_variants(
        variant_admin,
        req_conf,
        ProductVariant.all_objects.filter(id=var_unconfirmed.id)
    )
    assert ProductVariant.all_objects.filter(id=var_unconfirmed.id).exists() is False, "Variant deleted upon confirmation"
    print("PASS: Admin action confirmation flow works accurately.")

    # -------------------------------------------------------------------------
    # TEST 5: Atomic rollback on unexpected error
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Atomic rollback on unexpected failure ---")
    var_rollback = ProductVariant.objects.create(
        product=product_2,
        sku=f"VAR-ROLLBACK-{unique_run}",
        regular_price=Decimal("300.00"),
        selling_price=Decimal("250.00")
    )
    CartItem.objects.create(cart=cart, variant=var_rollback, quantity=1)

    with patch.object(ProductVariant, 'hard_delete', side_effect=RuntimeError("Simulated DB Disk Failure")):
        results_err = ProductVariantCleanupService.execute_cleanup(
            ProductVariant.all_objects.filter(id=var_rollback.id),
            user=superuser
        )
        assert len(results_err['errors']) == 1
        assert ProductVariant.all_objects.filter(id=var_rollback.id).exists() is True, "Variant preserved after error"
        assert CartItem.objects.filter(variant_id=var_rollback.id).exists() is True, "CartItem rolled back"
    print("PASS: Atomic rollback preserves records on failure.")

    print("\n>>> ALL PRODUCT VARIANT CLEANUP TESTS PASSED SUCCESSFULLY! <<<\n")


if __name__ == '__main__':
    run_tests()
