from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import (
    Category,
    Brand,
    Product,
    ProductVariant,
    ProductStatus,
    ProductModerationLog
)

User = get_user_model()

class MarketplaceCatalogueTests(APITestCase):
    def setUp(self):
        # 1. Super Admin
        self.admin_user = User.objects.create_superuser(
            email='admin@oyopasal.com',
            password='AdminPassword123!'
        )

        # 2. Operations Admin
        self.ops_user = User.objects.create_user(
            email='ops@oyopasal.com',
            password='OpsPassword123!',
            role=UserRole.OPERATIONS_ADMIN,
            is_verified=True
        )

        # 3. Approved Vendor
        self.vendor_user = User.objects.create_user(
            email='vendor@techhimalaya.com',
            password='VendorPassword123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Tech Himalaya Pvt Ltd',
            slug='tech-himalaya',
            status=VendorStatus.APPROVED
        )
        self.vendor_store = Store.objects.create(
            vendor=self.vendor_profile,
            name='Tech Himalaya Flagship',
            slug='tech-himalaya-flagship',
            is_active=True,
            is_verified=True
        )

        # 4. Another Vendor (to test data isolation)
        self.other_vendor_user = User.objects.create_user(
            email='other@craftsnepal.com',
            password='OtherVendorPass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.other_vendor_profile = VendorProfile.objects.create(
            user=self.other_vendor_user,
            business_name='Crafts Nepal',
            slug='crafts-nepal',
            status=VendorStatus.APPROVED
        )

        # 5. Taxonomy (Categories & Brand)
        self.root_category = Category.objects.create(
            name='Electronics',
            slug='electronics',
            is_active=True
        )
        self.sub_category = Category.objects.create(
            name='Smartphones',
            slug='smartphones',
            parent=self.root_category,
            is_active=True
        )
        self.brand = Brand.objects.create(
            name='Himalaya Tech',
            slug='himalaya-tech',
            is_active=True
        )

    def test_category_hierarchy_tree_api(self):
        """Verify public categories endpoint returns parent categories with nested subcategories."""
        url = reverse('catalogue:public_category_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Electronics')
        self.assertEqual(len(response.data[0]['subcategories']), 1)
        self.assertEqual(response.data[0]['subcategories'][0]['name'], 'Smartphones')

    def test_vendor_store_creation_and_listing(self):
        """Verify vendor can create and list their own stores."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('stores:vendor_store_list_create')
        
        # List stores
        list_res = self.client.get(url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data['meta']['total_count'], 1)

        # Create secondary store
        payload = {
            'name': 'Tech Himalaya Pokhara Branch',
            'description': 'Lakeside branch store',
            'contact_phone': '9801234567',
            'address': 'Lakeside-6, Pokhara'
        }
        create_res = self.client.post(url, payload)
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_res.data['name'], 'Tech Himalaya Pokhara Branch')
        self.assertEqual(create_res.data['slug'], 'tech-himalaya-pokhara-branch')

    def test_vendor_cannot_modify_other_vendor_store(self):
        """Verify multi-tenant store isolation: vendor cannot mutate other vendor's store."""
        self.client.force_authenticate(user=self.other_vendor_user)
        url = reverse('stores:vendor_store_detail', kwargs={'id': self.vendor_store.id})
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_vendor_create_draft_product_with_variants(self):
        """Verify vendor can create a product with custom variants."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('catalogue:vendor_product_list_create')

        payload = {
            'store': str(self.vendor_store.id),
            'category': str(self.sub_category.id),
            'brand': str(self.brand.id),
            'name': 'Himalaya Pro Smartphone',
            'base_sku': 'HIM-PRO-01',
            'short_description': 'Fast flagship phone made in Nepal',
            'description': 'Full specifications description',
            'tax_rate': '13.00',
            'status': ProductStatus.DRAFT,
            'variants': [
                {
                    'sku': 'HIM-PRO-01-BLK-128',
                    'regular_price': '45000.00',
                    'selling_price': '39999.00',
                    'attributes': {'color': 'Jet Black', 'storage': '128GB'},
                    'is_default': True
                },
                {
                    'sku': 'HIM-PRO-01-SLV-256',
                    'regular_price': '52000.00',
                    'selling_price': '47999.00',
                    'attributes': {'color': 'Silver', 'storage': '256GB'},
                    'is_default': False
                }
            ]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        product = Product.objects.get(base_sku='HIM-PRO-01')
        self.assertEqual(product.status, ProductStatus.DRAFT)
        self.assertEqual(product.variants.count(), 2)

        # Check calculated discount
        default_variant = product.variants.get(is_default=True)
        self.assertAlmostEqual(default_variant.discount_percentage, 11.1, places=1)

    def test_product_moderation_full_workflow(self):
        """
        Verify complete moderation lifecycle:
        1. Vendor creates Draft.
        2. Vendor submits for review (SUBMITTED).
        3. Ops Admin rejects with feedback (REJECTED).
        4. Vendor re-submits.
        5. Ops Admin approves (APPROVED).
        6. Product becomes visible on public search.
        """
        # Step 1: Draft
        product = Product.objects.create(
            vendor=self.vendor_profile,
            store=self.vendor_store,
            category=self.sub_category,
            brand=self.brand,
            name='Everest Ultrabook',
            base_sku='EVR-ULTRA-01',
            status=ProductStatus.DRAFT
        )
        ProductVariant.objects.create(
            product=product,
            sku='EVR-ULTRA-01-BASE',
            regular_price=Decimal('120000.00'),
            selling_price=Decimal('115000.00'),
            is_default=True
        )

        # Product is NOT visible in public search yet
        public_url = reverse('catalogue:public_product_list')
        public_res1 = self.client.get(public_url)
        self.assertEqual(public_res1.data['meta']['total_count'], 0)

        # Step 2: Vendor Submits
        self.client.force_authenticate(user=self.vendor_user)
        submit_url = reverse('catalogue:vendor_product_submit', kwargs={'id': product.id})
        sub_res = self.client.post(submit_url)
        self.assertEqual(sub_res.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.status, ProductStatus.SUBMITTED)

        # Step 3: Admin Rejection
        self.client.force_authenticate(user=self.ops_user)
        mod_url = reverse('catalogue:admin_product_moderate', kwargs={'id': product.id})
        reject_res = self.client.post(mod_url, {
            'action': 'REJECT',
            'reason': 'Please provide clearer product specifications.'
        })
        self.assertEqual(reject_res.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.status, ProductStatus.REJECTED)
        self.assertEqual(product.rejection_reason, 'Please provide clearer product specifications.')

        # Step 4: Vendor Re-submits
        self.client.force_authenticate(user=self.vendor_user)
        sub_res2 = self.client.post(submit_url)
        self.assertEqual(sub_res2.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.status, ProductStatus.SUBMITTED)

        # Step 5: Admin Approves
        self.client.force_authenticate(user=self.ops_user)
        approve_res = self.client.post(mod_url, {'action': 'APPROVE'})
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)
        product.refresh_from_db()
        self.assertEqual(product.status, ProductStatus.APPROVED)
        self.assertEqual(product.moderated_by, self.ops_user)

        # Verify Audit Log
        logs = ProductModerationLog.objects.filter(product=product).order_by('created_at')
        self.assertEqual(logs.count(), 4)
        self.assertEqual(logs[0].action, 'SUBMIT')
        self.assertEqual(logs[1].action, 'REJECT')
        self.assertEqual(logs[2].action, 'SUBMIT')
        self.assertEqual(logs[3].action, 'APPROVE')

        # Step 6: Public Search Verification
        self.client.logout()
        public_res2 = self.client.get(public_url, {'search': 'Everest'})
        self.assertEqual(public_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(public_res2.data['meta']['total_count'], 1)
        self.assertEqual(public_res2.data['data'][0]['name'], 'Everest Ultrabook')
        self.assertEqual(public_res2.data['data'][0]['price_range']['selling_price' if 'selling_price' in public_res2.data['data'][0]['price_range'] else 'min_price'], '115000.00')

    def test_public_product_price_and_category_filtering(self):
        """Verify price range and category filters work accurately on public products."""
        # Create approved product
        prod = Product.objects.create(
            vendor=self.vendor_profile,
            store=self.vendor_store,
            category=self.sub_category,
            brand=self.brand,
            name='Affordable Earbuds',
            base_sku='EAR-BUD-01',
            status=ProductStatus.APPROVED
        )
        ProductVariant.objects.create(
            product=prod,
            sku='EAR-BUD-01-WHT',
            regular_price=Decimal('2500.00'),
            selling_price=Decimal('1999.00'),
            is_default=True
        )

        public_url = reverse('catalogue:public_product_list')
        
        # Test match within price range 1000 - 3000
        match_res = self.client.get(public_url, {'min_price': '1000', 'max_price': '3000'})
        self.assertEqual(match_res.data['meta']['total_count'], 1)

        # Test no match above 3000
        no_match_res = self.client.get(public_url, {'min_price': '3000'})
        self.assertEqual(no_match_res.data['meta']['total_count'], 0)
