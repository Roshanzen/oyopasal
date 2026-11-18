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
            v_id = str(item.variant.product.vendor_id)
            if v_id not in groups:
                groups[v_id] = {
                    'vendor_id': v_id,
                    'vendor_name': item.variant.product.vendor.business_name,
                    'store_name': item.variant.product.store.name if item.variant.product.store else '',
                    'items': [],
                    'subtotal': '0.00'
                }
            groups[v_id]['items'].append(CartItemSerializer(item).data)
            current_sub = float(groups[v_id]['subtotal']) + float(item.total_price)
            groups[v_id]['subtotal'] = f"{current_sub:.2f}"
        return list(groups.values())

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        items_list = []
        for it in instance.items.select_related('variant', 'variant__product', 'variant__product__vendor', 'variant__product__category'):
            p = it.variant.product
            v = p.vendor
            cat = p.category
            prod_dict = {
                'id': str(p.id),
                'name': p.name,
                'slug': p.slug,
                'category': {'id': str(cat.id) if cat else '', 'name': cat.name if cat else 'General', 'slug': cat.slug if cat else 'general'},
                'vendor': {'id': str(v.slug if v else 'v-local'), 'name': v.business_name if v else 'Local Mart', 'rating': 4.8, 'delivery_time_mins': '10-15 mins'},
                'original_price': float(it.variant.regular_price or it.variant.selling_price),
                'discounted_price': float(it.variant.selling_price),
                'price': float(it.variant.selling_price),
                'discount_percentage': float(it.variant.discount_percentage or 0),
                'unit': 'Standard',
                'stock': 50,
                'in_stock': True,
                'rating': 4.8,
                'reviews_count': 12,
                'image_url': getattr(p, 'primary_image', '') or '',
                'description': p.short_description or '',
                'sections': ['best_sellers']
            }
            u_price = float(it.unit_price or it.variant.selling_price)
            t_price = float(it.total_price or (it.quantity * it.variant.selling_price))
            items_list.append({
                'id': str(it.id),
                'product_id': str(p.id),
                'product': prod_dict,
                'quantity': it.quantity,
                'selected_variant_id': str(it.variant_id),
                'unit_price': u_price,
                'total_price': t_price
            })

        subtotal = sum(i['total_price'] for i in items_list)
        item_count = sum(i['quantity'] for i in items_list)
        free_thresh = 499.0
        delivery_fee = 0.0 if (subtotal >= free_thresh or subtotal == 0) else 35.0
        handling_fee = 15.0 if subtotal > 0 else 0.0
        total = subtotal + delivery_fee + handling_fee

        ret['items'] = items_list
        ret['item_count'] = item_count
        ret['total_items'] = item_count
        ret['vendor_count'] = len(ret.get('grouped_by_vendor', []))
        ret['subtotal'] = f"{subtotal:.2f}"
        ret['delivery_fee'] = delivery_fee
        ret['free_delivery_threshold'] = free_thresh
        ret['amount_needed_for_free_delivery'] = max(0.0, free_thresh - subtotal)
        ret['handling_fee'] = handling_fee
        ret['coupon'] = None
        ret['total'] = total
        ret['vendor_groups'] = ret.get('grouped_by_vendor', [])
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

        if not variant:
            raise serializers.ValidationError("Valid product or variant not found.")
        attrs['variant'] = variant
        return attrs


class UpdateCartItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(required=True, min_value=1)

