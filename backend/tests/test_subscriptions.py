from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product
from apps.subscriptions.models import (
    SubscriptionPlan,
    TenantSubscription,
    SubscriptionInvoice,
    SubscriptionTier,
    SubscriptionStatus,
    BillingInterval
)
from apps.subscriptions.services import SubscriptionService

User = get_user_model()

class SubscriptionsAndLimitsTests(APITestCase):
    def setUp(self):
        # 1. Super Admin
        self.superadmin = User.objects.create_superuser(
            email='superadmin@oyopasal.com',
            password='SuperSecretAdmin123!',
            role=UserRole.SUPER_ADMIN,
            is_verified=True
        )

        # 2. Vendor User & Profile
        self.vendor_user = User.objects.create_user(
            email='vendor@techstore.com',
            password='VendorSecret123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Tech Gear Nepal',
            slug='tech-gear-nepal',
            status=VendorStatus.APPROVED
        )

        # 3. Create Subscription Plans
        self.basic_plan = SubscriptionPlan.objects.create(
            name='Starter Merchant',
            slug='starter-merchant',
            tier=SubscriptionTier.BASIC,
            description='Perfect for small boutique shops',
            price_monthly=Decimal('1500.00'),
            price_annually=Decimal('15000.00'),
            max_products=2,
            max_stores=1,
            max_staff_accounts=1,
            max_monthly_orders=50,
            has_advanced_inventory=False,
            has_analytics_reports=True,
            is_active=True
        )
        self.pro_plan = SubscriptionPlan.objects.create(
            name='Enterprise Merchant',
            slug='enterprise-merchant',
            tier=SubscriptionTier.ENTERPRISE,
            description='Unlimited growth for established retail brands',
            price_monthly=Decimal('5000.00'),
            price_annually=Decimal('50000.00'),
            max_products=1000,
            max_stores=5,
            max_staff_accounts=10,
            max_monthly_orders=5000,
            has_advanced_inventory=True,
            has_analytics_reports=True,
            is_active=True
        )

        self.category = Category.objects.create(name='Electronics', slug='electronics')

    def test_public_subscription_plans_list(self):
        """Any client can list available SaaS plans."""
        url = reverse('subscriptions:plans_list')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        resp_json = res.json()
        plans = resp_json['data'] if 'data' in resp_json else resp_json
        self.assertGreaterEqual(len(plans), 2)
        plan_names = [p['name'] for p in plans]
        self.assertIn('Starter Merchant', plan_names)

    def test_superadmin_can_create_plan(self):
        """Super Admin can configure new subscription tiers."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse('subscriptions:admin_plans')
        payload = {
            'name': 'Gold Partner Tier',
            'slug': 'gold-partner-tier',
            'tier': 'PROFESSIONAL',
            'description': 'Exclusive high volume plan',
            'price_monthly': '3000.00',
            'price_annually': '30000.00',
            'trial_days': 30,
            'max_products': 200,
            'max_stores': 3,
            'max_staff_accounts': 5,
            'max_monthly_orders': 1000,
            'has_advanced_inventory': True,
            'has_analytics_reports': True,
            'is_active': True
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SubscriptionPlan.objects.filter(slug='gold-partner-tier').exists())

    def test_tenant_subscribe_and_invoice_generation(self):
        """Vendor subscribes to Starter Plan; active contract and VAT invoice are generated."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('subscriptions:subscribe_or_upgrade')
        payload = {
            'plan_slug': 'starter-merchant',
            'billing_interval': 'MONTHLY',
            'payment_method': 'ESEWA'
        }
        res = self.client.post(url, payload)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertEqual(data['status'], 'ACTIVE')
        self.assertEqual(data['billing_interval'], 'MONTHLY')
        self.assertIn('invoices', data)
        self.assertEqual(len(data['invoices']), 1)
        
        # Check 13% Nepal VAT calculation: NPR 1,500 + 13% = NPR 1,695
        invoice = data['invoices'][0]
        self.assertEqual(Decimal(invoice['amount']), Decimal('1500.00'))
        self.assertEqual(Decimal(invoice['tax_amount']), Decimal('195.00'))
        self.assertEqual(Decimal(invoice['grand_total']), Decimal('1695.00'))
        self.assertEqual(invoice['payment_status'], 'PAID')

    def test_tenant_quotas_and_usage_endpoint(self):
        """Vendor can inspect their active limits and current usage."""
        # Assign Starter Plan
        SubscriptionService.subscribe_or_upgrade(
            tenant=self.vendor,
            plan=self.basic_plan,
            billing_interval='MONTHLY'
        )

        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('subscriptions:current_subscription')
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.json()
        self.assertEqual(data['plan_name'], 'Starter Merchant')
        self.assertTrue(data['is_valid_subscription'])
        self.assertEqual(data['limits']['max_products'], 2)
        self.assertEqual(data['limits']['current_products'], 0)
        self.assertTrue(data['limits']['can_create_product'])
        self.assertEqual(data['limits']['max_stores'], 1)

    def test_tenant_cancel_auto_renewal(self):
        """Vendor can cancel auto-renewal."""
        SubscriptionService.subscribe_or_upgrade(
            tenant=self.vendor,
            plan=self.basic_plan
        )
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('subscriptions:cancel_subscription')
        res = self.client.post(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.vendor.refresh_from_db()
        self.assertFalse(self.vendor.subscription.auto_renew)
        self.assertIsNotNone(self.vendor.subscription.cancelled_at)

    def test_store_creation_limit_enforcement(self):
        """Vendor cannot exceed max_stores quota enforced at API level."""
        SubscriptionService.subscribe_or_upgrade(
            tenant=self.vendor,
            plan=self.basic_plan # max_stores = 1
        )
        self.client.force_authenticate(user=self.vendor_user)
        store_url = reverse('stores:vendor_store_list_create')

        # First store: Success
        res1 = self.client.post(store_url, {
            'name': 'Tech Gear Kathmandu Hub',
            'slug': 'tech-gear-ktm'
        })
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Second store: Forbidden due to plan quota
        res2 = self.client.post(store_url, {
            'name': 'Tech Gear Pokhara Hub',
            'slug': 'tech-gear-pokhara'
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit of 1 stores has been reached', str(res2.json()))

    def test_product_creation_limit_enforcement(self):
        """Vendor cannot exceed max_products quota enforced at API level."""
        SubscriptionService.subscribe_or_upgrade(
            tenant=self.vendor,
            plan=self.basic_plan # max_products = 2
        )
        store = Store.objects.create(
            vendor=self.vendor,
            name='Main Tech Depot',
            slug='main-tech-depot'
        )
        self.client.force_authenticate(user=self.vendor_user)
        prod_url = reverse('catalogue:vendor_product_list_create')

        # Product 1: Success
        res1 = self.client.post(prod_url, {
            'store': str(store.id),
            'category': str(self.category.id),
            'name': 'USB-C Fast Charger 65W',
            'base_sku': 'CHG-65W',
            'short_description': 'GaN fast charger'
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Product 2: Success
        res2 = self.client.post(prod_url, {
            'store': str(store.id),
            'category': str(self.category.id),
            'name': 'Mechanical Gaming Keyboard',
            'base_sku': 'KB-MECH-01',
            'short_description': 'RGB Mechanical'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

        # Product 3: Rejected by subscription guard
        res3 = self.client.post(prod_url, {
            'store': str(store.id),
            'category': str(self.category.id),
            'name': 'Wireless Ergonomic Mouse',
            'base_sku': 'MOU-ERGO-01',
            'short_description': 'Bluetooth mouse'
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('limit of 2 products has been reached', str(res3.json()))
