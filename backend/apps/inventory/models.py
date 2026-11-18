from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import BaseModel
from apps.warehouse.models import Warehouse
from apps.catalogue.models import ProductVariant

class StockMovementType(models.TextChoices):
    INCOMING = 'INCOMING', 'Incoming Supplier Receipt / Restock'
    RESERVATION = 'RESERVATION', 'Checkout Stock Reservation'
    RESERVATION_RELEASE = 'RESERVATION_RELEASE', 'Checkout Reservation Released'
    DISPATCH = 'DISPATCH', 'Order Fulfillment Dispatch'
    ADJUSTMENT = 'ADJUSTMENT', 'Manual Inventory Adjustment'
    TRANSFER_OUT = 'TRANSFER_OUT', 'Stock Transfer Outbound'
    TRANSFER_IN = 'TRANSFER_IN', 'Stock Transfer Inbound'
    DAMAGED = 'DAMAGED', 'Damaged / Write-off'
    RETURN_RESTOCK = 'RETURN_RESTOCK', 'Customer Return Restock'


class InventoryItem(BaseModel):
    """
    Physical stock record of a product variant stored inside a specific warehouse.
    Tracks on-hand units, actively reserved units, and reorder safety thresholds.
    """
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name='inventory_items'
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name='inventory_records'
    )
    quantity_on_hand = models.IntegerField(default=0, help_text='Total physical units in warehouse')
    quantity_reserved = models.IntegerField(default=0, help_text='Units held in active checkouts/unfulfilled orders')
    reorder_threshold = models.PositiveIntegerField(default=5, help_text='Threshold below which low-stock warning triggers')
    safety_stock = models.PositiveIntegerField(default=0, help_text='Buffer quantity reserved against unexpected surges')

    class Meta:
        verbose_name = 'Inventory Item'
        verbose_name_plural = 'Inventory Items'
        unique_together = ('warehouse', 'variant')
        ordering = ['warehouse', 'variant']

    def __str__(self):
        return f"{self.variant.sku} @ {self.warehouse.code} (Avail: {self.quantity_available})"

    @property
    def quantity_available(self):
        """Available quantity sellable to shoppers without overselling."""
        return max(0, self.quantity_on_hand - self.quantity_reserved)

    @property
    def is_low_stock(self):
        """Evaluates whether current available units have breached reorder thresholds."""
        return self.quantity_available <= self.reorder_threshold


class StockMovement(BaseModel):
    """
    Immutable audit ledger recording every change in inventory units.
    """
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name='movements'
    )
    movement_type = models.CharField(
        max_length=30,
        choices=StockMovementType.choices,
        db_index=True
    )
    quantity = models.IntegerField(help_text='Quantity delta (positive or negative)')
    balance_after = models.IntegerField(help_text='Resulting physical on-hand balance after change')
    reference_id = models.CharField(
        max_length=120,
        blank=True,
        db_index=True,
        help_text='External reference (e.g. Order ID, PO ID, Return ID)'
    )
    notes = models.TextField(blank=True, help_text='Reason or operational remarks')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements'
    )

    class Meta:
        verbose_name = 'Stock Movement'
        verbose_name_plural = 'Stock Movements'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.movement_type} ({self.quantity}) -> Bal: {self.balance_after} [{self.inventory_item.variant.sku}]"


class StockReservation(BaseModel):
    """
    Time-limited hold placed on inventory units while customer is completing checkout.
    Expires automatically if payment is not completed within TTL (e.g., 15 minutes).
    """
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name='reservations'
    )
    session_id = models.CharField(max_length=120, db_index=True, help_text='Cart session or checkout token')
    quantity = models.PositiveIntegerField()
    expires_at = models.DateTimeField(db_index=True)
    is_released = models.BooleanField(default=False, db_index=True)
    is_committed = models.BooleanField(default=False, db_index=True)

    class Meta:
        verbose_name = 'Stock Reservation'
        verbose_name_plural = 'Stock Reservations'
        ordering = ['-created_at']

    def __str__(self):
        status_label = 'Committed' if self.is_committed else ('Released' if self.is_released else 'Active')
        return f"Hold {self.quantity} of {self.inventory_item.variant.sku} [{status_label}]"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at and not self.is_committed and not self.is_released

