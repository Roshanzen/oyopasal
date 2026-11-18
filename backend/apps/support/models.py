import uuid
from django.db import models
from django.conf import settings
from apps.common.models import BaseModel
from apps.orders.models import Order

class TicketCategory(models.TextChoices):
    ORDER_ISSUE = 'ORDER_ISSUE', 'Order / Delivery Delay'
    PAYMENT = 'PAYMENT', 'Payment / Refund Issue'
    RETURN_REFUND = 'RETURN_REFUND', 'Product Return / Exchange'
    VENDOR_DISPUTE = 'VENDOR_DISPUTE', 'Vendor / Store Dispute'
    TECHNICAL = 'TECHNICAL', 'Technical / Bug Report'
    GENERAL = 'GENERAL', 'General Inquiry'


class TicketPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    URGENT = 'URGENT', 'Urgent'


class TicketStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
    RESOLVED = 'RESOLVED', 'Resolved'
    CLOSED = 'CLOSED', 'Closed'


class SupportTicket(BaseModel):
    ticket_number = models.CharField(max_length=50, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='support_tickets',
        db_index=True
    )
    subject = models.CharField(max_length=200)
    category = models.CharField(
        max_length=30,
        choices=TicketCategory.choices,
        default=TicketCategory.GENERAL
    )
    priority = models.CharField(
        max_length=20,
        choices=TicketPriority.choices,
        default=TicketPriority.MEDIUM
    )
    status = models.CharField(
        max_length=20,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN,
        db_index=True
    )
    related_order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='support_tickets'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tickets'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket_number} - {self.subject} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            self.ticket_number = f"TCK-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class TicketMessage(BaseModel):
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ticket_messages'
    )
    message = models.TextField()
    attachment_url = models.CharField(max_length=500, blank=True)
    is_staff_reply = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Msg by {self.sender.email} on {self.ticket.ticket_number}"

