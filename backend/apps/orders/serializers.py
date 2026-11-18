from rest_framework import serializers
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatusHistory, OrderStatus

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            'id', 'variant', 'product_name', 'variant_sku',
            'attributes_snapshot', 'unit_price', 'quantity',
            'total_price', 'tax_rate', 'tax_amount'
        ]
        read_only_fields = ['id']


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
    store_name = serializers.CharField(source='store.name', read_only=True)
    shipping_destination = serializers.JSONField(source='parent_order.shipping_address_snapshot', read_only=True)

    class Meta:
        model = VendorSubOrder
        fields = [
            'id', 'sub_order_number', 'vendor_name', 'store_name',
            'status', 'subtotal', 'delivery_fee', 'commission_rate',
            'commission_amount', 'vendor_net_amount',
            'tracking_number', 'delivery_provider', 'cancellation_reason',
            'shipping_destination', 'shipped_at', 'delivered_at',
            'items', 'timeline', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class VendorSubOrderListSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    item_count = serializers.IntegerField(source='items.count', read_only=True)

    class Meta:
        model = VendorSubOrder
        fields = [
            'id', 'sub_order_number', 'vendor_name', 'store_name',
            'status', 'subtotal', 'vendor_net_amount', 'item_count',
            'tracking_number', 'created_at'
        ]


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


class OrderListSerializer(serializers.ModelSerializer):
    suborder_count = serializers.IntegerField(source='suborders.count', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'status', 'grand_total',
            'currency', 'payment_method', 'payment_status',
            'suborder_count', 'created_at'
        ]


class CheckoutRequestSerializer(serializers.Serializer):
    address_id = serializers.UUIDField(required=False, help_text="ID of customer saved Address")
    shipping_address = serializers.DictField(required=False, help_text="Inline address dict if address_id not supplied")
    payment_method = serializers.ChoiceField(
        choices=['COD', 'ESEWA', 'KHALTI', 'FONEPAY', 'BANK_TRANSFER'],
        default='COD'
    )
    customer_notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get('address_id') and not attrs.get('shipping_address'):
            raise serializers.ValidationError("Either address_id or shipping_address must be provided.")
        return attrs


class SubOrderTransitionSerializer(serializers.Serializer):
    new_status = serializers.ChoiceField(choices=OrderStatus.choices)
    remarks = serializers.CharField(required=False, allow_blank=True)
    tracking_number = serializers.CharField(required=False, allow_blank=True)
    delivery_provider = serializers.CharField(required=False, allow_blank=True)

