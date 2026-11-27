from rest_framework import serializers
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatusHistory, OrderStatus

class OrderItemSerializer(serializers.ModelSerializer):
    store_name = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'variant', 'product_name', 'product_title_snapshot', 'store_name_snapshot',
            'store_name', 'variant_sku', 'attributes_snapshot', 'unit_price', 'quantity',
            'total_price', 'tax_rate', 'tax_amount'
        ]
        read_only_fields = ['id']

    def get_store_name(self, obj):
        if obj.store_name_snapshot:
            return obj.store_name_snapshot
        if obj.store and obj.store.name:
            return obj.store.name
        if obj.sub_order and getattr(obj.sub_order, 'store_name_snapshot', ''):
            return obj.sub_order.store_name_snapshot
        return ''

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        attrs = instance.attributes_snapshot or {}
        ret['color'] = attrs.get('color') or attrs.get('color_name') or ''
        ret['color_code'] = attrs.get('color_code') or attrs.get('color_value') or ''
        ret['size'] = attrs.get('size') or ''
        ret['variant_name'] = attrs.get('name') or ''
        ret['product_name'] = instance.product_title_snapshot or instance.product_name or ''
        return ret


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True, default='System')

    class Meta:
        model = OrderStatusHistory
        fields = [
            'id', 'previous_status', 'new_status', 'remarks',
            'changed_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class VendorSubOrderDetailSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    timeline = OrderStatusHistorySerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    store_name = serializers.SerializerMethodField()
    shipping_destination = serializers.JSONField(source='parent_order.shipping_address_snapshot', read_only=True)

    class Meta:
        model = VendorSubOrder
        fields = [
            'id', 'sub_order_number', 'vendor_name', 'store_name', 'store_name_snapshot',
            'status', 'subtotal', 'delivery_fee', 'commission_rate',
            'commission_amount', 'vendor_net_amount',
            'tracking_number', 'delivery_provider', 'cancellation_reason',
            'shipping_destination', 'shipped_at', 'delivered_at',
            'items', 'timeline', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_store_name(self, obj):
        if obj.store and obj.store.name:
            return obj.store.name
        return obj.store_name_snapshot or (obj.vendor.business_name if obj.vendor else 'Local Store')


class VendorSubOrderListSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    store_name = serializers.SerializerMethodField()
    item_count = serializers.IntegerField(source='items.count', read_only=True)

    class Meta:
        model = VendorSubOrder
        fields = [
            'id', 'sub_order_number', 'vendor_name', 'store_name', 'store_name_snapshot',
            'status', 'subtotal', 'vendor_net_amount', 'item_count',
            'tracking_number', 'created_at'
        ]

    def get_store_name(self, obj):
        if obj.store and obj.store.name:
            return obj.store.name
        return obj.store_name_snapshot or (obj.vendor.business_name if obj.vendor else 'Local Store')


def normalize_status_to_step_index(raw_status):
    """
    Normalizes order/suborder status string to milestone sequence index (0 to 5):
    1. Order Placed (0)
    2. Store Confirmed (1)
    3. Packing Items (2)
    4. Ready for Pickup (3)
    5. Out for Delivery (4)
    6. Delivered (5)
    """
    if not raw_status:
        return 0
    s = str(raw_status).strip().upper().replace(' ', '_').replace('-', '_')
    if s in ['DELIVERED', 'COMPLETED']:
        return 5
    if s in ['OUT_FOR_DELIVERY', 'SHIPPED', 'DISPATCHED']:
        return 4
    if s in ['READY_FOR_DISPATCH', 'READY_FOR_PICKUP', 'READY_FOR_RIDER_PICKUP']:
        return 3
    if s in ['PACKED', 'PACKED_BY_VENDOR', 'PROCESSING']:
        return 2
    if s in ['CONFIRMED', 'CONFIRMED_BY_VENDOR']:
        return 1
    return 0  # PENDING, PLACED, ORDER_PLACED, PENDING_PAYMENT


def build_milestones_for_status(status_str, timeline_entries=None, created_at=None, shipped_at=None, delivered_at=None):
    """
    Constructs the 6 live delivery milestones with accurate status synchronization,
    highlighting the current milestone, and attaching real backend timestamps without fabrication.
    """
    cur_idx = normalize_status_to_step_index(status_str)

    milestone_definitions = [
        ('ORDER_PLACED', 'Order Placed', 'Your order was successfully placed and recorded in OyoPasal.'),
        ('CONFIRMED', 'Store Confirmed', 'Vendor verified inventory and accepted your order.'),
        ('PACKING', 'Packing Items', 'Fresh goods are being gathered and carefully packaged.'),
        ('READY_FOR_PICKUP', 'Ready for Pickup', 'Bag sealed with tamper-proof tag, assigned to rider.'),
        ('OUT_FOR_DELIVERY', 'Out for Delivery', 'Rider has picked up package and is en route to you.'),
        ('DELIVERED', 'Delivered', 'Order handed over successfully at your doorstep.')
    ]

    timestamps = {}
    if created_at:
        timestamps[0] = created_at.strftime('%I:%M %p')

    if timeline_entries:
        for entry in timeline_entries:
            st = getattr(entry, 'new_status', '')
            idx = normalize_status_to_step_index(st)
            ts = getattr(entry, 'created_at', None)
            if idx > 0 and ts and idx not in timestamps:
                timestamps[idx] = ts.strftime('%I:%M %p')

    if shipped_at and 4 not in timestamps:
        timestamps[4] = shipped_at.strftime('%I:%M %p')
    if delivered_at and 5 not in timestamps:
        timestamps[5] = delivered_at.strftime('%I:%M %p')

    steps = []
    for i, (key, title, desc) in enumerate(milestone_definitions):
        is_done = i <= cur_idx
        is_current = (i == cur_idx)
        ts = timestamps.get(i, '') if is_done else ''
        steps.append({
            'key': key,
            'title': title,
            'description': desc,
            'done': is_done,
            'current': is_current,
            'timestamp': ts
        })
    return steps


def build_order_items_by_vendor(instance):
    """
    Build items_by_vendor array matching the React frontend Order contract.
    Groups items by their fulfilling vendor/store and attaches product images & pricing.
    """
    items_by_vendor = []
    suborders = getattr(instance, 'suborders', None)
    if not suborders:
        return items_by_vendor

    for sub in suborders.select_related('vendor', 'store').prefetch_related(
        'items', 'items__variant', 'items__variant__product', 'items__variant__product__images', 'timeline'
    ).all():
        v = getattr(sub, 'vendor', None)
        st = getattr(sub, 'store', None)
        v_items = []
        for item in sub.items.all():
            prod = getattr(item.variant, 'product', None) if getattr(item, 'variant', None) else None
            first_img = None
            if prod and hasattr(prod, 'images'):
                prod_imgs = list(prod.images.all())
                first_img = next((img for img in prod_imgs if img.is_primary), None) or (prod_imgs[0] if prod_imgs else None)
            img_url = first_img.image_url if first_img else ''
            unit_str = getattr(prod, 'unit', 'piece') or 'piece' if prod else 'piece'
            u_price = float(item.unit_price or 0.0)
            t_price = float(item.total_price or (u_price * item.quantity))
            v_items.append({
                'id': str(item.id),
                'product_id': str(prod.id) if prod else '',
                'product_name': item.product_name,
                'unit': unit_str,
                'quantity': item.quantity,
                'unit_price': u_price,
                'total': t_price,
                'image_url': img_url
            })
        st_lat = float(st.latitude) if (st and getattr(st, 'latitude', None) is not None) else (
            float(v.latitude) if (v and getattr(v, 'latitude', None) is not None) else None
        )
        st_lng = float(st.longitude) if (st and getattr(st, 'longitude', None) is not None) else (
            float(v.longitude) if (v and getattr(v, 'longitude', None) is not None) else None
        )
        vendor_area = (st.address if st and st.address else getattr(v, 'city', '')) if v else ''
        sub_timeline = list(sub.timeline.all()) if hasattr(sub, 'timeline') else []
        items_by_vendor.append({
            'vendor': {
                'id': str(v.id) if v else (str(st.id) if st else ''),
                'name': v.business_name if v else (st.name if st else 'Local Store'),
                'lat': st_lat,
                'lng': st_lng,
                'area': vendor_area,
            },
            'fulfillment_status': sub.status,
            'fulfillment_id': str(sub.id),
            'sub_order_number': sub.sub_order_number,
            'items': v_items,
            'vendor_delivery_fee': float(sub.delivery_fee or 0.0),
            'tracking_updates': build_milestones_for_status(
                status_str=sub.status,
                timeline_entries=sub_timeline,
                created_at=sub.created_at,
                shipped_at=sub.shipped_at,
                delivered_at=sub.delivered_at
            )
        })
    return items_by_vendor


class OrderDetailSerializer(serializers.ModelSerializer):
    suborders = VendorSubOrderDetailSerializer(many=True, read_only=True)
    timeline = OrderStatusHistorySerializer(many=True, read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer_email', 'status',
            'subtotal', 'discount_total', 'delivery_total', 'tax_total',
            'grand_total', 'currency', 'payment_method', 'payment_status',
            'shipping_address_snapshot', 'customer_notes',
            'suborders', 'timeline', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        snap = instance.shipping_address_snapshot or {}
        lat_val = snap.get('latitude') if snap.get('latitude') is not None else snap.get('lat')
        lng_val = snap.get('longitude') if snap.get('longitude') is not None else snap.get('lng')

        city_val = snap.get('city') or snap.get('district') or ''
        area_val = snap.get('area') or snap.get('municipality') or snap.get('tole_street') or ''
        street_val = snap.get('street') or snap.get('tole_street') or ''

        # Structured delivery_address
        ret['delivery_address'] = {
            'id': str(snap.get('id', 'addr-order')),
            'title': snap.get('title', 'Delivery Address'),
            'recipient_name': snap.get('recipient_name', 'Customer'),
            'phone': snap.get('recipient_phone') or snap.get('phone', ''),
            'street': street_val,
            'area': area_val,
            'city': city_val,
            'district': snap.get('district') or city_val,
            'country': snap.get('country') or 'Nepal',
            'landmark': snap.get('landmark', ''),
            'is_default': True,
            'lat': float(lat_val) if lat_val is not None else 0.0,
            'lng': float(lng_val) if lng_val is not None else 0.0,
        }

        # Build items_by_vendor matching frontend Order interface
        ret['items_by_vendor'] = build_order_items_by_vendor(instance)

        # Collect timeline entries and timestamps across order and suborders
        order_timeline = list(instance.timeline.all()) if hasattr(instance, 'timeline') else []
        suborders = list(instance.suborders.all()) if hasattr(instance, 'suborders') else []
        for s in suborders:
            if hasattr(s, 'timeline'):
                order_timeline.extend(list(s.timeline.all()))

        # Determine effective parent status (if any suborder has advanced, reflect it)
        effective_status = instance.status
        if suborders:
            max_sub_idx = max(normalize_status_to_step_index(s.status) for s in suborders)
            parent_idx = normalize_status_to_step_index(instance.status)
            if max_sub_idx > parent_idx:
                status_keys = ['ORDER_PLACED', 'CONFIRMED', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED']
                effective_status = status_keys[max_sub_idx]

        shipped_at = next((s.shipped_at for s in suborders if getattr(s, 'shipped_at', None)), None)
        delivered_at = next((s.delivered_at for s in suborders if getattr(s, 'delivered_at', None)), None)

        ret['tracking_updates'] = build_milestones_for_status(
            status_str=effective_status,
            timeline_entries=order_timeline,
            created_at=instance.created_at,
            shipped_at=shipped_at,
            delivered_at=delivered_at
        )

        ret['total_amount'] = float(instance.grand_total or 0)
        ret['grand_total'] = float(instance.grand_total or 0)
        ret['subtotal'] = float(instance.subtotal or 0)
        ret['delivery_fee'] = float(instance.delivery_total or 0)
        ret['delivery_total'] = float(instance.delivery_total or 0)
        ret['tax_total'] = float(instance.tax_total or 0)
        ret['handling_fee'] = 0.0
        ret['coupon_discount'] = float(instance.discount_total or 0)
        ret['estimated_delivery_mins'] = 12
        ret['delivery_option'] = 'EXPRESS_12_MINS'
        return ret



class OrderListSerializer(serializers.ModelSerializer):
    suborder_count = serializers.IntegerField(source='suborders.count', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'status', 'grand_total',
            'currency', 'payment_method', 'payment_status',
            'suborder_count', 'created_at'
        ]

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['total_amount'] = float(instance.grand_total or 0)
        ret['subtotal'] = float(instance.subtotal or 0)
        ret['delivery_fee'] = float(instance.delivery_total or 0)
        ret['handling_fee'] = 15.0
        ret['coupon_discount'] = float(instance.discount_total or 0)
        ret['estimated_delivery_mins'] = 12
        snap = instance.shipping_address_snapshot or {}
        lat_val = snap.get('latitude') or snap.get('lat')
        lng_val = snap.get('longitude') or snap.get('lng')
        ret['delivery_address'] = {
            'id': str(snap.get('id', 'addr-order')),
            'title': snap.get('title', 'Delivery Address'),
            'recipient_name': snap.get('recipient_name', 'Customer'),
            'phone': snap.get('recipient_phone') or snap.get('phone', ''),
            'street': snap.get('tole_street') or snap.get('street', ''),
            'area': snap.get('municipality') or snap.get('area') or snap.get('district') or '',
            'city': snap.get('district') or snap.get('city') or '',
            'landmark': snap.get('landmark', ''),
            'is_default': True,
            'lat': float(lat_val) if lat_val is not None else 27.7172,
            'lng': float(lng_val) if lng_val is not None else 85.3240,
        }
        ret['items_by_vendor'] = build_order_items_by_vendor(instance)
        return ret


class CheckoutRequestSerializer(serializers.Serializer):
    address_id = serializers.CharField(required=False, allow_null=True, help_text="ID of customer saved Address")
    shipping_address = serializers.DictField(required=False, allow_null=True, help_text="Inline address dict if address_id not supplied")
    delivery_address = serializers.DictField(required=False, allow_null=True, help_text="Frontend alias for shipping_address")
    payment_method = serializers.CharField(default='COD')
    delivery_option = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    customer_notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        # Map alternate frontend names
        if 'delivery_address' in attrs and not attrs.get('shipping_address'):
            attrs['shipping_address'] = attrs['delivery_address']
        if 'notes' in attrs and not attrs.get('customer_notes'):
            attrs['customer_notes'] = attrs['notes']

        pm = (attrs.get('payment_method') or 'COD').upper()
        if pm in ['CASH_ON_DELIVERY', 'COD']:
            attrs['payment_method'] = 'COD'
        elif pm in ['ESEWA', 'KHALTI', 'FONEPAY', 'BANK_TRANSFER']:
            attrs['payment_method'] = pm
        else:
            attrs['payment_method'] = 'COD'

        # If address_id is not a valid UUID (e.g. 'addr-map-...'), treat as inline shipping_address
        addr_id = attrs.get('address_id')
        if addr_id:
            import uuid
            try:
                uuid.UUID(str(addr_id))
            except ValueError:
                attrs['address_id'] = None

        if not attrs.get('address_id') and not attrs.get('shipping_address'):
            raise serializers.ValidationError("Either a valid address_id or shipping_address must be provided.")
        return attrs


class SubOrderTransitionSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=OrderStatus.choices)
    remarks = serializers.CharField(required=False, allow_blank=True)
    tracking_number = serializers.CharField(required=False, allow_blank=True)
    delivery_provider = serializers.CharField(required=False, allow_blank=True)

