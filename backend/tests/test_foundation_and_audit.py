from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import UserRole
from apps.customers.models import CustomerProfile, Address, NepalProvince
from apps.vendors.models import VendorProfile, VendorDocument, VendorStaffMember
from apps.suppliers.models import SupplierProfile, SupplierDocument, SupplierStaffMember
from apps.audit.models import AuditLog, AuditAction

User = get_user_model()

class FoundationAndAuditAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Super Admin User
        self.admin_user = User.objects.create_superuser(
            email='superadmin@oyopasal.com',
            password='AdminPass123!',
            role=UserRole.SUPER_ADMIN
        )

        # 2. Customer User
        self.customer_user = User.objects.create_user(
            email='shopper@gmail.com',
            password='CustomerPass123!',
            role=UserRole.CUSTOMER,
            first_name='Anil',
            last_name='Shrestha'
        )
        self.customer_profile, _ = CustomerProfile.objects.get_or_create(
            user=self.customer_user,
            gender='MALE'
        )

        # 3. Vendor Owner User & Profile
        self.vendor_user = User.objects.create_user(
            email='vendor@teststore.com',
            password='VendorPass123!',
            role=UserRole.VENDOR_OWNER
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Patan Heritage Crafts',
            slug='patan-heritage-crafts',
            pan_vat_number='123456789',
            status='PENDING'
        )

        # 4. Supplier Owner User & Profile
        self.supplier_user = User.objects.create_user(
            email='supplier@testtextiles.com',
            password='SupplierPass123!',
            role=UserRole.SUPPLIER_OWNER
        )
        self.supplier_profile = SupplierProfile.objects.create(
            user=self.supplier_user,
            company_name='Himalayan Raw Fibers Ltd',
            slug='himalayan-raw-fibers',
            pan_vat_number='987654321',
            status='PENDING'
        )

    def test_customer_profile_retrieve_and_update(self):
        self.client.force_authenticate(user=self.customer_user)
        # GET profile
        response = self.client.get('/api/v1/customers/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['gender'], 'MALE')

        # PATCH profile
        update_res = self.client.patch('/api/v1/customers/me/', {'gender': 'OTHER'}, format='json')
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.customer_profile.refresh_from_db()
        self.assertEqual(self.customer_profile.gender, 'OTHER')

    def test_customer_address_book_lifecycle(self):
        self.client.force_authenticate(user=self.customer_user)

        # 1. Create first address (should auto-default to default shipping)
        payload1 = {
            'recipient_name': 'Anil Shrestha',
            'recipient_phone': '9841000001',
            'province': NepalProvince.BAGMATI,
            'district': 'Kathmandu',
            'municipality': 'Kathmandu Metropolitan',
            'ward_number': 3,
            'tole_street': 'Lazimpat Rd',
            'is_default_shipping': True,
        }
        create_res = self.client.post('/api/v1/customers/addresses/', payload1, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        addr1_id = create_res.data['id']
        self.assertTrue(create_res.data['is_default_shipping'])

        # 2. Create second address
        payload2 = {
            'recipient_name': 'Anil Office',
            'recipient_phone': '9841000002',
            'province': NepalProvince.BAGMATI,
            'district': 'Lalitpur',
            'municipality': 'Lalitpur Metropolitan',
            'ward_number': 4,
            'tole_street': 'Jhamsikhel',
            'is_default_shipping': False,
        }
        create_res2 = self.client.post('/api/v1/customers/addresses/', payload2, format='json')
        self.assertEqual(create_res2.status_code, status.HTTP_201_CREATED)
        addr2_id = create_res2.data['id']

        # 3. Set address 2 as default shipping via action
        set_default_res = self.client.post(f'/api/v1/customers/addresses/{addr2_id}/set-default/', {'type': 'shipping'}, format='json')
        self.assertEqual(set_default_res.status_code, status.HTTP_200_OK)

        addr1 = Address.objects.get(id=addr1_id)
        addr2 = Address.objects.get(id=addr2_id)
        self.assertFalse(addr1.is_default_shipping)
        self.assertTrue(addr2.is_default_shipping)

    def test_vendor_kyc_verification_and_audit_trail(self):
        # 1. Create a KYC document for vendor
        VendorDocument.objects.create(
            vendor=self.vendor_profile,
            document_type='PAN_CERTIFICATE',
            document_url='https://imagekit.io/oyopasal/pan123.jpg'
        )

        # 2. Super Admin approves vendor KYC
        self.client.force_authenticate(user=self.admin_user)
        approve_res = self.client.post(
            f'/api/v1/vendors/admin/{self.vendor_profile.id}/verify-kyc/',
            {'status': 'APPROVED'},
            format='json'
        )
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)

        self.vendor_profile.refresh_from_db()
        self.assertEqual(self.vendor_profile.status, 'APPROVED')

        # Verify audit log was created
        audit_entry = AuditLog.objects.filter(
            action=AuditAction.KYC_VERIFICATION,
            target_id=str(self.vendor_profile.id)
        ).first()
        self.assertIsNotNone(audit_entry)
        self.assertEqual(audit_entry.user, self.admin_user)
        self.assertEqual(audit_entry.delta_changes['new_status'], 'APPROVED')

    def test_supplier_verification_and_audit(self):
        self.client.force_authenticate(user=self.admin_user)
        verify_res = self.client.post(
            f'/api/v1/suppliers/admin/{self.supplier_profile.id}/verify/',
            {'status': 'APPROVED'},
            format='json'
        )
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)

        self.supplier_profile.refresh_from_db()
        self.assertEqual(self.supplier_profile.status, 'APPROVED')

        audit_entry = AuditLog.objects.filter(
            action=AuditAction.KYC_VERIFICATION,
            target_id=str(self.supplier_profile.id)
        ).first()
        self.assertIsNotNone(audit_entry)

    def test_vendor_staff_management_permissions(self):
        # 1. Vendor owner creates a staff user
        staff_user = User.objects.create_user(
            email='staff@teststore.com',
            password='StaffPass123!',
            role=UserRole.VENDOR_STAFF
        )

        self.client.force_authenticate(user=self.vendor_user)
        payload = {
            'user': staff_user.id,
            'can_manage_products': True,
            'can_manage_orders': True,
            'can_view_settlements': False,
        }
        res = self.client.post('/api/v1/vendors/staff/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(res.data['can_view_settlements'])

    def test_audit_logs_restricted_to_super_admin(self):
        # Customer should be forbidden from accessing audit logs
        self.client.force_authenticate(user=self.customer_user)
        cust_res = self.client.get('/api/v1/audit/logs/')
        self.assertEqual(cust_res.status_code, status.HTTP_403_FORBIDDEN)

        # Super admin should be allowed
        self.client.force_authenticate(user=self.admin_user)
        admin_res = self.client.get('/api/v1/audit/logs/')
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)
