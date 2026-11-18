from django.contrib import admin
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

@admin.register(SupplierProduct)
class SupplierProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'sku', 'supplier', 'wholesale_price', 'moq', 'available_stock', 'is_active')
    list_filter = ('supplier', 'is_active')
    search_fields = ('name', 'sku', 'supplier__company_name')


@admin.register(QuotationRequest)
class QuotationRequestAdmin(admin.ModelAdmin):
    list_display = ('rfq_number', 'vendor', 'supplier', 'product', 'requested_quantity', 'status', 'created_at')
    list_filter = ('status', 'supplier')
    search_fields = ('rfq_number', 'vendor__business_name', 'supplier__company_name')


@admin.register(SupplierQuotation)
class SupplierQuotationAdmin(admin.ModelAdmin):
    list_display = ('quotation_number', 'vendor', 'supplier', 'quantity', 'unit_price', 'total_amount', 'status', 'valid_until')
    list_filter = ('status', 'supplier')
    search_fields = ('quotation_number', 'supplier__company_name', 'vendor__business_name')


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0
    readonly_fields = ('product_name', 'sku', 'unit_price', 'quantity', 'total_price')


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('po_number', 'vendor', 'supplier', 'destination_warehouse', 'status', 'grand_total', 'delivery_due_date', 'created_at')
    list_filter = ('status', 'supplier', 'vendor')
    search_fields = ('po_number', 'vendor__business_name', 'supplier__company_name')
    inlines = [PurchaseOrderItemInline]


@admin.register(GoodsReceipt)
class GoodsReceiptAdmin(admin.ModelAdmin):
    list_display = ('grn_number', 'purchase_order', 'received_by', 'is_inventory_updated', 'received_at')
    search_fields = ('grn_number', 'purchase_order__po_number')


@admin.register(SupplierInvoice)
class SupplierInvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'purchase_order', 'supplier', 'vendor', 'billed_amount', 'due_date', 'payment_status')
    list_filter = ('payment_status',)
    search_fields = ('invoice_number', 'purchase_order__po_number')


@admin.register(SupplierPayment)
class SupplierPaymentAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'amount', 'payment_method', 'bank_reference', 'paid_at')
    search_fields = ('invoice__invoice_number', 'bank_reference')

