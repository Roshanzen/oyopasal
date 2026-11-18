from django.contrib import admin
from apps.settlements.models import VendorSettlement, SettlementItem

class SettlementItemInline(admin.TabularInline):
    model = SettlementItem
    extra = 0
    readonly_fields = ('sub_order', 'amount')

@admin.register(VendorSettlement)
class VendorSettlementAdmin(admin.ModelAdmin):
    list_display = ('settlement_number', 'vendor', 'status', 'gross_amount', 'platform_commission', 'net_payout', 'bank_reference', 'paid_at')
    list_filter = ('status', 'vendor')
    search_fields = ('settlement_number', 'vendor__business_name', 'bank_reference')
    inlines = [SettlementItemInline]

