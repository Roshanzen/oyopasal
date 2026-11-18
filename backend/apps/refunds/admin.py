from django.contrib import admin
from apps.refunds.models import Refund

@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ('refund_number', 'order', 'sub_order', 'customer', 'amount', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('refund_number', 'order__order_number', 'customer__email')

