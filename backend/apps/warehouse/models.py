from django.db import models
from apps.common.models import BaseModel, SoftDeletableModel
from apps.vendors.models import VendorProfile
from apps.customers.models import NepalProvince

class Warehouse(BaseModel, SoftDeletableModel):
    """
    Physical storage and fulfillment location.
    May be platform-operated (vendor=None) or vendor-owned private facility.
    """
    vendor = models.ForeignKey(
        VendorProfile,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='warehouses',
        help_text='Owner vendor. Null indicates platform central fulfillment hub.'
    )
    name = models.CharField(max_length=200, db_index=True)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    contact_person = models.CharField(max_length=150, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    
    # Location
    province = models.CharField(max_length=50, choices=NepalProvince.choices, default=NepalProvince.BAGMATI)
    district = models.CharField(max_length=100)
    city = models.CharField(max_length=150)
    address_line = models.CharField(max_length=255)
    postal_code = models.CharField(max_length=20, blank=True)
    
    is_active = models.BooleanField(default=True, db_index=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Warehouse'
        verbose_name_plural = 'Warehouses'
        ordering = ['-is_default', 'name']

    def __str__(self):
        owner = self.vendor.business_name if self.vendor else 'Platform Hub'
        return f"{self.name} [{self.code}] - {owner}"

