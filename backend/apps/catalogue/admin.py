from django.contrib import admin, messages
from django.template.response import TemplateResponse
from django.utils import timezone
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from apps.catalogue.models import (
    Category,
    Brand,
    Product,
    ProductVariant,
    ProductImage,
    ProductModerationLog,
    ProductStatus,
)
from apps.catalogue.services import (
    ProductVariantCleanupService,
    ProductCleanupService,
    CategoryCleanupService,
)
from apps.cart.models import CartItem


@admin.action(description=_("Safely delete, reassign, or archive categories"))
def safe_delete_or_archive_categories(modeladmin, request, queryset):
    is_confirmed = request.POST.get('confirmed') == 'yes' or getattr(request, 'is_confirmed', False)
    if not is_confirmed:
        analyses = [CategoryCleanupService.analyze_category(c) for c in queryset]
        target_categories = Category.objects.filter(
            is_active=True,
            is_deleted=False
        ).exclude(id__in=[c.id for c in queryset]).order_by('ordering', 'name')

        context = {
            **modeladmin.admin_site.each_context(request),
            'title': _('Confirm Category Deletion, Reassignment & Archival'),
            'opts': modeladmin.model._meta,
            'queryset': queryset,
            'analyses': analyses,
            'target_categories': target_categories,
            'has_products': any(a.products_count > 0 for a in analyses),
            'has_subcategories': any(a.subcategories_count > 0 for a in analyses),
            'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, 'admin/catalogue/confirm_category_cleanup.html', context)

    target_category_id = request.POST.get('target_category_id')
    target_cat = None
    if target_category_id:
        target_cat = Category.objects.filter(id=target_category_id).first()

    results = CategoryCleanupService.execute_cleanup(queryset, target_category=target_cat, user=request.user)
    msg_parts = []
    if results['reassigned']:
        re_info = [f"{r['products_count']} product(s) from '{r['name']}' to '{r['target']}'" for r in results['reassigned']]
        msg_parts.append(f"Successfully reassigned: {'; '.join(re_info)}.")
    if results['deleted']:
        del_names = [d['name'] for d in results['deleted']]
        msg_parts.append(f"Permanently deleted {len(del_names)} category(s): {', '.join(del_names)}.")
    if results['archived']:
        arc_names = [a['name'] for a in results['archived']]
        msg_parts.append(f"Safely archived {len(arc_names)} category(s) to protect existing products/orders: {', '.join(arc_names)}.")
    if results['errors']:
        err_msgs = [e.get('error', 'Error') for e in results['errors']]
        msg_parts.append(f"Errors encountered: {'; '.join(err_msgs)}.")

    full_msg = " | ".join(msg_parts) if msg_parts else "No categories were modified."
    level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
    modeladmin.message_user(request, full_msg, level=level)


@admin.action(description=_("Archive / Deactivate selected categories"))
def archive_and_deactivate_categories(modeladmin, request, queryset):
    results = CategoryCleanupService.execute_cleanup(queryset, target_category=None, user=request.user)
    count = len(results['archived']) + len(results['deleted'])
    modeladmin.message_user(
        request,
        f"Successfully processed {count} category(s). Existing products, orders, and receipts remain 100% intact.",
        level=messages.SUCCESS
    )


@admin.action(description=_("Reactivate selected categories"))
def reactivate_categories(modeladmin, request, queryset):
    count = CategoryCleanupService.reactivate_categories(queryset, user=request.user)
    modeladmin.message_user(
        request,
        f"Successfully reactivated {count} category(s) and their parent tree.",
        level=messages.SUCCESS
    )


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'slug', 'image_preview', 'is_active', 'ordering')
    list_filter = ('is_active', 'parent')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('image_preview',)
    fields = (
        'parent',
        'name',
        'slug',
        'description',
        'image',
        'image_url',
        'image_preview',
        'icon_url',
        'is_active',
        'ordering',
    )
    exclude = ('is_deleted', 'deleted_at')
    save_on_top = True
    actions = [safe_delete_or_archive_categories, archive_and_deactivate_categories, reactivate_categories]

    @admin.display(description=_('Image Preview'))
    def image_preview(self, obj):
        url = None
        if hasattr(obj, 'image') and obj.image:
            try:
                url = obj.image.url
            except Exception:
                url = None
        if not url:
            url = getattr(obj, 'image_url', None)
        if url:
            return format_html(
                '<img src="{}" style="max-width: 120px; max-height: 80px; object-fit: contain; border-radius: 8px; border: 1px solid #cbd5e1; padding: 2px; background: #f8fafc;" alt="{}" />',
                url,
                obj.name
            )
        return format_html('<span style="color: #94a3b8; font-size: 11px;">No image configured</span>')

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "parent":
            kwargs["queryset"] = Category.objects.filter(is_active=True, is_deleted=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def delete_model(self, request, obj):
        analysis = CategoryCleanupService.analyze_category(obj)
        if analysis.can_safely_delete:
            CategoryCleanupService.execute_cleanup(Category.all_objects.filter(pk=obj.pk), user=request.user)
            messages.success(request, f"Empty category '{obj.name}' was safely permanently deleted.")
        else:
            CategoryCleanupService.execute_cleanup(Category.all_objects.filter(pk=obj.pk), user=request.user)
            reasons = "; ".join(analysis.reasons_to_protect)
            messages.warning(
                request,
                f"Category '{obj.name}' contains associated records ({reasons}). "
                "It was safely archived and deactivated rather than deleted to protect product and order integrity."
            )

    def delete_queryset(self, request, queryset):
        # Check if any category has products
        has_dependencies = any(
            not CategoryCleanupService.analyze_category(c).can_safely_delete
            for c in queryset
        )
        if has_dependencies:
            # Route to confirmation workflow to allow reassignment or safe archival
            return safe_delete_or_archive_categories(self, request, queryset)

        results = CategoryCleanupService.execute_cleanup(queryset, user=request.user)
        del_names = [d['name'] for d in results['deleted']]
        messages.success(request, f"Permanently deleted {len(del_names)} clean category(s): {', '.join(del_names)}.")



@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.action(description=_("Safely delete / clean selected products"))
def safe_delete_or_archive_products(modeladmin, request, queryset):
    results = ProductCleanupService.execute_cleanup(queryset, user=request.user)
    msg_parts = []
    if results['deleted']:
        del_names = [d['name'] for d in results['deleted']]
        msg_parts.append(f"Permanently deleted {len(del_names)} clean product(s): {', '.join(del_names)}.")
    if results['archived']:
        arc_names = [a['name'] for a in results['archived']]
        msg_parts.append(f"Archived {len(arc_names)} product(s) with historical orders: {', '.join(arc_names)}.")
    if results['errors']:
        err_names = [e['name'] for e in results['errors']]
        msg_parts.append(f"Errors on {len(err_names)} product(s): {', '.join(err_names)}.")

    full_msg = " | ".join(msg_parts) if msg_parts else "No products were modified."
    level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
    modeladmin.message_user(request, full_msg, level=level)


@admin.action(description=_("Archive / Deactivate selected products"))
def archive_and_deactivate_products(modeladmin, request, queryset):
    count = 0
    now = timezone.now()
    for product in queryset:
        variants = ProductVariant.all_objects.filter(product=product)
        variant_ids = list(variants.values_list('id', flat=True))
        CartItem.objects.filter(variant_id__in=variant_ids).delete()
        variants.update(is_active=False, is_deleted=True, deleted_at=now)
        product.status = ProductStatus.ARCHIVED
        product.is_deleted = True
        product.deleted_at = now
        product.save(update_fields=['status', 'is_deleted', 'deleted_at', 'updated_at'])
        count += 1

    modeladmin.message_user(
        request,
        f"Successfully archived/deactivated {count} product(s) and their variants. Historical orders remain intact.",
        level=messages.SUCCESS
    )


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_sku', 'vendor', 'store', 'category', 'status', 'is_featured', 'created_at')
    list_filter = ('status', 'is_featured', 'category', 'brand')
    search_fields = ('name', 'base_sku', 'vendor__business_name')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductVariantInline, ProductImageInline]
    actions = [safe_delete_or_archive_products, archive_and_deactivate_products]

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "category":
            kwargs["queryset"] = Category.objects.filter(is_active=True, is_deleted=False)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def delete_model(self, request, obj):
        results = ProductCleanupService.execute_cleanup(
            Product.all_objects.filter(pk=obj.pk),
            user=request.user
        )
        if results['archived']:
            messages.warning(
                request,
                f"Product '{obj.name}' has historical order references. "
                "It was safely archived rather than permanently deleted."
            )
        elif results['deleted']:
            messages.success(request, f"Product '{obj.name}' was safely permanently deleted.")
        elif results['errors']:
            messages.error(request, f"Error deleting product '{obj.name}': {results['errors'][0]['error']}")

    def delete_queryset(self, request, queryset):
        results = ProductCleanupService.execute_cleanup(queryset, user=request.user)
        msg_parts = []
        if results['deleted']:
            del_names = [d['name'] for d in results['deleted']]
            msg_parts.append(f"Permanently deleted {len(del_names)} clean product(s): {', '.join(del_names)}.")
        if results['archived']:
            arc_names = [a['name'] for a in results['archived']]
            msg_parts.append(f"Archived {len(arc_names)} product(s) with historical orders: {', '.join(arc_names)}.")
        if results['errors']:
            err_names = [e['name'] for e in results['errors']]
            msg_parts.append(f"Errors on {len(err_names)} product(s): {', '.join(err_names)}.")
        full_msg = " | ".join(msg_parts) if msg_parts else "No products were modified."
        level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
        self.message_user(request, full_msg, level=level)


