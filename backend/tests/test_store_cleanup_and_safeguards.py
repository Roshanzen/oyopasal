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
from django.db.models import ProtectedError

from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store, StoreGalleryImage
from apps.catalogue.models import Category, Product, ProductVariant
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.inventory.models import InventoryItem, Warehouse
from apps.cart.models import Cart, CartItem
from apps.stores.admin import StoreAdmin, force_delete_test_stores, archive_and_deactivate_stores
from apps.stores.services import StoreCleanupService, StoreDependencyAnalysis

User = get_user_model()


def setup_request(user, post_data=None):
    factory = RequestFactory()
    req = factory.post('/admin/stores/store/', data=post_data or {})
    req.user = user
    setattr(req, 'session', {})
    messages = FallbackStorage(req)
    setattr(req, '_messages', messages)
    return req


def run_tests():
    print("=== STARTING OYOPASAL STORE CLEANUP & SAFEGUARDS TEST SUITE ===")
    unique_run = uuid.uuid4().hex[:6]

    # --- Setup Base Fixtures ---
    superuser = User.objects.create_user(
        email=f"super_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="ADMIN",
        is_superuser=True,
        is_staff=True
    )
    staff_user = User.objects.create_user(
        email=f"staff_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="ADMIN",
        is_staff=True,
        is_superuser=False
    )
    customer_user = User.objects.create_user(
        email=f"cust_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="CUSTOMER"
    )
    vendor_user = User.objects.create_user(
        email=f"vendor_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="VENDOR"
    )
    real_vendor_user = User.objects.create_user(
        email=f"real_vendor_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="VENDOR"
    )
    test_vendor = VendorProfile.objects.create(
        user=vendor_user,
        business_name=f"Test Vendor {unique_run}",
        slug=f"test-vendor-{unique_run}",
        status=VendorStatus.APPROVED
    )
    real_vendor = VendorProfile.objects.create(
        user=real_vendor_user,
        business_name=f"Patan Fresh Grocery {unique_run}",
        slug=f"patan-fresh-grocery-{unique_run}",
        status=VendorStatus.APPROVED
    )

    cat = Category.objects.create(name=f"Test Cat {unique_run}", slug=f"test-cat-{unique_run}")
    modeladmin = StoreAdmin(Store, AdminSite())

    # =========================================================================
    # SCENARIO 1: Store with Historical Orders (Never Deleted -> Must Archive)
    # =========================================================================
    store_with_orders = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Store Orders {unique_run}",
        slug=f"test-store-orders-{unique_run}",
        is_active=True,
        is_verified=True
    )
    prod_1 = Product.objects.create(
        vendor=test_vendor,
        store=store_with_orders,
        category=cat,
        name=f"Ordered Product {unique_run}",
        slug=f"ordered-product-{unique_run}",
        base_sku=f"ORD-SKU-{unique_run}"
    )
    var_1 = ProductVariant.objects.create(
        product=prod_1,
        sku=f"ORD-VAR-{unique_run}",
        regular_price=Decimal("100.00"),
        selling_price=Decimal("90.00")
    )
    order_1 = Order.objects.create(
        customer=customer_user,
        order_number=f"ORD-TEST-{unique_run}",
        status=OrderStatus.CONFIRMED,
        subtotal=Decimal("90.00"),
        grand_total=Decimal("90.00")
    )
    suborder_1 = VendorSubOrder.objects.create(
        parent_order=order_1,
        vendor=test_vendor,
        store=store_with_orders,
        sub_order_number=f"SO-TEST-{unique_run}",
        status=OrderStatus.CONFIRMED,
        subtotal=Decimal("90.00")
    )
    item_1 = OrderItem.objects.create(
        sub_order=suborder_1,
        store=store_with_orders,
        variant=var_1,
        product_name=prod_1.name,
        variant_sku=var_1.sku,
        unit_price=Decimal("90.00"),
        quantity=1,
        total_price=Decimal("90.00")
    )

    # Execute cleanup on store_with_orders
    req = setup_request(superuser, post_data={'confirmed': 'yes'})
    qs_1 = Store.objects.filter(id=store_with_orders.id)
    force_delete_test_stores(modeladmin, req, qs_1)

    # Assertions for Scenario 1
    store_with_orders.refresh_from_db()
    assert Store.objects.filter(id=store_with_orders.id).exists(), "Store with orders must NOT be deleted!"
    assert store_with_orders.is_active is False, "Store with orders must be deactivated/archived!"
    assert Order.objects.filter(id=order_1.id).exists(), "Customer order must remain completely intact!"
    assert VendorSubOrder.objects.filter(id=suborder_1.id).exists(), "VendorSubOrder must remain intact!"
    assert OrderItem.objects.filter(id=item_1.id).exists(), "OrderItem must remain intact!"
    assert Product.objects.filter(id=prod_1.id).exists(), "Product must remain intact to preserve receipt links!"
    assert ProductVariant.objects.filter(id=var_1.id).exists(), "Variant must remain intact!"
    print("✓ Scenario 1 Passed: Store with historical orders is archived/deactivated, order records are 100% preserved.")

    # =========================================================================
    # SCENARIO 2: Clean Test Store with No Orders (Safe Permanent Deletion)
    # =========================================================================
    store_clean = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Clean Store {unique_run}",
        slug=f"test-clean-store-{unique_run}",
        is_active=True
    )
    clean_store_id = store_clean.id
    prod_clean = Product.objects.create(
        vendor=test_vendor,
        store=store_clean,
        category=cat,
        name=f"Clean Product {unique_run}",
        slug=f"clean-product-{unique_run}",
        base_sku=f"CLN-SKU-{unique_run}"
    )
    clean_prod_id = prod_clean.id
    var_clean = ProductVariant.objects.create(
        product=prod_clean,
        sku=f"CLN-VAR-{unique_run}",
        regular_price=Decimal("50.00"),
        selling_price=Decimal("45.00")
    )
    clean_var_id = var_clean.id
    # Add non-order dependencies (CartItem, GalleryImage)
    cart = Cart.objects.create(user=customer_user)
    CartItem.objects.create(cart=cart, variant=var_clean, quantity=2)
    StoreGalleryImage.objects.create(store=store_clean, caption="Gallery Test", sort_order=1)

    # Execute cleanup on clean store
    qs_2 = Store.objects.filter(id=clean_store_id)
    force_delete_test_stores(modeladmin, req, qs_2)

    # Assertions for Scenario 2
    assert not Store.objects.filter(id=clean_store_id).exists(), "Clean test store must be permanently deleted!"
    assert not Product.objects.filter(id=clean_prod_id).exists(), "Clean product must be deleted!"
    assert not ProductVariant.objects.filter(id=clean_var_id).exists(), "Clean variant must be deleted!"
    assert not CartItem.objects.filter(variant_id=clean_var_id).exists(), "Dangling cart items must be deleted!"
    assert not StoreGalleryImage.objects.filter(store_id=clean_store_id).exists(), "Gallery images must be deleted!"
    print("✓ Scenario 2 Passed: Clean test store and non-order dependencies are safely permanently deleted.")

    # =========================================================================
    # SCENARIO 3: Store with Protected References (OrderItem Protected FK)
    # =========================================================================
    # Store whose product variant is in an OrderItem -> ProtectedError prevention
    analysis_1 = StoreCleanupService.analyze_store(store_with_orders)
    assert analysis_1.has_orders_or_transactions is True, "Analysis must detect orders/transactions"
    assert analysis_1.action_recommendation == 'ARCHIVE', "Recommendation must be ARCHIVE"
    assert any("order" in r.lower() for r in analysis_1.reasons_to_protect), "Must detail protected reasons"

    # Verify atomic rollback if ProtectedError were simulated in hard_delete
    store_protected = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Protected Store {unique_run}",
        slug=f"test-protected-store-{unique_run}",
        is_active=True
    )
    with patch.object(Store, 'hard_delete', side_effect=ProtectedError("Cannot delete", [item_1])):
        results = StoreCleanupService.execute_cleanup(Store.objects.filter(id=store_protected.id))
        store_protected.refresh_from_db()
        assert Store.objects.filter(id=store_protected.id).exists(), "Store must not be deleted on ProtectedError"
        assert store_protected.is_active is False, "Store must be archived instead when ProtectedError is trapped"
        assert len(results['archived']) == 1, "Results must record store was archived due to protected reference"
    store_protected.hard_delete()
    print("✓ Scenario 3 Passed: Protected references are trapped, roll back cleanly, and fall back to archival.")

    # =========================================================================
    # SCENARIO 4: Mixed Bulk Selection (Real Store + Test with Orders + Clean Test)
    # =========================================================================
    prod_store = Store.objects.create(
        vendor=real_vendor,
        name=f"Patan Live Grocery {unique_run}",
        slug=f"patan-live-grocery-{unique_run}",
        is_active=True,
        contact_email="official@patanfresh.com.np"
    )
    test_archived_target = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Store Bulk Order {unique_run}",
        slug=f"test-store-bulk-order-{unique_run}",
        is_active=True
    )
    # Link an order to test_archived_target
    suborder_bulk = VendorSubOrder.objects.create(
        parent_order=order_1,
        vendor=test_vendor,
        store=test_archived_target,
        sub_order_number=f"SO-BULK-{unique_run}",
        status=OrderStatus.CONFIRMED,
        subtotal=Decimal("40.00")
    )
    test_delete_target = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Store Bulk Clean {unique_run}",
        slug=f"test-store-bulk-clean-{unique_run}",
        is_active=True
    )
    delete_target_id = test_delete_target.id

    mixed_qs = Store.objects.filter(id__in=[prod_store.id, test_archived_target.id, test_delete_target.id])
    force_delete_test_stores(modeladmin, req, mixed_qs)

    # Assertions for Scenario 4
    # 1. Production store must be untouched (skipped)
    prod_store.refresh_from_db()
    assert prod_store.is_active is True, "Production store must be completely skipped and remain active!"
    # 2. Test store with order must be archived
    test_archived_target.refresh_from_db()
    assert test_archived_target.is_active is False, "Test store with order must be archived!"
    assert Store.objects.filter(id=test_archived_target.id).exists(), "Test store with order must exist!"
    # 3. Clean test store must be permanently deleted
    assert not Store.objects.filter(id=delete_target_id).exists(), "Clean test store must be deleted!"
    print("✓ Scenario 4 Passed: Mixed bulk selection correctly skips production, archives order-linked, and deletes clean.")

    # =========================================================================
    # SCENARIO 5: Confirmation Step
    # =========================================================================
    unconfirmed_store = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Unconfirmed Store {unique_run}",
        slug=f"test-unconfirmed-{unique_run}",
        is_active=True
    )
    req_unconfirmed = setup_request(superuser, post_data={})  # Missing confirmed=yes
    response = force_delete_test_stores(modeladmin, req_unconfirmed, Store.objects.filter(id=unconfirmed_store.id))
    # Must return confirmation template response without deleting
    assert response is not None, "Unconfirmed call must return confirmation TemplateResponse"
    assert response.template_name == 'admin/stores/confirm_store_cleanup.html', "Must use confirm_store_cleanup.html"
    assert Store.objects.filter(id=unconfirmed_store.id).exists(), "Store must NOT be deleted prior to confirmation"
    # Now confirm
    req_confirmed = setup_request(superuser, post_data={'confirmed': 'yes'})
    force_delete_test_stores(modeladmin, req_confirmed, Store.objects.filter(id=unconfirmed_store.id))
    assert not Store.objects.filter(id=unconfirmed_store.id).exists(), "Store must be deleted after confirmation"
    print("✓ Scenario 5 Passed: Confirmation step prompts with template and only deletes upon confirmation.")

    # =========================================================================
    # SCENARIO 6: Rollback on Unexpected Error
    # =========================================================================
    error_store = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Error Store {unique_run}",
        slug=f"test-error-store-{unique_run}",
        is_active=True
    )
    error_prod = Product.objects.create(
        vendor=test_vendor,
        store=error_store,
        category=cat,
        name=f"Error Prod {unique_run}",
        slug=f"error-prod-{unique_run}",
        base_sku=f"ERR-SKU-{unique_run}"
    )
    with patch.object(Store, 'hard_delete', side_effect=RuntimeError("Simulated DB connection drop")):
        results = StoreCleanupService.execute_cleanup(Store.objects.filter(id=error_store.id))
        assert len(results['errors']) == 1, "Error must be caught and reported"
        # Since transaction rolled back, error_store and error_prod still exist
        assert Store.objects.filter(id=error_store.id).exists(), "Store must remain intact on rollback"
        assert Product.objects.filter(id=error_prod.id).exists(), "Product must remain intact on rollback"
    # Clean up error_store
    error_prod.hard_delete()
    error_store.hard_delete()
    print("✓ Scenario 6 Passed: Unexpected errors trigger atomic rollback without corrupting partial state.")

    # =========================================================================
    # SCENARIO 7: Idempotency
    # =========================================================================
    # Run cleanup twice on already archived store
    force_delete_test_stores(modeladmin, req, Store.objects.filter(id=test_archived_target.id))
    test_archived_target.refresh_from_db()
    assert test_archived_target.is_active is False, "Re-running cleanup must safely keep store archived"
    assert VendorSubOrder.objects.filter(id=suborder_bulk.id).exists(), "Orders must remain intact after re-run"
    print("✓ Scenario 7 Passed: Cleanup operation is fully idempotent on repeated execution.")

    # =========================================================================
    # SCENARIO 8: Superuser Restriction
    # =========================================================================
    req_staff = setup_request(staff_user, post_data={'confirmed': 'yes'})
    target_staff_store = Store.objects.create(
        vendor=test_vendor,
        name=f"Test Staff Target {unique_run}",
        slug=f"test-staff-target-{unique_run}",
        is_active=True
    )
    force_delete_test_stores(modeladmin, req_staff, Store.objects.filter(id=target_staff_store.id))
    assert Store.objects.filter(id=target_staff_store.id).exists(), "Non-superusers must be blocked!"
    target_staff_store.hard_delete()
    print("✓ Scenario 8 Passed: Action strictly blocks non-superusers.")

    # =========================================================================
    # Cleanup Fixtures
    # =========================================================================
    prod_store.hard_delete()
    suborder_bulk.delete()
    item_1.delete()
    suborder_1.delete()
    order_1.delete()
    var_1.delete()
    prod_1.delete()
    store_with_orders.hard_delete()
    test_archived_target.hard_delete()
    cart.delete()
    cat.delete()
    test_vendor.delete()
    real_vendor.delete()
    customer_user.delete()
    vendor_user.delete()
    real_vendor_user.delete()
    staff_user.delete()
    superuser.delete()

    print("=== ALL 8 OYOPASAL STORE CLEANUP & SAFEGUARD TESTS PASSED (100% SUCCESS) ===")


if __name__ == '__main__':
    run_tests()
