from django.db import models
from django.conf import settings
from apps.common.models import BaseModel

class CustomerProfile(BaseModel):
    """Profile extension for individual marketplace shoppers."""
    GENDER_CHOICES = (
        ('MALE', 'Male'),
        ('FEMALE', 'Female'),
        ('OTHER', 'Other'),
        ('UNSPECIFIED', 'Prefer not to say'),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_profile'
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, choices=GENDER_CHOICES, default='UNSPECIFIED')
    loyalty_points = models.PositiveIntegerField(default=0)
    is_phone_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"Customer: {self.user.email}"


class NepalProvince(models.TextChoices):
    KOSHI = 'KOSHI', 'Koshi Province'
    MADHESH = 'MADHESH', 'Madhesh Province'
    BAGMATI = 'BAGMATI', 'Bagmati Province'
    GANDAKI = 'GANDAKI', 'Gandaki Province'
    LUMBINI = 'LUMBINI', 'Lumbini Province'
    KARNALI = 'KARNALI', 'Karnali Province'
    SUDURPASHCHIM = 'SUDURPASHCHIM', 'Sudurpashchim Province'


class Address(BaseModel):
    """
    Standardized multi-tier delivery address supporting Nepal administrative divisions
    as well as international address layouts.
    """
    customer = models.ForeignKey(
        CustomerProfile,
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    recipient_name = models.CharField(max_length=150)
    recipient_phone = models.CharField(max_length=20)
    province = models.CharField(max_length=50, choices=NepalProvince.choices, default=NepalProvince.BAGMATI)
    district = models.CharField(max_length=100)
    municipality = models.CharField(max_length=150, help_text='Municipality, Metropolitan City, or Rural Municipality')
    ward_number = models.PositiveSmallIntegerField(help_text='Ward number (1-35)')
    tole_street = models.CharField(max_length=255, help_text='Tole or street name')
    landmark = models.CharField(max_length=255, blank=True, help_text='Nearby recognizable landmark')
    postal_code = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    is_default_shipping = models.BooleanField(default=False)
    is_default_billing = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'Addresses'
        ordering = ['-is_default_shipping', '-created_at']

    def __str__(self):
        return f"{self.recipient_name} - {self.tole_street}, Ward {self.ward_number}, {self.district}"


class WishlistItem(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='wishlist_items')
    session_key = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    product = models.ForeignKey('catalogue.Product', on_delete=models.CASCADE, related_name='wishlist_entries')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user or self.session_key} - {self.product.name}"


