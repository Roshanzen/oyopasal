from rest_framework import serializers
from apps.settlements.models import VendorSettlement, SettlementItem, SettlementStatus

class SettlementItemSerializer(serializers.ModelSerializer):
    sub_order_number = serializers.CharField(source='sub_order.sub_order_number', read_only=True)

    class Meta:
        model = SettlementItem
        fields = ['id', 'sub_order', 'sub_order_number', 'amount']


class VendorSettlementSerializer(serializers.ModelSerializer):
    items = SettlementItemSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)

    class Meta:
        model = VendorSettlement
        fields = [
            'id', 'settlement_number', 'vendor', 'vendor_name',
            'status', 'gross_amount', 'platform_commission', 'net_payout',
            'bank_reference', 'paid_at', 'remarks', 'items', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class GenerateSettlementSerializer(serializers.Serializer):
    vendor_id = serializers.UUIDField(required=True)


class MarkSettlementPaidSerializer(serializers.Serializer):
    bank_reference = serializers.CharField(required=True, max_length=120)

