from django.contrib import admin
from apps.warehouse.models import Warehouse

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'vendor', 'city', 'province', 'is_active', 'is_default')
    list_filter = ('province', 'is_active', 'is_default')
    search_fields = ('name', 'code', 'city', 'district')

