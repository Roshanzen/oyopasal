from django.contrib import admin
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatusHistory

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('variant', 'product_name', 'variant_sku', 'unit_price', 'quantity', 'total_price', 'tax_amount')

class VendorSubOrderInline(admin.StackedInline):
    model = VendorSubOrder
    extra = 0
    readonly_fields = ('sub_order_number', 'vendor', 'store', 'subtotal', 'commission_amount', 'vendor_net_amount')

class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ('previous_status', 'new_status', 'remarks', 'changed_by', 'created_at')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'customer', 'status', 'grand_total', 'payment_method', 'payment_status', 'created_at')
    list_filter = ('status', 'payment_method', 'payment_status')
    search_fields = ('order_number', 'customer__email')
    inlines = [VendorSubOrderInline, OrderStatusHistoryInline]

@admin.register(VendorSubOrder)
class VendorSubOrderAdmin(admin.ModelAdmin):
    list_display = ('sub_order_number', 'parent_order', 'vendor', 'store', 'store_name_snapshot', 'status', 'subtotal', 'commission_amount', 'vendor_net_amount', 'created_at')
    list_filter = ('status', 'vendor')
    search_fields = ('sub_order_number', 'parent_order__order_number', 'vendor__business_name', 'store_name_snapshot')
    inlines = [OrderItemInline, OrderStatusHistoryInline]

@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('product_name', 'product_title_snapshot', 'store_name_snapshot', 'store', 'variant_sku', 'sub_order', 'unit_price', 'quantity', 'total_price')
    search_fields = ('product_name', 'product_title_snapshot', 'store_name_snapshot', 'variant_sku', 'sub_order__sub_order_number')

