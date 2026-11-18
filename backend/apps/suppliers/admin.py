from django.contrib import admin
from apps.suppliers.models import SupplierProfile, SupplierDocument

class SupplierDocumentInline(admin.TabularInline):
    model = SupplierDocument
    extra = 0

@admin.register(SupplierProfile)
class SupplierProfileAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'user', 'status', 'pan_vat_number', 'credit_terms_days', 'created_at')
    list_filter = ('status',)
    search_fields = ('company_name', 'user__email', 'pan_vat_number')
    prepopulated_fields = {'slug': ('company_name',)}
    inlines = [SupplierDocumentInline]

@admin.register(SupplierDocument)
class SupplierDocumentAdmin(admin.ModelAdmin):
    list_display = ('supplier', 'document_type', 'is_verified', 'verified_at')
    list_filter = ('document_type', 'is_verified')
    search_fields = ('supplier__company_name',)

