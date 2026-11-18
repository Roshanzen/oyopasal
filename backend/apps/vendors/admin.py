from django.contrib import admin
from apps.vendors.models import VendorProfile, VendorDocument

class VendorDocumentInline(admin.TabularInline):
    model = VendorDocument
    extra = 0

@admin.register(VendorProfile)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = ('business_name', 'user', 'status', 'pan_vat_number', 'commission_rate_override', 'created_at')
    list_filter = ('status', 'business_category')
    search_fields = ('business_name', 'user__email', 'pan_vat_number')
    prepopulated_fields = {'slug': ('business_name',)}
    inlines = [VendorDocumentInline]

@admin.register(VendorDocument)
class VendorDocumentAdmin(admin.ModelAdmin):
    list_display = ('vendor', 'document_type', 'is_verified', 'verified_at')
    list_filter = ('document_type', 'is_verified')
    search_fields = ('vendor__business_name',)

