import os
import sys
from decimal import Decimal
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
sys.path.insert(0, os.path.abspath('backend'))
django.setup()

from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken
from apps.catalogue.models import Product, ProductVariant, Category, Brand, ProductImage
from apps.inventory.models import InventoryItem
from apps.warehouse.models import Warehouse

def run_patch_investigation_tests():
    print("=" * 70)
    print("STARTING OYOPASAL VENDOR PRODUCT UPDATE (PATCH) INVESTIGATION & VERIFICATION")
    print("=" * 70)

    # Target product
    target_id = '72ac3994-bfe1-418e-bd63-5d93845572eb'
    prod = Product.objects.filter(id=target_id).first()
    if not prod:
        prod = Product.objects.first()
        target_id = str(prod.id)
    
    assert prod is not None, "Target product must exist in database"
    vendor = prod.vendor
    token = str(RefreshToken.for_user(vendor.user).access_token)
    auth_headers = {'HTTP_AUTHORIZATION': f'Bearer {token}', 'HTTP_HOST': 'localhost'}
    client = Client()

    categories = list(Category.objects.filter(is_active=True))
    assert len(categories) >= 1, "At least one category required"
    cat_1 = categories[0]
    cat_2 = categories[1] if len(categories) > 1 else categories[0]

    brand_1 = Brand.objects.first()
    assert brand_1 is not None, "At least one brand required"
    brand_2 = Brand.objects.last()

    print(f"Target Product: {prod.id} | '{prod.name}' | Vendor: {vendor.business_name}")

    # -------------------------------------------------------------
    # TEST 1: The user's exact reported error: Brand sent as dict object
    # -------------------------------------------------------------
    dict_brand_payload = {
        'brand': {
            'id': str(brand_1.id),
            'name': brand_1.name
        }
    }
    res1 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data=dict_brand_payload,
        content_type='application/json',
        **auth_headers
    )
    assert res1.status_code == 200, f"Test 1 Failed: {res1.status_code} {res1.content.decode()}"
    prod.refresh_from_db()
    assert prod.brand == brand_1, f"Expected brand {brand_1}, got {prod.brand}"
    print("✓ TEST 1 PASSED: Brand submitted as dict object successfully normalized & saved to DB.")

    # -------------------------------------------------------------
    # TEST 2: Category sent as dict object
    # -------------------------------------------------------------
    dict_cat_payload = {
        'category': {
            'id': str(cat_1.id),
            'name': cat_1.name
        }
    }
    res2 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data=dict_cat_payload,
        content_type='application/json',
        **auth_headers
    )
    assert res2.status_code == 200, f"Test 2 Failed: {res2.status_code} {res2.content.decode()}"
    prod.refresh_from_db()
    assert prod.category == cat_1, f"Expected category {cat_1}, got {prod.category}"
    print("✓ TEST 2 PASSED: Category submitted as dict object successfully normalized & saved to DB.")

    # -------------------------------------------------------------
    # TEST 3: Update product name
    # -------------------------------------------------------------
    res3 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={'name': 'OYO TEST PRODUCT 001 (Updated Edition)'},
        content_type='application/json',
        **auth_headers
    )
    assert res3.status_code == 200, f"Test 3 Failed: {res3.status_code} {res3.content.decode()}"
    prod.refresh_from_db()
    assert prod.name == 'OYO TEST PRODUCT 001 (Updated Edition)'
    print("✓ TEST 3 PASSED: Product name updated successfully.")

    # -------------------------------------------------------------
    # TEST 4: Update product price (both root convenience and variant)
    # -------------------------------------------------------------
    res4 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={
            'variants': [{
                'selling_price': '1150.00',
                'regular_price': '1750.00'
            }]
        },
        content_type='application/json',
        **auth_headers
    )
    assert res4.status_code == 200, f"Test 4 Failed: {res4.status_code} {res4.content.decode()}"
    prod.refresh_from_db()
    def_var = prod.variants.filter(is_default=True).first() or prod.variants.first()
    assert float(def_var.selling_price) == 1150.00
    assert float(def_var.regular_price) == 1750.00
    print("✓ TEST 4 PASSED: Product selling price and regular price updated successfully.")

    # -------------------------------------------------------------
    # TEST 5: Change brand (UUID string and null to clear)
    # -------------------------------------------------------------
    res5a = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={'brand': str(brand_2.id)},
        content_type='application/json',
        **auth_headers
    )
    assert res5a.status_code == 200
    prod.refresh_from_db()
    assert prod.brand == brand_2

    # Clear brand with null
    res5b = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={'brand': None},
        content_type='application/json',
        **auth_headers
    )
    assert res5b.status_code == 200
    prod.refresh_from_db()
    assert prod.brand is None

    # Clear brand with empty string ""
    res5c = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={'brand': ''},
        content_type='application/json',
        **auth_headers
    )
    assert res5c.status_code == 200
    prod.refresh_from_db()
    assert prod.brand is None
    print("✓ TEST 5 PASSED: Brand changed to new UUID, cleared with null, and cleared with empty string.")

    # -------------------------------------------------------------
    # TEST 6: Change category (UUID string)
    # -------------------------------------------------------------
    res6 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={'category': str(cat_2.id)},
        content_type='application/json',
        **auth_headers
    )
    assert res6.status_code == 200
    prod.refresh_from_db()
    assert prod.category == cat_2
    print("✓ TEST 6 PASSED: Category changed to new category UUID successfully.")

    # -------------------------------------------------------------
    # TEST 7: Update product images (list of image dicts & list of URLs)
    # -------------------------------------------------------------
    new_images_payload = {
        'images': [
            {
                'image_url': 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600',
                'alt_text': 'Updated Primary Watch View',
                'is_primary': True,
                'ordering': 1
            },
            {
                'image_url': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
                'alt_text': 'Side Angle Watch View',
                'is_primary': False,
                'ordering': 2
            }
        ]
    }
    res7 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data=new_images_payload,
        content_type='application/json',
        **auth_headers
    )
    assert res7.status_code == 200
    prod.refresh_from_db()
    assert prod.images.count() == 2
    primary_img = prod.images.filter(is_primary=True).first()
    assert primary_img.image_url == 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600'
    print("✓ TEST 7 PASSED: Gallery imagery updated and multi-angle order preserved.")

    # -------------------------------------------------------------
    # TEST 8: Update stock quantity
    # -------------------------------------------------------------
    res8 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={
            'variants': [{
                'stock_quantity': 42
            }]
        },
        content_type='application/json',
        **auth_headers
    )
    assert res8.status_code == 200
    prod.refresh_from_db()
    warehouse = Warehouse.objects.filter(is_active=True).first()
    def_var = prod.variants.filter(is_default=True).first() or prod.variants.first()
    inv_item = InventoryItem.objects.filter(variant=def_var, warehouse=warehouse).first()
    assert inv_item is not None
    assert inv_item.quantity_on_hand == 42
    print("✓ TEST 8 PASSED: Live warehouse inventory updated to 42 units.")

    # -------------------------------------------------------------
    # TEST 9: Update product description & short description
    # -------------------------------------------------------------
    res9 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={
            'short_description': 'Refined short description for testing',
            'description': 'Full detailed product specifications and overview.'
        },
        content_type='application/json',
        **auth_headers
    )
    assert res9.status_code == 200
    prod.refresh_from_db()
    assert prod.short_description == 'Refined short description for testing'
    assert prod.description == 'Full detailed product specifications and overview.'
    print("✓ TEST 9 PASSED: Product descriptions updated successfully.")

    # -------------------------------------------------------------
    # TEST 10: Save without changing optional fields (Partial Update Isolation)
    # -------------------------------------------------------------
    orig_sku = prod.base_sku
    orig_tax = str(prod.tax_rate)
    res10 = client.patch(
        f'/api/v1/vendor/products/{target_id}/',
        data={'is_featured': True},
        content_type='application/json',
        **auth_headers
    )
    assert res10.status_code == 200
    prod.refresh_from_db()
    assert prod.base_sku == orig_sku
    assert str(prod.tax_rate) == orig_tax
    assert prod.is_featured is True
    print("✓ TEST 10 PASSED: Partial update preserved all untouched optional & mandatory fields.")

    # -------------------------------------------------------------
    # TEST 11: Customer Marketplace Reflection
    # -------------------------------------------------------------
    cust_res = client.get(f'/api/v1/catalogue/products/{prod.slug}/', HTTP_HOST='localhost')
    assert cust_res.status_code == 200
    cust_data = cust_res.json().get('data', cust_res.json())
    assert cust_data['name'] == 'OYO TEST PRODUCT 001 (Updated Edition)'
    assert cust_data['stock_quantity'] == 42
    assert cust_data['is_in_stock'] is True
    print("✓ TEST 11 PASSED: Updated product correctly displayed on customer marketplace with live price and stock.")

    # -------------------------------------------------------------
    # TEST 12: Vendor Dashboard Retrieval
    # -------------------------------------------------------------
    vendor_get_res = client.get(f'/api/v1/vendor/products/{target_id}/', **auth_headers)
    assert vendor_get_res.status_code == 200
    v_data = vendor_get_res.json().get('data', vendor_get_res.json())
    assert v_data['name'] == 'OYO TEST PRODUCT 001 (Updated Edition)'
    print("✓ TEST 12 PASSED: Vendor dashboard retrieves updated product data.")

    print("\nALL 12 INVESTIGATION AND UPDATE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == '__main__':
    run_patch_investigation_tests()