@admin.action(description=_("Safely delete / clean selected variants"))
def safe_delete_or_archive_variants(modeladmin, request, queryset):
    is_confirmed = request.POST.get('confirmed') == 'yes' or getattr(request, 'is_confirmed', False)
    if not is_confirmed:
        analyses = [ProductVariantCleanupService.analyze_variant(v) for v in queryset]
        context = {
            **modeladmin.admin_site.each_context(request),
            'title': _('Confirm Safe Variant Cleanup'),
            'opts': modeladmin.model._meta,
            'queryset': queryset,
            'analyses': analyses,
            'action_checkbox_name': admin.helpers.ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, 'admin/catalogue/confirm_variant_cleanup.html', context)

    results = ProductVariantCleanupService.execute_cleanup(queryset, user=request.user)
    msg_parts = []
    if results['deleted']:
        del_skus = [d['sku'] for d in results['deleted']]
        msg_parts.append(f"Permanently deleted {len(del_skus)} variant(s): {', '.join(del_skus)}.")
    if results['archived']:
        arc_skus = [a['sku'] for a in results['archived']]
        msg_parts.append(f"Archived {len(arc_skus)} variant(s) with historical orders: {', '.join(arc_skus)}.")
    if results['errors']:
        err_skus = [e['sku'] for e in results['errors']]
        msg_parts.append(f"Errors on {len(err_skus)} variant(s): {', '.join(err_skus)}.")

    full_msg = " | ".join(msg_parts) if msg_parts else "No variants were modified."
    level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
    modeladmin.message_user(request, full_msg, level=level)


