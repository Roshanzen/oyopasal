from django.contrib import admin
from apps.commissions.models import CommissionRule, CommissionRecord

@admin.register(CommissionRule)
class CommissionRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'rule_type', 'category', 'vendor', 'percentage', 'fixed_fee', 'is_active', 'effective_from')
    list_filter = ('rule_type', 'is_active')
    search_fields = ('name',)


@admin.register(CommissionRecord)
class CommissionRecordAdmin(admin.ModelAdmin):
    list_display = ('sub_order', 'gross_amount', 'commission_rate', 'commission_amount', 'net_vendor_earning', 'is_settled', 'created_at')
    list_filter = ('is_settled',)
    search_fields = ('sub_order__sub_order_number',)

