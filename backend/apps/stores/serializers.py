from rest_framework import serializers
from apps.stores.models import Store

class StoreDetailSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    vendor_slug = serializers.CharField(source='vendor.slug', read_only=True)
    vendor_id = serializers.CharField(source='vendor.id', read_only=True)
    kyc_status = serializers.CharField(source='vendor.status', read_only=True)
    logo = serializers.CharField(source='logo_url', read_only=True)
    banner = serializers.CharField(source='banner_url', read_only=True)

    class Meta:
        model = Store
        fields = [
            'id', 'name', 'slug', 'description', 'logo_url', 'banner_url', 'logo', 'banner',
            'contact_email', 'contact_phone', 'address', 'business_hours',
            'latitude', 'longitude',
            'shipping_policy', 'return_policy', 'is_active', 'is_verified',
            'vendor_id', 'vendor_name', 'vendor_slug', 'kyc_status', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'is_verified', 'vendor_id', 'vendor_name', 'vendor_slug', 'kyc_status', 'created_at']


class StoreListSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    kyc_status = serializers.CharField(source='vendor.status', read_only=True)
    logo = serializers.CharField(source='logo_url', read_only=True)
    banner = serializers.CharField(source='banner_url', read_only=True)

    class Meta:
        model = Store
        fields = [
            'id', 'name', 'slug', 'description', 'logo_url', 'banner_url', 'logo', 'banner',
            'vendor_name', 'is_active', 'is_verified', 'kyc_status'
        ]


class StoreCreateUpdateSerializer(serializers.ModelSerializer):
    logo = serializers.CharField(required=False, allow_blank=True, default='')
    banner = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model = Store
        fields = [
            'id', 'name', 'slug', 'description', 'logo_url', 'banner_url', 'logo', 'banner',
            'contact_email', 'contact_phone', 'address', 'business_hours',
            'latitude', 'longitude',
            'shipping_policy', 'return_policy', 'is_active'
        ]
        read_only_fields = ['id', 'slug']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        from apps.common.services.image_resolver import resolve_image_url

        # Normalize and resolve banner / banner_url
        if 'banner' in data and not data.get('banner_url'):
            data['banner_url'] = data['banner']
        elif 'banner_url' in data and not data.get('banner'):
            data['banner'] = data['banner_url']

        if 'banner_url' in data and data['banner_url']:
            resolved_banner = resolve_image_url(data['banner_url'])
            data['banner_url'] = resolved_banner
            data['banner'] = resolved_banner
            
        # Normalize and resolve logo / logo_url
        if 'logo' in data and not data.get('logo_url'):
            data['logo_url'] = data['logo']
        elif 'logo_url' in data and not data.get('logo'):
            data['logo'] = data['logo_url']

        if 'logo_url' in data and data['logo_url']:
            resolved_logo = resolve_image_url(data['logo_url'])
            data['logo_url'] = resolved_logo
            data['logo'] = resolved_logo

        return super().to_internal_value(data)

    def create(self, validated_data):
        logo = validated_data.pop('logo', None)
        banner = validated_data.pop('banner', None)
        if logo and not validated_data.get('logo_url'):
            validated_data['logo_url'] = logo
        if banner and not validated_data.get('banner_url'):
            validated_data['banner_url'] = banner
        return super().create(validated_data)

    def update(self, instance, validated_data):
        logo = validated_data.pop('logo', None)
        banner = validated_data.pop('banner', None)
        if logo:
            validated_data['logo_url'] = logo
        if banner:
            validated_data['banner_url'] = banner
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['banner'] = instance.banner_url or ''
        ret['logo'] = instance.logo_url or ''
        return ret
