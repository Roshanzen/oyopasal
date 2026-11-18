from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.orders.models import Order, VendorSubOrder, OrderStatus
from apps.payments.models import (
    Payment,
    PaymentStatus,
    FinancialLedgerEntry,
    LedgerEntryType,
    DebitCredit
)
from apps.commissions.models import CommissionRecord
from apps.settlements.models import VendorSettlement, SettlementStatus
from apps.settlements.services import SettlementService
from apps.payments.services import PaymentProcessingService

User = get_user_model()

class PaymentsAndFinanceTests(APITestCase):
    def setUp(self):
        # 1. Users
        self.admin_user = User.objects.create_superuser(
            email='finance.admin@oyopasal.com',
            password='FinanceAdminPass123!'
        )
        self.customer_user = User.objects.create_user(
            email='shopper.np@example.com',
            password='ShopperPass123!',
            role=UserRole.CUSTOMER,
            is_verified=True
        )
        self.vendor_user = User.objects.create_user(
            email='merchant@ktmgear.com',
            password='MerchantPass123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )

        # 2. Vendor & Store
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Kathmandu Adventure Gear',
            slug='ktm-adventure-gear',
            status=VendorStatus.APPROVED,
            commission_rate_override=Decimal('10.00'), # 10%
            bank_name='Nepal Investment Mega Bank',
            bank_account_number='01234567890123'
        )
        self.store = Store.objects.create(
            vendor=self.vendor_profile,
            name='KTM Gear Flagship',
            slug='ktm-gear-flagship'
        )

        # 3. Order & Sub-Order
        self.order = Order.objects.create(
            order_number='ORD-20261031-TEST01',
            customer=self.customer_user,
            status=OrderStatus.PENDING_PAYMENT,
            subtotal=Decimal('10000.00'),
            delivery_total=Decimal('100.00'),
            tax_total=Decimal('1300.00'),
            grand_total=Decimal('11400.00'),
            payment_method='ESEWA',
            payment_status='UNPAID'
        )

        self.sub_order = VendorSubOrder.objects.create(
            parent_order=self.order,
            sub_order_number='SUB-20261031-TEST01-V01',
            vendor=self.vendor_profile,
            store=self.store,
            status=OrderStatus.PENDING_PAYMENT,
            subtotal=Decimal('10000.00'),
            delivery_fee=Decimal('100.00'),
            commission_rate=Decimal('10.00'),
            commission_amount=Decimal('1000.00'),
            vendor_net_amount=Decimal('9000.00')
        )

    def test_payment_initiation_esewa(self):
        """Verify initiating payment returns eSewa v2 signature and action parameters."""
        self.client.force_authenticate(user=self.customer_user)
        init_url = reverse('payments:initiate_payment')

        payload = {
            'order_id': str(self.order.id),
            'provider': 'ESEWA',
            'return_url': 'https://oyopasal.com/checkout/success'
        }
        response = self.client.post(init_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        gateway_data = response.data['data']['gateway_data']
        self.assertEqual(gateway_data['provider'], 'ESEWA')
        self.assertIn('signature', gateway_data['fields'])
        self.assertEqual(gateway_data['fields']['total_amount'], '11400.00')

        # Verify Payment model record created
        payment = Payment.objects.get(transaction_reference=response.data['data']['transaction_reference'])
        self.assertEqual(payment.status, PaymentStatus.INITIATED)
        self.assertEqual(payment.amount, Decimal('11400.00'))

    def test_payment_verification_and_financial_ledger(self):
        """
        Verify payment verification:
        1. Updates payment status to SUCCESS.
        2. Sets Order payment_status = PAID and advances status to CONFIRMED.
        3. Creates CommissionRecord for suborder.
        4. Logs double-entry ledger rows (Customer Payment debit, Vendor Payable credit, Commission credit).
        """
        init_res = PaymentProcessingService.initiate_order_payment(
            order=self.order,
            provider='ESEWA'
        )
        txn_ref = init_res['transaction_reference']

        verify_url = reverse('payments:verify_payment')
        callback_payload = {
            'transaction_reference': txn_ref,
            'callback_data': {
                'transaction_code': 'ESEWA_TXN_998877',
                'status': 'COMPLETE'
            }
        }

        response = self.client.post(verify_url, callback_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        payment = Payment.objects.get(transaction_reference=txn_ref)
        self.assertEqual(payment.status, PaymentStatus.SUCCESS)
        self.assertEqual(payment.gateway_reference, 'ESEWA_TXN_998877')

        # Verify Order updated
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')
        self.assertEqual(self.order.status, OrderStatus.CONFIRMED)

        # Verify Commission Record created
        commission_rec = CommissionRecord.objects.get(sub_order=self.sub_order)
        self.assertEqual(commission_rec.commission_amount, Decimal('1000.00'))
        self.assertEqual(commission_rec.net_vendor_earning, Decimal('9000.00'))
        self.assertFalse(commission_rec.is_settled)

        # Verify Financial Ledger Entries
        entries = FinancialLedgerEntry.objects.filter(order=self.order)
        # Should have: Customer Inflow (11400), Vendor Payable (9000), Commission (1000), Tax (1300)
        inflow = entries.get(entry_type=LedgerEntryType.CUSTOMER_PAYMENT)
        self.assertEqual(inflow.amount, Decimal('11400.00'))
        self.assertEqual(inflow.direction, DebitCredit.DEBIT)

        vendor_payable = entries.get(entry_type=LedgerEntryType.VENDOR_PAYABLE)
        self.assertEqual(vendor_payable.amount, Decimal('9000.00'))
        self.assertEqual(vendor_payable.direction, DebitCredit.CREDIT)

        comm_entry = entries.get(entry_type=LedgerEntryType.PLATFORM_COMMISSION)
        self.assertEqual(comm_entry.amount, Decimal('1000.00'))
        self.assertEqual(comm_entry.direction, DebitCredit.CREDIT)

    def test_payment_idempotency_protection(self):
        """Verify calling verify callback repeatedly does not duplicate financial ledger records."""
        init_res = PaymentProcessingService.initiate_order_payment(order=self.order, provider='ESEWA')
        txn_ref = init_res['transaction_reference']

        callback_payload = {
            'transaction_reference': txn_ref,
            'callback_data': {'transaction_code': 'ESEWA_IDEM_111'}
        }
        verify_url = reverse('payments:verify_payment')

        # First verification
        self.client.post(verify_url, callback_payload, format='json')
        initial_ledger_count = FinancialLedgerEntry.objects.filter(order=self.order).count()

        # Duplicate webhook callback from payment provider
        dup_res = self.client.post(verify_url, callback_payload, format='json')
        self.assertEqual(dup_res.status_code, status.HTTP_200_OK)

        # Ledger count must remain identical!
        second_ledger_count = FinancialLedgerEntry.objects.filter(order=self.order).count()
        self.assertEqual(initial_ledger_count, second_ledger_count)

    def test_vendor_settlement_generation_and_payout(self):
        """
        Verify settlement workflow:
        1. Suborder is delivered and commission recorded.
        2. Admin generates settlement batch for vendor.
        3. Commission record is marked settled.
        4. Admin marks settlement as PAID with bank reference.
        5. Settlement payout is debited in financial ledger.
        """
        # Mark suborder as delivered & create commission record
        self.sub_order.status = OrderStatus.DELIVERED
        self.sub_order.save()

        CommissionRecord.objects.create(
            sub_order=self.sub_order,
            gross_amount=self.sub_order.subtotal,
            commission_rate=Decimal('10.00'),
            commission_amount=Decimal('1000.00'),
            net_vendor_earning=Decimal('9000.00'),
            is_settled=False
        )

        # Step 1: Admin generates settlement batch
        self.client.force_authenticate(user=self.admin_user)
        gen_url = reverse('settlements:admin_generate_settlement')
        gen_res = self.client.post(gen_url, {'vendor_id': str(self.vendor_profile.id)})
        self.assertEqual(gen_res.status_code, status.HTTP_201_CREATED)

        settlement_id = gen_res.data['data']['id']
        settlement = VendorSettlement.objects.get(id=settlement_id)
        self.assertEqual(settlement.status, SettlementStatus.APPROVED)
        self.assertEqual(settlement.net_payout, Decimal('9000.00'))

        # Verify commission record marked as settled
        rec = CommissionRecord.objects.get(sub_order=self.sub_order)
        self.assertTrue(rec.is_settled)

        # Step 2: Vendor views their settlement
        self.client.force_authenticate(user=self.vendor_user)
        vendor_settle_url = reverse('settlements:vendor_settlement_list')
        vendor_res = self.client.get(vendor_settle_url)
        self.assertEqual(vendor_res.status_code, status.HTTP_200_OK)
        self.assertEqual(vendor_res.data['meta']['total_count'], 1)

        # Step 3: Admin records bank payout
        self.client.force_authenticate(user=self.admin_user)
        paid_url = reverse('settlements:admin_mark_settlement_paid', kwargs={'id': settlement.id})
        paid_res = self.client.post(paid_url, {'bank_reference': 'NIMB-FT-884920'})
        self.assertEqual(paid_res.status_code, status.HTTP_200_OK)

        settlement.refresh_from_db()
        self.assertEqual(settlement.status, SettlementStatus.PAID)
        self.assertEqual(settlement.bank_reference, 'NIMB-FT-884920')
        self.assertIsNotNone(settlement.paid_at)

        # Verify payout debit recorded in Financial Ledger
        payout_entry = FinancialLedgerEntry.objects.filter(
            entry_type=LedgerEntryType.SETTLEMENT_PAYOUT,
            reference_id=settlement.settlement_number
        ).first()
        self.assertIsNotNone(payout_entry)
        self.assertEqual(payout_entry.amount, Decimal('9000.00'))
        self.assertEqual(payout_entry.direction, DebitCredit.DEBIT)

