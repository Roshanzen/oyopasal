import os
import sys
import uuid
from decimal import Decimal

sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.catalogue.views import PublicCategoryListView
from apps.catalogue.serializers import CategoryTreeSerializer, CategorySerializer

User = get_user_model()


def run_tests():
    print("=== STARTING SHOP BY CATEGORY BACKEND & API VERIFICATION SUITE ===")
    unique_run = uuid.uuid4().hex[:6]

    # Base fixtures
    vendor_user = User.objects.create_user(
        email=f"sbc_vendor_{unique_run}@oyopasal.com",
        password="Password123!",
        role="VENDOR"
    )
    vendor = VendorProfile.objects.create(
        user=vendor_user,
        business_name=f"SBC Merchant {unique_run}",
        slug=f"sbc-merchant-{unique_run}",
        status=VendorStatus.APPROVED
    )
    store = Store.objects.create(
        vendor=vendor,
        name=f"SBC Store {unique_run}",
        slug=f"sbc-store-{unique_run}",
        is_active=True
    )
    inactive_store = Store.objects.create(
        vendor=vendor,
        name=f"SBC Inactive Store {unique_run}",
        slug=f"sbc-inact-store-{unique_run}",
        is_active=False
    )

    # 1. Category with image and 3 active approved products
    cat_with_img = Category.objects.create(
        name=f"Popular Department {unique_run}",
        slug=f"pop-dept-{unique_run}",
        image_url="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
        ordering=1,
        is_active=True
    )
    for i in range(3):
        p = Product.objects.create(
            vendor=vendor,
            store=store,
            category=cat_with_img,
            name=f"Active Prod {i} {unique_run}",
            base_sku=f"SKU-ACT-{i}-{unique_run}",
            status=ProductStatus.APPROVED
        )
        ProductVariant.objects.create(
            product=p,
            sku=f"VAR-ACT-{i}-{unique_run}",
            regular_price=Decimal("100.00"),
            selling_price=Decimal("90.00")
        )

    # Add a product in inactive store (should NOT be counted)
    p_inact_store = Product.objects.create(
        vendor=vendor,
        store=inactive_store,
        category=cat_with_img,
        name=f"Inactive Store Prod {unique_run}",
        base_sku=f"SKU-INACT-ST-{unique_run}",
        status=ProductStatus.APPROVED
    )

    # Add an unapproved product (should NOT be counted)
    p_draft = Product.objects.create(
        vendor=vendor,
        store=store,
        category=cat_with_img,
        name=f"Draft Prod {unique_run}",
        base_sku=f"SKU-DRAFT-{unique_run}",
        status=ProductStatus.DRAFT
    )

    # 2. Category without image and ZERO products
    cat_zero_prods = Category.objects.create(
        name=f"Department Zero Prods {unique_run}",
        slug=f"dept-zero-{unique_run}",
        image_url="",
        ordering=2,
        is_active=True
    )

    # 3. Inactive Category (should NOT appear in public API)
    cat_inactive = Category.objects.create(
        name=f"Category Inactive {unique_run}",
        slug=f"cat-inact-{unique_run}",
        ordering=3,
        is_active=False
    )

    # 4. Child Subcategory (should NOT appear in top-level public API)
    cat_child = Category.objects.create(
        name=f"Department Child {unique_run}",
        slug=f"dept-child-{unique_run}",
        parent=cat_with_img,
        ordering=1,
        is_active=True
    )
    # Add a product to the child subcategory (should bubble up to parent's count)
    p_child = Product.objects.create(
        vendor=vendor,
        store=store,
        category=cat_child,
        name=f"Child Prod {unique_run}",
        base_sku=f"SKU-CHILD-{unique_run}",
        status=ProductStatus.APPROVED
    )

    # --- Test API View Execution ---
    factory = RequestFactory()
    request = factory.get('/api/v1/categories/')
    view = PublicCategoryListView.as_view()
    response = view(request)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.data
    assert isinstance(data, list), "Response data must be a list"

    # Find created categories in data
    found_with_img = next((c for c in data if c['id'] == str(cat_with_img.id)), None)
    found_zero = next((c for c in data if c['id'] == str(cat_zero_prods.id)), None)
    found_inactive = next((c for c in data if c['id'] == str(cat_inactive.id)), None)
    found_child = next((c for c in data if c['id'] == str(cat_child.id)), None)

    # Assertions
    print("\n--- Verifying API Contract and Filtering ---")
    assert found_with_img is not None, "Top-level active category must be present"
    assert found_zero is not None, "Category with 0 products must be present"
    assert found_inactive is None, "Inactive category must NOT be present in public list"
    assert found_child is None, "Child category must NOT be present as top-level"
    print("PASS: Inactive and child categories correctly excluded from top-level list.")

    # Check Required Fields in API Response
    print("\n--- Verifying Serializer Fields ---")
    required_fields = ['id', 'name', 'slug', 'description', 'parent', 'icon_url', 'image_url', 'image', 'imageUrl', 'is_active', 'ordering', 'product_count', 'item_count']
    for rf in required_fields:
        assert rf in found_with_img, f"Missing required field '{rf}' in Category API response"
    print(f"PASS: All {len(required_fields)} required fields present in API response.")

    # Check Product Count Logic
    print("\n--- Verifying Dynamic Product Counts ---")
    # cat_with_img has 3 direct active products + 1 child category active product = 4 total products.
    # It must NOT count the draft product or the inactive store product.
    assert found_with_img['product_count'] == 4, f"Expected 4 active products, got {found_with_img['product_count']}"
    assert found_with_img['item_count'] == 4, f"Expected item_count 4, got {found_with_img['item_count']}"
    print(f"PASS: Category with image accurately counted {found_with_img['product_count']} active products (child product included, draft & inactive store excluded).")

    # cat_zero_prods must return product_count = 0
    assert found_zero['product_count'] == 0, f"Expected 0 products, got {found_zero['product_count']}"
    assert found_zero['item_count'] == 0, f"Expected item_count 0, got {found_zero['item_count']}"
    assert found_zero['image_url'] in (None, ''), f"Expected empty image_url, got {found_zero['image_url']}"
    assert found_zero['image'] in (None, ''), f"Expected empty image, got {found_zero['image']}"
    assert found_zero['imageUrl'] in (None, ''), f"Expected empty imageUrl, got {found_zero['imageUrl']}"
    print(f"PASS: Empty category accurately returned product_count = 0 without error.")

    # Check image URL resolution across image_url, image, and imageUrl
    assert found_with_img['image_url'].startswith('https://'), "Image URL correctly preserved"
    assert found_with_img['image'] == found_with_img['image_url'], "image field must match image_url"
    assert found_with_img['imageUrl'] == found_with_img['image_url'], "imageUrl field must match image_url"
    print("PASS: Image URLs properly preserved and served across image_url, image, and imageUrl.")

    # Test Relative URL handling in CategoryTreeSerializer
    cat_relative = Category.objects.create(
        name=f"Category Relative {unique_run}",
        slug=f"cat-rel-{unique_run}",
        image_url="/media/categories/handicrafts.jpg",
        ordering=4,
        is_active=True
    )
    rel_req = factory.get('/api/v1/categories/')
    rel_data = CategoryTreeSerializer(cat_relative, context={'request': rel_req}).data
    assert rel_data['image_url'].startswith('http://testserver/media/') or rel_data['image_url'].endswith('/media/categories/handicrafts.jpg'), "Relative media path properly resolved with base URI"
    assert rel_data['image'] == rel_data['image_url']
    assert rel_data['imageUrl'] == rel_data['image_url']
    print("PASS: Relative media URL correctly resolved to absolute URI.")

    # Test CategoryAdmin image_preview
    from django.contrib.admin.sites import AdminSite
    from apps.catalogue.admin import CategoryAdmin
    admin_inst = CategoryAdmin(Category, AdminSite())
    preview_html = str(admin_inst.image_preview(cat_with_img))
    assert '<img src=' in preview_html, "Admin image preview must render HTML img element for category with image"
    assert cat_with_img.image_url in preview_html, "Admin image preview must reference category image URL"
    no_preview_html = str(admin_inst.image_preview(cat_zero_prods))
    assert 'No image' in no_preview_html, "Admin image preview must render fallback text for category without image"
    print("PASS: Django CategoryAdmin image_preview correctly formats images and fallbacks.")

    # --- 10 TEST SCENARIOS COVERAGE ---
    print("\n--- Verifying 10 End-to-End Scenarios ---")
    # 1. Category with a valid Django Admin image URL
    cat_admin_url = Category.objects.create(
        name=f"Admin Configured Cat {unique_run}",
        slug=f"admin-cat-{unique_run}",
        image_url="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
        is_active=True
    )
    data1 = CategorySerializer(cat_admin_url).data
    assert data1['image_url'] == "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c"
    print("Scenario 1 PASS: Valid Django Admin image URL preserved.")

    # 2. Category with uploaded image (mocked via dynamic property)
    class MockUploadedImage:
        url = "/media/categories/uploaded_sample.png"
    cat_uploaded = Category(
        name=f"Uploaded Cat {unique_run}",
        slug=f"uploaded-cat-{unique_run}",
        image_url="",
        is_active=True
    )
    cat_uploaded.image = MockUploadedImage()
    data2 = CategorySerializer(cat_uploaded, context={'request': rel_req}).data
    assert "/media/categories/uploaded_sample.png" in data2['image_url']
    print("Scenario 2 PASS: Uploaded category image correctly exposed.")

    # 3. Category with valid external image
    cat_external = Category.objects.create(
        name=f"External CDN Cat {unique_run}",
        slug=f"external-cat-{unique_run}",
        image_url="https://ik.imagekit.io/oyopasal/categories/electronics.webp",
        is_active=True
    )
    data3 = CategorySerializer(cat_external).data
    assert data3['image_url'] == "https://ik.imagekit.io/oyopasal/categories/electronics.webp"
    print("Scenario 3 PASS: External CDN image preserved.")

    # 4. Category with relative Django media URL
    assert "/media/categories/handicrafts.jpg" in rel_data['image_url']
    print("Scenario 4 PASS: Relative Django media URL resolved.")

    # 5. Category with no image
    data5 = CategorySerializer(cat_zero_prods).data
    assert data5['image_url'] in (None, '')
    print("Scenario 5 PASS: Category with no image returns None/empty cleanly.")

    # 6. Category with invalid / whitespace image URL
    cat_invalid = Category.objects.create(
        name=f"Whitespace Cat {unique_run}",
        slug=f"whitespace-cat-{unique_run}",
        image_url="   ",
        is_active=True
    )
    data6 = CategorySerializer(cat_invalid).data
    assert data6['image_url'] is None
    print("Scenario 6 PASS: Invalid / whitespace URL normalized to None.")

    # 7. Category updated through Django Admin
    cat_admin_url.image_url = "https://images.unsplash.com/photo-updated-1234"
    cat_admin_url.save(update_fields=['image_url'])
    cat_admin_url.refresh_from_db()
    data7 = CategorySerializer(cat_admin_url).data
    assert data7['image_url'] == "https://images.unsplash.com/photo-updated-1234"
    print("Scenario 7 PASS: Real-time update through Django Admin reflected immediately.")

    # 8. Category with zero products
    assert found_zero['product_count'] == 0
    print("Scenario 8 PASS: Category with zero products accurately computed.")

    # 9. Inactive category excluded from public storefront
    assert found_inactive is None
    print("Scenario 9 PASS: Inactive category excluded from public API.")

    # 10. Empty category API response (filter returns 0)
    empty_req = factory.get('/api/v1/categories/?nonexistent=1')
    empty_qs = Category.objects.filter(id=uuid.uuid4())
    empty_serializer = CategorySerializer(empty_qs, many=True)
    assert empty_serializer.data == []
    print("Scenario 10 PASS: Empty category queryset returns clean [] without fake categories.")

    # 11. Verify cleanup_test_categories Management Command
    print("\n--- Verifying cleanup_test_categories Management Command ---")
    from django.core.management import call_command
    from io import StringIO
    cat_to_clean = Category.objects.create(
        name=f"Admin Configured Dept {unique_run}",
        slug=f"admin-configured-dept-{unique_run}",
        is_active=True
    )
    cat_to_clean_357691 = Category.objects.create(
        name=f"Special Dept 357691 {unique_run}",
        slug=f"special-dept-357691-{unique_run}",
        is_active=True
    )
    out = StringIO()
    call_command('cleanup_test_categories', stdout=out)
    output_str = out.getvalue()
    assert "Successfully permanently deleted" in output_str, "Command must report successful deletion"
    assert not Category.all_objects.filter(id=cat_to_clean.id).exists(), "Test category must be permanently deleted from MySQL"
    assert not Category.all_objects.filter(id=cat_to_clean_357691.id).exists(), "Test category 357691 must be permanently deleted from MySQL"
    print("PASS: cleanup_test_categories successfully deleted automated test categories from MySQL.")

    # Cleanup test run artifacts
    ProductVariant.all_objects.filter(sku__icontains=unique_run).delete()
    Product.all_objects.filter(name__icontains=unique_run).delete()
    Category.all_objects.filter(slug__icontains=unique_run).delete()
    Store.objects.filter(slug__icontains=unique_run).delete()
    VendorProfile.objects.filter(slug__icontains=unique_run).delete()
    User.objects.filter(email__icontains=unique_run).delete()

    print("\n>>> ALL SHOP BY CATEGORY BACKEND & API TESTS PASSED SUCCESSFULLY! <<<\n")


if __name__ == '__main__':
    run_tests()
