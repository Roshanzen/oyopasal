from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from apps.cart.models import Cart, CartItem
from apps.catalogue.models import ProductVariant

class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='variant.product.name', read_only=True)
    product_slug = serializers.CharField(source='variant.product.slug', read_only=True)
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    attributes = serializers.JSONField(source='variant.attributes', read_only=True)
    vendor_id = serializers.CharField(source='variant.product.vendor.id', read_only=True)
    vendor_name = serializers.CharField(source='variant.product.vendor.business_name', read_only=True)
    store_name = serializers.CharField(source='variant.product.store.name', read_only=True)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id', 'variant', 'product_name', 'product_slug',
            'variant_sku', 'attributes', 'vendor_id', 'vendor_name',
            'store_name', 'quantity', 'unit_price', 'total_price', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    vendor_count = serializers.IntegerField(read_only=True)
    grouped_by_vendor = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = [
            'id', 'total_items', 'subtotal', 'vendor_count',
            'items', 'grouped_by_vendor', 'updated_at'
        ]
        read_only_fields = ['id', 'updated_at']

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_grouped_by_vendor(self, obj):
        groups = {}
        for item in obj.items.select_related('variant__product__vendor', 'variant__product__store'):
            p = getattr(item.variant, 'product', None) if item.variant else None
            v = p.vendor if p else None
            v_id = str(v.id if v else 'v-local')
            v_name = v.business_name if v else 'Local Mart'
            if v_id not in groups:
                groups[v_id] = {
                    'vendor': {
                        'id': v_id,
                        'name': v_name,
                    },
                    'vendor_id': v_id,
                    'vendor_name': v_name,
                    'store_name': p.store.name if (p and p.store) else '',
                    'items': [],
                    'subtotal': '0.00',
                    'delivery_fee': 0.0,
                }
            groups[v_id]['items'].append(CartItemSerializer(item).data)
            current_sub = float(groups[v_id]['subtotal']) + float(item.total_price)
            groups[v_id]['subtotal'] = f"{current_sub:.2f}"
        return list(groups.values())

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        items_list = []
        vendor_groups_map = {}

        for it in instance.items.select_related('variant', 'variant__product', 'variant__product__vendor', 'variant__product__category').prefetch_related('variant__product__images'):
            p = it.variant.product if it.variant else None
            v = p.vendor if p else None
            cat = p.category if p else None

            # Get image URL safely (check variant-specific image first)
            attrs = it.variant.attributes or {} if it.variant else {}
            color = attrs.get('color') or attrs.get('color_name') or ''
            color_code = attrs.get('color_code') or attrs.get('color_value') or ''
            size = attrs.get('size') or ''
            var_name = attrs.get('name') or (f"{color} / {size}" if color and size else (color or size or ''))

            var_img = ''
            if it.variant:
                v_imgs = list(it.variant.images.all())
                v_img = v_imgs[0] if v_imgs else None
                if v_img:
                    var_img = v_img.image_url
                elif attrs.get('image_url'):
                    var_img = attrs.get('image_url')

            img_url = var_img
            if not img_url and p:
                p_imgs = list(p.images.all())
                first_img = next((img for img in p_imgs if img.is_primary), None) or (p_imgs[0] if p_imgs else None)
                if first_img:
                    img_url = first_img.image_url

            v_id = str(v.id if v else 'v-local')
            v_name = v.business_name if v else 'Local Mart'

            if p:
                prod_dict = {
                    'id': str(p.id),
                    'name': p.name,
                    'slug': p.slug,
                    'category': {
                        'id': str(cat.id) if cat else '',
                        'name': cat.name if cat else 'General',
                        'slug': cat.slug if cat else 'general'
                    },
                    'vendor': {
                        'id': v_id,
                        'name': v_name,
                        'rating': 4.8,
                        'delivery_time_mins': '10-15 mins'
                    },
                    'original_price': float(it.variant.regular_price or it.variant.selling_price),
                    'discounted_price': float(it.variant.selling_price),
                    'price': float(it.variant.selling_price),
                    'discount_percentage': float(it.variant.discount_percentage or 0),
                    'unit': getattr(p, 'unit', 'piece') or 'piece',
                    'stock': 50,
                    'in_stock': True,
                    'rating': 4.8,
                    'reviews_count': 12,
                    'image_url': img_url,
                    'gallery': [img_url] if img_url else [],
                    'images': [{'image_url': img_url, 'is_primary': True}] if img_url else [],
                    'variants': [],
                    'has_variants': False,
                    'available_colors': [],
                    'available_sizes': [],
                    'description': p.short_description or '',
                    'sections': ['best_sellers']
                }
            else:
                prod_dict = {
                    'id': 'unknown',
                    'name': 'Unavailable Product',
                    'slug': 'unavailable',
                    'category': {'id': '', 'name': 'General', 'slug': 'general'},
                    'vendor': {'id': v_id, 'name': v_name, 'rating': 4.0, 'delivery_time_mins': 'N/A'},
                    'original_price': float(it.unit_price or 0),
                    'discounted_price': float(it.unit_price or 0),
                    'price': float(it.unit_price or 0),
                    'discount_percentage': 0,
                    'unit': 'piece',
                    'stock': 0,
                    'in_stock': False,
                    'rating': 0,
                    'reviews_count': 0,
                    'image_url': '',
                    'gallery': [],
                    'images': [],
                    'variants': [],
                    'has_variants': False,
                    'available_colors': [],
                    'available_sizes': [],
                    'description': 'This product is currently unavailable.',
                    'sections': []
                }

            u_price = float(it.unit_price or (it.variant.selling_price if it.variant else 0))
            t_price = float(it.total_price or (it.quantity * u_price))
            item_data = {
                'id': str(it.id),
                'product_id': str(p.id) if p else 'unknown',
                'product': prod_dict,
                'quantity': it.quantity,
                'selected_variant_id': str(it.variant_id) if it.variant_id else '',
                'variant_id': str(it.variant_id) if it.variant_id else '',
                'variant_sku': it.variant.sku if it.variant else '',
                'variant_name': var_name,
                'color': color,
                'color_code': color_code,
                'size': size,
                'image_url': img_url,
                'attributes': attrs,
                'unit_price': u_price,
                'total_price': t_price
            }
            items_list.append(item_data)

            # Group by vendor
            if v_id not in vendor_groups_map:
                vendor_groups_map[v_id] = {
                    'vendor': {
                        'id': v_id,
                        'name': v_name,
                    },
                    'vendor_id': v_id,
                    'vendor_name': v_name,
                    'store_name': p.store.name if (p and p.store) else '',
                    'items': [],
                    'subtotal': 0.0,
                    'delivery_fee': 0.0,
                }
            vendor_groups_map[v_id]['items'].append(item_data)
            vendor_groups_map[v_id]['subtotal'] = round(vendor_groups_map[v_id]['subtotal'] + t_price, 2)

        vendor_groups = list(vendor_groups_map.values())
        subtotal = sum(i['total_price'] for i in items_list)
        item_count = sum(i['quantity'] for i in items_list)
        free_thresh = 499.0
        delivery_fee = 0.0 if (subtotal >= free_thresh or subtotal == 0) else 35.0
        handling_fee = 15.0 if subtotal > 0 else 0.0
        total = subtotal + delivery_fee + handling_fee

        ret['items'] = items_list
        ret['item_count'] = item_count
        ret['total_items'] = item_count
        ret['vendor_count'] = len(vendor_groups)
        ret['subtotal'] = f"{subtotal:.2f}"
        ret['delivery_fee'] = delivery_fee
        ret['free_delivery_threshold'] = free_thresh
        ret['amount_needed_for_free_delivery'] = max(0.0, free_thresh - subtotal)
        ret['handling_fee'] = handling_fee
        ret['coupon'] = None
        ret['total'] = total
        ret['vendor_groups'] = vendor_groups
        ret['grouped_by_vendor'] = vendor_groups
        return ret



