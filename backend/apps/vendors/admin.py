from django.contrib import admin, messages
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from apps.vendors.models import (
    VendorProfile,
    VendorDocument,
    SellerApplication,
    VendorInvitation,
    SellerApplicationAudit,
    VendorStatus,
)
from apps.vendors.services import VendorCleanupService
from apps.catalogue.models import Product, ProductVariant, ProductStatus
from apps.cart.models import CartItem


class VendorDocumentInline(admin.TabularInline):
    model = VendorDocument
    extra = 0


class SellerApplicationAuditInline(admin.TabularInline):
    model = SellerApplicationAudit
    extra = 0
    readonly_fields = ('action', 'actor', 'notes', 'previous_status', 'new_status', 'created_at')
    can_delete = False


@admin.action(description=_("Safely delete / clean selected vendors & products"))
def safe_delete_or_archive_vendors(modeladmin, request, queryset):
    """
    Dependency-aware cleanup action for VendorProfile instances.
    - Superuser restricted.
    - Prompts for confirmation before permanent deletion.
    - Vendors with historical orders/transactions: archived, stores deactivated,
      products soft-deleted, and customer order history/snapshots preserved intact.
    - Vendors with 0 historical orders: permanently deleted along with all their products and assets.
    """
    if not request.user.is_superuser:
        modeladmin.message_user(
            request,
            "Permission denied: Only superusers can execute vendor profile deletion.",
            level=messages.ERROR
        )
        return

    is_confirmed = request.POST.get('confirmed') == 'yes' or getattr(request, 'is_confirmed', False)
    if not is_confirmed:
        analyses = [VendorCleanupService.analyze_vendor(v) for v in queryset]
        context = {
            **modeladmin.admin_site.each_context(request),
            'title': _('Confirm Safe Vendor Cleanup'),
            'opts': modeladmin.model._meta,
            'queryset': queryset,
            'analyses': analyses,
            'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, 'admin/vendors/confirm_vendor_cleanup.html', context)

    results = VendorCleanupService.execute_cleanup(queryset, user=request.user)
    msg_parts = []
    if results['deleted']:
        del_names = [d['business_name'] for d in results['deleted']]
        msg_parts.append(f"Permanently deleted {len(del_names)} clean vendor(s) and their products: {', '.join(del_names)}.")
    if results['archived']:
        arc_names = [a['business_name'] for a in results['archived']]
        msg_parts.append(f"Archived {len(arc_names)} vendor(s) to protect customer order history: {', '.join(arc_names)}.")
    if results['errors']:
        err_names = [e['business_name'] for e in results['errors']]
        msg_parts.append(f"Errors on {len(err_names)} vendor(s): {', '.join(err_names)}.")

    full_msg = " | ".join(msg_parts) if msg_parts else "No vendors were modified."
    level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
    modeladmin.message_user(request, full_msg, level=level)


@admin.action(description=_("Archive / Deactivate selected vendors"))
def archive_and_deactivate_vendors(modeladmin, request, queryset):
    count = 0
    now = timezone.now()
    for vendor in queryset:
        # Deactivate stores
        for store in vendor.stores.all():
            store.is_active = False
            store.is_deleted = True
            store.deleted_at = now
            store.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])

        # Deactivate & archive products
        for prod in vendor.products.all():
            variants = ProductVariant.all_objects.filter(product=prod)
            variant_ids = list(variants.values_list('id', flat=True))
            CartItem.objects.filter(variant_id__in=variant_ids).delete()
            variants.update(is_active=False, is_deleted=True, deleted_at=now)
            prod.status = ProductStatus.ARCHIVED
            prod.is_deleted = True
            prod.deleted_at = now
            prod.save(update_fields=['status', 'is_deleted', 'deleted_at', 'updated_at'])

        vendor.status = VendorStatus.ARCHIVED
        vendor.rejection_reason = "Archived by admin: historical transactions preserved."
        vendor.save(update_fields=['status', 'rejection_reason', 'updated_at'])
        count += 1

    modeladmin.message_user(
        request,
        f"Successfully archived/deactivated {count} vendor(s) and their stores/products. Customer receipts remain intact.",
        level=messages.SUCCESS
    )


@admin.register(VendorProfile)
class VendorProfileAdmin(admin.ModelAdmin):
    list_display = ('business_name', 'user', 'status', 'pan_vat_number', 'commission_rate_override', 'created_at')
    list_filter = ('status', 'business_category')
    search_fields = ('business_name', 'user__email', 'pan_vat_number')
    prepopulated_fields = {'slug': ('business_name',)}
    inlines = [VendorDocumentInline]
    actions = [safe_delete_or_archive_vendors, archive_and_deactivate_vendors]

    def delete_model(self, request, obj):
        results = VendorCleanupService.execute_cleanup(
            VendorProfile.objects.filter(pk=obj.pk),
            user=request.user
        )
        if results['archived']:
            messages.warning(
                request,
                f"Vendor '{obj.business_name}' has historical orders/transactions. "
                "It was safely archived and products removed from storefront to protect customer receipts."
            )
        elif results['deleted']:
            messages.success(request, f"Vendor '{obj.business_name}' and all associated products were safely permanently deleted.")
        elif results['errors']:
            messages.error(request, f"Error deleting vendor '{obj.business_name}': {results['errors'][0]['error']}")

    def delete_queryset(self, request, queryset):
        results = VendorCleanupService.execute_cleanup(queryset, user=request.user)
        msg_parts = []
        if results['deleted']:
            del_names = [d['business_name'] for d in results['deleted']]
            msg_parts.append(f"Permanently deleted {len(del_names)} clean vendor(s) and their products: {', '.join(del_names)}.")
        if results['archived']:
            arc_names = [a['business_name'] for a in results['archived']]
            msg_parts.append(f"Archived {len(arc_names)} vendor(s) to protect customer order history: {', '.join(arc_names)}.")
        if results['errors']:
            err_names = [e['business_name'] for e in results['errors']]
            msg_parts.append(f"Errors on {len(err_names)} vendor(s): {', '.join(err_names)}.")

        full_msg = " | ".join(msg_parts) if msg_parts else "No vendors were modified."
        level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
        self.message_user(request, full_msg, level=level)


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
    actions = ['approve_and_send_invitations']

    @admin.action(description="Approve selected applications & send activation invitations")
    def approve_and_send_invitations(self, request, queryset):
        from apps.vendors.application_services import admin_approve_and_invite
        count = 0
        for app in queryset:
            try:
                admin_approve_and_invite(application=app, admin_user=request.user)
                count += 1
            except Exception as e:
                self.message_user(request, f"Error approving {app.application_number}: {e}", level='ERROR')
        if count > 0:
            self.message_user(request, f"Successfully approved {count} application(s) and dispatched activation invitations.")


@admin.register(VendorInvitation)
class VendorInvitationAdmin(admin.ModelAdmin):
    list_display = ('application', 'email', 'token', 'expires_at', 'is_used', 'used_at', 'created_at')
    list_filter = ('is_used',)
    search_fields = ('email', 'token', 'application__application_number')
    readonly_fields = ('token', 'created_at', 'updated_at', 'used_at')
