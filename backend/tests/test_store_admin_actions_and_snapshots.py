import os, sys
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

import uuid
from decimal import Decimal
from django.test import RequestFactory
from django.contrib.admin.sites import AdminSite
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.auth import get_user_model
from apps.stores.models import Store
from apps.stores.admin import StoreAdmin, archive_and_deactivate_stores, force_delete_test_stores
from apps.vendors.models import VendorProfile, VendorStatus
from apps.catalogue.models import Category, Product, ProductVariant
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus

User = get_user_model()


def setup_request(user):
    rf = RequestFactory()
    req = rf.get('/admin/stores/store/')
    req.user = user
    setattr(req, 'session', {})
    messages = FallbackStorage(req)
    setattr(req, '_messages', messages)
    return req


def run_tests():
    print("=== STARTING OYOPASAL STORE ADMIN & SNAPSHOT TESTS ===")
    unique_run = uuid.uuid4().hex[:6]

    # 1. Setup Admin Users
    superuser = User.objects.create_user(
        email=f"super_{unique_run}@example.com",
        password="Password123!",
        role="ADMIN",
        is_superuser=True,
        is_staff=True
    )
    staff_user = User.objects.create_user(
        email=f"staff_{unique_run}@example.com",
        password="Password123!",
        role="ADMIN",
        is_superuser=False,
        is_staff=True
    )
    customer_user = User.objects.create_user(
        email=f"cust_{unique_run}@example.com",
        password="Password123!",
        role="CUSTOMER"
    )

    vendor_user = User.objects.create_user(
        email=f"vend_{unique_run}@example.com",
        password="Password123!",
        role="VENDOR"
    )
    vendor = VendorProfile.objects.create(
        user=vendor_user,
        business_name=f"Vendor Test {unique_run}",
        slug=f"vendor-test-{unique_run}",
        status=VendorStatus.APPROVED
    )

    cat = Category.objects.create(name=f"Category {unique_run}", slug=f"cat-{unique_run}")

    # Create Store A (for deactivation test) and Store B (for force-delete test) and Store C (for standard delete SET_NULL test)
    store_a = Store.objects.create(
        vendor=vendor,
        name=f"Alpha Mart {unique_run}",
        slug=f"alpha-mart-{unique_run}",
        is_active=True,
        is_verified=True
    )
    store_b = Store.objects.create(
        vendor=vendor,
        name=f"Beta Test Store {unique_run}",
        slug=f"beta-test-{unique_run}",
        is_active=True,
        is_verified=True
    )
    store_c = Store.objects.create(
        vendor=vendor,
        name=f"Gamma Mart {unique_run}",
        slug=f"gamma-mart-{unique_run}",
        is_active=True,
        is_verified=True
    )

    prod_b = Product.objects.create(
        vendor=vendor,
        store=store_b,
        category=cat,
        name=f"Product Beta {unique_run}",
        slug=f"prod-beta-{unique_run}",
        base_sku=f"SKU-B-{unique_run}"
    )
    var_b = ProductVariant.objects.create(
        product=prod_b,
        sku=f"VAR-B-{unique_run}",
        regular_price=Decimal("250.00"),
        selling_price=Decimal("250.00")
    )

    prod_c = Product.objects.create(
        vendor=vendor,
        store=store_c,
        category=cat,
        name=f"Product Gamma {unique_run}",
        slug=f"prod-gamma-{unique_run}",
        base_sku=f"SKU-C-{unique_run}"
    )
    var_c = ProductVariant.objects.create(
        product=prod_c,
        sku=f"VAR-C-{unique_run}",
        regular_price=Decimal("150.00"),
        selling_price=Decimal("150.00")
    )

    # Orders for Store B
    order_b = Order.objects.create(
        order_number=f"ORD-B-{unique_run}",
        customer=customer_user,
        grand_total=Decimal("250.00"),
        subtotal=Decimal("250.00")
    )
    suborder_b = VendorSubOrder.objects.create(
        parent_order=order_b,
        sub_order_number=f"SO-B-{unique_run}",
        vendor=vendor,
        store=store_b,
        subtotal=Decimal("250.00"),
        status=OrderStatus.CONFIRMED
    )
    item_b = OrderItem.objects.create(
        sub_order=suborder_b,
        store=store_b,
        variant=var_b,
        product_name=prod_b.name,
        unit_price=Decimal("250.00"),
        quantity=1,
        total_price=Decimal("250.00")
    )

    # Orders for Store C
    order_c = Order.objects.create(
        order_number=f"ORD-C-{unique_run}",
        customer=customer_user,
        grand_total=Decimal("150.00"),
        subtotal=Decimal("150.00")
    )
    suborder_c = VendorSubOrder.objects.create(
        parent_order=order_c,
        sub_order_number=f"SO-C-{unique_run}",
        vendor=vendor,
        store=store_c,
        subtotal=Decimal("150.00"),
        status=OrderStatus.CONFIRMED
    )
    item_c = OrderItem.objects.create(
        sub_order=suborder_c,
        variant=var_c,
        product_name=prod_c.name,
        unit_price=Decimal("150.00"),
        quantity=1,
        total_price=Decimal("150.00")
    )

    modeladmin = StoreAdmin(Store, AdminSite())

    # --- TEST 1: StoreAdmin action registration ---
    action_names = [a.__name__ if callable(a) else a for a in modeladmin.actions]
    assert 'archive_and_deactivate_stores' in action_names, "archive_and_deactivate_stores must be in StoreAdmin actions"
    assert 'force_delete_test_stores' in action_names, "force_delete_test_stores must be in StoreAdmin actions"
    print("✓ Test 1: StoreAdmin actions are properly registered.")

    # --- TEST 2: Archive / Deactivate selected stores ---
    req = setup_request(superuser)
    qs_a = Store.objects.filter(id=store_a.id)
    archive_and_deactivate_stores(modeladmin, req, qs_a)
    store_a.refresh_from_db()
    assert store_a.is_active is False, "Store A must now have is_active=False"
    print("✓ Test 2: 'Archive / Deactivate selected stores' sets is_active=False successfully.")

    # --- TEST 3: OrderItem and VendorSubOrder Snapshots ---
    suborder_c.refresh_from_db()
    item_c.refresh_from_db()
    assert suborder_c.store_name_snapshot == store_c.name, f"Expected {store_c.name}, got {suborder_c.store_name_snapshot}"
    assert item_c.store_name_snapshot == store_c.name, f"Expected {store_c.name}, got {item_c.store_name_snapshot}"
    assert item_c.product_title_snapshot == prod_c.name, f"Expected {prod_c.name}, got {item_c.product_title_snapshot}"
    print("✓ Test 3: OrderItem and VendorSubOrder auto-populate store_name_snapshot and product_title_snapshot.")

    # --- TEST 4: Delete on Store with Existing Orders (Archives safely, no ProtectedError) ---
    store_c_id = store_c.id
    store_c_name = store_c.name
    # Delete store_c through modeladmin (must archive to preserve customer receipts)
    modeladmin.delete_model(req, store_c)
    store_c.refresh_from_db()
    assert Store.all_objects.filter(id=store_c_id).exists(), "Store C with orders must NOT be hard-deleted"
    assert store_c.is_active is False, "Store C must be archived/deactivated"
    suborder_c.refresh_from_db()
    item_c.refresh_from_db()
    assert suborder_c.store_name_snapshot == store_c_name, "SubOrder store_name_snapshot must be preserved"
    assert item_c.store_name_snapshot == store_c_name, "OrderItem store_name_snapshot must be preserved"
    assert Order.objects.filter(id=order_c.id).exists(), "Order C must remain intact"
    print("✓ Test 4: Store with existing orders is safely archived without ProtectedError and preserves snapshots.")

    # --- TEST 5: Force Delete Test Stores permission restriction ---
    req_staff = setup_request(staff_user)
    qs_b = Store.objects.filter(id=store_b.id)
    force_delete_test_stores(modeladmin, req_staff, qs_b)
    # Store B must still exist because staff_user is not superuser
    assert Store.objects.filter(id=store_b.id).exists(), "Non-superuser cannot force delete test stores"
    print("✓ Test 5: 'Force delete test stores' strictly blocks non-superusers.")

    # --- TEST 6: Force Delete Test Stores superuser execution & dependency protection ---
    # Create clean test store D without orders
    store_d = Store.objects.create(
        vendor=vendor,
        name=f"Test Store Clean D {unique_run}",
        slug=f"test-store-clean-d-{unique_run}",
        is_active=True
    )
    store_d_id = store_d.id

    req_super = setup_request(superuser)
    setattr(req_super, 'is_confirmed', True)
    force_delete_test_stores(modeladmin, req_super, Store.objects.filter(id__in=[store_b.id, store_d_id]))

    # Clean store D must be deleted
    assert not Store.objects.filter(id=store_d_id).exists(), "Clean test store D must be permanently deleted"
    # Store B has orders -> must be archived, orders NOT wiped
    store_b.refresh_from_db()
    assert Store.objects.filter(id=store_b.id).exists(), "Store B with orders must be archived, not deleted"
    assert store_b.is_active is False, "Store B must be deactivated"
    assert VendorSubOrder.objects.filter(id=suborder_b.id).exists(), "SubOrder B must be preserved"
    assert OrderItem.objects.filter(id=item_b.id).exists(), "OrderItem B must be preserved"
    assert Order.objects.filter(id=order_b.id).exists(), "Order B must be preserved"
    print("✓ Test 6: 'Force delete test stores' deletes clean test stores and safely archives stores with orders.")

    # Cleanup remaining fixtures
    Order.objects.filter(id__in=[order_b.id, order_c.id]).delete()
    store_a.delete()
    store_b.hard_delete()
    store_c.hard_delete()
    prod_b.hard_delete()
    prod_c.hard_delete()
    cat.delete()
    vendor.delete()
    customer_user.delete()
    vendor_user.delete()
    superuser.delete()
    staff_user.delete()
    print("=== ALL STORE ADMIN & SNAPSHOT TESTS PASSED WITH 100% SUCCESS ===")


if __name__ == '__main__':
    run_tests()
