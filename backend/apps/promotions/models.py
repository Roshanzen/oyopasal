from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import BaseModel
from apps.orders.models import Order

class CouponDiscountType(models.TextChoices):
    PERCENTAGE = 'PERCENTAGE', 'Percentage Discount'
    FIXED = 'FIXED', 'Fixed Amount Discount (NPR)'


class Coupon(BaseModel):
    code = models.CharField(max_length=40, unique=True, db_index=True)
    description = models.CharField(max_length=255, blank=True)
    discount_type = models.CharField(
        max_length=20,
        choices=CouponDiscountType.choices,
        default=CouponDiscountType.PERCENTAGE
    )
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum discount cap in NPR for percentage coupons"
    )
    min_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Minimum cart subtotal required to apply coupon"
    )
    usage_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Global maximum number of redemptions allowed"
    )
    usage_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    starts_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} ({self.discount_value} {self.discount_type})"

    def is_valid(self, order_amount: Decimal):
        now = timezone.now()
        if not self.is_active:
            return False, "This coupon code is inactive."
        if self.starts_at and now < self.starts_at:
            return False, "This coupon is not yet valid."
        if self.expires_at and now > self.expires_at:
            return False, "This coupon code has expired."
        if self.usage_limit is not None and self.usage_count >= self.usage_limit:
            return False, "This coupon has reached its maximum redemption limit."
        if order_amount < self.min_order_amount:
            return False, f"Minimum order subtotal of NPR {self.min_order_amount} required."
        return True, ""

    def calculate_discount(self, order_amount: Decimal) -> Decimal:
        if order_amount <= Decimal('0.00'):
            return Decimal('0.00')

        if self.discount_type == CouponDiscountType.PERCENTAGE:
            raw_discount = (order_amount * self.discount_value) / Decimal('100.0')
            if self.max_discount_amount is not None:
                return min(raw_discount, self.max_discount_amount)
            return raw_discount
        else: # FIXED
            return min(self.discount_value, order_amount)


class CouponUsage(BaseModel):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coupon_usages')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='coupon_usages')
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['-created_at']


class MarketingPromotion(BaseModel):
    title = models.CharField(max_length=255)
    title_ne = models.CharField(max_length=255, blank=True)
    subtitle = models.CharField(max_length=255, blank=True)
    subtitle_ne = models.CharField(max_length=255, blank=True)
    badge = models.CharField(max_length=100, blank=True)
    badge_ne = models.CharField(max_length=100, blank=True)
    cta_text = models.CharField(max_length=100, default='Shop Now')
    cta_text_ne = models.CharField(max_length=100, blank=True)
    cta_category = models.CharField(max_length=100, blank=True)
    destination_url = models.CharField(max_length=500, blank=True, null=True)
    image = models.CharField(max_length=500)
    code = models.CharField(max_length=50, blank=True)
    color_theme = models.CharField(max_length=50, default='emerald')
    placement = models.CharField(max_length=50, default='hero', db_index=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    starts_at = models.DateTimeField(default=timezone.now, null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.placement})"


class Advertisement(BaseModel):
    title = models.CharField(max_length=255)
    title_ne = models.CharField(max_length=255, blank=True)
    subtitle = models.CharField(max_length=255, blank=True)
    subtitle_ne = models.CharField(max_length=255, blank=True)
    image_url = models.CharField(max_length=500)
    destination_url = models.CharField(max_length=500, default='/')
    placement = models.CharField(max_length=50, default='sidebar', db_index=True)
    priority = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    starts_at = models.DateTimeField(default=timezone.now, null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    clicks_count = models.IntegerField(default=0)
    impressions_count = models.IntegerField(default=0)

    class Meta:
        ordering = ['priority', '-created_at']

    def __str__(self):
        return f"{self.title} ({self.placement})"


