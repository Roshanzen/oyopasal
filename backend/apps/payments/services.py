import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.orders.models import Order, OrderStatus, OrderStatusHistory
from apps.payments.models import (
    Payment,
    PaymentStatus,
    PaymentProvider,
    FinancialLedgerEntry,
    LedgerEntryType,
    DebitCredit
)
from apps.commissions.models import CommissionRecord, CommissionRule
from apps.payments.gateways import PaymentGatewayFactory

class PaymentProcessingService:
    @classmethod
    @transaction.atomic
    def initiate_order_payment(cls, order: Order, provider: str, return_url: str = 'http://localhost:3000/checkout/success') -> dict:
        """
        Initializes a payment session for an order, storing transaction references
        and returning provider parameters (e.g. form fields or checkout URLs).
        """
        transaction_ref = f"TXN-{timezone.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        idempotency_key = f"IDEM-{order.order_number}-{provider}"

        # Get or create payment record
        payment, created = Payment.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                'order': order,
                'provider': provider,
                'status': PaymentStatus.INITIATED,
                'amount': order.grand_total,
                'currency': order.currency,
                'transaction_reference': transaction_ref,
            }
        )

        gateway = PaymentGatewayFactory.get_gateway(provider)
        init_payload = gateway.initiate(payment, return_url)

        return {
            'payment_id': str(payment.id),
            'transaction_reference': payment.transaction_reference,
            'status': payment.status,
            'gateway_data': init_payload
        }

    @classmethod
    @transaction.atomic
    def verify_order_payment(cls, transaction_reference: str, callback_data: dict) -> Payment:
        """
        Server-side payment verification.
        Applies idempotency protection, records commission ledgers,
        and generates auditable financial entries.
        """
        payment = Payment.objects.select_for_update().get(transaction_reference=transaction_reference)

        # Idempotency guard: If already confirmed, return without duplicate ledger credits
        if payment.status == PaymentStatus.SUCCESS:
            return payment

        gateway = PaymentGatewayFactory.get_gateway(payment.provider)
        verification_result = gateway.verify(payment, callback_data)

        if not verification_result.get('is_valid', False):
            payment.status = PaymentStatus.FAILED
            payment.gateway_payload = callback_data
            payment.save(update_fields=['status', 'gateway_payload', 'updated_at'])
            return payment

        # Mark Payment Success
        payment.status = PaymentStatus.SUCCESS
        payment.gateway_reference = verification_result.get('gateway_reference', '')
        payment.gateway_payload = callback_data
        payment.verified_at = timezone.now()
        payment.save(update_fields=['status', 'gateway_reference', 'gateway_payload', 'verified_at', 'updated_at'])

        # Update Parent Order
        order = payment.order
        order.payment_status = 'PAID'
        order.payment_method = payment.provider
        if order.status in [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_PROCESSING]:
            order.status = OrderStatus.CONFIRMED
        order.save(update_fields=['payment_status', 'payment_method', 'status', 'updated_at'])

        # Create Ledger Entry for Customer Inflow
        FinancialLedgerEntry.objects.create(
            entry_type=LedgerEntryType.CUSTOMER_PAYMENT,
            direction=DebitCredit.DEBIT,
            amount=payment.amount,
            order=order,
            reference_id=payment.transaction_reference,
            description=f"Customer inflow received via {payment.provider} for Order {order.order_number}"
        )

        # Process SubOrders, Commissions, and Vendor Payables
        for sub_order in order.suborders.all():
            if sub_order.status in [OrderStatus.PENDING_PAYMENT, OrderStatus.PAYMENT_PROCESSING]:
                sub_order.status = OrderStatus.CONFIRMED
                sub_order.save(update_fields=['status', 'updated_at'])

            # Create or update CommissionRecord
            commission_rec, _ = CommissionRecord.objects.get_or_create(
                sub_order=sub_order,
                defaults={
                    'gross_amount': sub_order.subtotal,
                    'commission_rate': sub_order.commission_rate,
                    'commission_amount': sub_order.commission_amount,
                    'net_vendor_earning': sub_order.vendor_net_amount,
                    'is_settled': False
                }
            )

            # Ledger: Vendor Payable (Credit to vendor)
            FinancialLedgerEntry.objects.create(
                entry_type=LedgerEntryType.VENDOR_PAYABLE,
                direction=DebitCredit.CREDIT,
                amount=sub_order.vendor_net_amount,
                order=order,
                sub_order=sub_order,
                vendor=sub_order.vendor,
                reference_id=sub_order.sub_order_number,
                description=f"Net earnings payable to {sub_order.vendor.business_name}"
            )

            # Ledger: Platform Commission (Credit to platform)
            FinancialLedgerEntry.objects.create(
                entry_type=LedgerEntryType.PLATFORM_COMMISSION,
                direction=DebitCredit.CREDIT,
                amount=sub_order.commission_amount,
                order=order,
                sub_order=sub_order,
                reference_id=sub_order.sub_order_number,
                description=f"Platform commission on SubOrder {sub_order.sub_order_number}"
            )

        # Ledger: Tax Collected
        if order.tax_total > 0:
            FinancialLedgerEntry.objects.create(
                entry_type=LedgerEntryType.TAX,
                direction=DebitCredit.CREDIT,
                amount=order.tax_total,
                order=order,
                reference_id=order.order_number,
                description=f"VAT / Tax collected on Order {order.order_number}"
            )

        # Order timeline
        OrderStatusHistory.objects.create(
            order=order,
            previous_status='UNPAID',
            new_status='PAID',
            remarks=f"Payment verified successfully via {payment.provider}. Ref: {payment.gateway_reference}"
        )

        return payment

