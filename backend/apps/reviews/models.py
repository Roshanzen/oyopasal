from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.common.models import BaseModel
from apps.catalogue.models import Product

class ProductReview(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reviews'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='customer_reviews'
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="1 to 5 star rating"
    )
    title = models.CharField(max_length=150, blank=True)
    comment = models.TextField(help_text="Customer textual review feedback")
    is_verified_purchase = models.BooleanField(
        default=False,
        help_text="Whether this customer actually purchased and received this product"
    )
    is_approved = models.BooleanField(default=True, db_index=True)
    vendor_reply = models.TextField(blank=True)
    vendor_replied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'product')

    def __str__(self):
        prod_title = getattr(self.product, 'name', '')
        return f"{self.user.email} - {prod_title} ({self.rating}★)"

