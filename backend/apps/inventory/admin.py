from django.contrib import admin
from apps.inventory.models import InventoryItem, StockMovement, StockReservation

class StockMovementInline(admin.TabularInline):
    model = StockMovement
    extra = 0
    readonly_fields = ('movement_type', 'quantity', 'balance_after', 'reference_id', 'notes', 'created_by', 'created_at')
    can_delete = False

@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('variant', 'warehouse', 'quantity_on_hand', 'quantity_reserved', 'quantity_available', 'is_low_stock')
    list_filter = ('warehouse',)
    search_fields = ('variant__sku', 'variant__product__name', 'warehouse__code')
    inlines = [StockMovementInline]

@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ('inventory_item', 'movement_type', 'quantity', 'balance_after', 'reference_id', 'created_by', 'created_at')
    list_filter = ('movement_type',)
    search_fields = ('inventory_item__variant__sku', 'reference_id', 'notes')

@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
    list_display = ('inventory_item', 'session_id', 'quantity', 'expires_at', 'is_released', 'is_committed')
    list_filter = ('is_released', 'is_committed')
    search_fields = ('inventory_item__variant__sku', 'session_id')

