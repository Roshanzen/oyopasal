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
            'latitude', 'longitude', 'max_local_delivery_km',
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

        request = self.context.get('request')

        # Resolved media URLs
        if instance.logo:
            data['logo'] = request.build_absolute_uri(instance.logo.url) if request else instance.logo.url
            data['logo_url'] = data['logo']
        elif instance.logo_url:
            data['logo'] = instance.logo_url
            data['logo_url'] = instance.logo_url

        if instance.cover_banner:
            data['banner'] = request.build_absolute_uri(instance.cover_banner.url) if request else instance.cover_banner.url
            data['banner_url'] = data['banner']
            data['cover_banner'] = data['banner']
        elif instance.banner_url:
            data['banner'] = instance.banner_url
            data['banner_url'] = instance.banner_url
            data['cover_banner'] = instance.banner_url

        data['rating'] = avg_rating
        data['delivery_time_mins'] = '10-15 mins'
        data['open_time'] = instance.opening_time.strftime('%I:%M %p') if instance.opening_time else '09:00 AM'
        data['close_time'] = instance.closing_time.strftime('%I:%M %p') if instance.closing_time else '09:00 PM'
        data['opening_time'] = data['open_time']
        data['closing_time'] = data['close_time']
        data['is_open'] = instance.is_active
        data['fulfillment_modes'] = 'Store Pickup & Delivery'

        data['store_name'] = instance.store_name or instance.name
        data['short_description'] = instance.short_description or (instance.description[:220] if instance.description else '')
        data['area_ward'] = instance.area_ward or instance.address or ''

        # Gallery photos: First pull from StoreGalleryImage
        gallery = []
        gallery_objects = []
        store_gallery_images = instance.gallery_images.all().order_by('sort_order', 'created_at')
        for gi in store_gallery_images:
            url = None
            if gi.image:
                url = request.build_absolute_uri(gi.image.url) if request else gi.image.url
            elif gi.image_url:
                url = gi.image_url
            if url:
                gallery_objects.append({
                    'id': str(gi.id),
                    'url': url,
                    'caption': gi.caption or '',
                    'sort_order': gi.sort_order,
                })
                if url not in gallery:
                    gallery.append(url)

        data['gallery_images'] = gallery_objects

        # Fallback to general photos if no gallery images uploaded yet
        if not gallery:
            if data.get('banner'):
                gallery.append(data['banner'])
            if vendor and getattr(vendor, 'banner_url', None) and vendor.banner_url not in gallery:
                gallery.append(vendor.banner_url)
            if data.get('logo') and data['logo'] not in gallery:
                gallery.append(data['logo'])
            if vendor and getattr(vendor, 'logo_url', None) and vendor.logo_url not in gallery:
                gallery.append(vendor.logo_url)

            # Include sample product images for the gallery if fewer than 4
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
        data['address'] = instance.area_ward or instance.address or (vendor.stores.filter(address__gt='').values_list('address', flat=True).first() if vendor else '') or 'Chapakhel Road, Lalitpur, Nepal'
        data['phone'] = instance.contact_phone or (vendor.user.phone_number if vendor and hasattr(vendor, 'user') else '') or '+977-1-5544332'
        data['email'] = instance.contact_email or (vendor.user.email if vendor and hasattr(vendor, 'user') else '') or 'store@oyopasal.com'
        data['description'] = instance.short_description or instance.description or (vendor.store_description if vendor else '') or 'Official certified marketplace vendor on OyoPasal providing fast, fresh, high-quality groceries and goods.'
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

        request = self.context.get('request')

        # Resolved media URLs
        if instance.logo:
            data['logo'] = request.build_absolute_uri(instance.logo.url) if request else instance.logo.url
            data['logo_url'] = data['logo']
        elif instance.logo_url:
            data['logo'] = instance.logo_url
            data['logo_url'] = instance.logo_url

        if instance.cover_banner:
            data['banner'] = request.build_absolute_uri(instance.cover_banner.url) if request else instance.cover_banner.url
            data['banner_url'] = data['banner']
            data['cover_banner'] = data['banner']
        elif instance.banner_url:
            data['banner'] = instance.banner_url
            data['banner_url'] = instance.banner_url
            data['cover_banner'] = instance.banner_url

        data['rating'] = avg_rating
        data['delivery_time_mins'] = '10-15 mins'
        data['open_time'] = instance.opening_time.strftime('%I:%M %p') if instance.opening_time else '09:00 AM'
        data['close_time'] = instance.closing_time.strftime('%I:%M %p') if instance.closing_time else '09:00 PM'
        data['opening_time'] = data['open_time']
        data['closing_time'] = data['close_time']
        data['is_open'] = instance.is_active
        data['fulfillment_modes'] = 'Store Pickup & Delivery'

        data['store_name'] = instance.store_name or instance.name
        data['short_description'] = instance.short_description or (instance.description[:220] if instance.description else '')
        data['area_ward'] = instance.area_ward or instance.address or ''

        # Gallery photos: First pull from StoreGalleryImage
        gallery = []
        gallery_objects = []
        store_gallery_images = instance.gallery_images.all().order_by('sort_order', 'created_at')
        for gi in store_gallery_images:
            url = None
            if gi.image:
                url = request.build_absolute_uri(gi.image.url) if request else gi.image.url
            elif gi.image_url:
                url = gi.image_url
            if url:
                gallery_objects.append({
                    'id': str(gi.id),
                    'url': url,
                    'caption': gi.caption or '',
                    'sort_order': gi.sort_order,
                })
                if url not in gallery:
                    gallery.append(url)

        data['gallery_images'] = gallery_objects

        # Fallback to general photos if no gallery images uploaded yet
        if not gallery:
            if data.get('banner'):
                gallery.append(data['banner'])
            if vendor and getattr(vendor, 'banner_url', None) and vendor.banner_url not in gallery:
                gallery.append(vendor.banner_url)
            if data.get('logo') and data['logo'] not in gallery:
                gallery.append(data['logo'])
            if vendor and getattr(vendor, 'logo_url', None) and vendor.logo_url not in gallery:
                gallery.append(vendor.logo_url)

            # Include sample product images for the gallery if fewer than 4
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
        data['address'] = instance.area_ward or instance.address or (vendor.stores.filter(address__gt='').values_list('address', flat=True).first() if vendor else '') or 'Chapakhel Road, Lalitpur, Nepal'
        data['phone'] = instance.contact_phone or (vendor.user.phone_number if vendor and hasattr(vendor, 'user') else '') or '+977-1-5544332'
        data['email'] = instance.contact_email or (vendor.user.email if vendor and hasattr(vendor, 'user') else '') or 'store@oyopasal.com'
        data['description'] = instance.short_description or instance.description or (vendor.store_description if vendor else '') or 'Official certified marketplace vendor on OyoPasal providing fast, fresh, high-quality groceries and goods.'
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
