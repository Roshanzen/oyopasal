from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class NotificationType(models.TextChoices):
    ORDER = 'ORDER', 'Order & Fulfillment'
    KYC = 'KYC', 'KYC & Verification'
    SETTLEMENT = 'SETTLEMENT', 'Settlement & Finance'
    PROMOTION = 'PROMOTION', 'Promotions & Discounts'
    SUPPORT = 'SUPPORT', 'Customer Support Ticket'
    SYSTEM = 'SYSTEM', 'System Alert'


class Notification(BaseModel):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    notification_type = models.CharField(
        max_length=25,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        db_index=True
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False, db_index=True)
    action_url = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.notification_type}] {self.recipient.email} - {self.title}"


class VendorOrderNotificationLog(BaseModel):
    """
    Auditable log and duplicate prevention guard for vendor order email notifications.
    Tracks delivery state, recipient, suborder details, and safe retry telemetry.
    """
    class NotificationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending Delivery'
        SENT = 'SENT', 'Sent Successfully'
        FAILED = 'FAILED', 'Failed Delivery'

    idempotency_key = models.CharField(max_length=150, unique=True, db_index=True)
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        related_name='vendor_notification_logs'
    )
    sub_order = models.ForeignKey(
        'orders.VendorSubOrder',
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )
    vendor = models.ForeignKey(
        'vendors.VendorProfile',
        on_delete=models.CASCADE,
        related_name='order_notification_logs'
    )
    store = models.ForeignKey(
        'stores.Store',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_notification_logs'
    )
    recipient_email = models.EmailField(db_index=True)
    sender_email = models.CharField(max_length=255, default='notifications@oyopasal.com')
    subject = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=NotificationStatus.choices,
        default=NotificationStatus.PENDING,
        db_index=True
    )
    items_count = models.PositiveIntegerField(default=0)
    vendor_subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sent_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    provider_response = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Vendor Order Notification Log'
        verbose_name_plural = 'Vendor Order Notification Logs'
        ordering = ['-created_at']

    def __str__(self):
        order_num = getattr(self.order, 'order_number', 'ORD')
        vendor_name = getattr(self.vendor, 'business_name', 'Vendor')
        return f"[{self.status}] {order_num} -> {vendor_name} ({self.recipient_email})"


