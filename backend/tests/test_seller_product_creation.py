import os
import sys
import json
import pytest
from decimal import Decimal

# Ensure backend is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

import django
django.setup()

from django.test import Client
from apps.accounts.models import User, UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.catalogue.models import Product, ProductVariant, ProductImage, Category
from apps.inventory.models import InventoryItem
from apps.stores.models import Store
from apps.warehouse.models import Warehouse


def test_seller_product_creation_flow():
    client = Client()

    # 1. Ensure test vendor exists
    vendor_user, _ = User.objects.get_or_create(
        email='seller_test_unit@oyopasal.com',
        defaults={
            'first_name': 'Test',
            'last_name': 'Seller Unit',
            'role': UserRole.VENDOR_OWNER,
            'is_active': True
        }
    )
    vendor, _ = VendorProfile.objects.get_or_create(
        user=vendor_user,
        defaults={
            'business_name': 'Himalayan Organic Honey Store',
            'slug': 'himalayan-organic-honey-store',
            'status': VendorStatus.APPROVED
        }
    )
    category = Category.objects.first()
    assert category is not None, "At least one category must exist"

    # -------------------------------------------------------------
    # TEST 1: Valid seller product creation with custom unit '5kg'
    # -------------------------------------------------------------
    payload = {
        'vendor_id': str(vendor.id),
        'name': 'Himalayan Wild Honey 5KG Batch',
        'category_slug': category.slug,
        'unit': '5kg',
        'original_price': 4500,
        'discounted_price': 3999,
        'stock': 40,
        'is_organic': True,
        'description': '100% Raw Wild Forest Honey harvested sustainably in Jumla.',
        'image_url': '/uploads/honey_5.webp',
        'gallery_urls': ['https://images.unsplash.com/photo-1587049352847-4a222e784d38?w=500'],
        'sections': ['fresh_arrivals', 'top_deals']
    }

    res = client.post(
        '/api/v1/seller/products/',
        data=json.dumps(payload),
        content_type='application/json'
    )

    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.content}"
    data = res.json()
    assert data['success'] is True
    prod_data = data['product']
    assert prod_data['unit'] == '5kg', f"Expected unit '5kg', got {prod_data.get('unit')}"
    assert prod_data['is_organic'] is True
    assert prod_data['discounted_price'] == 3999.0
    assert prod_data['original_price'] == 4500.0
    assert 'fresh_arrivals' in prod_data['sections']
    assert prod_data['image_url'] == '/uploads/honey_5.webp'

    # Verify directly in MySQL Database
    prod_id = prod_data['id']
    prod = Product.objects.get(id=prod_id)
    assert prod.unit == '5kg'
    assert prod.is_organic is True
    assert prod.name == 'Himalayan Wild Honey 5KG Batch'

    # Verify Variant
    variant = prod.variants.first()
    assert variant is not None
    assert variant.attributes.get('unit') == '5kg'
    assert variant.selling_price == Decimal('3999.00')

    # Verify Inventory
    inv = InventoryItem.objects.filter(variant=variant).first()
    assert inv is not None
    assert inv.quantity_on_hand == 40

    # Verify Images (both primary and gallery)
    images = list(prod.images.all())
    assert len(images) == 2
    primary_img = prod.images.filter(is_primary=True).first()
    assert primary_img.image_url == '/uploads/honey_5.webp'
    print("PASS: Test 1 - Seller product created with unit '5kg', stock, organic status, and images.")

    # -------------------------------------------------------------
    # TEST 2: Rejection of corrupted image_url (e.g. debugging prompt)
    # -------------------------------------------------------------
    corrupted_prompt = """Investigate and fix the seller product creation failure in OyoPasal.
The POST request to `/api/v1/seller/products/` is returning a 500 Internal Server Error.
The exception originates in `backend/apps/vendors/seller_views.py`."""

    bad_payload = payload.copy()
    bad_payload['name'] = 'Corrupted Image Product'
    bad_payload['image_url'] = corrupted_prompt

    res_corrupt = client.post(
        '/api/v1/seller/products/',
        data=json.dumps(bad_payload),
        content_type='application/json'
    )
    assert res_corrupt.status_code == 400, f"Expected 400, got {res_corrupt.status_code}: {res_corrupt.content}"
    err_json = res_corrupt.json()
    assert err_json['success'] is False
    assert err_json['error']['code'] == 'INVALID_IMAGE_URL'
    print("PASS: Test 2 - Corrupted image prompt successfully rejected with HTTP 400 INVALID_IMAGE_URL.")

    # -------------------------------------------------------------
    # TEST 3: Validation of invalid fields (empty name, negative price, negative stock)
    # -------------------------------------------------------------
    bad_name_payload = payload.copy()
    bad_name_payload['name'] = '   '
    res_bad_name = client.post('/api/v1/seller/products/', data=json.dumps(bad_name_payload), content_type='application/json')
    assert res_bad_name.status_code == 400
    assert res_bad_name.json()['error']['code'] == 'INVALID_NAME'

    bad_price_payload = payload.copy()
    bad_price_payload['discounted_price'] = -50
    res_bad_price = client.post('/api/v1/seller/products/', data=json.dumps(bad_price_payload), content_type='application/json')
    assert res_bad_price.status_code == 400
    assert res_bad_price.json()['error']['code'] == 'INVALID_PRICE'

    bad_stock_payload = payload.copy()
    bad_stock_payload['stock'] = -10
    res_bad_stock = client.post('/api/v1/seller/products/', data=json.dumps(bad_stock_payload), content_type='application/json')
    assert res_bad_stock.status_code == 400
    assert res_bad_stock.json()['error']['code'] == 'INVALID_STOCK'
    print("PASS: Test 3 - Invalid name, negative prices, and negative stock return HTTP 400.")

    # -------------------------------------------------------------
    # TEST 4: Vendor spoofing protection
    # -------------------------------------------------------------
    # Authenticate as vendor_user
    client.force_login(vendor_user)

    # Create another vendor
    other_user, _ = User.objects.get_or_create(
        email='other_vendor@oyopasal.com',
        defaults={'first_name': 'Other', 'last_name': 'Vendor', 'role': UserRole.VENDOR_OWNER}
    )
    other_vendor, _ = VendorProfile.objects.get_or_create(
        user=other_user,
        defaults={'business_name': 'Other Store', 'slug': 'other-store'}
    )

    # Attempt to create product pretending to be other_vendor
    spoof_payload = payload.copy()
    spoof_payload['vendor_id'] = str(other_vendor.id)
    spoof_payload['name'] = 'Spoofed Product'

    res_spoof = client.post(
        '/api/v1/seller/products/',
        data=json.dumps(spoof_payload),
        content_type='application/json'
    )
    assert res_spoof.status_code == 403, f"Expected 403 for vendor spoofing, got {res_spoof.status_code}"
    print("PASS: Test 4 - Vendor ID spoofing rejected with HTTP 403 Forbidden.")

    # -------------------------------------------------------------
    # TEST 5: Update product unit and stock via PUT
    # -------------------------------------------------------------
    update_payload = {
        'unit': '10kg',
        'discounted_price': 7500,
        'stock': 15,
        'is_organic': True
    }
    res_update = client.put(
        f'/api/v1/seller/products/{prod_id}/',
        data=json.dumps(update_payload),
        content_type='application/json'
    )
    assert res_update.status_code == 200, f"Expected 200, got {res_update.status_code}"
    prod.refresh_from_db()
    assert prod.unit == '10kg'
    inv.refresh_from_db()
    assert inv.quantity_on_hand == 15
    print("PASS: Test 5 - Product unit and live inventory updated via PUT.")

    print("\nALL SELLER PRODUCT CREATION TESTS PASSED SUCCESSFULLY!")


if __name__ == '__main__':
    test_seller_product_creation_flow()
