import sys
import os
import uuid
import django

# Setup django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from rest_framework.test import APIRequestFactory
from apps.accounts.models import User, UserRole
from apps.vendors.models import (
    VendorProfile,
    VendorStatus,
    SellerApplication,
    SellerApplicationStatus,
    VendorInvitation,
)
from apps.stores.models import Store
from apps.vendors.application_views import (
    SellerApplicationApplyView,
    SellerApplicationTrackView,
    AdminSellerApplicationApproveView,
    VendorActivationSubmitView,
)
from apps.accounts.views import VendorLoginView, CustomTokenObtainPairView
from apps.vendors.application_services import (
    create_seller_application,
    admin_approve_and_invite,
    activate_vendor_account,
)


def run_customer_vendor_login_tests():
    print("=== STARTING CUSTOMER/VENDOR LOGIN & SELLER ONBOARDING VERIFICATION ===")
    factory = APIRequestFactory()

    # Create admin user
    admin_user = User.objects.filter(role=UserRole.SUPER_ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create_user(
            email=f"admin_test_{uuid.uuid4().hex[:6]}@oyopasal.np",
            password="AdminPassword123!",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True
        )
    print(f"✓ Setup: Admin user ready ({admin_user.email})")

    # 1. Test Customer-only account attempting Vendor Login receives HTTP 403 CUSTOMER_ACCOUNT_ONLY
    customer_email = f"customer_only_{uuid.uuid4().hex[:6]}@example.com"
    customer_pwd = "CustomerPassword123!"
    cust_user = User.objects.create_user(
        email=customer_email,
        password=customer_pwd,
        first_name="Ritesh",
        last_name="Yadav",
        role=UserRole.CUSTOMER,
        is_active=True,
        is_verified=True
    )

    req_vlogin = factory.post('/api/v1/auth/login-vendor/', {
        'email': customer_email,
        'password': customer_pwd
    }, format='json')
    res_vlogin = VendorLoginView.as_view()(req_vlogin)

    assert res_vlogin.status_code == 403, f"Expected 403 for customer-only vendor login, got {res_vlogin.status_code}"
    vlogin_data = res_vlogin.data
    assert vlogin_data.get('error', {}).get('code') == 'CUSTOMER_ACCOUNT_ONLY', f"Expected CUSTOMER_ACCOUNT_ONLY, got {vlogin_data}"
    assert vlogin_data.get('error', {}).get('action') == 'APPLY_SELLER'
    assert 'registered as a customer only' in vlogin_data.get('detail', '').lower()
    print("✓ Scenario 1: Customer-only login receives HTTP 403 CUSTOMER_ACCOUNT_ONLY with APPLY_SELLER action")

    # 2. Test existing customer submitting seller application
    app_payload = {
        'full_name': 'Ritesh Yadav',
        'email': customer_email,
        'phone': '+977 9841998877',
        'business_name': f"Ritesh Kirana Pasale {uuid.uuid4().hex[:4]}",
        'business_category': 'Grocery & Daily Staples',
        'business_description': 'Traditional Kathmandu valley grocery store.',
        'province': 'Bagmati Province',
        'district': 'Kathmandu',
        'municipality': 'Kathmandu Metropolitan',
        'complete_address': 'Koteshwor 32, Kathmandu',
        'declaration_confirmed': True,
    }

    req_apply = factory.post('/api/v1/seller/applications/apply/', app_payload, format='json')
    res_apply = SellerApplicationApplyView.as_view()(req_apply)

    assert res_apply.status_code == 201, f"Expected 201 on seller application, got {res_apply.status_code}"
    app_res_data = res_apply.data
    assert app_res_data['success'] is True
    app_number = app_res_data['application_number']

    # Ensure no duplicate User was created
    total_users_for_email = User.objects.filter(email__iexact=customer_email).count()
    assert total_users_for_email == 1, f"Expected exactly 1 user record, found {total_users_for_email}"

    # Verify user remains CUSTOMER role with no vendor profile yet
    cust_user.refresh_from_db()
    assert cust_user.role == UserRole.CUSTOMER
    assert not hasattr(cust_user, 'vendor_profile')

    # Verify application is linked to applicant_user
    app_record = SellerApplication.objects.get(application_number=app_number)
    assert app_record.applicant_user == cust_user
    assert app_record.status == SellerApplicationStatus.PENDING
    print("✓ Scenario 2: Existing customer successfully submitted application: no duplicate user, role remains CUSTOMER")

    # 3. Test Customer with PENDING application attempting Vendor Login
    req_pending_login = factory.post('/api/v1/auth/login-vendor/', {
        'email': customer_email,
        'password': customer_pwd
    }, format='json')
    res_pending_login = VendorLoginView.as_view()(req_pending_login)

    assert res_pending_login.status_code == 403, f"Expected 403, got {res_pending_login.status_code}"
    pending_data = res_pending_login.data
    assert pending_data.get('error', {}).get('code') == 'APPLICATION_PENDING_REVIEW'
    assert pending_data.get('error', {}).get('application_number') == app_number
    assert pending_data.get('error', {}).get('action') == 'TRACK_APPLICATION'

    # Test duplicate application prevention for pending application
    req_dup_apply = factory.post('/api/v1/seller/applications/apply/', app_payload, format='json')
    res_dup_apply = SellerApplicationApplyView.as_view()(req_dup_apply)
    assert res_dup_apply.status_code == 400, f"Expected 400 for duplicate application, got {res_dup_apply.status_code}"
    print("✓ Scenario 3: Customer with PENDING application receives APPLICATION_PENDING_REVIEW and duplicate applications blocked")

    # 4. Test Admin approval: invitation sent, application approved, but activation is incomplete
    invite_result = admin_approve_and_invite(app_record, admin_user=admin_user)
    assert invite_result['success'] is True
    invitation_token = invite_result['invitation_token']

    # Attempting vendor login before completing activation returns ACCOUNT_AWAITING_ACTIVATION
    req_awaiting_login = factory.post('/api/v1/auth/login-vendor/', {
        'email': customer_email,
        'password': customer_pwd
    }, format='json')
    res_awaiting_login = VendorLoginView.as_view()(req_awaiting_login)

    assert res_awaiting_login.status_code == 403, f"Expected 403, got {res_awaiting_login.status_code}"
    awaiting_data = res_awaiting_login.data
    assert awaiting_data.get('error', {}).get('code') == 'ACCOUNT_AWAITING_ACTIVATION'
    assert awaiting_data.get('error', {}).get('action') == 'ACTIVATE_ACCOUNT'
    print("✓ Scenario 4: Approved but inactive application receives HTTP 403 ACCOUNT_AWAITING_ACTIVATION")

    # 5. Test complete merchant account activation
    new_merchant_pwd = "MerchantSecurePass99!"
    act_req = factory.post('/api/v1/seller/activation/submit/', {
        'token': invitation_token,
        'password': new_merchant_pwd
    }, format='json')
    act_res = VendorActivationSubmitView.as_view()(act_req)

    assert act_res.status_code == 200, f"Expected 200 on activation submit, got {act_res.status_code}"
    act_data = act_res.data
    assert act_data['success'] is True

    # Verify user state after activation
    cust_user.refresh_from_db()
    assert cust_user.role == UserRole.VENDOR
    assert hasattr(cust_user, 'vendor_profile')
    assert cust_user.vendor_profile.status == VendorStatus.APPROVED
    assert cust_user.vendor_profile.stores.filter(is_verified=True).exists()

    # Now Vendor Login succeeds with the new merchant password!
    req_success_vlogin = factory.post('/api/v1/auth/login-vendor/', {
        'email': customer_email,
        'password': new_merchant_pwd
    }, format='json')
    res_success_vlogin = VendorLoginView.as_view()(req_success_vlogin)

    assert res_success_vlogin.status_code == 200, f"Expected 200 on vendor login after activation, got {res_success_vlogin.status_code}"
    vlogin_success_data = res_success_vlogin.data
    assert 'access' in vlogin_success_data
    assert 'vendor' in vlogin_success_data
    assert vlogin_success_data['vendor']['is_approved'] is True

    # Verify that normal Customer Login (POST /api/v1/auth/token/) ALSO functions cleanly!
    req_cust_login = factory.post('/api/v1/auth/token/', {
        'email': customer_email,
        'password': new_merchant_pwd
    }, format='json')
    res_cust_login = CustomTokenObtainPairView.as_view()(req_cust_login)

    assert res_cust_login.status_code == 200, f"Expected 200 on customer login, got {res_cust_login.status_code}"
    assert 'access' in res_cust_login.data
    print("✓ Scenario 5: Activated vendor successfully logs in via Vendor Login and normal Customer Login is preserved")

    # 6. Test that an already active vendor cannot create a new duplicate seller application
    req_active_dup = factory.post('/api/v1/seller/applications/apply/', app_payload, format='json')
    res_active_dup = SellerApplicationApplyView.as_view()(req_active_dup)
    assert res_active_dup.status_code == 400
    assert 'already exists' in str(res_active_dup.data).lower()
    print("✓ Scenario 6: Active approved vendor is blocked from creating duplicate applications")

    print("\n=== ALL CUSTOMER/VENDOR LOGIN & SELLER ONBOARDING TESTS PASSED (6/6) ===")


if __name__ == '__main__':
    run_customer_vendor_login_tests()
