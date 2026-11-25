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
    store_name = models.CharField(max_length=255, blank=True, help_text="Display store name")
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    description = models.TextField(blank=True)
    short_description = models.CharField(max_length=220, blank=True, help_text="Short store summary (max 220 chars)")
    logo_url = models.URLField(max_length=500, blank=True)
    banner_url = models.URLField(max_length=500, blank=True)
    logo = models.ImageField(upload_to='stores/logos/', null=True, blank=True)
    cover_banner = models.ImageField(upload_to='stores/banners/', null=True, blank=True)
    
    # Contact Details
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    area_ward = models.CharField(max_length=255, blank=True, help_text="Store location area / ward")
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    max_local_delivery_km = models.FloatField(default=15.0, help_text="Maximum local express delivery radius in km")
    
    # Store Policies & Hours
    opening_time = models.TimeField(null=True, blank=True, help_text="Daily opening time")
    closing_time = models.TimeField(null=True, blank=True, help_text="Daily closing time")
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
        if self.store_name and not self.name:
            self.name = self.store_name
        elif self.name and not self.store_name:
            self.store_name = self.name

        if self.short_description and not self.description:
            self.description = self.short_description
        elif self.description and not self.short_description:
            self.short_description = self.description[:220]

        if self.area_ward and not self.address:
            self.address = self.area_ward
        elif self.address and not self.area_ward:
            self.area_ward = self.address

        if self.logo and hasattr(self.logo, 'url'):
            try:
                self.logo_url = self.logo.url
            except Exception:
                pass
        if self.cover_banner and hasattr(self.cover_banner, 'url'):
            try:
                self.banner_url = self.cover_banner.url
            except Exception:
                pass

        if not self.slug:
            base_slug = slugify(self.name) or str(self.id)[:8]
            slug = base_slug
            counter = 1
            while Store.objects.filter(slug=slug).exclude(id=self.id).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)

        # Ensure vendor status stays in sync with store verification
        if self.is_verified and self.vendor_id:
            try:
                from apps.vendors.models import VendorProfile, VendorStatus
                vendor = getattr(self, 'vendor', None)
                if vendor and vendor.status != VendorStatus.APPROVED:
                    VendorProfile.objects.filter(id=self.vendor_id).update(status=VendorStatus.APPROVED)
            except Exception:
                pass


class StoreGalleryImage(BaseModel):
    """
    Gallery photo showcasing store facilities, storefront, and products (max 9 images per store).
    """
    store = models.ForeignKey(
        Store,
        on_delete=models.CASCADE,
        related_name='gallery_images'
    )
    image = models.ImageField(upload_to='stores/gallery/', null=True, blank=True)
    image_url = models.URLField(max_length=500, blank=True)
    caption = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Store Gallery Image'
        verbose_name_plural = 'Store Gallery Images'
        ordering = ['sort_order', 'created_at']

    def __str__(self):
        return f"{self.store.name} - Gallery #{self.id}"

    def save(self, *args, **kwargs):
        if self.image and hasattr(self.image, 'url'):
            try:
                self.image_url = self.image.url
            except Exception:
                pass
        super().save(*args, **kwargs)


