import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile
from apps.stores.models import Store
from apps.catalogue.models import Category, Product

User = get_user_model()

def run_tests():
    print("=" * 70)
    print("RUNNING CENTRALIZED CATEGORY MANAGEMENT & SELLER RESTRICTION AUDIT")
    print("=" * 70)

    # Cleanup test artifacts
    Product.all_objects.filter(name__startswith='Centralized Test Prod').delete()
    Category.all_objects.filter(slug__startswith='test-central-').delete()
    User.objects.filter(email__in=[
        'central_super_admin@oyopasal.com',
        'central_ops_admin@oyopasal.com',
        'central_vendor@oyopasal.com',
        'central_customer@oyopasal.com'
    ]).delete()

    try:
        # 1. Create Users
        super_admin = User.objects.create_superuser(
            email='central_super_admin@oyopasal.com',
            password='Password123!',
            first_name='Super',
            last_name='Admin'
        )
        super_admin_token = str(RefreshToken.for_user(super_admin).access_token)

        ops_admin = User.objects.create_user(
            email='central_ops_admin@oyopasal.com',
            password='Password123!',
            role=UserRole.OPERATIONS_ADMIN,
            first_name='Ops',
            last_name='Admin'
        )
        ops_admin_token = str(RefreshToken.for_user(ops_admin).access_token)

        vendor_user = User.objects.create_user(
            email='central_vendor@oyopasal.com',
            password='Password123!',
            role=UserRole.VENDOR_OWNER,
            first_name='Vendor',
            last_name='Seller'
        )
        vendor_profile = VendorProfile.objects.create(
            user=vendor_user,
            business_name='Central Test Vendor Store',
            status='APPROVED'
        )
        vendor_store = Store.objects.create(
            vendor=vendor_profile,
            name='Central Test Vendor Store',
            slug='central-test-vendor-store',
            is_active=True,
            is_verified=True
        )
        vendor_token = str(RefreshToken.for_user(vendor_user).access_token)

        customer = User.objects.create_user(
            email='central_customer@oyopasal.com',
            password='Password123!',
            role=UserRole.CUSTOMER,
            first_name='Customer',
            last_name='Buyer'
        )
        customer_token = str(RefreshToken.for_user(customer).access_token)

        client = APIClient()

        # ------------------------------------------------------------------
        # TEST 1: Super Admin can create categories (POST)
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {super_admin_token}')
        res = client.post('/api/v1/categories/', {
            'name': 'Central Hardware',
            'slug': 'test-central-hardware',
            'is_active': True,
            'ordering': 10
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED, f"Admin create failed: {res.status_code} {res.data}"
        parent_cat_id = res.data['category']['id']
        print("[PASS] Test 1: Super Admin created parent category 'Central Hardware' (201 Created)")

        # ------------------------------------------------------------------
        # TEST 2: Operations Admin can create subcategories (POST)
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {ops_admin_token}')
        res = client.post('/api/v1/categories/', {
            'name': 'Hand Tools',
            'slug': 'test-central-hand-tools',
            'parent_id': parent_cat_id,
            'is_active': True,
            'ordering': 1
        }, format='json')
        assert res.status_code == status.HTTP_201_CREATED, f"Ops Admin subcat create failed: {res.status_code} {res.data}"
        sub_cat_id = res.data['category']['id']
        print("[PASS] Test 2: Operations Admin created subcategory 'Hand Tools' under 'Central Hardware' (201 Created)")

        # ------------------------------------------------------------------
        # TEST 3: Admin can update category (PATCH / PUT)
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {super_admin_token}')
        res = client.patch(f'/api/v1/categories/test-central-hand-tools/', {
            'name': 'Hand & Power Tools'
        }, format='json')
        assert res.status_code == status.HTTP_200_OK, f"Admin update failed: {res.status_code} {res.data}"
        print("[PASS] Test 3: Admin updated category name to 'Hand & Power Tools' (200 OK)")

        # ------------------------------------------------------------------
        # TEST 4: Seller/Vendor CANNOT create categories (POST -> 403 Forbidden)
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {vendor_token}')
        res = client.post('/api/v1/categories/', {
            'name': 'Seller Custom Category',
            'slug': 'test-central-seller-cat',
            'is_active': True
        }, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403 for seller POST, got {res.status_code}: {res.data}"
        print("[PASS] Test 4: Seller POST /api/v1/categories/ strictly denied with 403 Forbidden")

        # ------------------------------------------------------------------
        # TEST 5: Seller/Vendor CANNOT edit, update, or delete categories (403 Forbidden)
        # ------------------------------------------------------------------
        res = client.patch('/api/v1/categories/test-central-hand-tools/', {
            'name': 'Hacked By Seller'
        }, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403 for seller PATCH, got {res.status_code}"

        res = client.delete('/api/v1/categories/test-central-hand-tools/')
        assert res.status_code == status.HTTP_403_FORBIDDEN, f"Expected 403 for seller DELETE, got {res.status_code}"
        print("[PASS] Test 5: Seller PATCH & DELETE /api/v1/categories/<slug>/ strictly denied with 403 Forbidden")

        # ------------------------------------------------------------------
        # TEST 6: Seller can read/list active categories for product selection (GET 200)
        # ------------------------------------------------------------------
        res = client.get('/api/v1/categories/')
        assert res.status_code == status.HTTP_200_OK, f"Seller GET categories failed: {res.status_code}"
        found_parent = any(c['slug'] == 'test-central-hardware' for c in res.data)
        assert found_parent, "Parent category not returned in categories list"
        print("[PASS] Test 6: Seller successfully fetches active categories and subcategories (200 OK)")

        # ------------------------------------------------------------------
        # TEST 7: Customer storefront can read/list categories (GET 200)
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {customer_token}')
        res = client.get('/api/v1/categories/')
        assert res.status_code == status.HTTP_200_OK, f"Customer GET failed: {res.status_code}"
        print("[PASS] Test 7: Customer storefront successfully accesses categories (200 OK)")

        # ------------------------------------------------------------------
        # TEST 8: Seller creates product with valid Admin-created category
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {vendor_token}')
        prod_payload = {
            'name': 'Centralized Test Prod Screwdriver Set',
            'category_slug': 'test-central-hand-tools',
            'unit': '1 Set',
            'original_price': 1500,
            'discounted_price': 1200,
            'stock': 30,
            'image_url': 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5'
        }
        res = client.post('/api/v1/seller/products/', prod_payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED, f"Seller product create failed: {res.status_code} {res.data}"
        assert res.data.get('success') is True
        assert res.data['product']['category']['slug'] == 'test-central-hand-tools'
        print("[PASS] Test 8: Seller created product referencing Admin category 'test-central-hand-tools' (201 Created)")

        # ------------------------------------------------------------------
        # TEST 9: Seller product creation fails with invalid or arbitrary category
        # ------------------------------------------------------------------
        invalid_payload = {
            'name': 'Centralized Test Prod Bogus Category',
            'category_slug': 'completely-arbitrary-fake-category',
            'unit': 'piece',
            'original_price': 500,
            'discounted_price': 400,
            'stock': 10
        }
        res = client.post('/api/v1/seller/products/', invalid_payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST, f"Expected 400 for fake category, got {res.status_code} {res.data}"
        assert res.data['error']['code'] == 'INVALID_CATEGORY'
        print("[PASS] Test 9: Seller product creation with arbitrary category rejected with 400 Bad Request")

        # ------------------------------------------------------------------
        # TEST 10: Seller product creation fails with inactive category
        # ------------------------------------------------------------------
        inact_cat = Category.objects.create(
            name='Inactive Deprecated Category',
            slug='test-central-inactive-cat',
            is_active=False
        )
        inactive_payload = {
            'name': 'Centralized Test Prod Inactive Category',
            'category_slug': inact_cat.slug,
            'unit': 'piece',
            'original_price': 500,
            'discounted_price': 400,
            'stock': 10
        }
        res = client.post('/api/v1/seller/products/', inactive_payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST, f"Expected 400 for inactive category, got {res.status_code} {res.data}"
        assert res.data['error']['code'] == 'INVALID_CATEGORY'
        print("[PASS] Test 10: Seller product creation with inactive category rejected with 400 Bad Request")

        # ------------------------------------------------------------------
        # TEST 11: Admin can delete/deactivate category
        # ------------------------------------------------------------------
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {super_admin_token}')
        res = client.delete(f'/api/v1/categories/{inact_cat.slug}/')
        assert res.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT], f"Admin delete failed: {res.status_code}"
        assert not Category.objects.filter(slug=inact_cat.slug, is_deleted=False).exists()
        print("[PASS] Test 11: Super Admin successfully deleted/soft-deleted category (200/204)")

        print("=" * 70)
        print("ALL 11 CENTRALIZED CATEGORY MANAGEMENT AUDIT ASSERTIONS PASSED!")
        print("=" * 70)

    finally:
        Product.objects.filter(name__startswith='Centralized Test Prod').delete()
        Category.objects.filter(slug__startswith='test-central-').delete()
        User.objects.filter(email__in=[
            'central_super_admin@oyopasal.com',
            'central_ops_admin@oyopasal.com',
            'central_vendor@oyopasal.com',
            'central_customer@oyopasal.com'
        ]).delete()

if __name__ == '__main__':
    run_tests()
