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
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.catalogue.admin import CategoryAdmin, safe_delete_or_archive_categories
from apps.catalogue.services import CategoryCleanupService

User = get_user_model()


def setup_request(user, post_data=None):
    factory = RequestFactory()
    req = factory.post('/admin/catalogue/category/', data=post_data or {})
    req.user = user
    setattr(req, 'session', {})
    messages = FallbackStorage(req)
    setattr(req, '_messages', messages)
    return req


def run_tests():
    print("=== STARTING CATEGORY CLEANUP & SAFEGUARDS TEST SUITE ===")
    unique_run = uuid.uuid4().hex[:6]

    superuser = User.objects.create_user(
        email=f"super_cat_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="ADMIN",
        is_superuser=True,
        is_staff=True
    )
    vendor_user = User.objects.create_user(
        email=f"vendor_cat_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="VENDOR"
    )
    customer_user = User.objects.create_user(
        email=f"cust_cat_{unique_run}@oyopasal.com",
        password="TestPassword123!",
        role="CUSTOMER"
    )

    vendor = VendorProfile.objects.create(
        user=vendor_user,
        business_name=f"Cat Test Vendor {unique_run}",
        slug=f"cat-test-vendor-{unique_run}",
        status=VendorStatus.APPROVED
    )
    store = Store.objects.create(
        vendor=vendor,
        name=f"Cat Test Store {unique_run}",
        slug=f"cat-test-store-{unique_run}",
        is_active=True
    )

    admin_site = AdminSite()
    category_admin = CategoryAdmin(Category, admin_site)

    # -------------------------------------------------------------------------
    # TEST 1: Deleting an empty category (Safe permanent deletion)
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: Delete empty category -> Safe permanent deletion ---")
    cat_empty = Category.objects.create(
        name=f"Empty Cat {unique_run}",
        slug=f"empty-cat-{unique_run}"
    )
    analysis_empty = CategoryCleanupService.analyze_category(cat_empty)
    assert analysis_empty.can_safely_delete is True
    assert analysis_empty.action_recommendation == 'DELETE'

    results_1 = CategoryCleanupService.execute_cleanup(
        Category.all_objects.filter(id=cat_empty.id),
        user=superuser
    )
    assert len(results_1['deleted']) == 1
    assert Category.all_objects.filter(id=cat_empty.id).exists() is False, "Empty category must be hard deleted"
    print("PASS: Empty category permanently deleted cleanly.")

    # -------------------------------------------------------------------------
    # TEST 2: Archiving a category containing products (No reassignment)
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: Category containing products without reassignment -> Safe Archival ---")
    cat_with_prods = Category.objects.create(
        name=f"Cat With Prods {unique_run}",
        slug=f"cat-with-prods-{unique_run}"
    )
    subcat = Category.objects.create(
        name=f"Subcat of Prods {unique_run}",
        slug=f"subcat-prods-{unique_run}",
        parent=cat_with_prods
    )
    prod_1 = Product.objects.create(
        vendor=vendor,
        store=store,
        category=cat_with_prods,
        name=f"Product In Cat {unique_run}",
        base_sku=f"SKU-CAT1-{unique_run}"
    )
    var_1 = ProductVariant.objects.create(
        product=prod_1,
        sku=f"VAR-CAT1-{unique_run}",
        regular_price=Decimal("100.00"),
        selling_price=Decimal("90.00")
    )

    analysis_prods = CategoryCleanupService.analyze_category(cat_with_prods)
    assert analysis_prods.can_safely_delete is False
    assert analysis_prods.products_count == 1
    assert analysis_prods.subcategories_count == 1

    # Execute cleanup without target category -> must archive
    results_2 = CategoryCleanupService.execute_cleanup(
        Category.all_objects.filter(id=cat_with_prods.id),
        target_category=None,
        user=superuser
    )
    assert len(results_2['archived']) == 1
    assert len(results_2['deleted']) == 0

    cat_with_prods.refresh_from_db()
    assert cat_with_prods.is_active is False, "Category must be deactivated"
    assert cat_with_prods.is_deleted is True, "Category must be soft-deleted"
    assert Category.objects.filter(id=cat_with_prods.id).exists() is False, "Excluded from active queries"
    assert Category.all_objects.filter(id=cat_with_prods.id).exists() is True, "Row preserved in database"

    # Subcategory must also be deactivated
    subcat.refresh_from_db()
    assert subcat.is_active is False, "Child subcategory must also be deactivated"

    # Product and variant must remain completely intact
    prod_1.refresh_from_db()
    assert prod_1.category_id == cat_with_prods.id, "Product category FK preserved"
    assert prod_1.is_deleted is False, "Product must NOT be deleted"
    print("PASS: Category with products safely archived, child subcategories deactivated, products preserved.")

    # -------------------------------------------------------------------------
    # TEST 3: Deleting a category after safely reassigning products
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Reassign products to active target category & delete old category ---")
    cat_old = Category.objects.create(
        name=f"Old Category {unique_run}",
        slug=f"old-cat-{unique_run}"
    )
    cat_target = Category.objects.create(
        name=f"Target Category {unique_run}",
        slug=f"target-cat-{unique_run}"
    )
    subcat_old = Category.objects.create(
        name=f"Old Subcategory {unique_run}",
        slug=f"old-subcat-{unique_run}",
        parent=cat_old
    )
    prod_reassign = Product.objects.create(
        vendor=vendor,
        store=store,
        category=cat_old,
        name=f"Product To Reassign {unique_run}",
        base_sku=f"SKU-REASS-{unique_run}"
    )

    results_3 = CategoryCleanupService.execute_cleanup(
        Category.all_objects.filter(id=cat_old.id),
        target_category=cat_target,
        user=superuser
    )
    assert len(results_3['deleted']) == 1, "Old category must be deleted"
    assert len(results_3['reassigned']) == 1
    assert Category.all_objects.filter(id=cat_old.id).exists() is False, "Old category hard deleted"

    # Verify product was reassigned to target category
    prod_reassign.refresh_from_db()
    assert prod_reassign.category_id == cat_target.id, "Product must now be assigned to target category"

    # Verify subcategory was reparented cleanly to old category's parent (None in this case)
    subcat_old.refresh_from_db()
    assert subcat_old.parent_id is None, "Subcategory reparented to avoid orphan cascade"
    assert Category.all_objects.filter(id=subcat_old.id).exists() is True, "Subcategory preserved"
    print("PASS: Products reassigned to target category, subcategories reparented, old category deleted.")

    # -------------------------------------------------------------------------
    # TEST 4: Categories containing products with historical OrderItems
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Category containing products with historical OrderItems ---")
    cat_ordered = Category.objects.create(
        name=f"Ordered Category {unique_run}",
        slug=f"ordered-cat-{unique_run}"
    )
    prod_ordered = Product.objects.create(
        vendor=vendor,
        store=store,
        category=cat_ordered,
        name=f"Ordered Prod {unique_run}",
        base_sku=f"SKU-ORD-CAT-{unique_run}"
    )
    var_ordered = ProductVariant.objects.create(
        product=prod_ordered,
        sku=f"VAR-ORD-CAT-{unique_run}",
        regular_price=Decimal("500.00"),
        selling_price=Decimal("450.00")
    )
    order = Order.objects.create(
        order_number=f"ORD-CAT-{unique_run}",
        customer=customer_user,
        subtotal=Decimal("450.00"),
        grand_total=Decimal("450.00"),
        status=OrderStatus.DELIVERED
    )
    suborder = VendorSubOrder.objects.create(
        sub_order_number=f"SUB-CAT-{unique_run}",
        parent_order=order,
        vendor=vendor,
        store=store,
        status=OrderStatus.DELIVERED,
        subtotal=Decimal("450.00")
    )
    order_item = OrderItem.objects.create(
        sub_order=suborder,
        store=store,
        variant=var_ordered,
        product_name=prod_ordered.name,
        variant_sku=var_ordered.sku,
        unit_price=Decimal("450.00"),
        quantity=1,
        total_price=Decimal("450.00")
    )

    analysis_ord = CategoryCleanupService.analyze_category(cat_ordered)
    assert analysis_ord.ordered_products_count == 1
    assert analysis_ord.can_safely_delete is False

    # Execute cleanup without target -> Safe Archival
    results_4 = CategoryCleanupService.execute_cleanup(
        Category.all_objects.filter(id=cat_ordered.id),
        target_category=None,
        user=superuser
    )
    assert len(results_4['archived']) == 1

    # Verify order history remains 100% intact
    order_item.refresh_from_db()
    assert order_item.variant_id == var_ordered.id
    assert order_item.variant.product_id == prod_ordered.id
    assert order_item.variant.product.category_id == cat_ordered.id
    assert order_item.product_name == prod_ordered.name
    assert Order.objects.filter(id=order.id).exists() is True
    assert VendorSubOrder.objects.filter(id=suborder.id).exists() is True

    cat_ordered.refresh_from_db()
    assert cat_ordered.is_active is False
    assert cat_ordered.is_deleted is True
    print("PASS: Category with historical orders safely archived, OrderItems & Orders 100% intact.")

    # -------------------------------------------------------------------------
    # TEST 5: Prevent new product assignments to archived categories
    # -------------------------------------------------------------------------
    print("\n--- TEST 5: Prevent new product assignments to archived category ---")
    try:
        Product.objects.create(
            vendor=vendor,
            store=store,
            category=cat_ordered,  # Archived category!
            name=f"Illegal Product {unique_run}",
            base_sku=f"SKU-ILLEGAL-{unique_run}"
        )
        assert False, "Should have raised ValidationError when assigning inactive category!"
    except ValidationError as ve:
        print(f"Caught expected ValidationError: {ve}")
        assert "inactive or archived" in str(ve).lower()
    print("PASS: System strictly blocks assigning products to archived categories.")

    # -------------------------------------------------------------------------
    # TEST 6: Prevent circular hierarchy reassignment
    # -------------------------------------------------------------------------
    print("\n--- TEST 6: Prevent circular hierarchy reassignment ---")
    cat_parent = Category.objects.create(
        name=f"Parent Cat {unique_run}",
        slug=f"parent-cat-{unique_run}"
    )
    cat_child = Category.objects.create(
        name=f"Child Cat {unique_run}",
        slug=f"child-cat-{unique_run}",
        parent=cat_parent
    )
    # Attempt to reassign parent's products to its own child while deleting parent
    results_circ = CategoryCleanupService.execute_cleanup(
        Category.all_objects.filter(id=cat_parent.id),
        target_category=cat_child,
        user=superuser
    )
    assert len(results_circ['errors']) == 1
    assert "circular hierarchy" in results_circ['errors'][0]['error'].lower()
    assert Category.all_objects.filter(id=cat_parent.id).exists() is True
    print("PASS: Circular hierarchy reassignment prevented.")

    # -------------------------------------------------------------------------
    # TEST 7: Reactivating an archived category
    # -------------------------------------------------------------------------
    print("\n--- TEST 7: Reactivate archived category ---")
    count_reactivated = CategoryCleanupService.reactivate_categories(
        Category.all_objects.filter(id=cat_ordered.id),
        user=superuser
    )
    assert count_reactivated == 1
    cat_ordered.refresh_from_db()
    assert cat_ordered.is_active is True
    assert cat_ordered.is_deleted is False
    assert cat_ordered.deleted_at is None
    print("PASS: Category reactivated successfully.")

    # -------------------------------------------------------------------------
    # TEST 8: Admin action confirmation workflow
    # -------------------------------------------------------------------------
    print("\n--- TEST 8: Admin action confirmation workflow ---")
    cat_unconf = Category.objects.create(
        name=f"Unconfirmed Cat {unique_run}",
        slug=f"unconf-cat-{unique_run}"
    )
    # Unconfirmed POST
    req_unconf = setup_request(superuser, post_data={})
    resp_unconf = safe_delete_or_archive_categories(
        category_admin,
        req_unconf,
        Category.all_objects.filter(id=cat_unconf.id)
    )
    assert resp_unconf.template_name == 'admin/catalogue/confirm_category_cleanup.html'
    assert Category.all_objects.filter(id=cat_unconf.id).exists() is True

    # Confirmed POST
    req_conf = setup_request(superuser, post_data={'confirmed': 'yes'})
    safe_delete_or_archive_categories(
        category_admin,
        req_conf,
        Category.all_objects.filter(id=cat_unconf.id)
    )
    assert Category.all_objects.filter(id=cat_unconf.id).exists() is False
    print("PASS: Admin action confirmation flow works accurately.")

    # -------------------------------------------------------------------------
    # TEST 9: Atomic rollback on failure
    # -------------------------------------------------------------------------
    print("\n--- TEST 9: Atomic rollback on unexpected failure ---")
    cat_fail = Category.objects.create(
        name=f"Fail Cat {unique_run}",
        slug=f"fail-cat-{unique_run}"
    )
    with patch.object(Category, 'hard_delete', side_effect=RuntimeError("Simulated Storage Failure")):
        results_err = CategoryCleanupService.execute_cleanup(
            Category.all_objects.filter(id=cat_fail.id),
            user=superuser
        )
        assert len(results_err['errors']) == 1
        assert Category.all_objects.filter(id=cat_fail.id).exists() is True
    print("PASS: Atomic rollback guarantees zero partial corruption on failure.")

    print("\n>>> ALL CATEGORY CLEANUP TESTS PASSED SUCCESSFULLY! <<<\n")


if __name__ == '__main__':
    run_tests()
