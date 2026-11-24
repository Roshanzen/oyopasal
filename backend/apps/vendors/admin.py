from django.contrib import admin
from apps.vendors.models import (
    VendorProfile,
    VendorDocument,
    SellerApplication,
    VendorInvitation,
    SellerApplicationAudit,
)

class VendorDocumentInline(admin.TabularInline):
    model = VendorDocument
    extra = 0

class SellerApplicationAuditInline(admin.TabularInline):
    model = SellerApplicationAudit
    extra = 0
    readonly_fields = ('action', 'actor', 'notes', 'previous_status', 'new_status', 'created_at')
    can_delete = False

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

@admin.register(SellerApplication)
class SellerApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'application_number',
        'business_name',
        'full_name',
        'email',
        'phone',
        'business_category',
        'status',
        'created_at'
    )
    list_filter = ('status', 'business_category', 'province')
    search_fields = ('application_number', 'business_name', 'full_name', 'email', 'phone', 'pan_vat_number')
    readonly_fields = ('application_number', 'created_at', 'updated_at', 'reviewed_at', 'reviewed_by')
    inlines = [SellerApplicationAuditInline]

@admin.register(VendorInvitation)
class VendorInvitationAdmin(admin.ModelAdmin):
    list_display = ('application', 'email', 'token', 'expires_at', 'is_used', 'used_at', 'created_at')
    list_filter = ('is_used',)
    search_fields = ('email', 'token', 'application__application_number')
    readonly_fields = ('token', 'created_at', 'updated_at', 'used_at')

