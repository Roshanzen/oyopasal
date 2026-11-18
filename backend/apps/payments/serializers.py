from rest_framework import serializers
from apps.payments.models import (
    Payment,
    FinancialLedgerEntry,
    PaymentProvider,
    PaymentStatus
)

class PaymentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'order', 'order_number', 'provider', 'status',
            'amount', 'currency', 'transaction_reference',
            'gateway_reference', 'verified_at', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'verified_at', 'created_at']


class InitiatePaymentSerializer(serializers.Serializer):
    order_id = serializers.UUIDField(required=True)
    provider = serializers.ChoiceField(choices=PaymentProvider.choices, default=PaymentProvider.COD)
    return_url = serializers.URLField(required=False, default='http://localhost:3000/checkout/success')


class VerifyPaymentSerializer(serializers.Serializer):
    transaction_reference = serializers.CharField(required=True)
    callback_data = serializers.DictField(required=False, default=dict)


class FinancialLedgerEntrySerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True, default=None)
    order_number = serializers.CharField(source='order.order_number', read_only=True, default=None)

    class Meta:
        model = FinancialLedgerEntry
        fields = [
            'id', 'entry_type', 'direction', 'amount',
            'vendor_name', 'order_number', 'reference_id',
            'description', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

