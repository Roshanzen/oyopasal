from django.contrib import admin
from apps.catalogue.models import (
    Category,
    Brand,
    Product,
    ProductVariant,
    ProductImage,
    ProductModerationLog
)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent', 'slug', 'is_active', 'ordering')
    list_filter = ('is_active', 'parent')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}
    exclude = ('is_deleted', 'deleted_at')
    save_on_top = True


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


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'base_sku', 'vendor', 'store', 'category', 'status', 'is_featured', 'created_at')
    list_filter = ('status', 'is_featured', 'category', 'brand')
    search_fields = ('name', 'base_sku', 'vendor__business_name')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ProductVariantInline, ProductImageInline]


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ('product', 'sku', 'regular_price', 'selling_price', 'is_default', 'is_active')
    search_fields = ('sku', 'product__name')
    list_filter = ('is_default', 'is_active')


@admin.register(ProductModerationLog)
class ProductModerationLogAdmin(admin.ModelAdmin):
    list_display = ('product', 'action', 'previous_status', 'new_status', 'action_by', 'created_at')
    list_filter = ('action', 'new_status')
    search_fields = ('product__name', 'reason')

