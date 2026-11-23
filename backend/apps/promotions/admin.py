from django.contrib import admin
from django.utils.html import format_html
from .models import HeroBanner, Coupon, CouponUsage, MarketingPromotion, Advertisement

@admin.register(HeroBanner)
class HeroBannerAdmin(admin.ModelAdmin):
    list_display = ('id', 'image_preview', 'alt_text', 'target_url', 'display_order', 'is_active', 'created_at')
    list_editable = ('display_order', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('alt_text', 'target_url')
    ordering = ('display_order', '-created_at')

    def image_preview(self, obj):
        if obj.image:
            try:
                url = obj.image.url
                return format_html(
                    '<img src="{}" style="max-height: 50px; max-width: 140px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0;" />',
                    url
                )
            except Exception:
                return "Image Error"
        return "No Image"
    image_preview.short_description = "Banner Preview"


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'min_order_amount', 'usage_count', 'usage_limit', 'is_active', 'expires_at')
    list_filter = ('discount_type', 'is_active')
    search_fields = ('code', 'description')
    ordering = ('-created_at',)


@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ('coupon', 'user', 'order', 'discount_amount', 'created_at')
    search_fields = ('coupon__code', 'user__email', 'order__order_number')
    ordering = ('-created_at',)


@admin.register(MarketingPromotion)
class MarketingPromotionAdmin(admin.ModelAdmin):
    list_display = ('title', 'placement', 'code', 'sort_order', 'is_active', 'starts_at', 'ends_at')
    list_filter = ('placement', 'is_active')
    search_fields = ('title', 'code', 'cta_category')
    ordering = ('sort_order', '-created_at')


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    list_display = ('title', 'placement', 'priority', 'clicks_count', 'impressions_count', 'is_active')
    list_filter = ('placement', 'is_active')
    search_fields = ('title', 'destination_url')
    ordering = ('priority', '-created_at')
