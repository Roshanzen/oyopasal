from unittest.mock import patch
import base64
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Product, Category, ProductVariant, ProductStatus
from apps.promotions.models import HeroBanner

User = get_user_model()

# Valid minimal JPEG (1x1 pixel)
VALID_JPEG_BYTES = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9'


class AuthenticationSecurityTests(APITestCase):
    def setUp(self):
        self.password = 'SecureP@ssw0rd123!'
        self.customer = User.objects.create_user(
            email='customer@example.com',
            phone_number='9800000001',
            password=self.password,
            role='CUSTOMER'
        )
        self.admin = User.objects.create_user(
            email='admin@example.com',
            phone_number='9800000002',
            password=self.password,
            role='SUPER_ADMIN',
            is_staff=True,
            is_superuser=True
        )

    def test_valid_login_succeeds(self):
        resp = self.client.post('/api/v1/auth/login/', {
            'phone_number': '9800000001',
            'password': self.password
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

    def test_wrong_password_rejected(self):
        resp = self.client.post('/api/v1/auth/login/', {
            'phone_number': '9800000001',
            'password': 'WrongPassword999!'
        })
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', resp.data)

    def test_missing_password_rejected(self):
        resp = self.client.post('/api/v1/auth/login/', {
            'phone_number': '9800000001'
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn('access', resp.data)

    def test_demo_quick_login_bypass_rejected(self):
        # Adding demo_quick_login: True without a valid password must fail
        resp = self.client.post('/api/v1/auth/login/', {
            'phone_number': '9800000001',
            'demo_quick_login': True
        })
        self.assertIn(resp.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED])
        self.assertNotIn('access', resp.data)

    def test_admin_cannot_bypass_password(self):
        resp = self.client.post('/api/v1/auth/login/', {
            'phone_number': '9800000002',
            'demo_quick_login': True
        })
        self.assertIn(resp.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED])
        self.assertNotIn('access', resp.data)


class FirebaseAuthenticationSecurityTests(APITestCase):
    def test_firebase_unconfigured_fails_safely(self):
        with patch('apps.accounts.views._get_or_init_firebase_app', return_value=None):
            resp = self.client.post('/api/v1/auth/firebase/', {'id_token': 'dummy.token'})
            self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertEqual(resp.data.get('error', {}).get('code'), 'FIREBASE_UNAVAILABLE')

    def test_firebase_invalid_token_rejected(self):
        from unittest.mock import MagicMock
        with patch('apps.accounts.views._get_or_init_firebase_app', return_value=MagicMock()), \
             patch('firebase_admin.auth.verify_id_token', side_effect=Exception("Invalid signature")):
            resp = self.client.post('/api/v1/auth/firebase/', {'id_token': 'forged.token'})
            self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
            self.assertEqual(resp.data.get('error', {}).get('code'), 'INVALID_FIREBASE_TOKEN')

    def test_firebase_verified_token_derives_identity(self):
        from unittest.mock import MagicMock
        mock_claims = {
            'uid': 'firebase_uid_12345',
            'email': 'verified_firebase@example.com',
            'name': 'Verified Firebase User',
            'phone_number': '+9779812345678'
        }
        with patch('apps.accounts.views._get_or_init_firebase_app', return_value=MagicMock()), \
             patch('firebase_admin.auth.verify_id_token', return_value=mock_claims):
            resp = self.client.post('/api/v1/auth/firebase/', {
                'id_token': 'valid.signed.token',
                # Attacker tries to inject a different email/phone in request payload:
                'email': 'spoofed_email@example.com',
                'phone_number': '9999999999'
            })
            self.assertEqual(resp.status_code, status.HTTP_200_OK)
            self.assertIn('access', resp.data)
            # User must have the email derived from verified claims, not the spoofed payload
            created_user = User.objects.get(email='verified_firebase@example.com')
            self.assertEqual(created_user.email, 'verified_firebase@example.com')
            self.assertEqual(created_user.first_name, 'Verified Firebase User')


class SellerApiSecurityTests(APITestCase):
    def setUp(self):
        self.password = 'VendorPass123!'
        # Customer
        self.customer = User.objects.create_user(
            email='cust@example.com',
            phone_number='9811111111',
            password=self.password,
            role='CUSTOMER'
        )

        # Vendor A
        self.vendor_user_a = User.objects.create_user(
            email='vendor_a@example.com',
            phone_number='9811111112',
            password=self.password,
            role='VENDOR_OWNER'
        )
        self.vendor_a = VendorProfile.objects.create(
            user=self.vendor_user_a,
            business_name='Store A',
            slug='store-a',
            status=VendorStatus.APPROVED
        )

        # Vendor B
        self.vendor_user_b = User.objects.create_user(
            email='vendor_b@example.com',
            phone_number='9811111113',
            password=self.password,
            role='VENDOR_OWNER'
        )
        self.vendor_b = VendorProfile.objects.create(
            user=self.vendor_user_b,
            business_name='Store B',
            slug='store-b',
            status=VendorStatus.APPROVED
        )

        # Stores
        self.store_a = Store.objects.create(vendor=self.vendor_a, name='Store A', slug='store-a')
        self.store_b = Store.objects.create(vendor=self.vendor_b, name='Store B', slug='store-b')

        # Category and Products
        self.category = Category.objects.create(name='Test Category', slug='test-category')
        self.product_b = Product.objects.create(
            vendor=self.vendor_b,
            store=self.store_b,
            category=self.category,
            name="Vendor B Product",
            slug="vendor-b-product",
            base_sku="SKU-B",
            status=ProductStatus.APPROVED
        )
        self.variant_b = ProductVariant.objects.create(
            product=self.product_b,
            sku="SKU-B-VAR",
            selling_price=100,
            regular_price=100,
            attributes={"name": "Standard"}
        )

    def test_anonymous_access_rejected(self):
        resp = self.client.get('/api/v1/vendors/seller/products/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        resp2 = self.client.get('/api/v1/vendors/seller/orders/')
        self.assertEqual(resp2.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_cannot_access_seller_endpoints(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.get('/api/v1/vendors/seller/products/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_vendor_access_prevented(self):
        # Vendor A authenticates, attempts to view / edit / delete Vendor B's product
        self.client.force_authenticate(user=self.vendor_user_a)

        # GET Vendor B product
        resp_get = self.client.get(f'/api/v1/vendors/seller/products/{self.product_b.id}/')
        self.assertEqual(resp_get.status_code, status.HTTP_403_FORBIDDEN)

        # PUT Vendor B product
        resp_put = self.client.put(f'/api/v1/vendors/seller/products/{self.product_b.id}/', {
            'name': 'Hacked by Vendor A'
        })
        self.assertEqual(resp_put.status_code, status.HTTP_403_FORBIDDEN)

        # DELETE Vendor B product
        resp_del = self.client.delete(f'/api/v1/vendors/seller/products/{self.product_b.id}/')
        self.assertEqual(resp_del.status_code, status.HTTP_403_FORBIDDEN)

        # Toggle stock on Vendor B product
        resp_stock = self.client.patch(f'/api/v1/vendors/seller/products/{self.product_b.id}/toggle-stock/')
        self.assertEqual(resp_stock.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_can_access_own_resources(self):
        self.client.force_authenticate(user=self.vendor_user_a)
        resp = self.client.get('/api/v1/vendors/seller/products/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class AdminCmsSecurityTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='cust_cms@example.com',
            phone_number='9822222221',
            password='Password123!',
            role='CUSTOMER'
        )
        self.superadmin = User.objects.create_user(
            email='super_cms@example.com',
            phone_number='9822222222',
            password='Password123!',
            role='SUPER_ADMIN',
            is_staff=True,
            is_superuser=True
        )

    def test_anonymous_access_admin_banners_rejected(self):
        resp = self.client.get('/api/admin/hero-banners/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_cannot_access_admin_banners(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.get('/api/admin/hero-banners/')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_can_access_admin_banners(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get('/api/admin/hero-banners/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_public_hero_banners_accessible(self):
        # Public endpoint must remain accessible without auth
        resp = self.client.get('/api/hero-banners/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class MediaUploadSecurityTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='cust_media@example.com',
            phone_number='9833333331',
            password='Password123!',
            role='CUSTOMER'
        )
        self.vendor_user = User.objects.create_user(
            email='vendor_media@example.com',
            phone_number='9833333332',
            password='Password123!',
            role='VENDOR_OWNER'
        )

    def test_anonymous_upload_rejected(self):
        resp = self.client.post('/api/media/upload/', {'base64': base64.b64encode(VALID_JPEG_BYTES).decode()})
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_upload_rejected(self):
        self.client.force_authenticate(user=self.customer)
        resp = self.client.post('/api/media/upload/', {'base64': base64.b64encode(VALID_JPEG_BYTES).decode()})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_valid_upload_succeeds(self):
        self.client.force_authenticate(user=self.vendor_user)
        b64_img = base64.b64encode(VALID_JPEG_BYTES).decode()
        resp = self.client.post('/api/media/upload/', {
            'base64': b64_img,
            'filename': 'test_upload.jpg'
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn('asset', resp.data)
        self.assertTrue(resp.data['asset']['url'].startswith('/uploads/'))

    def test_invalid_file_type_rejected(self):
        self.client.force_authenticate(user=self.vendor_user)
        # Uploading fake text pretending to be image
        fake_bytes = b'echo "malicious payload"'
        b64_fake = base64.b64encode(fake_bytes).decode()
        resp = self.client.post('/api/media/upload/', {
            'base64': b64_fake,
            'filename': 'exploit.jpg'
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get('error', {}).get('code'), 'UNSUPPORTED_FILE_TYPE')
