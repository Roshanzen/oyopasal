from django.contrib import admin
from apps.payments.models import Payment, FinancialLedgerEntry

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('transaction_reference', 'order', 'provider', 'amount', 'status', 'gateway_reference', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('transaction_reference', 'gateway_reference', 'order__order_number')


@admin.register(FinancialLedgerEntry)
class FinancialLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ('entry_type', 'direction', 'amount', 'reference_id', 'vendor', 'created_at')
    list_filter = ('entry_type', 'direction')
    search_fields = ('reference_id', 'description', 'vendor__business_name')

