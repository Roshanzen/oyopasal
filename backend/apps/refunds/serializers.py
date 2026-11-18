import uuid
from decimal import Decimal
from rest_framework import serializers
from apps.refunds.models import Refund, RefundStatus
from apps.orders.models import Order, VendorSubOrder, OrderStatus

class RefundRequestSerializer(serializers.ModelSerializer):
    order_id = serializers.UUIDField(write_only=True)
    sub_order_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Refund
        fields = ['id', 'order_id', 'sub_order_id', 'amount', 'reason', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']

    def validate(self, attrs):
        user = self.context['request'].user
        order_id = attrs.get('order_id')
        sub_order_id = attrs.get('sub_order_id')
        amount = attrs.get('amount')

        try:
            order = Order.objects.get(id=order_id, customer=user)
        except Order.DoesNotExist:
            raise serializers.ValidationError({"order_id": "Order not found or does not belong to you."})

        # Ensure order is not cancelled or already refunded
        if order.status in [OrderStatus.CANCELLED, OrderStatus.REFUNDED]:
            raise serializers.ValidationError({"order_id": f"Order status is {order.status}; cannot request refund."})

        sub_order = None
        if sub_order_id:
            try:
                sub_order = VendorSubOrder.objects.get(id=sub_order_id, parent_order=order)
            except VendorSubOrder.DoesNotExist:
                raise serializers.ValidationError({"sub_order_id": "Sub-order not found in this order."})

        max_amount = sub_order.subtotal if sub_order else order.grand_total
        if amount <= 0 or amount > max_amount:
            raise serializers.ValidationError({"amount": f"Refund amount must be between 1 and {max_amount} NPR."})

        attrs['order'] = order
        attrs['sub_order'] = sub_order
        attrs['customer'] = user
        return attrs

    def create(self, validated_data):
        validated_data.pop('order_id', None)
        validated_data.pop('sub_order_id', None)
        validated_data['refund_number'] = f"REF-{uuid.uuid4().hex[:10].upper()}"
        return super().create(validated_data)


class RefundDetailSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    processed_by_email = serializers.EmailField(source='processed_by.email', read_only=True)

    class Meta:
        model = Refund
        fields = [
            'id',
            'refund_number',
            'order',
            'order_number',
            'sub_order',
            'customer',
            'customer_name',
            'customer_email',
            'amount',
            'reason',
            'status',
            'rejection_reason',
            'processed_by',
            'processed_by_email',
            'processed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class RefundActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['APPROVE', 'REJECT'])
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('action') == 'REJECT' and not attrs.get('rejection_reason'):
            raise serializers.ValidationError({"rejection_reason": "Rejection reason is required when rejecting a refund."})
        return attrs

