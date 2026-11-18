from rest_framework import serializers
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceipt,
    SupplierInvoice,
    SupplierPayment
)

class SupplierProductSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)

    class Meta:
        model = SupplierProduct
        fields = [
            'id', 'supplier', 'supplier_name', 'category', 'name',
            'slug', 'sku', 'description', 'specifications',
            'unit_of_measure', 'wholesale_price', 'moq',
            'bulk_price_tiers', 'available_stock', 'lead_time_days',
            'image_url', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'supplier', 'slug', 'created_at']


class QuotationRequestSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = QuotationRequest
        fields = [
            'id', 'rfq_number', 'vendor', 'vendor_name',
            'supplier', 'supplier_name', 'product', 'product_name',
            'requested_quantity', 'target_price', 'notes',
            'status', 'created_at'
        ]
        read_only_fields = ['id', 'rfq_number', 'status', 'created_at']


class SupplierQuotationSerializer(serializers.ModelSerializer):
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = SupplierQuotation
        fields = [
            'id', 'quotation_number', 'rfq', 'vendor', 'vendor_name',
            'supplier', 'supplier_name', 'product', 'product_name',
            'quantity', 'unit_price', 'total_amount', 'lead_time_days',
            'valid_until', 'status', 'remarks', 'created_at'
        ]
        read_only_fields = ['id', 'quotation_number', 'created_at']


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'supplier_product', 'product_name', 'sku', 'unit_price', 'quantity', 'total_price']
        read_only_fields = ['id']


class GoodsReceiptSerializer(serializers.ModelSerializer):
    received_by_name = serializers.CharField(source='received_by.full_name', read_only=True, default='Vendor Staff')

    class Meta:
        model = GoodsReceipt
        fields = [
            'id', 'grn_number', 'received_by_name', 'received_at',
            'accepted_quantities', 'damaged_quantities', 'missing_quantities',
            'remarks', 'is_inventory_updated'
        ]
        read_only_fields = ['id', 'grn_number', 'received_at']


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)

    class Meta:
        model = SupplierInvoice
        fields = [
            'id', 'invoice_number', 'po_number', 'supplier_name', 'vendor_name',
            'billed_amount', 'due_date', 'payment_status', 'paid_amount', 'created_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    goods_receipt = GoodsReceiptSerializer(read_only=True)
    invoice = SupplierInvoiceSerializer(read_only=True)
    vendor_name = serializers.CharField(source='vendor.business_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    warehouse_name = serializers.CharField(source='destination_warehouse.name', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'vendor', 'vendor_name',
            'supplier', 'supplier_name', 'destination_warehouse', 'warehouse_name',
            'status', 'total_amount', 'tax_amount', 'grand_total',
            'payment_terms', 'delivery_due_date', 'tracking_number',
            'dispatched_at', 'delivered_at', 'notes',
            'items', 'goods_receipt', 'invoice', 'created_at'
        ]
        read_only_fields = ['id', 'po_number', 'created_at']


# Action Request Serializers
class CreateRFQSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)
    target_price = serializers.DecimalField(required=False, max_digits=12, decimal_places=2, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class SubmitQuotationSerializer(serializers.Serializer):
    unit_price = serializers.DecimalField(required=True, max_digits=12, decimal_places=2)
    lead_time_days = serializers.IntegerField(default=3, min_value=1)
    validity_days = serializers.IntegerField(default=14, min_value=1)
    remarks = serializers.CharField(required=False, allow_blank=True)


class AcceptQuotationSerializer(serializers.Serializer):
    destination_warehouse_id = serializers.UUIDField(required=True)
    payment_terms = serializers.CharField(default='30_DAYS_CREDIT')
    notes = serializers.CharField(required=False, allow_blank=True)


class ProcessGRNSerializer(serializers.Serializer):
    accepted_items = serializers.DictField(required=True, help_text="Mapping of po_item_id -> integer quantity accepted")
    damaged_items = serializers.DictField(required=False, default=dict)
    missing_items = serializers.DictField(required=False, default=dict)
    remarks = serializers.CharField(required=False, allow_blank=True)


class DispatchPOSerializer(serializers.Serializer):
    tracking_number = serializers.CharField(required=False, allow_blank=True, default='')

