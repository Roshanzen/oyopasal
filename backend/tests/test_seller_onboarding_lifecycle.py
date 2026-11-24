import uuid
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APITestCase
from apps.accounts.models import User, UserRole
from apps.vendors.models import (
    VendorProfile,
    VendorStatus,
    SellerApplication,
    SellerApplicationStatus,
    VendorInvitation,
)
from apps.stores.models import Store


class TestSellerOnboardingLifecycle(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            email=f"admin_test_{uuid.uuid4().hex[:6]}@oyopasal.np",
            password="AdminPassword123!",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True
        )
        self.customer_user = User.objects.create_user(
            email=f"customer_test_{uuid.uuid4().hex[:6]}@example.com",
            password="CustomerPassword123!",
            role=UserRole.CUSTOMER
        )

    def test_01_application_submission_and_validation(self):
        """Test public application submission, missing fields rejection, and duplicate rejection."""
        # 1. Missing fields should fail
        res_fail = self.client.post('/api/v1/seller/applications/apply/', {}, format='json')
        assert res_fail.status_code == 400

        # 2. Valid submission
        test_email = f"applicant_{uuid.uuid4().hex[:6]}@teststore.np"
        payload = {
            'full_name': 'Ram Bahadur Thapa',
            'email': test_email,
            'phone': '+977 9801112233',
            'business_name': f"Thapa Fresh Mart {uuid.uuid4().hex[:4]}",
            'business_category': 'Grocery & Daily Staples',
            'business_description': 'Authentic local organic fruits and daily vegetables.',
            'province': 'Bagmati Province',
            'district': 'Kathmandu',
            'municipality': 'Kathmandu Metropolitan',
            'complete_address': 'New Baneshwor, Ward 10',
            'pan_vat_number': '601999888',
            'declaration_confirmed': True
        }
        res_ok = self.client.post('/api/v1/seller/applications/apply/', payload, format='json')
        assert res_ok.status_code == 201
        data = res_ok.json()
        assert data['success'] is True
        assert data['status'] == 'PENDING'
        app_num = data['application_number']
        assert app_num.startswith('APP-')

        # 3. Duplicate pending application with same email should be rejected
        res_dup = self.client.post('/api/v1/seller/applications/apply/', payload, format='json')
        assert res_dup.status_code == 400

    def test_02_application_tracking(self):
        """Test tracking application by reference number and email."""
        test_email = f"track_{uuid.uuid4().hex[:6]}@teststore.np"
        payload = {
            'full_name': 'Sita Devi Sharma',
            'email': test_email,
            'phone': '+977 9802223344',
            'business_name': f"Sharma Sweets {uuid.uuid4().hex[:4]}",
            'business_category': 'Bakery & Dairy Products',
            'province': 'Bagmati Province',
            'district': 'Lalitpur',
            'municipality': 'Lalitpur Metropolitan',
            'complete_address': 'Patan Dhoka, Ward 2',
            'declaration_confirmed': True
        }
        res_apply = self.client.post('/api/v1/seller/applications/apply/', payload, format='json')
        assert res_apply.status_code == 201
        app_num = res_apply.json()['application_number']

        # Valid tracking
        res_track = self.client.post('/api/v1/seller/applications/track/', {
            'application_number': app_num,
            'email': test_email
        }, format='json')
        assert res_track.status_code == 200
        track_data = res_track.json()['data']
        assert track_data['application_number'] == app_num
        assert track_data['status'] == 'PENDING'

        # Wrong email must be rejected (applicant isolation)
        res_track_wrong = self.client.post('/api/v1/seller/applications/track/', {
            'application_number': app_num,
            'email': 'wrong@attacker.com'
        }, format='json')
        assert res_track_wrong.status_code == 400

    def test_03_admin_review_approval_and_invitation(self):
        """Test admin list, review, and approval issuing single-use invitation token."""
        test_email = f"invite_{uuid.uuid4().hex[:6]}@merchant.np"
        payload = {
            'full_name': 'Krishna Prasad',
            'email': test_email,
            'phone': '+977 9803334455',
            'business_name': f"Himalayan Organic Mart {uuid.uuid4().hex[:4]}",
            'business_category': 'Organic & Local Farm Specialties',
            'province': 'Gandaki Province',
            'district': 'Kaski',
            'municipality': 'Pokhara Metropolitan',
            'complete_address': 'Lakeside, Ward 6',
            'declaration_confirmed': True
        }
        res_apply = self.client.post('/api/v1/seller/applications/apply/', payload, format='json')
        app_num = res_apply.json()['application_number']

        # 1. Non-admin customer cannot access admin endpoints
        self.client.force_authenticate(user=self.customer_user)
        res_unauth = self.client.get('/api/v1/seller/admin/applications/')
        assert res_unauth.status_code == 403

        # 2. Admin can list applications and overview summary
        self.client.force_authenticate(user=self.admin_user)
        res_admin_list = self.client.get('/api/v1/seller/admin/applications/')
        assert res_admin_list.status_code == 200
        list_data = res_admin_list.json()
        assert 'summary' in list_data['results']
        assert list_data['results']['summary']['total'] >= 1

        # 3. Move application to UNDER_REVIEW
        res_review = self.client.post(f"/api/v1/seller/admin/applications/{app_num}/status/", {
            'status': 'UNDER_REVIEW',
            'notes': 'Checking shop location in Lakeside Pokhara.'
        }, format='json')
        assert res_review.status_code == 200
        assert res_review.json()['status'] == 'UNDER_REVIEW'

        # 4. Admin approves application
        res_approve = self.client.post(f"/api/v1/seller/admin/applications/{app_num}/approve/", {}, format='json')
        assert res_approve.status_code == 200
        approve_data = res_approve.json()
        assert approve_data['success'] is True
        token = approve_data['invitation_token']
        assert token is not None
        assert 'vendor/activate?token=' in approve_data['activation_url']

        # Check application status in DB
        app_obj = SellerApplication.objects.get(application_number=app_num)
        assert app_obj.status == SellerApplicationStatus.INVITATION_SENT
        assert app_obj.vendor_profile is not None
        assert app_obj.vendor_profile.status == VendorStatus.PENDING  # Pending until activation

    def test_04_vendor_activation_flow(self):
        """Test verifying activation token, setting password, activating vendor profile, and blocking reuse."""
        test_email = f"activate_{uuid.uuid4().hex[:6]}@shop.np"
        payload = {
            'full_name': 'Gopal KC',
            'email': test_email,
            'phone': '+977 9804445566',
            'business_name': f"Patan Ceramics {uuid.uuid4().hex[:4]}",
            'business_category': 'Books, Stationery & Crafts',
            'province': 'Bagmati Province',
            'district': 'Lalitpur',
            'municipality': 'Lalitpur Metropolitan',
            'complete_address': 'Mangalbazar, Ward 11',
            'declaration_confirmed': True
        }
        res_apply = self.client.post('/api/v1/seller/applications/apply/', payload, format='json')
        app_num = res_apply.json()['application_number']

        # Approve as admin
        self.client.force_authenticate(user=self.admin_user)
        res_approve = self.client.post(f"/api/v1/seller/admin/applications/{app_num}/approve/", {}, format='json')
        token = res_approve.json()['invitation_token']

        # Unauthenticate (public applicant opening link)
        self.client.force_authenticate(user=None)

        # 1. Verify token
        res_verify = self.client.get(f"/api/v1/seller/activation/verify/?token={token}")
        assert res_verify.status_code == 200
        assert res_verify.json()['data']['email'] == test_email

        # 2. Activate with short password should fail
        res_short = self.client.post('/api/v1/seller/activation/activate/', {
            'token': token,
            'password': '123'
        }, format='json')
        assert res_short.status_code == 400

        # 3. Successful activation
        res_activate = self.client.post('/api/v1/seller/activation/activate/', {
            'token': token,
            'password': 'StrongMerchantPass123!',
            'confirm_password': 'StrongMerchantPass123!'
        }, format='json')
        assert res_activate.status_code == 200
        act_data = res_activate.json()
        assert act_data['success'] is True
        assert act_data['token'] is not None

        # Check DB states
        app_obj = SellerApplication.objects.get(application_number=app_num)
        assert app_obj.status == SellerApplicationStatus.ACTIVE
        assert app_obj.vendor_profile.status == VendorStatus.APPROVED
        assert app_obj.vendor_profile.stores.first().is_verified is True

        # 4. Consumed token cannot be reused
        res_reuse = self.client.post('/api/v1/seller/activation/activate/', {
            'token': token,
            'password': 'AnotherPassword123!'
        }, format='json')
        assert res_reuse.status_code == 400

        # 5. Activated vendor can log in via VendorLoginView
        res_login = self.client.post('/api/auth/login-vendor/', {
            'email': test_email,
            'password': 'StrongMerchantPass123!'
        }, format='json')
        assert res_login.status_code == 200
        assert res_login.json()['user']['has_vendor_access'] is True

    def test_05_pending_applicant_denied_vendor_dashboard(self):
        """Verify unapproved/pending applicant is denied access to seller login and protected APIs."""
        test_email = f"pending_denied_{uuid.uuid4().hex[:6]}@merchant.np"
        # Register user with unapproved vendor profile
        user = User.objects.create_user(
            email=test_email,
            password="PendingPass123!",
            role=UserRole.VENDOR
        )
        vp = VendorProfile.objects.create(
            user=user,
            business_name=f"Pending Mart {uuid.uuid4().hex[:4]}",
            slug=f"pending-mart-{uuid.uuid4().hex[:4]}",
            status=VendorStatus.PENDING
        )
        Store.objects.create(
            vendor=vp,
            name=vp.business_name,
            is_verified=False
        )

        # 1. Login attempt to /api/auth/login-vendor/ must return 403 Forbidden
        res_login = self.client.post('/api/auth/login-vendor/', {
            'email': test_email,
            'password': 'PendingPass123!'
        }, format='json')
        assert res_login.status_code == 403
        assert 'pending' in res_login.json()['detail'].lower() or 'review' in res_login.json()['detail'].lower()

        # 2. Direct API call to seller dashboard while authenticated with pending profile must be rejected
        self.client.force_authenticate(user=user)
        res_dash = self.client.get('/api/seller/dashboard/')
        assert res_dash.status_code == 403