class AddToCartSerializer(serializers.Serializer):
    variant_id = serializers.CharField(required=False, allow_null=True)
    product_id = serializers.CharField(required=False, allow_null=True)
    quantity = serializers.IntegerField(default=1, min_value=1)

    def validate(self, attrs):
        v_id = attrs.get('variant_id')
        p_id = attrs.get('product_id')
        import uuid
        variant = None
        if v_id:
            try:
                v_uuid = uuid.UUID(str(v_id))
                variant = ProductVariant.objects.select_related('product').filter(id=v_uuid, is_active=True).first()
            except (ValueError, TypeError):
                pass
        if not variant and p_id:
            try:
                p_uuid = uuid.UUID(str(p_id))
                variant = ProductVariant.objects.select_related('product').filter(product_id=p_uuid, is_active=True).first()
            except (ValueError, TypeError):
                variant = ProductVariant.objects.select_related('product').filter(product__slug=p_id, is_active=True).first()

        if not variant or not getattr(variant, 'product', None):
            raise serializers.ValidationError("Valid product or variant not found.")
        if variant.product.status != 'APPROVED':
            raise serializers.ValidationError(f"Product '{variant.product.name}' is currently unavailable.")

        from apps.inventory.models import InventoryItem
        avail = sum(inv.quantity_available for inv in InventoryItem.objects.filter(variant=variant))
        req_qty = attrs.get('quantity', 1)
        if avail < req_qty:
            raise serializers.ValidationError(f"Insufficient stock available. Requested: {req_qty}, In stock: {avail}.")

        attrs['variant'] = variant
        return attrs


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(required=True, min_value=1)

