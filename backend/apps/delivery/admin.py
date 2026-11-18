from django.contrib import admin
from apps.delivery.models import DeliveryZone

@admin.register(DeliveryZone)
class DeliveryZoneAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'province', 'base_shipping_charge', 'estimated_delivery_days_min', 'estimated_delivery_days_max', 'is_active')
    list_filter = ('province', 'is_active')
    search_fields = ('name', 'code')

