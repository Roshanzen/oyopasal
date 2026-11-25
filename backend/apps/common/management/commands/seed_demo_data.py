import uuid
from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.warehouse.models import Warehouse
from apps.catalogue.models import Category, Brand, Product, ProductVariant, ProductStatus
from apps.inventory.models import InventoryItem
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.payments.models import Payment, PaymentStatus, FinancialLedgerEntry
from apps.commissions.models import CommissionRecord, CommissionRule
from apps.settlements.models import VendorSettlement, SettlementStatus
from apps.subscriptions.models import SubscriptionPlan, TenantSubscription, SubscriptionTier, SubscriptionStatus

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds complete, realistic multi-ecosystem demo data for Oyo Pasal'

    def handle(self, *args, **options):
        self.stdout.write("Starting demo data seeding for Oyo Pasal...")

        # 1. Super Admin User
        admin_user, _ = User.objects.get_or_create(
            email='admin@oyopasal.com',
            defaults={
                'first_name': 'Platform',
                'last_name': 'Administrator',
                'role': UserRole.SUPER_ADMIN,
                'is_staff': True,
                'is_superuser': True,
                'is_verified': True,
            }
        )
        admin_user.set_password('AdminPass123!')
        admin_user.save()
        self.stdout.write(f"[OK] Superadmin ready: {admin_user.email} / AdminPass123!")

        # 2. Customers
        customer_user, _ = User.objects.get_or_create(
            email='customer@gmail.com',
            defaults={
                'first_name': 'Aayush',
                'last_name': 'Shrestha',
                'role': UserRole.CUSTOMER,
                'phone_number': '9841234567',
                'is_verified': True,
            }
        )
        customer_user.set_password('CustomerPass123!')
        customer_user.save()
        self.stdout.write(f"[OK] Customer ready: {customer_user.email} / CustomerPass123!")

        # 3. Vendors
        vendor_user1, _ = User.objects.get_or_create(
            email='vendor@himalayancrafts.com',
            defaults={
                'first_name': 'Bikram',
                'last_name': 'Shakya',
                'role': UserRole.VENDOR_OWNER,
                'phone_number': '9851023456',
                'is_verified': True,
            }
        )
        vendor_user1.set_password('VendorPass123!')
        vendor_user1.save()

        vendor1, _ = VendorProfile.objects.get_or_create(
            user=vendor_user1,
            defaults={
                'business_name': 'Himalayan Handicrafts & Pashmina',
                'slug': 'himalayan-handicrafts',
                'status': VendorStatus.APPROVED,
                'pan_vat_number': '102938475',
                'business_category': 'Traditional Crafts & Textiles',
                'store_description': 'Authentic hand-woven Pashmina and Tibetan brass singing bowls crafted in Patan.',
                'bank_name': 'Nabil Bank Ltd',
                'bank_account_name': 'Himalayan Handicrafts Pvt Ltd',
                'bank_account_number': '0192837465019',
                'bank_branch': 'Pulchowk Branch',
            }
        )

        vendor_user2, _ = User.objects.get_or_create(
            email='vendor@techzone.com',
            defaults={
                'first_name': 'Kiran',
                'last_name': 'Tamang',
                'role': UserRole.VENDOR_OWNER,
                'phone_number': '9861098765',
                'is_verified': True,
            }
        )
        vendor_user2.set_password('VendorPass123!')
        vendor_user2.save()

        vendor2, _ = VendorProfile.objects.get_or_create(
            user=vendor_user2,
            defaults={
                'business_name': 'TechZone Nepal Electronics',
                'slug': 'techzone-nepal',
                'status': VendorStatus.APPROVED,
                'pan_vat_number': '987654321',
                'business_category': 'Consumer Electronics',
                'store_description': 'Genuine gadgets, GaN chargers, and mechanical keyboards with full local warranty.',
                'bank_name': 'Global IME Bank',
                'bank_account_name': 'TechZone Nepal',
                'bank_account_number': '8472910384729',
                'bank_branch': 'New Road Branch',
            }
        )
        self.stdout.write(f"[OK] Vendors ready: {vendor1.business_name}, {vendor2.business_name}")

        # 4. Stores
        store1, _ = Store.objects.get_or_create(
            vendor=vendor1,
            slug='himalayan-crafts-patan',
            defaults={
                'name': 'Himalayan Crafts Patan Flagship',
                'description': 'Main showroom in Patan Durbar Square',
                'contact_phone': '015522334',
                'contact_email': 'crafts@himalaya.com.np',
                'address': 'Mangalbazar, Lalitpur',
                'is_active': True,
            }
        )
        store2, _ = Store.objects.get_or_create(
            vendor=vendor2,
            slug='techzone-new-road',
            defaults={
                'name': 'TechZone New Road Experience Center',
                'description': 'Authorized electronics outlet in New Road, Kathmandu',
                'contact_phone': '014223344',
                'contact_email': 'sales@techzone.com.np',
                'address': 'New Road, Kathmandu',
                'is_active': True,
            }
        )

        # 6. Warehouses
        wh1, _ = Warehouse.objects.get_or_create(
            code='KTM-CENTRAL-01',
            defaults={
                'name': 'Kathmandu Central Fulfillment Hub',
                'district': 'Kathmandu',
                'city': 'Kathmandu',
                'is_active': True,
            }
        )
        wh2, _ = Warehouse.objects.get_or_create(
            code='PATAN-DEPOT-02',
            defaults={
                'vendor': vendor1,
                'name': 'Patan Artisan Depot',
                'district': 'Lalitpur',
                'city': 'Lalitpur',
                'is_active': True,
            }
        )

        # 7. Categories & Brands
        cat_crafts, _ = Category.objects.get_or_create(
            slug='handicrafts-art',
            defaults={'name': 'Handicrafts & Art', 'ordering': 1}
        )
        cat_pashmina, _ = Category.objects.get_or_create(
            slug='pashmina-shawls',
            defaults={'name': 'Pashmina Shawls', 'parent': cat_crafts, 'ordering': 1}
        )
        cat_electronics, _ = Category.objects.get_or_create(
            slug='consumer-electronics',
            defaults={'name': 'Consumer Electronics', 'ordering': 2}
        )
        cat_chargers, _ = Category.objects.get_or_create(
            slug='chargers-cables',
            defaults={'name': 'Chargers & Power', 'parent': cat_electronics, 'ordering': 1}
        )

        brand_himalaya, _ = Brand.objects.get_or_create(
            slug='yak-yeti-heritage',
            defaults={'name': 'Yak & Yeti Heritage'}
        )
        brand_neptech, _ = Brand.objects.get_or_create(
            slug='neptech-gadgets',
            defaults={'name': 'NepTech Gadgets'}
        )

        # 8. Products, Variants & Inventory
        # Product 1: Pashmina Shawl
        p1, _ = Product.objects.get_or_create(
            slug='100-percent-pure-cashmere-pashmina-shawl',
            defaults={
                'vendor': vendor1,
                'store': store1,
                'category': cat_pashmina,
                'brand': brand_himalaya,
                'name': '100% Pure Cashmere Pashmina Shawl',
                'base_sku': 'PASH-PURE-01',
                'short_description': 'Hand-spun Grade-A Chyangra Pashmina Shawl from Mustang.',
                'description': 'Exquisite warmth and feather-light touch. Handcrafted by master weavers.',
                'status': ProductStatus.APPROVED,
                'tax_rate': Decimal('13.00'),
                'is_featured': True,
            }
        )
        v1, _ = ProductVariant.objects.get_or_create(
            sku='PASH-CHY-RED',
            defaults={
                'product': p1,
                'regular_price': Decimal('7500.00'),
                'selling_price': Decimal('6200.00'),
                'attributes': {'Color': 'Crimson Red', 'Size': '200x70cm'},
                'is_default': True,
                'is_active': True,
            }
        )
        InventoryItem.objects.get_or_create(
            warehouse=wh1,
            variant=v1,
            defaults={'quantity_on_hand': 45, 'quantity_reserved': 2, 'reorder_threshold': 10}
        )

        # Product 2: Singing Bowl
        p2, _ = Product.objects.get_or_create(
            slug='seven-metal-tibetan-singing-bowl-set',
            defaults={
                'vendor': vendor1,
                'store': store1,
                'category': cat_crafts,
                'brand': brand_himalaya,
                'name': 'Seven Metal Tibetan Singing Bowl Set',
                'base_sku': 'BOWL-TIB-02',
                'short_description': 'Hand-hammered brass meditation bowl with wooden mallet and silk cushion.',
                'description': 'Tuned to 432Hz frequency for deep meditation, healing and harmonic relaxation.',
                'status': ProductStatus.APPROVED,
                'tax_rate': Decimal('13.00'),
                'is_featured': True,
            }
        )
        v2, _ = ProductVariant.objects.get_or_create(
            sku='BOWL-7M-8IN',
            defaults={
                'product': p2,
                'regular_price': Decimal('4200.00'),
                'selling_price': Decimal('3600.00'),
                'attributes': {'Diameter': '8 Inches', 'Material': '7-Metal Alloy'},
                'is_default': True,
                'is_active': True,
            }
        )
        InventoryItem.objects.get_or_create(
            warehouse=wh2,
            variant=v2,
            defaults={'quantity_on_hand': 30, 'quantity_reserved': 0, 'reorder_threshold': 5}
        )

        # Product 3: GaN Fast Charger
        p3, _ = Product.objects.get_or_create(
            slug='gan-65w-dual-port-fast-charger',
            defaults={
                'vendor': vendor2,
                'store': store2,
                'category': cat_chargers,
                'brand': brand_neptech,
                'name': 'GaN 65W Dual-Port Type-C Fast Charger',
                'base_sku': 'CHG-GAN-65W',
                'short_description': 'Compact Gallium Nitride high-speed charger for MacBooks, laptops & smartphones.',
                'description': 'PD 3.0 and QC 4.0 certified. Includes smart temperature control and surge protector.',
                'status': ProductStatus.APPROVED,
                'tax_rate': Decimal('13.00'),
                'is_featured': True,
            }
        )
        v3, _ = ProductVariant.objects.get_or_create(
            sku='CHG-GAN-65W-BLK',
            defaults={
                'product': p3,
                'regular_price': Decimal('3200.00'),
                'selling_price': Decimal('2650.00'),
                'attributes': {'Color': 'Matte Black', 'Output': '65W PD'},
                'is_default': True,
                'is_active': True,
            }
        )
        InventoryItem.objects.get_or_create(
            warehouse=wh1,
            variant=v3,
            defaults={'quantity_on_hand': 80, 'quantity_reserved': 5, 'reorder_threshold': 15}
        )
        self.stdout.write("[OK] Products, variants and warehouse inventory populated.")

        # 9. Subscription Plans
        plan_starter, _ = SubscriptionPlan.objects.get_or_create(
            slug='starter-merchant-plan',
            defaults={
                'name': 'Starter Merchant Plan',
                'tier': SubscriptionTier.BASIC,
                'price_monthly': Decimal('1500.00'),
                'price_annually': Decimal('15000.00'),
                'max_products': 50,
                'max_stores': 2,
                'max_staff_accounts': 3,
                'max_monthly_orders': 200,
                'has_advanced_inventory': False,
                'has_analytics_reports': True,
                'is_active': True,
            }
        )
        plan_pro, _ = SubscriptionPlan.objects.get_or_create(
            slug='professional-growth-plan',
            defaults={
                'name': 'Professional Growth Plan',
                'tier': SubscriptionTier.PROFESSIONAL,
                'price_monthly': Decimal('3500.00'),
                'price_annually': Decimal('35000.00'),
                'max_products': 500,
                'max_stores': 5,
                'max_staff_accounts': 10,
                'max_monthly_orders': 2000,
                'has_advanced_inventory': True,
                'has_analytics_reports': True,
                'has_api_access': True,
                'is_active': True,
            }
        )

        TenantSubscription.objects.get_or_create(
            vendor=vendor1,
            defaults={
                'plan': plan_pro,
                'status': SubscriptionStatus.ACTIVE,
                'current_period_start': timezone.now() - timedelta(days=10),
                'current_period_end': timezone.now() + timedelta(days=20),
                'auto_renew': True,
            }
        )
        TenantSubscription.objects.get_or_create(
            vendor=vendor2,
            defaults={
                'plan': plan_starter,
                'status': SubscriptionStatus.ACTIVE,
                'current_period_start': timezone.now() - timedelta(days=5),
                'current_period_end': timezone.now() + timedelta(days=25),
                'auto_renew': True,
            }
        )
        self.stdout.write("[OK] SaaS Plans and Tenant Subscriptions active.")

        # 10. Sample Delivered Orders & Double-Entry Ledger
        order1, _ = Order.objects.get_or_create(
            order_number='ORD-NEPAL-20261101-001',
            defaults={
                'customer': customer_user,
                'status': OrderStatus.DELIVERED,
                'subtotal': Decimal('6200.00'),
                'delivery_total': Decimal('100.00'),
                'tax_total': Decimal('806.00'),
                'grand_total': Decimal('7106.00'),
                'currency': 'NPR',
                'payment_method': 'ESEWA',
                'payment_status': 'PAID',
                'shipping_address_snapshot': {
                    'name': 'Aayush Shrestha',
                    'phone': '9841234567',
                    'province': 'Bagmati',
                    'district': 'Lalitpur',
                    'city': 'Patan',
                    'ward': 5,
                    'street': 'Lagankhel Marg'
                }
            }
        )
        suborder1, _ = VendorSubOrder.objects.get_or_create(
            sub_order_number='SUB-NEPAL-20261101-001-V01',
            defaults={
                'parent_order': order1,
                'vendor': vendor1,
                'store': store1,
                'status': OrderStatus.DELIVERED,
                'subtotal': Decimal('6200.00'),
                'delivery_fee': Decimal('100.00'),
                'commission_rate': Decimal('10.00'),
                'commission_amount': Decimal('620.00'),
                'vendor_net_amount': Decimal('5580.00'),
                'tracking_number': 'NEX-KTM-99201',
                'delivery_provider': 'Nepal Express Logistics',
            }
        )
        OrderItem.objects.get_or_create(
            sub_order=suborder1,
            variant=v1,
            defaults={
                'product_name': p1.name,
                'variant_sku': v1.sku,
                'unit_price': v1.selling_price,
                'quantity': 1,
                'total_price': v1.selling_price,
                'tax_rate': Decimal('13.00'),
                'tax_amount': Decimal('806.00'),
            }
        )
        Payment.objects.get_or_create(
            order=order1,
            transaction_reference='TXN-ESEWA-20261101-9872',
            defaults={
                'provider': 'ESEWA',
                'status': PaymentStatus.SUCCESS,
                'amount': Decimal('7106.00'),
                'currency': 'NPR',
                'idempotency_key': 'IDEMP-DEMO-001',
            }
        )
        CommissionRecord.objects.get_or_create(
            sub_order=suborder1,
            defaults={
                'gross_amount': Decimal('6200.00'),
                'commission_rate': Decimal('10.00'),
                'commission_amount': Decimal('620.00'),
                'net_vendor_earning': Decimal('5580.00'),
                'is_settled': True,
            }
        )
        VendorSettlement.objects.get_or_create(
            settlement_number='SETTLE-KTM-20261101-001',
            defaults={
                'vendor': vendor1,
                'status': SettlementStatus.PAID,
                'gross_amount': Decimal('6200.00'),
                'platform_commission': Decimal('620.00'),
                'net_payout': Decimal('5580.00'),
                'bank_reference': 'NABIL-FT-992837',
                'paid_at': timezone.now(),
            }
        )

        self.stdout.write("[OK] Orders and financial transactions ready.")
        self.stdout.write(self.style.SUCCESS("All demo data seeded successfully!"))
