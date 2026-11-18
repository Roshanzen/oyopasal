from django.db import models
from django.conf import settings
from apps.common.models import BaseModel
from apps.orders.models import Order, VendorSubOrder

class RefundStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Admin Review'
    APPROVED = 'APPROVED', 'Approved'
    PROCESSED = 'PROCESSED', 'Refund Dispatched'
    REJECTED = 'REJECTED', 'Refund Request Rejected'


class Refund(BaseModel):
    """
    Customer refund request and processing record.
    """
    refund_number = models.CharField(max_length=60, unique=True, db_index=True)
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='refunds'
    )
    sub_order = models.ForeignKey(
        VendorSubOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='refunds'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='refunds'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(
        max_length=25,
        choices=RefundStatus.choices,
        default=RefundStatus.PENDING,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='processed_refunds'
    )
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Refund'
        verbose_name_plural = 'Refunds'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.refund_number}: NPR {self.amount} for {self.order.order_number} [{self.get_status_display()}]"

