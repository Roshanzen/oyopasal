from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import BaseModel
from apps.vendors.models import VendorProfile
from apps.orders.models import VendorSubOrder

class SettlementStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved for Payout'
    PAID = 'PAID', 'Settlement Paid'
    HELD = 'HELD', 'On Hold (Escrow / Dispute)'
    DISPUTED = 'DISPUTED', 'Disputed'


class VendorSettlement(BaseModel):
    """
    Vendor payout batch consolidating multiple delivered sub-orders after escrow clearance.
    """
    settlement_number = models.CharField(max_length=60, unique=True, db_index=True)
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.PROTECT,
        related_name='settlements'
    )
    status = models.CharField(
        max_length=25,
        choices=SettlementStatus.choices,
        default=SettlementStatus.PENDING,
        db_index=True
    )
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2)
    platform_commission = models.DecimalField(max_digits=12, decimal_places=2)
    net_payout = models.DecimalField(max_digits=12, decimal_places=2)
    bank_reference = models.CharField(max_length=120, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = 'Vendor Settlement'
        verbose_name_plural = 'Vendor Settlements'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.settlement_number} - {self.vendor.business_name}: NPR {self.net_payout} [{self.get_status_display()}]"


class SettlementItem(BaseModel):
    """
    Individual sub-order included in a settlement batch.
    """
    settlement = models.ForeignKey(
        VendorSettlement,
        on_delete=models.CASCADE,
        related_name='items'
    )
    sub_order = models.OneToOneField(
        VendorSubOrder,
        on_delete=models.PROTECT,
        related_name='settlement_item'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = 'Settlement Item'
        verbose_name_plural = 'Settlement Items'

    def __str__(self):
        return f"{self.sub_order.sub_order_number} in {self.settlement.settlement_number}"

