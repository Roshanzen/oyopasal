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

