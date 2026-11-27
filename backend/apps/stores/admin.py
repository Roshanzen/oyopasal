from django.contrib import admin, messages
from django.db import models, transaction
from django.template.response import TemplateResponse
from django.utils.translation import gettext_lazy as _
from apps.stores.models import Store, StoreGalleryImage
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.services import StoreCleanupService


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
        f"Successfully approved and verified {updated_stores} store(s) and {len(vendor_ids)} linked vendor profile(s).",
        level=messages.SUCCESS
    )


@admin.action(description=_("Archive / Deactivate selected stores"))
def archive_and_deactivate_stores(modeladmin, request, queryset):
    """
    Bulk admin action to set is_active=False on selected stores,
    hiding them from the customer storefront while keeping customer order receipts intact.
    """
    count = 0
    for store in queryset:
        store.is_active = False
        store.save(update_fields=['is_active', 'updated_at'])
        count += 1

    modeladmin.message_user(
        request,
        f"Successfully archived/deactivated {count} store(s). Customer order receipts and financial records remain intact.",
        level=messages.SUCCESS
    )


@admin.action(description=_("Force delete / safely clean test stores"))
def force_delete_test_stores(modeladmin, request, queryset):
    """
    Dependency-aware cleanup action for test stores.
    - Superuser restricted.
    - Prompts for confirmation before permanent deletion.
    - Test stores with NO historical orders: safely permanently deleted.
    - Stores with historical orders: archived and deactivated to protect customer receipts.
    - Active production stores: skipped and protected.
    """
    if not request.user.is_superuser:
        modeladmin.message_user(
            request,
            "Permission denied: Only superusers can execute test store cleanup.",
            level=messages.ERROR
        )
        return

    # Check for confirmation
    is_confirmed = request.POST.get('confirmed') == 'yes' or getattr(request, 'is_confirmed', False)
    if not is_confirmed:
        analyses = [StoreCleanupService.analyze_store(s) for s in queryset]
        context = {
            **modeladmin.admin_site.each_context(request),
            'title': _('Confirm Safe Test Store Cleanup'),
            'opts': modeladmin.model._meta,
            'queryset': queryset,
            'analyses': analyses,
            'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, 'admin/stores/confirm_store_cleanup.html', context)

    # Confirmed execution
    results = StoreCleanupService.execute_cleanup(queryset, user=request.user)

    msg_parts = []
    if results['deleted']:
        del_names = [d['name'] for d in results['deleted']]
        msg_parts.append(f"Permanently deleted {len(del_names)} clean test store(s): {', '.join(del_names)}.")
    if results['archived']:
        arc_names = [a['name'] for a in results['archived']]
        msg_parts.append(f"Archived {len(arc_names)} store(s) with historical orders/transactions: {', '.join(arc_names)}.")
    if results['skipped']:
        skip_names = [s['name'] for s in results['skipped']]
        msg_parts.append(f"Skipped {len(skip_names)} production store(s): {', '.join(skip_names)}.")
    if results['errors']:
        err_names = [e['name'] for e in results['errors']]
        msg_parts.append(f"Errors encountered on {len(err_names)} store(s): {', '.join(err_names)}.")

    full_msg = " | ".join(msg_parts) if msg_parts else "No stores were modified."
    level = messages.ERROR if results['errors'] else (messages.WARNING if results['skipped'] or results['archived'] else messages.SUCCESS)
    modeladmin.message_user(request, full_msg, level=level)


@admin.register(Store)
class StoreAdmin(admin.ModelAdmin):
    list_display = ('name', 'vendor', 'slug', 'is_active', 'is_verified', 'contact_phone', 'created_at')
    list_editable = ('is_active', 'is_verified')
    list_filter = ('is_active', 'is_verified', 'created_at')
    search_fields = ('name', 'vendor__business_name', 'contact_email', 'contact_phone')
    prepopulated_fields = {'slug': ('name',)}
    actions = [approve_and_verify_stores, archive_and_deactivate_stores, force_delete_test_stores]
    inlines = [StoreGalleryImageInline]

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.is_verified and obj.vendor_id:
            VendorProfile.objects.filter(id=obj.vendor_id).update(status=VendorStatus.APPROVED)

    def delete_model(self, request, obj):
        analysis = StoreCleanupService.analyze_store(obj)
        if analysis.has_orders_or_transactions or not analysis.is_test_store:
            from django.utils import timezone
            obj.is_active = False
            obj.is_deleted = True
            obj.deleted_at = timezone.now()
            obj.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])
            messages.warning(
                request,
                f"Store '{obj.name}' has historical transactions or is a production store. "
                "It was safely archived rather than permanently deleted."
            )
        else:
            StoreCleanupService.execute_cleanup(Store.objects.filter(id=obj.id), user=request.user)
            messages.success(request, f"Test store '{obj.name}' was safely permanently deleted.")

    def delete_queryset(self, request, queryset):
        results = StoreCleanupService.execute_cleanup(queryset, user=request.user)
        msg_parts = []
        if results['deleted']:
            msg_parts.append(f"Permanently deleted {len(results['deleted'])} test store(s).")
        if results['archived']:
            msg_parts.append(f"Archived {len(results['archived'])} store(s) to protect customer orders.")
        if results['skipped']:
            msg_parts.append(f"Skipped {len(results['skipped'])} production store(s).")
        messages.info(request, " | ".join(msg_parts) if msg_parts else "No stores deleted.")
