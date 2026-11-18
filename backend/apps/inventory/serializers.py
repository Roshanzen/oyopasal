from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from apps.inventory.models import (
    InventoryItem,
    StockMovement,
    StockReservation,
    StockMovementType,
)

class InventoryItemSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    warehouse_code = serializers.CharField(source='warehouse.code', read_only=True)
    product_name = serializers.CharField(source='variant.product.name', read_only=True)
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_attributes = serializers.JSONField(source='variant.attributes', read_only=True)
    
    quantity_available = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'warehouse', 'warehouse_name', 'warehouse_code',
            'variant', 'variant_sku', 'product_name', 'variant_attributes',
            'quantity_on_hand', 'quantity_reserved', 'quantity_available',
            'reorder_threshold', 'safety_stock', 'is_low_stock', 'created_at'
        ]
        read_only_fields = ['id', 'quantity_reserved', 'quantity_available', 'is_low_stock', 'created_at']


class StockAdjustmentSerializer(serializers.Serializer):
    delta = serializers.IntegerField(required=True, help_text="Number of units to add (positive) or deduct (negative)")
    movement_type = serializers.ChoiceField(
        choices=[
            StockMovementType.INCOMING,
            StockMovementType.ADJUSTMENT,
            StockMovementType.DAMAGED,
            StockMovementType.RETURN_RESTOCK
        ],
        default=StockMovementType.ADJUSTMENT
    )
    reason = serializers.CharField(required=True, max_length=255, help_text="Mandatory business reason for adjustment")
    reference_id = serializers.CharField(required=False, allow_blank=True, max_length=120)


class StockMovementSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='inventory_item.variant.sku', read_only=True)
    warehouse_name = serializers.CharField(source='inventory_item.warehouse.name', read_only=True)
    created_by_email = serializers.CharField(source='created_by.email', read_only=True, default='System')

    class Meta:
        model = StockMovement
        fields = [
            'id', 'inventory_item', 'variant_sku', 'warehouse_name',
            'movement_type', 'quantity', 'balance_after',
            'reference_id', 'notes', 'created_by_email', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class StockReservationSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='inventory_item.variant.sku', read_only=True)

    class Meta:
        model = StockReservation
        fields = [
            'id', 'inventory_item', 'variant_sku', 'session_id',
            'quantity', 'expires_at', 'is_released', 'is_committed', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