@admin.action(description=_("Archive / Deactivate selected variants"))
def archive_and_deactivate_variants(modeladmin, request, queryset):
    count = 0
    now = timezone.now()
    for variant in queryset:
        CartItem.objects.filter(variant=variant).delete()
        variant.is_active = False
        variant.is_deleted = True
        variant.deleted_at = now
        variant.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])
        count += 1

    modeladmin.message_user(
        request,
        f"Successfully archived/deactivated {count} variant(s). Historical order items remain intact.",
        level=messages.SUCCESS
    )


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('product', 'sku', 'regular_price', 'selling_price', 'is_default', 'is_active')
    search_fields = ('sku', 'product__name')
    list_filter = ('is_default', 'is_active')
    actions = [safe_delete_or_archive_variants, archive_and_deactivate_variants]

    def delete_model(self, request, obj):
        results = ProductVariantCleanupService.execute_cleanup(
            ProductVariant.all_objects.filter(pk=obj.pk),
            user=request.user
        )
        if results['archived']:
            messages.warning(
                request,
                f"Variant '{obj.sku}' has historical order references. "
                "It was safely archived rather than permanently deleted to protect order receipts."
            )
        elif results['deleted']:
            messages.success(request, f"Variant '{obj.sku}' was safely permanently deleted.")
        elif results['errors']:
            messages.error(request, f"Error deleting variant '{obj.sku}': {results['errors'][0]['error']}")

    def delete_queryset(self, request, queryset):
        results = ProductVariantCleanupService.execute_cleanup(queryset, user=request.user)
        msg_parts = []
        if results['deleted']:
            del_skus = [d['sku'] for d in results['deleted']]
            msg_parts.append(f"Permanently deleted {len(del_skus)} variant(s): {', '.join(del_skus)}.")
        if results['archived']:
            arc_skus = [a['sku'] for a in results['archived']]
            msg_parts.append(f"Archived {len(arc_skus)} variant(s) with historical orders: {', '.join(arc_skus)}.")
        if results['errors']:
            err_skus = [e['sku'] for e in results['errors']]
            msg_parts.append(f"Errors on {len(err_skus)} variant(s): {', '.join(err_skus)}.")

        full_msg = " | ".join(msg_parts) if msg_parts else "No variants were modified."
        level = messages.ERROR if results['errors'] else (messages.WARNING if results['archived'] else messages.SUCCESS)
        self.message_user(request, full_msg, level=level)


@admin.register(ProductModerationLog)
class ProductModerationLogAdmin(admin.ModelAdmin):
    list_display = ('product', 'action', 'previous_status', 'new_status', 'action_by', 'created_at')
    list_filter = ('action', 'new_status')
    search_fields = ('product__name', 'reason')
