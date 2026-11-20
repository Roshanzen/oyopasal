from decimal import Decimal
from rest_framework import serializers
from .models import Coupon, CouponUsage

class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            'id',
            'code',
            'description',
            'discount_type',
            'discount_value',
            'max_discount_amount',
            'min_order_amount',
            'usage_limit',
            'usage_count',
            'is_active',
            'starts_at',
            'expires_at',
            'created_at',
        ]
        read_only_fields = ['id', 'usage_count', 'created_at']


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=40)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))


class CouponValidationResultSerializer(serializers.Serializer):
    code = serializers.CharField()
    is_valid = serializers.BooleanField()
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    new_subtotal = serializers.DecimalField(max_digits=12, decimal_places=2)
    message = serializers.CharField()


class MarketingPromotionSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import MarketingPromotion
        model = MarketingPromotion
        fields = [
            'id', 'title', 'title_ne', 'subtitle', 'subtitle_ne',
            'badge', 'badge_ne', 'cta_text', 'cta_text_ne', 'cta_category',
            'destination_url', 'image', 'code', 'color_theme', 'placement',
            'sort_order', 'is_active', 'starts_at', 'ends_at'
        ]


class AdvertisementSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import Advertisement
        model = Advertisement
        fields = [
            'id', 'title', 'title_ne', 'subtitle', 'subtitle_ne',
            'image_url', 'destination_url', 'placement', 'priority',
            'is_active', 'starts_at', 'ends_at', 'clicks_count', 'impressions_count'
        ]


class HeroBannerSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        from .models import HeroBanner
        model = HeroBanner
        fields = [
            'id',
            'image',
            'image_url',
            'target_url',
            'alt_text',
            'display_order',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['id', 'image_url', 'created_at']

    def get_image_url(self, obj):
        if not obj.image:
            return ''
        try:
            url = obj.image.url
        except Exception:
            return ''
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(url)
        return url



