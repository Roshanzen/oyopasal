import uuid
from rest_framework.test import APITestCase
from apps.accounts.models import User, UserRole
from apps.vendors.models import (
    VendorProfile,
    VendorStatus,
    SellerApplication,
    SellerApplicationStatus,
    VendorInvitation,
)
from apps.vendors.application_services import (
    create_seller_application,
    admin_approve_and_invite,
    activate_vendor_account,
)
from apps.stores.models import Store


class TestCustomerVendorLoginExperience(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            email=f"admin_{uuid.uuid4().hex[:6]}@oyopasal.np",
            password="AdminPassword123!",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True
        )
        self.customer_email = f"customer_{uuid.uuid4().hex[:6]}@example.com"
        self.customer_password = "CustomerSecret123!"
        self.customer_user = User.objects.create_user(
            email=self.customer_email,
            password=self.customer_password,
            first_name="Ritesh",
            last_name="Yadav",
            role=UserRole.CUSTOMER
        )

    def test_01_customer_only_login_rejected_with_customer_account_only(self):
        """1. Customer-only account attempting Vendor Login receives HTTP 403 CUSTOMER_ACCOUNT_ONLY."""
        res = self.client.post('/api/v1/auth/login-vendor/', {
            'email': self.customer_email,
            'password': self.customer_password
        }, format='json')

        self.assertEqual(res.status_code, 403)
        data = res.json()
        self.assertFalse(data.get('success', True))
        self.assertEqual(data.get('error', {}).get('code'), 'CUSTOMER_ACCOUNT_ONLY')
        self.assertIn("registered as a Customer only", data.get('detail', ''))
        self.assertEqual(data.get('error', {}).get('action'), 'APPLY_SELLER')

    def test_02_existing_customer_submits_seller_application_without_duplicate(self):
        """2. Existing customer can apply to become a seller; no duplicate user is created, permissions untouched."""
        app_data = {
            'full_name': 'Ritesh Yadav',
            'email': self.customer_email,
            'phone': '+977 9841223344',
            'business_name': f"Ritesh Grocery Mart {uuid.uuid4().hex[:4]}",
            'business_category': 'Grocery & Daily Staples',
            'business_description': 'Fresh produce and groceries.',
            'province': 'Bagmati Province',
            'district': 'Kathmandu',
            'municipality': 'Kathmandu Metropolitan',
            'complete_address': 'Koteshwor 32, Kathmandu',
            'declaration_confirmed': True
        }

        # Submit application
        res = self.client.post('/api/v1/seller/applications/apply/', app_data, format='json')
        self.assertEqual(res.status_code, 201)
        res_data = res.json()
        self.assertTrue(res_data['success'])
        app_num = res_data['application_number']

        # Verify only 1 User exists with this email (no duplicate accounts created)
        user_count = User.objects.filter(email__iexact=self.customer_email).count()
        self.assertEqual(user_count, 1)

        # Verify user role is still CUSTOMER and no vendor profile yet
        refreshed_user = User.objects.get(email__iexact=self.customer_email)
        self.assertEqual(refreshed_user.role, UserRole.CUSTOMER)
        self.assertFalse(hasattr(refreshed_user, 'vendor_profile'))

        # Verify application is linked to applicant_user
        app = SellerApplication.objects.get(application_number=app_num)
        self.assertEqual(app.applicant_user, self.customer_user)
        self.assertEqual(app.status, SellerApplicationStatus.PENDING)

    def test_03_customer_with_pending_application_vendor_login_and_duplicate_prevention(self):
        """3. Customer with PENDING application gets APPLICATION_PENDING_REVIEW on vendor login; duplicate applications blocked."""
        app = create_seller_application({
            'full_name': 'Ritesh Yadav',
            'email': self.customer_email,
            'phone': '+977 9841223344',
            'business_name': f"Pending Mart {uuid.uuid4().hex[:4]}",
            'business_category': 'General Retail',
            'complete_address': 'Baneshwor, Kathmandu',
            'declaration_confirmed': True
        }, applicant_user=self.customer_user)

        # Attempting vendor login informs user of pending review
        res = self.client.post('/api/v1/auth/login-vendor/', {
            'email': self.customer_email,
            'password': self.customer_password
        }, format='json')

        self.assertEqual(res.status_code, 403)
        data = res.json()
        self.assertEqual(data.get('error', {}).get('code'), 'APPLICATION_PENDING_REVIEW')
        self.assertEqual(data.get('error', {}).get('application_number'), app.application_number)
        self.assertEqual(data.get('error', {}).get('action'), 'TRACK_APPLICATION')

        # Attempting duplicate application submission with same email is blocked
        res_dup = self.client.post('/api/v1/seller/applications/apply/', {
            'full_name': 'Ritesh Yadav',
            'email': self.customer_email,
            'phone': '+977 9841223344',
            'business_name': f"Second Mart {uuid.uuid4().hex[:4]}",
            'complete_address': 'Baneshwor, Kathmandu',
            'declaration_confirmed': True
        }, format='json')

        self.assertEqual(res_dup.status_code, 400)
        dup_data = res_dup.json()
        self.assertIn('already submitted', str(dup_data).lower())

    def test_04_approved_but_inactive_application_shows_awaiting_activation(self):
        """4. Admin approved application awaiting password activation returns ACCOUNT_AWAITING_ACTIVATION."""
        app = create_seller_application({
            'full_name': 'Ritesh Yadav',
            'email': self.customer_email,
            'phone': '+977 9841223344',
            'business_name': f"Approved Mart {uuid.uuid4().hex[:4]}",
            'business_category': 'Grocery & Staples',
            'complete_address': 'Thamel, Kathmandu',
            'declaration_confirmed': True
        }, applicant_user=self.customer_user)

        # Admin approves and sends invitation
        invite_res = admin_approve_and_invite(app, admin_user=self.admin_user)
        self.assertTrue(invite_res['success'])
        invitation_token = invite_res['invitation_token']

        # Before user consumes invitation, vendor dashboard is not accessible
        res_login = self.client.post('/api/v1/auth/login-vendor/', {
            'email': self.customer_email,
            'password': self.customer_password
        }, format='json')

        self.assertEqual(res_login.status_code, 403)
        data = res_login.json()
        self.assertEqual(data.get('error', {}).get('code'), 'ACCOUNT_AWAITING_ACTIVATION')
        self.assertEqual(data.get('error', {}).get('action'), 'ACTIVATE_ACCOUNT')

    def test_05_activation_and_active_vendor_login_and_customer_login_preservation(self):
        """5. Complete onboarding activation: vendor login succeeds with new password, and normal customer login is preserved."""
        app = create_seller_application({
            'full_name': 'Ritesh Yadav',
            'email': self.customer_email,
            'phone': '+977 9841223344',
            'business_name': f"Activated Store {uuid.uuid4().hex[:4]}",
            'business_category': 'Electronics',
            'complete_address': 'Putalisadak, Kathmandu',
            'declaration_confirmed': True
        }, applicant_user=self.customer_user)

        invite_res = admin_approve_and_invite(app, admin_user=self.admin_user)
        invitation_token = invite_res['invitation_token']

        # Applicant activates merchant account and sets merchant password
        new_vendor_password = "NewMerchantPassword456!"
        activation_res = activate_vendor_account(invitation_token, new_vendor_password)
        self.assertTrue(activation_res['success'])

        # Now Vendor Login succeeds with the new password
        res_vlogin = self.client.post('/api/v1/auth/login-vendor/', {
            'email': self.customer_email,
            'password': new_vendor_password
        }, format='json')

        self.assertEqual(res_vlogin.status_code, 200)
        vdata = res_vlogin.json()
        self.assertIn('access', vdata)
        self.assertIn('vendor', vdata)
        self.assertEqual(vdata['vendor']['status'], 'APPROVED')

        # Customer Login (POST /api/v1/auth/login/) strictly rejects Vendor credentials with HTTP 403 Forbidden
        res_clogin = self.client.post('/api/v1/auth/login/', {
            'email': self.customer_email,
            'password': new_vendor_password
        }, format='json')

        self.assertEqual(res_clogin.status_code, 403)
        cdata = res_clogin.json()
        self.assertEqual(cdata.get('error', {}).get('code'), 'VENDOR_ACCOUNT_PORTAL_MISMATCH')
        self.assertIn('registered as a merchant/vendor', cdata.get('detail', '').lower())
