from django.db import models
from django.conf import settings
from apps.common.models import BaseModel
from apps.orders.models import Order, VendorSubOrder
from apps.vendors.models import VendorProfile

class PaymentProvider(models.TextChoices):
    ESEWA = 'ESEWA', 'eSewa Mobile Wallet'
    KHALTI = 'KHALTI', 'Khalti Payment Gateway'
    FONEPAY = 'FONEPAY', 'Fonepay QR / Direct'
    BANK_TRANSFER = 'BANK_TRANSFER', 'Direct Bank Transfer / ConnectIPS'
    COD = 'COD', 'Cash on Delivery'


class PaymentStatus(models.TextChoices):
    INITIATED = 'INITIATED', 'Initiated'
    PENDING = 'PENDING', 'Pending Verification'
    SUCCESS = 'SUCCESS', 'Payment Successful'
    FAILED = 'FAILED', 'Payment Failed'
    REFUNDED = 'REFUNDED', 'Refunded'


class Payment(BaseModel):
    """
    Payment transaction record for an Order.
    Stores gateway references, raw verification responses, and idempotency tokens.
    """
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    provider = models.CharField(
        max_length=30,
        choices=PaymentProvider.choices,
        default=PaymentProvider.COD,
        db_index=True
    )
    status = models.CharField(
        max_length=30,
        choices=PaymentStatus.choices,
        default=PaymentStatus.INITIATED,
        db_index=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='NPR')

    transaction_reference = models.CharField(max_length=120, unique=True, db_index=True)
    gateway_reference = models.CharField(max_length=150, blank=True, db_index=True)
    gateway_payload = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=120, unique=True, db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.provider} [{self.get_status_display()}]: NPR {self.amount} for {self.order.order_number}"


class LedgerEntryType(models.TextChoices):
    CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT', 'Customer Payment Inflow'
    VENDOR_PAYABLE = 'VENDOR_PAYABLE', 'Vendor Payable Credit'
    PLATFORM_COMMISSION = 'PLATFORM_COMMISSION', 'Platform Commission Revenue'
    DELIVERY_FEE = 'DELIVERY_FEE', 'Delivery Fee Collected'
    TAX = 'TAX', 'Tax / VAT Collected'
    REFUND = 'REFUND', 'Customer Refund Outflow'
    SETTLEMENT_PAYOUT = 'SETTLEMENT_PAYOUT', 'Vendor Settlement Payout'


class DebitCredit(models.TextChoices):
    DEBIT = 'DEBIT', 'Debit'
    CREDIT = 'CREDIT', 'Credit'


class FinancialLedgerEntry(BaseModel):
    """
    Double-entry auditable financial ledger.
    Every financial event in Oyo Pasal produces strict ledger entries for reconciliation.
    """
    entry_type = models.CharField(
        max_length=40,
        choices=LedgerEntryType.choices,
        db_index=True
    )
    direction = models.CharField(
        max_length=10,
        choices=DebitCredit.choices
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    sub_order = models.ForeignKey(VendorSubOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='ledger_entries')
    
    reference_id = models.CharField(max_length=120, db_index=True)
    description = models.CharField(max_length=255)

    class Meta:
        verbose_name = 'Financial Ledger Entry'
        verbose_name_plural = 'Financial Ledger Entries'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.direction}] {self.entry_type}: NPR {self.amount} - {self.description}"

