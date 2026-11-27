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

from apps.vendors.models import VendorProfile, VendorStatus, VendorDocument, VendorStaffMember
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductImage, ProductStatus
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.inventory.models import InventoryItem, Warehouse
from apps.cart.models import Cart, CartItem
from apps.customers.models import WishlistItem
from apps.settlements.models import VendorSettlement, SettlementStatus
from apps.vendors.admin import VendorProfileAdmin, safe_delete_or_archive_vendors
from apps.vendors.services import VendorCleanupService

User = get_user_model()


def setup_request(user, post_data=None):
    factory = RequestFactory()
    req = factory.post('/admin/vendors/vendorprofile/', data=post_data or {})
    req.user = user
    setattr(req, 'session', {})
    messages = FallbackStorage(req)
    setattr(req, '_messages', messages)
    return req


def run_tests():
    print("=== STARTING VENDOR CLEANUP & SAFEGUARDS TEST SUITE ===")
    unique_run = uuid.uuid4().hex[:6]

    superuser = User.objects.create_user(
        email=f"super_vend_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="ADMIN",
        is_superuser=True,
        is_staff=True
    )
    staff_user = User.objects.create_user(
        email=f"staff_vend_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="ADMIN",
        is_staff=True,
        is_superuser=False
    )
    customer_user = User.objects.create_user(
        email=f"cust_vend_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="CUSTOMER"
    )

    category = Category.objects.create(
        name=f"Vendor Test Cat {unique_run}",
        slug=f"vendor-test-cat-{unique_run}"
    )
    warehouse = Warehouse.objects.create(
        name=f"Vendor WH {unique_run}",
        code=f"VEND-WH-{unique_run}"
    )
    cart = Cart.objects.create(user=customer_user)

    admin_site = AdminSite()
    vendor_admin = VendorProfileAdmin(VendorProfile, admin_site)

    # -------------------------------------------------------------------------
    # TEST 1: Vendor with products but NO order history -> Safe permanent deletion
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Vendor with products & 0 orders -> Safe permanent deletion ---")
    u_clean = User.objects.create_user(email=f"clean_v_{unique_run}@oyopasal.com", password="Password123!", role="VENDOR")
    staff_clean_user = User.objects.create_user(email=f"clean_staff_{unique_run}@oyopasal.com", password="Password123!", role="STAFF")

    vendor_clean = VendorProfile.objects.create(
        user=u_clean,
        business_name=f"Clean Test Vendor {unique_run}",
        slug=f"clean-test-vendor-{unique_run}",
        status=VendorStatus.APPROVED
    )
    store_clean = Store.objects.create(
        vendor=vendor_clean,
        name=f"Clean Store {unique_run}",
        slug=f"clean-store-{unique_run}"
    )
    VendorDocument.objects.create(
        vendor=vendor_clean,
        document_type='PAN_CERTIFICATE',
        document_url='https://example.com/pan.png'
    )
    VendorStaffMember.objects.create(
        vendor=vendor_clean,
        user=staff_clean_user
    )

    # Vendor products and variants
    prod_clean = Product.objects.create(
        vendor=vendor_clean,
        store=store_clean,
        category=category,
        name=f"Clean Product {unique_run}",
        base_sku=f"SKU-CL-{unique_run}"
    )
    var_clean = ProductVariant.objects.create(
        product=prod_clean,
        sku=f"VAR-CL-{unique_run}",
        regular_price=Decimal("1500.00"),
        selling_price=Decimal("1400.00"),
        is_default=True
    )
    InventoryItem.objects.create(warehouse=warehouse, variant=var_clean, quantity_on_hand=20)
    CartItem.objects.create(cart=cart, variant=var_clean, quantity=1)
    WishlistItem.objects.create(user=customer_user, product=prod_clean)

    analysis_clean = VendorCleanupService.analyze_vendor(vendor_clean)
    assert analysis_clean.action_recommendation == 'DELETE', "Should recommend DELETE"
    assert analysis_clean.has_orders_or_transactions is False

    # Execute cleanup
    results_1 = VendorCleanupService.execute_cleanup(
        VendorProfile.objects.filter(id=vendor_clean.id),
        user=superuser
    )
    assert len(results_1['deleted']) == 1, "Vendor must be in deleted list"
    assert len(results_1['errors']) == 0

    # Verify everything was cleanly deleted
    assert VendorProfile.objects.filter(id=vendor_clean.id).exists() is False, "Vendor row deleted"
    assert Product.all_objects.filter(id=prod_clean.id).exists() is False, "Product row deleted"
    assert ProductVariant.all_objects.filter(id=var_clean.id).exists() is False, "Variant row deleted"
    assert Store.all_objects.filter(id=store_clean.id).exists() is False, "Store row deleted"
    assert CartItem.objects.filter(variant_id=var_clean.id).exists() is False, "CartItem removed"
    assert WishlistItem.objects.filter(product_id=prod_clean.id).exists() is False, "Wishlist removed"
    assert InventoryItem.objects.filter(variant_id=var_clean.id).exists() is False, "Inventory removed"
    print("PASS: Clean vendor and its products/variants/stores deleted with 0 ProtectedErrors.")

    # -------------------------------------------------------------------------
    # TEST 2: Vendor with historical orders -> Safe archival & snapshot preservation
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Vendor with historical orders -> Safe Archival & Preservation ---")
    u_ordered = User.objects.create_user(email=f"ord_v_{unique_run}@oyopasal.com", password="Password123!", role="VENDOR")
    vendor_ordered = VendorProfile.objects.create(
        user=u_ordered,
        business_name=f"Ordered Vendor {unique_run}",
        slug=f"ordered-vendor-{unique_run}",
        status=VendorStatus.APPROVED
    )
    store_ordered = Store.objects.create(
        vendor=vendor_ordered,
        name=f"Ordered Store {unique_run}",
        slug=f"ordered-store-{unique_run}",
        is_active=True
    )
    prod_ordered = Product.objects.create(
        vendor=vendor_ordered,
        store=store_ordered,
        category=category,
        name=f"Ordered Product {unique_run}",
        base_sku=f"SKU-ORD-{unique_run}"
    )
    var_ordered = ProductVariant.objects.create(
        product=prod_ordered,
        sku=f"VAR-ORD-{unique_run}",
        regular_price=Decimal("2500.00"),
        selling_price=Decimal("2200.00"),
        is_default=True
    )

    # Also an unpurchased second product on same vendor
    prod_unpurchased = Product.objects.create(
        vendor=vendor_ordered,
        store=store_ordered,
        category=category,
        name=f"Unpurchased Prod {unique_run}",
        base_sku=f"SKU-UNP-{unique_run}"
    )
    var_unpurchased = ProductVariant.objects.create(
        product=prod_unpurchased,
        sku=f"VAR-UNP-{unique_run}",
        regular_price=Decimal("500.00"),
        selling_price=Decimal("400.00"),
        is_default=True
    )

    # Create historical order and sub-order
    order = Order.objects.create(
        order_number=f"ORD-VEND-{unique_run}",
        customer=customer_user,
        subtotal=Decimal("2200.00"),
        grand_total=Decimal("2200.00"),
        status=OrderStatus.DELIVERED
    )
    suborder = VendorSubOrder.objects.create(
        sub_order_number=f"SUB-VEND-{unique_run}",
        parent_order=order,
        vendor=vendor_ordered,
        store=store_ordered,
        status=OrderStatus.DELIVERED,
        subtotal=Decimal("2200.00"),
        commission_amount=Decimal("220.00"),
        vendor_net_amount=Decimal("1980.00")
    )
    order_item = OrderItem.objects.create(
        sub_order=suborder,
        store=store_ordered,
        variant=var_ordered,
        product_name=prod_ordered.name,
        variant_sku=var_ordered.sku,
        unit_price=Decimal("2200.00"),
        quantity=1,
        total_price=Decimal("2200.00")
    )

    # Active cart items exist for both variants
    CartItem.objects.create(cart=cart, variant=var_ordered, quantity=1)
    CartItem.objects.create(cart=cart, variant=var_unpurchased, quantity=1)

    analysis_ordered = VendorCleanupService.analyze_vendor(vendor_ordered)
    assert analysis_ordered.has_orders_or_transactions is True
    assert analysis_ordered.action_recommendation == 'ARCHIVE'

    # Execute cleanup
    results_2 = VendorCleanupService.execute_cleanup(
        VendorProfile.objects.filter(id=vendor_ordered.id),
        user=superuser
    )
    assert len(results_2['archived']) == 1, "Vendor must be archived"
    assert len(results_2['deleted']) == 0, "Vendor must NOT be deleted"

    # Verify Vendor state
    vendor_ordered.refresh_from_db()
    assert vendor_ordered.status == VendorStatus.ARCHIVED, "Status must be ARCHIVED"

    # Verify Store state
    store_ordered.refresh_from_db()
    assert store_ordered.is_active is False, "Store must be deactivated"
    assert store_ordered.is_deleted is True, "Store must be soft-deleted"

    # Verify historical Order and SubOrder remain 100% intact
    suborder.refresh_from_db()
    assert suborder.vendor_id == vendor_ordered.id, "SubOrder vendor FK preserved"
    assert suborder.store_name_snapshot == vendor_ordered.business_name or suborder.store_name_snapshot == store_ordered.name
    order_item.refresh_from_db()
    assert order_item.variant_id == var_ordered.id, "OrderItem variant FK preserved"
    assert order_item.product_title_snapshot == prod_ordered.name
    assert order_item.variant_sku == var_ordered.sku

    # Verify Purchased product and variant are archived
    prod_ordered.refresh_from_db()
    assert prod_ordered.status == ProductStatus.ARCHIVED, "Product must be ARCHIVED"
    assert prod_ordered.is_deleted is True
    var_ordered.refresh_from_db()
    assert var_ordered.is_active is False
    assert var_ordered.is_deleted is True

    # Verify Unpurchased product of that vendor was hard-deleted
    assert Product.all_objects.filter(id=prod_unpurchased.id).exists() is False, "Unpurchased product cleaned up"

    # Verify Cart items for vendor products are cleared
    assert CartItem.objects.filter(variant_id__in=[var_ordered.id, var_unpurchased.id]).exists() is False
    print("PASS: Historical orders preserved, snapshots intact, vendor & ordered products archived, unpurchased products purged.")

    # -------------------------------------------------------------------------
    # TEST 3: Vendor with settlements cannot be deleted
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Vendor with settlement record -> Safely archived ---")
    u_settle = User.objects.create_user(email=f"settle_v_{unique_run}@oyopasal.com", password="Password123!", role="VENDOR")
    vendor_settle = VendorProfile.objects.create(
        user=u_settle,
        business_name=f"Settled Vendor {unique_run}",
        slug=f"settled-vendor-{unique_run}",
        status=VendorStatus.APPROVED
    )
    VendorSettlement.objects.create(
        vendor=vendor_settle,
        settlement_number=f"SET-{unique_run}",
        gross_amount=Decimal("5000.00"),
        platform_commission=Decimal("500.00"),
        net_payout=Decimal("4500.00"),
        status=SettlementStatus.PAID
    )

    analysis_settle = VendorCleanupService.analyze_vendor(vendor_settle)
    assert analysis_settle.has_orders_or_transactions is True
    assert analysis_settle.action_recommendation == 'ARCHIVE'

    results_3 = VendorCleanupService.execute_cleanup(
        VendorProfile.objects.filter(id=vendor_settle.id),
        user=superuser
    )
    assert len(results_3['archived']) == 1
    assert VendorProfile.objects.filter(id=vendor_settle.id).exists() is True
    vendor_settle.refresh_from_db()
    assert vendor_settle.status == VendorStatus.ARCHIVED
    print("PASS: Vendor with settlements safely archived.")

    # -------------------------------------------------------------------------
    # TEST 4: Superuser permission check on admin action
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Superuser permission safeguard ---")
    req_staff = setup_request(staff_user, post_data={'confirmed': 'yes'})
    safe_delete_or_archive_vendors(
        vendor_admin,
        req_staff,
        VendorProfile.objects.filter(id=vendor_settle.id)
    )
    # Check that error message was issued
    messages = list(req_staff._messages)
    assert any("Permission denied" in m.message for m in messages), "Non-superuser must be blocked"
    print("PASS: Non-superuser blocked with Permission Denied.")

    # -------------------------------------------------------------------------
    # TEST 5: Atomic rollback on failure
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Atomic rollback on failure ---")
    u_err = User.objects.create_user(email=f"err_v_{unique_run}@oyopasal.com", password="Password123!", role="VENDOR")
    vendor_err = VendorProfile.objects.create(
        user=u_err,
        business_name=f"Error Rollback Vendor {unique_run}",
        slug=f"error-rollback-vendor-{unique_run}"
    )

    with patch.object(VendorProfile, 'delete', side_effect=RuntimeError("Simulated Storage Failure")):
        results_err = VendorCleanupService.execute_cleanup(
            VendorProfile.objects.filter(id=vendor_err.id),
            user=superuser
        )
        assert len(results_err['errors']) == 1
        assert VendorProfile.objects.filter(id=vendor_err.id).exists() is True, "Vendor preserved on failure"
    print("PASS: Atomic rollback guarantees zero partial corruption.")

    print("\n>>> ALL VENDOR CLEANUP TESTS PASSED SUCCESSFULLY! <<<\n")


if __name__ == '__main__':
    run_tests()
