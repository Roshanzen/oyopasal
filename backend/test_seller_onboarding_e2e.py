import sys
import os
import uuid
import django

# Setup django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework_simplejwt.tokens import RefreshToken
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
    AdminSellerApplicationListView,
    AdminSellerApplicationStatusView,
    AdminSellerApplicationApproveView,
    VendorActivationVerifyView,
    VendorActivationSubmitView,
)
from apps.accounts.views import VendorLoginView
from apps.vendors.seller_views import SellerDashboardView


def run_onboarding_e2e_tests():
    print("=== STARTING OYOPASAL SELLER ONBOARDING & ACTIVATION E2E TEST ===")
    factory = APIRequestFactory()

    # Create admin user for testing
    admin_user = User.objects.filter(role=UserRole.SUPER_ADMIN).first()
    if not admin_user:
        admin_user = User.objects.create_user(
            email=f"e2e_admin_{uuid.uuid4().hex[:6]}@oyopasal.np",
            password="AdminPassword123!",
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True
        )
    print(f"✓ Step 0: Test Admin User Ready ({admin_user.email})")

    # 1. Test Application Submission Validation (Missing Fields)
    req_missing = factory.post('/api/v1/seller/applications/apply/', {}, format='json')
    res_missing = SellerApplicationApplyView.as_view()(req_missing)
    assert res_missing.status_code == 400, f"Expected 400 for missing fields, got {res_missing.status_code}"
    print("✓ Step 1: Missing required fields properly rejected (HTTP 400)")

    # 2. Test Successful Application Submission
    test_email = f"nepal_merchant_{uuid.uuid4().hex[:6]}@example.com"
    app_payload = {
        'full_name': 'Bikram Thapa',
        'email': test_email,
        'phone': '+977 9801239876',
        'business_name': f"Bikram Grocery Store {uuid.uuid4().hex[:4]}",
        'business_category': 'Grocery & Daily Staples',
        'business_description': 'Fresh organic vegetables and groceries from Sindhupalchok.',
        'province': 'Bagmati Province',
        'district': 'Kathmandu',
        'municipality': 'Kathmandu Metropolitan',
        'complete_address': 'Putalisadak, Ward 28',
        'pan_vat_number': '601888999',
        'declaration_confirmed': True,
    }
    req_apply = factory.post('/api/v1/seller/applications/apply/', app_payload, format='json')
    res_apply = SellerApplicationApplyView.as_view()(req_apply)
    assert res_apply.status_code == 201, f"Expected 201, got {res_apply.status_code}: {res_apply.data}"
    app_number = res_apply.data['application_number']
    assert app_number.startswith('APP-'), "Application number must have format APP-YYYY-XXXX"
    assert res_apply.data['status'] == 'PENDING'
    print(f"✓ Step 2: Application submitted successfully: Ref {app_number} with status PENDING")

    # 3. Test Duplicate Pending Application Rejection
    req_dup = factory.post('/api/v1/seller/applications/apply/', app_payload, format='json')
    res_dup = SellerApplicationApplyView.as_view()(req_dup)
    assert res_dup.status_code == 400, "Duplicate application with same email must be rejected"
    print("✓ Step 3: Duplicate pending application prevented (HTTP 400)")

    # 4. Test Application Tracking (Positive & Applicant Isolation)
    req_track = factory.post('/api/v1/seller/applications/track/', {
        'application_number': app_number,
        'email': test_email
    }, format='json')
    res_track = SellerApplicationTrackView.as_view()(req_track)
    assert res_track.status_code == 200
    assert res_track.data['data']['status'] == 'PENDING'
    assert res_track.data['data']['business_name'] == app_payload['business_name']

    # Attacker tries to read application with wrong email
    req_attacker = factory.post('/api/v1/seller/applications/track/', {
        'application_number': app_number,
        'email': 'attacker@gmail.com'
    }, format='json')
    res_attacker = SellerApplicationTrackView.as_view()(req_attacker)
    assert res_attacker.status_code == 400
    print("✓ Step 4: Tracking succeeds for owner and enforces applicant isolation against unauthorized emails")

    # 5. Test Admin Application List & Stats Aggregation
    req_admin_list = factory.get('/api/v1/seller/admin/applications/')
    force_authenticate(req_admin_list, user=admin_user)
    res_admin_list = AdminSellerApplicationListView.as_view()(req_admin_list)
    assert res_admin_list.status_code == 200
    summary = res_admin_list.data['results']['summary']
    assert summary['total'] >= 1
    assert summary['pending'] >= 1
    print(f"✓ Step 5: Admin console retrieved live summary metrics: Total {summary['total']}, Pending {summary['pending']}")

    # 6. Test Admin Move to UNDER_REVIEW
    req_review = factory.post(f"/api/v1/seller/admin/applications/{app_number}/status/", {
        'status': 'UNDER_REVIEW',
        'notes': 'Checking Putalisadak ward office location registration.'
    }, format='json')
    force_authenticate(req_review, user=admin_user)
    res_review = AdminSellerApplicationStatusView.as_view()(req_review, pk=app_number)
    assert res_review.status_code == 200
    assert res_review.data['status'] == 'UNDER_REVIEW'
    print(f"✓ Step 6: Application moved to UNDER_REVIEW with internal audit note")

    # 7. Test Admin Approval & Single-Use Invitation Token Generation
    req_approve = factory.post(f"/api/v1/seller/admin/applications/{app_number}/approve/", {
        'frontend_url': 'http://127.0.0.1:3000'
    }, format='json')
    force_authenticate(req_approve, user=admin_user)
    res_approve = AdminSellerApplicationApproveView.as_view()(req_approve, pk=app_number)
    assert res_approve.status_code == 200
    invitation_token = res_approve.data['invitation_token']
    assert invitation_token is not None
    assert 'vendor/activate?token=' in res_approve.data['activation_url']

    app_db = SellerApplication.objects.get(application_number=app_number)
    assert app_db.status == SellerApplicationStatus.INVITATION_SENT
    assert app_db.vendor_profile is not None
    assert app_db.vendor_profile.status == VendorStatus.PENDING  # Unapproved until activated
    print(f"✓ Step 7: Application approved. Single-use invitation token generated ({invitation_token[:12]}...)")

    # 8. Test That Inactive / Pending Vendor Cannot Log into Seller Portal Yet
    req_early_login = factory.post('/api/auth/login-vendor/', {
        'email': test_email,
        'password': 'AnyPassword123!'
    }, format='json')
    res_early_login = VendorLoginView.as_view()(req_early_login)
    assert res_early_login.status_code in [401, 403], "Unactivated vendor must be denied access"
    print("✓ Step 8: Unactivated applicant denied merchant portal access prior to password setup")

    # 9. Test Verification of Activation Token
    req_verify = factory.get(f"/api/v1/seller/activation/verify/?token={invitation_token}")
    res_verify = VendorActivationVerifyView.as_view()(req_verify)
    assert res_verify.status_code == 200
    assert res_verify.data['data']['email'] == test_email
    assert res_verify.data['data']['business_name'] == app_payload['business_name']
    print(f"✓ Step 9: Invitation token verified: Associated with {test_email} for store '{res_verify.data['data']['business_name']}'")

    # 10. Test Vendor Account Activation & Password Setup
    req_activate = factory.post('/api/v1/seller/activation/activate/', {
        'token': invitation_token,
        'password': 'SecureMerchantPass2026!',
        'confirm_password': 'SecureMerchantPass2026!'
    }, format='json')
    res_activate = VendorActivationSubmitView.as_view()(req_activate)
    assert res_activate.status_code == 200
    assert res_activate.data['success'] is True
    jwt_token = res_activate.data['token']
    assert jwt_token is not None

    # Check database states
    app_db.refresh_from_db()
    assert app_db.status == SellerApplicationStatus.ACTIVE
    vp = app_db.vendor_profile
    vp.refresh_from_db()
    assert vp.status == VendorStatus.APPROVED
    store = vp.stores.first()
    assert store.is_verified is True
    assert store.is_active is True
    print("✓ Step 10: Vendor account activated: Status=ACTIVE, VendorProfile=APPROVED, Store=Verified")

    # 11. Test Consumed Token Replay Protection (Cannot be reused)
    req_reuse = factory.post('/api/v1/seller/activation/activate/', {
        'token': invitation_token,
        'password': 'AnotherPassword!'
    }, format='json')
    res_reuse = VendorActivationSubmitView.as_view()(req_reuse)
    assert res_reuse.status_code == 400
    print("✓ Step 11: Single-use invitation token consumed. Replay attack blocked (HTTP 400)")

    # 12. Test Merchant Login with New Password
    req_login = factory.post('/api/auth/login-vendor/', {
        'email': test_email,
        'password': 'SecureMerchantPass2026!'
    }, format='json')
    res_login = VendorLoginView.as_view()(req_login)
    assert res_login.status_code == 200
    assert res_login.data['user']['has_vendor_access'] is True
    assert res_login.data['vendor']['is_approved'] is True
    print(f"✓ Step 12: Activated merchant successfully logged into Vendor Portal (HTTP 200)")

    # 13. Test Protected Seller Dashboard API Access
    vendor_user = User.objects.get(email=test_email)
    req_dash = factory.get('/api/seller/dashboard/')
    force_authenticate(req_dash, user=vendor_user)
    res_dash = SellerDashboardView.as_view()(req_dash)
    assert res_dash.status_code == 200
    assert res_dash.data['success'] is True
    print("✓ Step 13: Protected Vendor Dashboard accessible by newly onboarded merchant (HTTP 200)")

    print("\n🎉 ALL 13 SELLER ONBOARDING & ACTIVATION E2E TESTS PASSED SUCCESSFULLY! 🎉\n")


if __name__ == '__main__':
    run_onboarding_e2e_tests()
