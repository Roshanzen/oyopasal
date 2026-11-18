from decimal import Decimal
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from apps.catalogue.models import (
    Category,
    Brand,
    Product,
    ProductVariant,
    ProductImage,
    ProductStatus,
    ProductModerationLog
)
from apps.stores.models import Store

class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon_url', 'image_url', 'ordering']


class CategoryTreeSerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(many=True, read_only=True)
    breadcrumbs = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()
    accent = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'name', 'slug', 'description', 'icon_url', 'icon',
            'image_url', 'ordering', 'item_count', 'accent', 'subcategories', 'breadcrumbs'
        ]

    def get_breadcrumbs(self, obj):
        return [{'id': a.id, 'name': a.name, 'slug': a.slug} for a in obj.get_ancestors()]

    def get_icon(self, obj):
        # Map common slugs to Lucide icon identifiers
        slug_icons = {
            'fruits-vegetables': 'Apple',
            'dairy-bakery': 'Milk',
            'grocery-staples': 'Package',
            'snacks-beverages': 'Cookie',
            'consumer-electronics': 'Zap',
            'chargers-cables': 'Zap',
            'handicrafts-art': 'Sparkles',
            'fashion-apparel': 'Shirt',
            'health-wellness': 'HeartPulse',
            'home-kitchen': 'Home',
        }
        return slug_icons.get(obj.slug, 'Package')

    def get_item_count(self, obj):
        return getattr(obj, 'product_count', 12)

    def get_accent(self, obj):
        accents = ['#059669', '#16A34A', '#0D9488', '#EA580C', '#2563EB', '#7C3AED', '#DB2777']
        return accents[abs(hash(str(obj.slug))) % len(accents)]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'slug', 'logo_url', 'website', 'is_active']
        read_only_fields = ['id', 'slug']


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'variant', 'image_url', 'alt_text', 'is_primary', 'ordering']
        read_only_fields = ['id']


class ProductVariantSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)
    discount_percentage = serializers.FloatField(read_only=True)
    is_in_stock = serializers.SerializerMethodField()
    stock_quantity = serializers.IntegerField(required=False, default=50)

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'barcode', 'regular_price', 'selling_price',
            'discount_percentage', 'attributes', 'is_default', 'is_active',
            'is_in_stock', 'stock_quantity'
        ]
        read_only_fields = ['is_in_stock']
        extra_kwargs = {
            'sku': {'validators': []}
        }

    def validate_sku(self, value):
        qs = ProductVariant.objects.filter(sku=value)
        product_instance = getattr(self.root, 'instance', None)
        if product_instance and hasattr(product_instance, 'variants'):
            qs = qs.exclude(product=product_instance)
        elif self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Product Variant with this sku already exists.")
        return value

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        from apps.inventory.models import InventoryItem
        from django.db.models import Sum, F
        total = InventoryItem.objects.filter(
            variant=instance
        ).aggregate(avail=Sum(F('quantity_on_hand') - F('quantity_reserved')))['avail']
        ret['stock_quantity'] = max(0, total) if total is not None else 0
        return ret

    @extend_schema_field(serializers.BooleanField())
    def get_is_in_stock(self, obj):
        from apps.inventory.models import InventoryItem
        from django.db.models import F
        return InventoryItem.objects.filter(
            variant=obj,
            quantity_on_hand__gt=F('quantity_reserved')
        ).exists()


class ProductListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    brand_name = serializers.CharField(source='brand.name', read_only=True, default=None)
    brand_slug = serializers.CharField(source='brand.slug', read_only=True, default=None)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    vendor_slug = serializers.CharField(source='vendor.slug', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    store_address = serializers.CharField(source='store.address', read_only=True, default='')
    store_latitude = serializers.SerializerMethodField()
    store_longitude = serializers.SerializerMethodField()
    
    primary_image = serializers.SerializerMethodField()
    price_range = serializers.SerializerMethodField()
    selling_price = serializers.SerializerMethodField()
    regular_price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    default_variant_id = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'base_sku', 'short_description',
            'category_name', 'category_slug', 'brand_name', 'brand_slug',
            'vendor_name', 'vendor_slug', 'store_name', 'store_slug', 'store_address',
            'store_latitude', 'store_longitude',
            'primary_image', 'price_range', 'selling_price',
            'regular_price', 'discount_percentage', 'default_variant_id',
            'is_in_stock', 'stock_quantity', 'is_featured', 'created_at'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Ensure category object
        ret['category'] = {
            'id': str(instance.category.id) if instance.category else '',
            'name': instance.category.name if instance.category else 'General',
            'slug': instance.category.slug if instance.category else 'general'
        }
        # Ensure vendor object
        vendor_name = instance.vendor.business_name if instance.vendor else 'Local Mart'
        ret['vendor'] = {
            'id': str(instance.vendor.slug if instance.vendor else 'v-local'),
            'name': vendor_name,
            'rating': 4.8,
            'delivery_time_mins': '10-15 mins'
        }
        # Prices
        sel_price = ret.get('selling_price') or '0.00'
        reg_price = ret.get('regular_price') or sel_price
        ret['discounted_price'] = float(sel_price)
        ret['original_price'] = float(reg_price)
        ret['price'] = float(sel_price)
        # Image
        img = ret.get('primary_image') or ''
        ret['image_url'] = img
        ret['image'] = img
        # Stock & ratings
        ret['in_stock'] = bool(ret.get('is_in_stock', True))
        ret['stock'] = ret.get('stock_quantity', 50)
        ret['rating'] = 4.8
        ret['reviews_count'] = 16
        ret['unit'] = 'Standard'
        ret['description'] = instance.short_description or getattr(instance, 'description', '') or ''
        # Sections for homepage carousels
        sec = []
        if instance.is_featured:
            sec.extend(['best_sellers', 'trending'])
        if (ret.get('discount_percentage') or 0) > 10:
            sec.append('top_deals')
        sec.append('fresh_arrivals')
        ret['sections'] = sec
        return ret

    @extend_schema_field(serializers.BooleanField())
    def get_is_in_stock(self, obj):
        from apps.inventory.models import InventoryItem
        from django.db.models import F
        return InventoryItem.objects.filter(
            variant__product=obj,
            quantity_on_hand__gt=F('quantity_reserved')
        ).exists()

    @extend_schema_field(serializers.IntegerField())
    def get_stock_quantity(self, obj):
        from apps.inventory.models import InventoryItem
        from django.db.models import Sum, F
        total = InventoryItem.objects.filter(
            variant__product=obj
        ).aggregate(avail=Sum(F('quantity_on_hand') - F('quantity_reserved')))['avail']
        return max(0, total) if total is not None else 0

    @extend_schema_field(serializers.FloatField(allow_null=True))
    def get_store_latitude(self, obj):
        if obj.store and obj.store.latitude:
            return float(obj.store.latitude)
        name_lower = (obj.store.name if obj.store else '').lower()
        addr_lower = (obj.store.address if obj.store else '').lower()
        if 'craft' in name_lower or 'patan' in addr_lower or 'lalitpur' in addr_lower:
            return 27.6738
        return 27.7033

    @extend_schema_field(serializers.FloatField(allow_null=True))
    def get_store_longitude(self, obj):
        if obj.store and obj.store.longitude:
            return float(obj.store.longitude)
        name_lower = (obj.store.name if obj.store else '').lower()
        addr_lower = (obj.store.address if obj.store else '').lower()
        if 'craft' in name_lower or 'patan' in addr_lower or 'lalitpur' in addr_lower:
            return 85.3253
        return 85.3120

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_primary_image(self, obj):
        first_img = obj.images.filter(is_primary=True).first() or obj.images.first()
        return first_img.image_url if first_img else None

    @extend_schema_field(serializers.DictField())
    def get_price_range(self, obj):
        active_variants = [v for v in obj.variants.all() if v.is_active]
        if not active_variants:
            return {'min_price': '0.00', 'max_price': '0.00'}
        prices = [v.selling_price for v in active_variants]
        return {
            'min_price': str(min(prices)),
            'max_price': str(max(prices)),
            'has_discount': any(v.discount_percentage > 0 for v in active_variants)
        }

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_selling_price(self, obj):
        active_variants = [v for v in obj.variants.all() if v.is_active]
        if not active_variants:
            return '0.00'
        default_v = next((v for v in active_variants if v.is_default), active_variants[0])
        return str(default_v.selling_price)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_regular_price(self, obj):
        active_variants = [v for v in obj.variants.all() if v.is_active]
        if not active_variants:
            return '0.00'
        default_v = next((v for v in active_variants if v.is_default), active_variants[0])
        return str(default_v.regular_price)

    @extend_schema_field(serializers.FloatField(allow_null=True))
    def get_discount_percentage(self, obj):
        active_variants = [v for v in obj.variants.all() if v.is_active]
        if not active_variants:
            return 0.0
        default_v = next((v for v in active_variants if v.is_default), active_variants[0])
        return float(default_v.discount_percentage)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_default_variant_id(self, obj):
        active_variants = [v for v in obj.variants.all() if v.is_active]
        if not active_variants:
            return None
        default_v = next((v for v in active_variants if v.is_default), active_variants[0])
        return str(default_v.id)


class ProductDetailSerializer(serializers.ModelSerializer):
    category = CategoryTreeSerializer(read_only=True)
    brand = BrandSerializer(read_only=True)
    brand_slug = serializers.CharField(source='brand.slug', read_only=True, default=None)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    vendor_slug = serializers.CharField(source='vendor.slug', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    store_slug = serializers.CharField(source='store.slug', read_only=True)
    store_address = serializers.CharField(source='store.address', read_only=True, default='')
    store_latitude = serializers.SerializerMethodField()
    store_longitude = serializers.SerializerMethodField()
    variants = ProductVariantSerializer(many=True, read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    is_in_stock = serializers.SerializerMethodField()
    stock_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'base_sku', 'short_description', 'description',
            'status', 'category', 'brand', 'brand_slug', 'vendor_name', 'vendor_slug',
            'store_name', 'store_slug', 'store_address', 'store_latitude', 'store_longitude',
            'tax_rate', 'is_featured', 'is_returnable', 'warranty_info',
            'variants', 'images', 'is_in_stock', 'stock_quantity', 'created_at'
        ]
        read_only_fields = ['id', 'slug', 'status', 'created_at']

    @extend_schema_field(serializers.BooleanField())
    def get_is_in_stock(self, obj):
        from apps.inventory.models import InventoryItem
        from django.db.models import F
        return InventoryItem.objects.filter(
            variant__product=obj,
            quantity_on_hand__gt=F('quantity_reserved')
        ).exists()

    @extend_schema_field(serializers.IntegerField())
    def get_stock_quantity(self, obj):
        from apps.inventory.models import InventoryItem
        from django.db.models import Sum, F
        total = InventoryItem.objects.filter(
            variant__product=obj
        ).aggregate(avail=Sum(F('quantity_on_hand') - F('quantity_reserved')))['avail']
        return max(0, total) if total is not None else 0

    @extend_schema_field(serializers.FloatField(allow_null=True))
    def get_store_latitude(self, obj):
        if obj.store and obj.store.latitude:
            return float(obj.store.latitude)
        name_lower = (obj.store.name if obj.store else '').lower()
        addr_lower = (obj.store.address if obj.store else '').lower()
        if 'craft' in name_lower or 'patan' in addr_lower or 'lalitpur' in addr_lower:
            return 27.6738
        return 27.7033

    @extend_schema_field(serializers.FloatField(allow_null=True))
    def get_store_longitude(self, obj):
        if obj.store and obj.store.longitude:
            return float(obj.store.longitude)
        name_lower = (obj.store.name if obj.store else '').lower()
        addr_lower = (obj.store.address if obj.store else '').lower()
        if 'craft' in name_lower or 'patan' in addr_lower or 'lalitpur' in addr_lower:
            return 85.3253
        return 85.3120


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, required=False)
    images = ProductImageSerializer(many=True, required=False)
    store = serializers.PrimaryKeyRelatedField(queryset=Store.objects.all(), required=False)

    class Meta:
        model = Product
        fields = [
            'id', 'slug', 'store', 'category', 'brand', 'name', 'base_sku',
            'short_description', 'description', 'tax_rate',
            'is_returnable', 'warranty_info', 'is_featured', 'variants', 'images'
        ]
        read_only_fields = ['id', 'slug']

    def to_internal_value(self, data):
        if hasattr(data, 'dict'):
            raw_data = data.dict()
        elif isinstance(data, dict):
            raw_data = data.copy()
        else:
            raw_data = data

        if isinstance(raw_data, dict):
            # 1. Normalize brand: accept UUID string, dict with 'id', or empty string/None
            if 'brand' in raw_data:
                b_val = raw_data['brand']
                if isinstance(b_val, dict):
                    raw_data['brand'] = b_val.get('id')
                elif hasattr(b_val, 'id'):
                    raw_data['brand'] = str(b_val.id)
                elif b_val in ['', 'null', 'None', None]:
                    raw_data['brand'] = None

            # 2. Normalize category: accept UUID string, dict with 'id', or preserve on partial
            if 'category' in raw_data:
                c_val = raw_data['category']
                if isinstance(c_val, dict):
                    raw_data['category'] = c_val.get('id')
                elif hasattr(c_val, 'id'):
                    raw_data['category'] = str(c_val.id)
                elif c_val in ['', 'null', 'None', None]:
                    if self.instance and self.partial:
                        raw_data.pop('category', None)

            # 3. Normalize store: accept UUID string, dict with 'id', or preserve on partial
            if 'store' in raw_data:
                s_val = raw_data['store']
                if isinstance(s_val, dict):
                    raw_data['store'] = s_val.get('id')
                elif hasattr(s_val, 'id'):
                    raw_data['store'] = str(s_val.id)
                elif s_val in ['', 'null', 'None', None]:
                    if self.instance and self.partial:
                        raw_data.pop('store', None)

            # 4. Handle multipart/form-data stringified variants and images
            if 'variants' in raw_data and isinstance(raw_data['variants'], str):
                import json
                try:
                    raw_data['variants'] = json.loads(raw_data['variants'])
                except (ValueError, TypeError):
                    pass

            if 'images' in raw_data and isinstance(raw_data['images'], str):
                import json
                try:
                    raw_data['images'] = json.loads(raw_data['images'])
                except (ValueError, TypeError):
                    pass

            # 5. Handle images as simple list of string URLs and resolve indirect links
            if 'images' in raw_data and isinstance(raw_data['images'], list):
                from apps.common.services.image_resolver import resolve_image_url
                norm_images = []
                for idx, img in enumerate(raw_data['images']):
                    if isinstance(img, str) and img.strip():
                        norm_images.append({
                            'image_url': resolve_image_url(img.strip()),
                            'alt_text': raw_data.get('name', 'Product Image'),
                            'is_primary': idx == 0,
                            'ordering': idx
                        })
                    elif isinstance(img, dict):
                        img_dict = dict(img)
                        if 'image_url' in img_dict and isinstance(img_dict['image_url'], str):
                            img_dict['image_url'] = resolve_image_url(img_dict['image_url'].strip())
                        norm_images.append(img_dict)
                raw_data['images'] = norm_images

            # 6. Handle multipart/form-data file uploads from request.FILES
            request = self.context.get('request')
            if request and getattr(request, 'FILES', None):
                import os, uuid
                from django.core.files.storage import default_storage
                uploaded_media = []
                for file_key in ['images', 'image', 'primary_image', 'uploaded_images']:
                    for file_obj in request.FILES.getlist(file_key):
                        ext = os.path.splitext(file_obj.name)[1]
                        file_name = f"products/{uuid.uuid4()}{ext}"
                        saved_path = default_storage.save(file_name, file_obj)
                        url = default_storage.url(saved_path)
                        if not url.startswith('http') and request:
                            url = request.build_absolute_uri(url)
                        uploaded_media.append({
                            'image_url': url,
                            'alt_text': getattr(file_obj, 'name', 'Product Image'),
                            'is_primary': len(uploaded_media) == 0 and not raw_data.get('images'),
                            'ordering': len(uploaded_media)
                        })
                if uploaded_media:
                    existing = raw_data.get('images', [])
                    if isinstance(existing, list):
                        raw_data['images'] = existing + uploaded_media
                    else:
                        raw_data['images'] = uploaded_media

            # 7. Map root pricing and stock convenience fields into default variant if provided
            root_sell = raw_data.pop('selling_price', None)
            root_reg = raw_data.pop('regular_price', None)
            root_stock = raw_data.pop('stock_quantity', None)
            if root_sell is not None or root_reg is not None or root_stock is not None:
                if 'variants' not in raw_data or not raw_data['variants']:
                    v_dict = {}
                    if root_sell is not None:
                        v_dict['selling_price'] = root_sell
                    if root_reg is not None:
                        v_dict['regular_price'] = root_reg
                    if root_stock is not None:
                        v_dict['stock_quantity'] = int(root_stock)
                    raw_data['variants'] = [v_dict]
                elif isinstance(raw_data['variants'], list) and len(raw_data['variants']) > 0:
                    if root_sell is not None:
                        raw_data['variants'][0]['selling_price'] = root_sell
                    if root_reg is not None:
                        raw_data['variants'][0]['regular_price'] = root_reg
                    if root_stock is not None:
                        raw_data['variants'][0]['stock_quantity'] = int(root_stock)

        return super().to_internal_value(raw_data)

    def validate_store(self, value):
        if value:
            user = self.context['request'].user
            if not hasattr(user, 'vendor_profile') or value.vendor != user.vendor_profile:
                raise serializers.ValidationError("You can only create products in a store belonging to your vendor account.")
        return value

    def create(self, validated_data):
        variants_data = validated_data.pop('variants', [])
        images_data = validated_data.pop('images', [])
        vendor = self.context['request'].user.vendor_profile

        if 'store' not in validated_data or not validated_data['store']:
            default_store = vendor.stores.filter(is_active=True).first() or vendor.stores.first()
            if not default_store:
                from apps.stores.models import Store
                from django.utils.text import slugify
                base_slug = slugify(vendor.business_name) or f"store-{str(vendor.id)[:8]}"
                slug = base_slug
                counter = 1
                while Store.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                default_store = Store.objects.create(
                    vendor=vendor,
                    name=vendor.business_name,
                    slug=slug,
                    description=vendor.store_description or f"Official storefront of {vendor.business_name}",
                    contact_email=getattr(vendor.user, 'email', ''),
                    is_active=True,
                    is_verified=False
                )
            validated_data['store'] = default_store

        from apps.subscriptions.services import SubscriptionService, SubscriptionLimitExceededError
        try:
            SubscriptionService.enforce_product_limit(vendor)
        except SubscriptionLimitExceededError as e:
            raise serializers.ValidationError({'detail': str(e)})

        with transaction.atomic():
            explicit_status = validated_data.pop('status', None)
            init_status = explicit_status or ProductStatus.DRAFT
            product = Product.objects.create(
                vendor=vendor,
                status=init_status,
                **validated_data
            )

            from apps.warehouse.models import Warehouse
            from apps.inventory.models import InventoryItem
            default_warehouse = Warehouse.objects.filter(is_active=True).first()

            created_variants = []
            # Create default variant if none provided
            if not variants_data:
                v = ProductVariant.objects.create(
                    product=product,
                    sku=f"{product.base_sku}-DEF",
                    regular_price=Decimal('0.00'),
                    selling_price=Decimal('0.00'),
                    is_default=True
                )
                created_variants.append((v, 50))
            else:
                for idx, v_data in enumerate(variants_data):
                    is_def = v_data.pop('is_default', idx == 0)
                    stock_qty = v_data.pop('stock_quantity', 50)
                    v = ProductVariant.objects.create(
                        product=product,
                        is_default=is_def,
                        **v_data
                    )
                    created_variants.append((v, stock_qty))

            if default_warehouse:
                for variant, qty in created_variants:
                    InventoryItem.objects.get_or_create(
                        warehouse=default_warehouse,
                        variant=variant,
                        defaults={'quantity_on_hand': int(qty or 50), 'reorder_threshold': 5}
                    )

            for img_data in images_data:
                ProductImage.objects.create(product=product, **img_data)

        return product

    def update(self, instance, validated_data):
        variants_data = validated_data.pop('variants', None)
        images_data = validated_data.pop('images', None)

        with transaction.atomic():
            for attr, val in validated_data.items():
                setattr(instance, attr, val)
            instance.save()

            from apps.warehouse.models import Warehouse
            from apps.inventory.models import InventoryItem
            default_warehouse = Warehouse.objects.filter(is_active=True).first()

            if variants_data is not None:
                default_variant = instance.variants.filter(is_default=True).first() or instance.variants.first()
                if default_variant and len(variants_data) == 1:
                    v_item = variants_data[0]
                    v_item.pop('id', None)
                    stock_val = v_item.pop('stock_quantity', None)
                    for v_k, v_v in v_item.items():
                        setattr(default_variant, v_k, v_v)
                    default_variant.save()

                    if stock_val is not None and default_warehouse:
                        inv, _ = InventoryItem.objects.get_or_create(
                            warehouse=default_warehouse,
                            variant=default_variant,
                            defaults={'quantity_on_hand': int(stock_val), 'reorder_threshold': 5}
                        )
                        inv.quantity_on_hand = int(stock_val)
                        inv.save(update_fields=['quantity_on_hand', 'updated_at'])
                else:
                    instance.variants.all().delete()
                    for idx, v_data in enumerate(variants_data):
                        v_data.pop('id', None)
                        is_def = v_data.pop('is_default', idx == 0)
                        stock_val = v_data.pop('stock_quantity', 50)
                        new_var = ProductVariant.objects.create(
                            product=instance,
                            is_default=is_def,
                            **v_data
                        )
                        if default_warehouse:
                            InventoryItem.objects.get_or_create(
                                warehouse=default_warehouse,
                                variant=new_var,
                                defaults={'quantity_on_hand': int(stock_val or 50), 'reorder_threshold': 5}
                            )

            if images_data is not None and len(images_data) > 0:
                instance.images.all().delete()
                for idx, img_data in enumerate(images_data):
                    img_data.pop('id', None)
                    if 'ordering' not in img_data:
                        img_data['ordering'] = idx
                    ProductImage.objects.create(product=instance, **img_data)

        return instance


class ProductModerationActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['APPROVE', 'REJECT', 'SUSPEND'])
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['action'] == 'REJECT' and not attrs.get('reason'):
            raise serializers.ValidationError({'reason': 'A reason is required when rejecting a product.'})
        return attrs

