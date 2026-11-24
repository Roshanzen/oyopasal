import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import BaseModel, SoftDeletableModel
from apps.vendors.models import VendorProfile
from apps.stores.models import Store
from apps.catalogue.models import Product


class Conversation(BaseModel, SoftDeletableModel):
    """
    Direct in-platform conversation channel between a Customer and a Vendor/Store.
    Guarantees unique 1-to-1 conversation per customer, vendor, and store context.
    """
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_conversations',
        db_index=True
    )
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.CASCADE,
        related_name='vendor_conversations',
        db_index=True
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='store_conversations',
        db_index=True
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='product_conversations'
    )
    
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_message_preview = models.CharField(max_length=255, blank=True, default='')
    last_message_sender_role = models.CharField(max_length=20, blank=True, default='')
    
    customer_unread_count = models.PositiveIntegerField(default=0)
    vendor_unread_count = models.PositiveIntegerField(default=0)

    is_archived_by_customer = models.BooleanField(default=False)
    is_archived_by_vendor = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Conversation'
        verbose_name_plural = 'Conversations'
        ordering = ['-last_message_at']
        constraints = [
            models.UniqueConstraint(
                fields=['customer', 'vendor', 'store'],
                name='unique_customer_vendor_store_conversation'
            )
        ]
        indexes = [
            models.Index(fields=['customer', '-last_message_at']),
            models.Index(fields=['vendor', '-last_message_at']),
        ]

    def __str__(self):
        store_name = self.store.name if self.store else self.vendor.business_name
        return f"Chat: {self.customer.email} <-> {store_name}"


class Message(BaseModel, SoftDeletableModel):
    """
    Persisted chat message between customer and vendor.
    """
    class SenderRole(models.TextChoices):
        CUSTOMER = 'CUSTOMER', 'Customer'
        VENDOR = 'VENDOR', 'Vendor'
        SYSTEM = 'SYSTEM', 'System'

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    sender_role = models.CharField(
        max_length=20,
        choices=SenderRole.choices,
        default=SenderRole.CUSTOMER,
        db_index=True
    )
    content = models.TextField()
    attachment_url = models.URLField(max_length=500, blank=True, null=True)
    
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['conversation', 'is_read']),
        ]

    def __str__(self):
        return f"[{self.sender_role}] {self.content[:30]}..."
