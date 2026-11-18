from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.catalogue.models import Product, Category, ProductVariant
from apps.stores.models import Store
from apps.vendors.models import VendorProfile
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.promotions.models import Coupon, CouponDiscountType
from apps.reviews.models import ProductReview
from apps.notifications.models import Notification, NotificationType
from apps.support.models import SupportTicket, TicketCategory, TicketStatus

User = get_user_model()

class AdvancedFeaturesStage12Tests(APITestCase):
    def setUp(self):
        # 1. Customer User
        self.customer = User.objects.create_user(
            email='customer.ram@example.com',
            password='Password123!',
            first_name='Ram',
            last_name='Shrestha',
            role='CUSTOMER'
        )

        # 2. Vendor Owner & Profile
        self.vendor_user = User.objects.create_user(
            email='vendor.sharma@example.com',
            password='Password123!',
            first_name='Hari',
            last_name='Sharma',
            role='VENDOR_OWNER'
        )
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Sharma Handicrafts',
            pan_vat_number='123456789',
            slug='sharma-handicrafts',
            status='APPROVED'
        )

        # 3. Super Admin
        self.admin = User.objects.create_superuser(
            email='admin.gov@oyopasal.com',
            password='Password123!',
            first_name='Super',
            last_name='Admin',
            role='SUPER_ADMIN'
        )

        # 4. Store, Category & Product
        self.store = Store.objects.create(
            vendor=self.vendor,
            name='Sharma Store Kathmandu',
            slug='sharma-store-ktm'
        )
        self.category = Category.objects.create(name='Pashmina Shawls', slug='pashmina-shawls')
        self.product = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.category,
            name='Pure Cashmere Pashmina',
            slug='pure-cashmere-pashmina',
            base_sku='PASH-001',
            status='APPROVED'
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku='PASH-001-REG',
            regular_price=Decimal('5000.00'),
            selling_price=Decimal('5000.00'),
            is_default=True
        )

    # ------------------------------------------------------------------
    # 1. Coupons & Promotions Tests
    # ------------------------------------------------------------------
    def test_coupon_validation_percentage_and_fixed(self):
        # Create Percentage Coupon: 10% off, max NPR 1000, min order NPR 2000
        coupon_pct = Coupon.objects.create(
            code='DASHAIN10',
            discount_type=CouponDiscountType.PERCENTAGE,
            discount_value=Decimal('10.00'),
            max_discount_amount=Decimal('1000.00'),
            min_order_amount=Decimal('2000.00'),
            is_active=True
        )

        # Validate with order below minimum (NPR 1500)
        url = '/api/v1/promotions/coupons/validate/'
        res_fail = self.client.post(url, {'code': 'DASHAIN10', 'subtotal': '1500.00'})
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(res_fail.data['is_valid'])

        # Validate with eligible subtotal (NPR 6000) -> 10% is NPR 600
        res_ok = self.client.post(url, {'code': 'DASHAIN10', 'subtotal': '6000.00'})
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertTrue(res_ok.data['is_valid'])
        self.assertEqual(res_ok.data['discount_amount'], '600.00')
        self.assertEqual(res_ok.data['new_subtotal'], '5400.00')

        # Validate Fixed Coupon: NPR 500 off
        coupon_fixed = Coupon.objects.create(
            code='WELCOME500',
            discount_type=CouponDiscountType.FIXED,
            discount_value=Decimal('500.00'),
            min_order_amount=Decimal('1000.00'),
            is_active=True
        )
        res_fixed = self.client.post(url, {'code': 'WELCOME500', 'subtotal': '3000.00'})
        self.assertEqual(res_fixed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_fixed.data['discount_amount'], '500.00')
        self.assertEqual(res_fixed.data['new_subtotal'], '2500.00')

    # ------------------------------------------------------------------
    # 2. Product Reviews & Ratings Tests
    # ------------------------------------------------------------------
    def test_customer_review_and_verified_purchase(self):
        # 1. Create a DELIVERED order for customer containing product
        order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-REV-101',
            status=OrderStatus.DELIVERED,
            subtotal=Decimal('5000.00'),
            grand_total=Decimal('5000.00')
        )
        sub_order = VendorSubOrder.objects.create(
            parent_order=order,
            vendor=self.vendor,
            store=self.store,
            sub_order_number='ORD-REV-101-V1',
            status=OrderStatus.DELIVERED,
            subtotal=Decimal('5000.00'),
            vendor_net_amount=Decimal('4500.00')
        )
        OrderItem.objects.create(
            sub_order=sub_order,
            variant=self.variant,
            product_name=self.product.name,
            variant_sku=self.variant.sku,
            quantity=1,
            unit_price=Decimal('5000.00'),
            total_price=Decimal('5000.00')
        )

        # 2. Customer submits 5-star review
        self.client.force_authenticate(user=self.customer)
        url = f'/api/v1/reviews/products/{self.product.id}/create/'
        res_rev = self.client.post(url, {
            'rating': 5,
            'title': 'Outstanding Authentic Pashmina',
            'comment': 'Soft, warm, and genuine quality from Kathmandu weavers.'
        })
        self.assertEqual(res_rev.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_rev.data['data']['is_verified_purchase'])
        self.assertEqual(res_rev.data['data']['rating'], 5)

        review_id = res_rev.data['data']['id']

        # 3. Public views review list
        self.client.force_authenticate(user=None)
        res_list = self.client.get(f'/api/v1/reviews/products/{self.product.id}/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data['data']), 1)

        # 4. Vendor replies to the review
        self.client.force_authenticate(user=self.vendor_user)
        res_reply = self.client.post(f'/api/v1/reviews/{review_id}/reply/', {
            'reply': 'Thank you Ram! We take immense pride in genuine Nepal craftsmanship.'
        })
        self.assertEqual(res_reply.status_code, status.HTTP_200_OK)
        self.assertIn('Thank you Ram', res_reply.data['data']['vendor_reply'])

    # ------------------------------------------------------------------
    # 3. Notifications Center Tests
    # ------------------------------------------------------------------
    def test_in_app_notifications_lifecycle(self):
        # Create notifications for customer
        Notification.objects.create(
            recipient=self.customer,
            notification_type=NotificationType.ORDER,
            title='Order Dispatched',
            message='Your order #ORD-REV-101 has been dispatched.',
            is_read=False
        )
        Notification.objects.create(
            recipient=self.customer,
            notification_type=NotificationType.PROMOTION,
            title='Dashain Festival Discount',
            message='Use coupon DASHAIN10 for 10% off.',
            is_read=False
        )

        self.client.force_authenticate(user=self.customer)

        # 1. Unread count
        res_count = self.client.get('/api/v1/notifications/unread-count/')
        self.assertEqual(res_count.status_code, status.HTTP_200_OK)
        self.assertEqual(res_count.data['unread_count'], 2)

        # 2. List notifications
        res_list = self.client.get('/api/v1/notifications/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_list.data['data']), 2)

        # 3. Mark all read
        res_all_read = self.client.post('/api/v1/notifications/mark-all-read/')
        self.assertEqual(res_all_read.status_code, status.HTTP_200_OK)
        self.assertEqual(res_all_read.data['count'], 2)

        # Verify count is now 0
        res_count2 = self.client.get('/api/v1/notifications/unread-count/')
        self.assertEqual(res_count2.data['unread_count'], 0)

    # ------------------------------------------------------------------
    # 4. Customer Support Tickets & Helpdesk Tests
    # ------------------------------------------------------------------
    def test_customer_support_ticket_lifecycle(self):
        self.client.force_authenticate(user=self.customer)

        # 1. Customer opens support ticket
        res_create = self.client.post('/api/v1/support/tickets/', {
            'subject': 'Delivery Delay Inquiry',
            'category': TicketCategory.ORDER_ISSUE,
            'priority': 'HIGH',
            'initial_message': 'My package was expected yesterday. Could you check carrier dispatch?'
        })
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        ticket_id = res_create.data['id']
        self.assertTrue(res_create.data['ticket_number'].startswith('TCK-'))

        # 2. Staff replies to the ticket
        self.client.force_authenticate(user=self.admin)
        res_staff_msg = self.client.post(f'/api/v1/support/tickets/{ticket_id}/messages/', {
            'message': 'Hello Ram, courier arrived at Kathmandu distribution hub this morning. Will deliver by 3 PM.'
        })
        self.assertEqual(res_staff_msg.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_staff_msg.data['is_staff_reply'])

        # 3. Customer views full thread
        self.client.force_authenticate(user=self.customer)
        res_thread = self.client.get(f'/api/v1/support/tickets/{ticket_id}/')
        self.assertEqual(res_thread.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_thread.data['messages']), 2)

