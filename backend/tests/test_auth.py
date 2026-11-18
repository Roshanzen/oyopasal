from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.suppliers.models import SupplierProfile, SupplierStatus
from apps.customers.models import CustomerProfile

User = get_user_model()

class AuthenticationAndRBACTests(APITestCase):
    def setUp(self):
        self.register_url = reverse('auth:register')
        self.login_url = reverse('auth:login')
        self.refresh_url = reverse('auth:token_refresh')
        self.logout_url = reverse('auth:logout')
        self.me_url = reverse('auth:me')
        self.health_url = reverse('health_check')

        self.customer_password = 'StrongCustomerPassword123!'
        self.customer_user = User.objects.create_user(
            email='shopper@example.com',
            password=self.customer_password,
            first_name='Aayush',
            last_name='Shrestha',
            role=UserRole.CUSTOMER,
            is_verified=True
        )
        self.customer_profile = CustomerProfile.objects.create(user=self.customer_user)

    def test_health_check_endpoint(self):
        """Verify service health endpoint returns HTTP 200 and component statuses."""
        response = self.client.get(self.health_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['components']['database']['status'], 'healthy')

    def test_register_customer(self):
        """Verify customer registration automatically provisions a CustomerProfile."""
        payload = {
            'email': 'newcustomer@example.com',
            'password': 'SecurePassword123!',
            'confirm_password': 'SecurePassword123!',
            'first_name': 'Sita',
            'last_name': 'Sharma',
            'role': UserRole.CUSTOMER
        }
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        
        user = User.objects.get(email='newcustomer@example.com')
        self.assertEqual(user.role, UserRole.CUSTOMER)
        self.assertTrue(hasattr(user, 'customer_profile'))

    def test_register_vendor(self):
        """Verify vendor owner registration provisions a VendorProfile with PENDING status."""
        payload = {
            'email': 'vendor.owner@himalayanmart.np',
            'password': 'VendorSecurePass123!',
            'confirm_password': 'VendorSecurePass123!',
            'first_name': 'Ram',
            'last_name': 'Bahadur',
            'role': UserRole.VENDOR_OWNER,
            'business_name': 'Himalayan Mart Kathmandu',
            'pan_vat_number': '601234567'
        }
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = User.objects.get(email='vendor.owner@himalayanmart.np')
        self.assertEqual(user.role, UserRole.VENDOR_OWNER)
        self.assertTrue(hasattr(user, 'vendor_profile'))
        self.assertEqual(user.vendor_profile.status, VendorStatus.PENDING)
        self.assertEqual(user.vendor_profile.business_name, 'Himalayan Mart Kathmandu')
        self.assertEqual(user.vendor_profile.slug, 'himalayan-mart-kathmandu')

    def test_register_supplier(self):
        """Verify wholesale supplier owner registration provisions a SupplierProfile."""
        payload = {
            'email': 'wholesaler@nepaldistributors.com',
            'password': 'SupplierSecurePass123!',
            'confirm_password': 'SupplierSecurePass123!',
            'first_name': 'Bikash',
            'last_name': 'Adhikari',
            'role': UserRole.SUPPLIER_OWNER,
            'company_name': 'Nepal Wholesale Distributors Pvt Ltd',
            'pan_vat_number': '300987654'
        }
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='wholesaler@nepaldistributors.com')
        self.assertEqual(user.role, UserRole.SUPPLIER_OWNER)
        self.assertTrue(hasattr(user, 'supplier_profile'))
        self.assertEqual(user.supplier_profile.status, SupplierStatus.PENDING)

    def test_disallow_super_admin_self_registration(self):
        """Ensure malicious users cannot grant themselves SUPER_ADMIN privileges."""
        payload = {
            'email': 'hacker@example.com',
            'password': 'HackerPassword123!',
            'confirm_password': 'HackerPassword123!',
            'role': UserRole.SUPER_ADMIN
        }
        response = self.client.post(self.register_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_login_and_jwt_claims(self):
        """Verify login returns access/refresh tokens along with custom claims."""
        payload = {
            'email': 'shopper@example.com',
            'password': self.customer_password
        }
        response = self.client.post(self.login_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], UserRole.CUSTOMER)
        self.assertEqual(response.data['user']['email'], 'shopper@example.com')

    def test_authenticated_me_endpoint(self):
        """Verify /api/v1/auth/me/ returns profile when authenticated, 401 when anonymous."""
        # Unauthenticated
        anon_response = self.client.get(self.me_url)
        self.assertEqual(anon_response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticated
        self.client.force_authenticate(user=self.customer_user)
        auth_response = self.client.get(self.me_url)
        self.assertEqual(auth_response.status_code, status.HTTP_200_OK)
        self.assertEqual(auth_response.data['data']['email'], self.customer_user.email)
        self.assertEqual(auth_response.data['data']['role'], UserRole.CUSTOMER)

    def test_logout_and_token_revocation(self):
        """Verify refresh token blacklisting on logout."""
        login_res = self.client.post(self.login_url, {
            'email': 'shopper@example.com',
            'password': self.customer_password
        })
        refresh_token = login_res.data['refresh']
        access_token = login_res.data['access']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        logout_res = self.client.post(self.logout_url, {'refresh': refresh_token})
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)
        self.assertTrue(logout_res.data['success'])

        # Attempting to refresh with the blacklisted token must fail
        refresh_attempt = self.client.post(self.refresh_url, {'refresh': refresh_token})
        self.assertEqual(refresh_attempt.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password_workflow(self):
        """Verify authenticated password rotation."""
        self.client.force_authenticate(user=self.customer_user)
        change_url = reverse('auth:password_change')
        
        # Test wrong old password
        res_fail = self.client.post(change_url, {
            'old_password': 'WrongPassword123!',
            'new_password': 'BrandNewPassword999!',
            'confirm_new_password': 'BrandNewPassword999!'
        })
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Test valid change
        res_ok = self.client.post(change_url, {
            'old_password': self.customer_password,
            'new_password': 'BrandNewPassword999!',
            'confirm_new_password': 'BrandNewPassword999!'
        })
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.data['success'])

        # Verify new password is set
        self.customer_user.refresh_from_db()
        self.assertTrue(self.customer_user.check_password('BrandNewPassword999!'))

