from django.contrib import admin
from django.utils.translation import gettext_lazy as _
from apps.stores.models import Store, StoreGalleryImage
from apps.vendors.models import VendorProfile, VendorStatus

class StoreGalleryImageInline(admin.TabularInline):
    model = StoreGalleryImage
    extra = 1
    fields = ('image', 'caption', 'sort_order')

@admin.action(description=_("Approve & Verify Selected Stores"))
def approve_and_verify_stores(modeladmin, request, queryset):
    """
    Bulk admin action to mark stores active and verified,
    simultaneously promoting their linked vendors to 'APPROVED'.
    """
    updated_stores = 0
    vendor_ids = set()
    for store in queryset:
        store.is_verified = True
        store.is_active = True
        store.save(update_fields=['is_verified', 'is_active', 'updated_at'])
        updated_stores += 1
        if store.vendor_id:
            vendor_ids.add(store.vendor_id)

    if vendor_ids:
        VendorProfile.objects.filter(id__in=vendor_ids).update(status=VendorStatus.APPROVED)

    modeladmin.message_user(
        request,
        f"Successfully approved and verified {updated_stores} store(s) and {len(vendor_ids)} linked vendor profile(s)."
    )


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'slug', 'is_active', 'is_verified', 'contact_phone', 'created_at')
    list_editable = ('is_active', 'is_verified')
    list_filter = ('is_active', 'is_verified', 'created_at')
    search_fields = ('name', 'vendor__business_name', 'contact_email', 'contact_phone')
    prepopulated_fields = {'slug': ('name',)}
    actions = [approve_and_verify_stores]
    inlines = [StoreGalleryImageInline]

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.is_verified and obj.vendor_id:
            VendorProfile.objects.filter(id=obj.vendor_id).update(status=VendorStatus.APPROVED)
