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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        vendor = instance.vendor
        vendor_status = getattr(vendor, 'status', 'PENDING') if vendor else 'PENDING'
        is_approved = bool(instance.is_verified) or (str(vendor_status).upper() == 'APPROVED')
        effective_status = 'APPROVED' if is_approved else str(vendor_status).upper()
        data['is_approved'] = is_approved
        data['is_verified'] = is_approved
        data['verified'] = is_approved
        data['status'] = effective_status
        data['kyc_status'] = effective_status
        data['approval_status'] = 'approved' if is_approved else effective_status.lower()

        # Additional storefront attributes
        avg_rating = 4.8
        if vendor:
            try:
                from apps.reviews.models import ProductReview
                from django.db.models import Avg
                agg = ProductReview.objects.filter(product__vendor=vendor).aggregate(avg=Avg('rating'))
                if agg.get('avg'):
                    avg_rating = round(float(agg['avg']), 1)
            except Exception:
                pass

        data['rating'] = avg_rating
        data['delivery_time_mins'] = '10-15 mins'
        data['open_time'] = '06:00'
        data['close_time'] = '21:00'
        data['is_open'] = instance.is_active
        data['fulfillment_modes'] = 'Store Pickup & Delivery'

        # Gallery photos
        gallery = []
        if instance.banner_url:
            gallery.append(instance.banner_url)
        if vendor and getattr(vendor, 'banner_url', None) and vendor.banner_url not in gallery:
            gallery.append(vendor.banner_url)
        if instance.logo_url and instance.logo_url not in gallery:
            gallery.append(instance.logo_url)
        if vendor and getattr(vendor, 'logo_url', None) and vendor.logo_url not in gallery:
            gallery.append(vendor.logo_url)

        # Include sample product images for the gallery if fewer than 3
        if vendor and len(gallery) < 4:
            try:
                from apps.catalogue.models import ProductImage
                prod_imgs = ProductImage.objects.filter(product__vendor=vendor).values_list('image_url', flat=True)[:6]
                for p_url in prod_imgs:
                    if p_url and p_url not in gallery:
                        gallery.append(p_url)
            except Exception:
                pass

        data['gallery'] = gallery
        data['address'] = instance.address or (vendor.stores.filter(address__gt='').values_list('address', flat=True).first() if vendor else '') or 'Chapakhel Road, Lalitpur, Nepal'
        data['phone'] = instance.contact_phone or (vendor.user.phone_number if vendor and hasattr(vendor, 'user') else '') or '+977-1-5544332'
        data['email'] = instance.contact_email or (vendor.user.email if vendor and hasattr(vendor, 'user') else '') or 'store@oyopasal.com'
        data['description'] = instance.description or (vendor.store_description if vendor else '') or 'Official certified marketplace vendor on OyoPasal providing fast, fresh, high-quality groceries and goods.'
        return data


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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        vendor = instance.vendor
        vendor_status = getattr(vendor, 'status', 'PENDING') if vendor else 'PENDING'
        is_approved = bool(instance.is_verified) or (str(vendor_status).upper() == 'APPROVED')
        effective_status = 'APPROVED' if is_approved else str(vendor_status).upper()
        data['is_approved'] = is_approved
        data['is_verified'] = is_approved
        data['verified'] = is_approved
        data['status'] = effective_status
        data['kyc_status'] = effective_status
        data['approval_status'] = 'approved' if is_approved else effective_status.lower()

        # Additional storefront attributes
        avg_rating = 4.8
        if vendor:
            try:
                from apps.reviews.models import ProductReview
                from django.db.models import Avg
                agg = ProductReview.objects.filter(product__vendor=vendor).aggregate(avg=Avg('rating'))
                if agg.get('avg'):
                    avg_rating = round(float(agg['avg']), 1)
            except Exception:
                pass

        data['rating'] = avg_rating
        data['delivery_time_mins'] = '10-15 mins'
        data['open_time'] = '06:00'
        data['close_time'] = '21:00'
        data['is_open'] = instance.is_active
        data['fulfillment_modes'] = 'Store Pickup & Delivery'

        # Gallery photos
        gallery = []
        if instance.banner_url:
            gallery.append(instance.banner_url)
        if vendor and getattr(vendor, 'banner_url', None) and vendor.banner_url not in gallery:
            gallery.append(vendor.banner_url)
        if instance.logo_url and instance.logo_url not in gallery:
            gallery.append(instance.logo_url)
        if vendor and getattr(vendor, 'logo_url', None) and vendor.logo_url not in gallery:
            gallery.append(vendor.logo_url)

        # Include sample product images for the gallery if fewer than 3
        if vendor and len(gallery) < 4:
            try:
                from apps.catalogue.models import ProductImage
                prod_imgs = ProductImage.objects.filter(product__vendor=vendor).values_list('image_url', flat=True)[:6]
                for p_url in prod_imgs:
                    if p_url and p_url not in gallery:
                        gallery.append(p_url)
            except Exception:
                pass

        data['gallery'] = gallery
        data['address'] = instance.address or (vendor.stores.filter(address__gt='').values_list('address', flat=True).first() if vendor else '') or 'Chapakhel Road, Lalitpur, Nepal'
        data['phone'] = instance.contact_phone or (vendor.user.phone_number if vendor and hasattr(vendor, 'user') else '') or '+977-1-5544332'
        data['email'] = instance.contact_email or (vendor.user.email if vendor and hasattr(vendor, 'user') else '') or 'store@oyopasal.com'
        data['description'] = instance.description or (vendor.store_description if vendor else '') or 'Official certified marketplace vendor on OyoPasal providing fast, fresh, high-quality groceries and goods.'
        return data


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
