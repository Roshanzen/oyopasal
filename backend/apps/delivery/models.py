from django.db import models
from apps.common.models import BaseModel, SoftDeletableModel
from apps.customers.models import NepalProvince

class DeliveryZone(BaseModel, SoftDeletableModel):
    """
    Logistics coverage zone with base shipping rates for Nepal districts and regions.
    """
    name = models.CharField(max_length=150, unique=True, db_index=True)
    code = models.CharField(max_length=50, unique=True)
    province = models.CharField(max_length=50, choices=NepalProvince.choices, blank=True)
    districts = models.JSONField(
        default=list,
        blank=True,
        help_text='List of district names covered e.g. ["Kathmandu", "Lalitpur", "Bhaktapur"]'
    )
    base_shipping_charge = models.DecimalField(max_digits=10, decimal_places=2, default=100.00)
    per_kg_charge = models.DecimalField(max_digits=10, decimal_places=2, default=50.00)
    estimated_delivery_days_min = models.PositiveSmallIntegerField(default=1)
    estimated_delivery_days_max = models.PositiveSmallIntegerField(default=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Delivery Zone'
        verbose_name_plural = 'Delivery Zones'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (NPR {self.base_shipping_charge})"

