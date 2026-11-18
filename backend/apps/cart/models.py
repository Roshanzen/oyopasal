from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.common.models import BaseModel
from apps.catalogue.models import ProductVariant

class Cart(BaseModel):
    """
    Active customer shopping cart holding items across multiple independent vendors.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='cart'
    )

    class Meta:
        verbose_name = 'Shopping Cart'
        verbose_name_plural = 'Shopping Carts'
        ordering = ['-updated_at']

    def __str__(self):
        return f"Cart of {self.user.email} ({self.total_items} items)"

    @property
    def total_items(self):
        return sum(item.quantity for item in self.items.all())

    @property
    def subtotal(self):
        return sum(item.total_price for item in self.items.all())

    @property
    def vendor_count(self):
        return len(set(item.variant.product.vendor_id for item in self.items.all()))


class CartItem(BaseModel):
    """
    Individual product variant in a customer cart.
    """
    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name='items'
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name='cart_items'
    )
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = 'Cart Item'
        verbose_name_plural = 'Cart Items'
        unique_together = ('cart', 'variant')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.quantity}x {self.variant.sku}"

    @property
    def unit_price(self):
        return self.variant.selling_price

    @property
    def total_price(self):
        return self.unit_price * self.quantity

