from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import BaseModel
from apps.customers.models import CustomerProfile
from apps.vendors.models import VendorProfile
from apps.stores.models import Store
from apps.catalogue.models import ProductVariant

class OrderStatus(models.TextChoices):
    PENDING_PAYMENT = 'PENDING_PAYMENT', 'Pending Payment'
    PAYMENT_PROCESSING = 'PAYMENT_PROCESSING', 'Payment Processing'
    CONFIRMED = 'CONFIRMED', 'Confirmed'
    PROCESSING = 'PROCESSING', 'Processing'
    PACKED = 'PACKED', 'Packed'
    READY_FOR_DISPATCH = 'READY_FOR_DISPATCH', 'Ready for Dispatch'
    SHIPPED = 'SHIPPED', 'Shipped'
    OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', 'Out for Delivery'
    DELIVERED = 'DELIVERED', 'Delivered'
    CANCELLATION_REQUESTED = 'CANCELLATION_REQUESTED', 'Cancellation Requested'
    CANCELLED = 'CANCELLED', 'Cancelled'
    RETURN_REQUESTED = 'RETURN_REQUESTED', 'Return Requested'
    RETURNED = 'RETURNED', 'Returned'
    REFUND_PENDING = 'REFUND_PENDING', 'Refund Pending'
    REFUNDED = 'REFUNDED', 'Refunded'
    FAILED = 'FAILED', 'Failed'


class Order(BaseModel):
    """
    Parent customer order representing the unified checkout purchase.
    Splits internally into independent VendorSubOrder entities for fulfillment.
    """
    order_number = models.CharField(max_length=50, unique=True, db_index=True)
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='orders'
    )
    status = models.CharField(
        max_length=35,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING_PAYMENT,
        db_index=True
    )
    
    # Financial breakdown
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    delivery_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    tax_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='NPR')

    # Payment
    payment_method = models.CharField(max_length=50, default='COD', help_text='ESEWA, KHALTI, FONEPAY, BANK_TRANSFER, COD')
    payment_status = models.CharField(max_length=30, default='UNPAID', db_index=True)
    
    # Snapshot of shipping and billing destination
    shipping_address_snapshot = models.JSONField(
        default=dict,
        help_text='Immutable snapshot of destination address at time of purchase'
    )
    billing_address_snapshot = models.JSONField(
        default=dict,
        blank=True
    )
    customer_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Marketplace Order'
        verbose_name_plural = 'Marketplace Orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order_number} ({self.get_status_display()}) - NPR {self.grand_total}"


class VendorSubOrder(BaseModel):
    """
    Vendor-specific portion of a parent order.
    Each vendor independently manages packing, dispatch, and delivery of their items.
    """
    parent_order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='suborders'
    )
    sub_order_number = models.CharField(max_length=60, unique=True, db_index=True)
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.PROTECT,
        related_name='suborders'
    )
    store = models.ForeignKey(
        Store,
        on_delete=models.PROTECT,
        related_name='suborders'
    )
    status = models.CharField(
        max_length=35,
        choices=OrderStatus.choices,
        default=OrderStatus.CONFIRMED,
        db_index=True
    )

    # Sub-order Financials
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10.00, help_text='Platform commission rate %')
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    vendor_net_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    # Fulfillment & Tracking
    tracking_number = models.CharField(max_length=100, blank=True)
    delivery_provider = models.CharField(max_length=100, blank=True)
    cancellation_reason = models.TextField(blank=True)
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Vendor Sub-Order'
        verbose_name_plural = 'Vendor Sub-Orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sub_order_number} - {self.vendor.business_name} ({self.get_status_display()})"


class OrderItem(BaseModel):
    """
    Line item purchased inside a vendor sub-order.
    """
    sub_order = models.ForeignKey(
        VendorSubOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.PROTECT,
        related_name='order_items'
    )
    product_name = models.CharField(max_length=255)
    variant_sku = models.CharField(max_length=100)
    attributes_snapshot = models.JSONField(default=dict, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField(default=1)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=13.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    reservation_id = models.UUIDField(null=True, blank=True, help_text='Linked stock reservation UUID')

    class Meta:
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'

    def __str__(self):
        return f"{self.quantity}x {self.product_name} ({self.variant_sku})"


class OrderStatusHistory(BaseModel):
    """
    Immutable audit timeline for parent order and vendor sub-order status transitions.
    """
    order = models.ForeignKey(Order, on_delete=models.CASCADE, null=True, blank=True, related_name='timeline')
    sub_order = models.ForeignKey(VendorSubOrder, on_delete=models.CASCADE, null=True, blank=True, related_name='timeline')
    previous_status = models.CharField(max_length=35)
    new_status = models.CharField(max_length=35)
    remarks = models.TextField(blank=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    class Meta:
        verbose_name = 'Order Status History'
        verbose_name_plural = 'Order Status Histories'
        ordering = ['-created_at']

    def __str__(self):
        target = self.sub_order.sub_order_number if self.sub_order else (self.order.order_number if self.order else 'Order')
        return f"{target}: {self.previous_status} -> {self.new_status}"

