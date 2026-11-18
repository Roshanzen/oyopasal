from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.orders.models import Order, OrderStatus
from apps.payments.models import FinancialLedgerEntry, LedgerEntryType
from apps.refunds.models import Refund, RefundStatus

User = get_user_model()

class RefundFlowIntegrationTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            email='customer@oyopasal.com',
            password='CustomerPass123!',
            role=UserRole.CUSTOMER,
            is_verified=True
        )
        self.superadmin = User.objects.create_user(
            email='admin@oyopasal.com',
            password='AdminPass123!',
            role=UserRole.SUPER_ADMIN,
            is_staff=True,
            is_superuser=True
        )
        self.order = Order.objects.create(
            customer=self.customer,
            order_number='ORD-TEST-REFUND-1',
            status=OrderStatus.DELIVERED,
            subtotal=Decimal('2500.00'),
            delivery_total=Decimal('100.00'),
            tax_total=Decimal('0.00'),
            grand_total=Decimal('2600.00'),
            payment_method='COD',
            payment_status='PAID',
            shipping_address_snapshot={
                'province': 'Bagmati',
                'district': 'Kathmandu',
                'municipality': 'Kathmandu Metropolitan',
                'ward': 3,
                'tole': 'Lazimpat'
            }
        )

    def test_customer_can_request_refund(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/v1/refunds/request/', {
            'order_id': str(self.order.id),
            'amount': 2600.00,
            'reason': 'Item damaged upon delivery'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['status'], 'PENDING')

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.RETURN_REQUESTED)

    def test_admin_can_approve_refund(self):
        refund = Refund.objects.create(
            refund_number='REF-TEST-999',
            order=self.order,
            customer=self.customer,
            amount=Decimal('2600.00'),
            reason='Defective product',
            status=RefundStatus.PENDING
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(f'/api/v1/refunds/admin/{refund.id}/action/', {
            'action': 'APPROVE'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        refund.refresh_from_db()
        self.assertEqual(refund.status, RefundStatus.APPROVED)
        self.assertEqual(refund.processed_by, self.superadmin)

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.REFUNDED)

        # Check ledger entry created
        ledger_entry = FinancialLedgerEntry.objects.filter(
            entry_type=LedgerEntryType.REFUND,
            order=self.order
        ).first()
        self.assertIsNotNone(ledger_entry)
        self.assertEqual(ledger_entry.amount, Decimal('2600.00'))
