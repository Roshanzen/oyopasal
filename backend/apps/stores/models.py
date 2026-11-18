from django.db import models
from django.utils.text import slugify
from apps.common.models import BaseModel, SoftDeletableModel
from apps.vendors.models import VendorProfile

class Store(BaseModel, SoftDeletableModel):
    """
    Physical or digital storefront owned by a verified vendor.
    Vendors can operate one or multiple stores depending on their SaaS plan.
    """
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.CASCADE,
        related_name='stores'
    )
    name = models.CharField(max_length=255, db_index=True)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    description = models.TextField(blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    banner_url = models.URLField(max_length=500, blank=True)
    
    # Contact Details
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    
    # Store Policies & Hours
    business_hours = models.JSONField(
        default=dict,
        blank=True,
        help_text='Opening hours per day e.g. {"sunday": "09:00-18:00", ...}'
    )
    shipping_policy = models.TextField(blank=True)
    return_policy = models.TextField(blank=True)
    
    # Status
    is_active = models.BooleanField(default=True, db_index=True)
    is_verified = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Store'
        verbose_name_plural = 'Stores'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.vendor.business_name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or str(self.id)[:8]
            slug = base_slug
            counter = 1
            while Store.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

