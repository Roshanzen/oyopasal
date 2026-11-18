from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.common.models import BaseModel, SoftDeletableModel
from apps.suppliers.models import SupplierProfile
from apps.vendors.models import VendorProfile
from apps.catalogue.models import Category
from apps.warehouse.models import Warehouse

class SupplierProduct(BaseModel, SoftDeletableModel):
    """
    Wholesale catalog product offered by verified suppliers for vendor bulk procurement.
    """
    supplier = models.ForeignKey(
        SupplierProfile,
        on_delete=models.CASCADE,
        related_name='wholesale_products'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='supplier_products'
    )
    name = models.CharField(max_length=255, db_index=True)
    slug = models.SlugField(max_length=280, unique=True, db_index=True)
    sku = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)
    specifications = models.JSONField(default=dict, blank=True)
    unit_of_measure = models.CharField(max_length=30, default='PIECE', help_text='PIECE, BOX, CARTON, KG, SET')
    
    # Wholesale Pricing & Minimum Order Quantity
    wholesale_price = models.DecimalField(max_digits=12, decimal_places=2, help_text='Base wholesale unit price')
    moq = models.PositiveIntegerField(default=10, help_text='Minimum Order Quantity')
    bulk_price_tiers = models.JSONField(
        default=list,
        blank=True,
        help_text='Tiered price thresholds e.g. [{"min_qty": 50, "price": "900.00"}, ...]'
    )
    
    available_stock = models.PositiveIntegerField(default=0)
    lead_time_days = models.PositiveIntegerField(default=3)
    image_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = 'Supplier Wholesale Product'
        verbose_name_plural = 'Supplier Wholesale Products'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} [{self.sku}] - {self.supplier.company_name} (MOQ: {self.moq})"


class RFQStatus(models.TextChoices):
    SUBMITTED = 'SUBMITTED', 'RFQ Submitted'
    QUOTED = 'QUOTED', 'Quotation Offered'
    ACCEPTED = 'ACCEPTED', 'Quotation Accepted'
    REJECTED = 'REJECTED', 'Quotation Rejected'
    EXPIRED = 'EXPIRED', 'RFQ Expired'


class QuotationRequest(BaseModel):
    """
    Request For Quotation (RFQ) submitted by a vendor to a supplier.
    """
    rfq_number = models.CharField(max_length=60, unique=True, db_index=True)
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='rfqs')
    supplier = models.ForeignKey(SupplierProfile, on_delete=models.CASCADE, related_name='rfqs')
    product = models.ForeignKey(SupplierProduct, on_delete=models.CASCADE, related_name='rfqs')
    requested_quantity = models.PositiveIntegerField()
    target_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=25, choices=RFQStatus.choices, default=RFQStatus.SUBMITTED, db_index=True)

    class Meta:
        verbose_name = 'Quotation Request (RFQ)'
        verbose_name_plural = 'Quotation Requests (RFQs)'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.rfq_number} - {self.vendor.business_name} -> {self.supplier.company_name}"


class SupplierQuotation(BaseModel):
    """
    Formal wholesale price quotation submitted by a supplier in response to an RFQ.
    """
    quotation_number = models.CharField(max_length=60, unique=True, db_index=True)
    rfq = models.ForeignKey(QuotationRequest, on_delete=models.CASCADE, related_name='quotations')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.CASCADE, related_name='received_quotations')
    supplier = models.ForeignKey(SupplierProfile, on_delete=models.CASCADE, related_name='issued_quotations')
    product = models.ForeignKey(SupplierProduct, on_delete=models.CASCADE, related_name='quotations')
    
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    lead_time_days = models.PositiveIntegerField(default=3)
    valid_until = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=25, choices=RFQStatus.choices, default=RFQStatus.QUOTED, db_index=True)
    remarks = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Supplier Quotation'
        verbose_name_plural = 'Supplier Quotations'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.quotation_number}: {self.quantity}x @ NPR {self.unit_price} [{self.get_status_display()}]"


class PurchaseOrderStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted to Supplier'
    CONFIRMED = 'CONFIRMED', 'Confirmed by Supplier'
    PROCESSING = 'PROCESSING', 'Processing & Packing'
    DISPATCHED = 'DISPATCHED', 'Dispatched in Transit'
    DELIVERED = 'DELIVERED', 'Delivered & Confirmed'
    CANCELLED = 'CANCELLED', 'Cancelled'


class PurchaseOrder(BaseModel):
    """
    Official B2B Purchase Order issued by a vendor to a supplier.
    """
    po_number = models.CharField(max_length=60, unique=True, db_index=True)
    vendor = models.ForeignKey(VendorProfile, on_delete=models.PROTECT, related_name='purchase_orders')
    supplier = models.ForeignKey(SupplierProfile, on_delete=models.PROTECT, related_name='purchase_orders')
    quotation = models.ForeignKey(SupplierQuotation, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders')
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='purchase_orders')
    
    status = models.CharField(
        max_length=30,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.SUBMITTED,
        db_index=True
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2)
    
    payment_terms = models.CharField(max_length=50, default='30_DAYS_CREDIT')
    delivery_due_date = models.DateField(null=True, blank=True)
    tracking_number = models.CharField(max_length=100, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Purchase Order (PO)'
        verbose_name_plural = 'Purchase Orders (POs)'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.po_number} - {self.vendor.business_name} -> {self.supplier.company_name} (NPR {self.grand_total})"


class PurchaseOrderItem(BaseModel):
    """
    Line item inside a B2B Purchase Order.
    """
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    supplier_product = models.ForeignKey(SupplierProduct, on_delete=models.PROTECT, related_name='po_items')
    product_name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField()
    total_price = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = 'Purchase Order Item'
        verbose_name_plural = 'Purchase Order Items'

    def __str__(self):
        return f"{self.quantity}x {self.product_name} in {self.purchase_order.po_number}"


class GoodsReceipt(BaseModel):
    """
    Goods Receipt Note (GRN) logging physical inspection and verification of received goods.
    Inventory is updated strictly based on accepted units.
    """
    grn_number = models.CharField(max_length=60, unique=True, db_index=True)
    purchase_order = models.OneToOneField(PurchaseOrder, on_delete=models.CASCADE, related_name='goods_receipt')
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    received_at = models.DateTimeField(default=timezone.now)
    
    accepted_quantities = models.JSONField(default=dict, help_text='Dictionary mapping item_id -> int accepted')
    damaged_quantities = models.JSONField(default=dict, help_text='Dictionary mapping item_id -> int damaged')
    missing_quantities = models.JSONField(default=dict, help_text='Dictionary mapping item_id -> int missing')
    remarks = models.TextField(blank=True)
    is_inventory_updated = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Goods Receipt Note (GRN)'
        verbose_name_plural = 'Goods Receipt Notes (GRNs)'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.grn_number} for {self.purchase_order.po_number}"


class SupplierInvoice(BaseModel):
    """
    Wholesale commercial invoice issued by supplier reflecting accepted GRN quantities.
    """
    invoice_number = models.CharField(max_length=60, unique=True, db_index=True)
    purchase_order = models.OneToOneField(PurchaseOrder, on_delete=models.CASCADE, related_name='invoice')
    supplier = models.ForeignKey(SupplierProfile, on_delete=models.PROTECT, related_name='invoices')
    vendor = models.ForeignKey(VendorProfile, on_delete=models.PROTECT, related_name='supplier_invoices')
    billed_amount = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    
    PAYMENT_STATUS_CHOICES = (
        ('UNPAID', 'Unpaid'),
        ('PARTIALLY_PAID', 'Partially Paid'),
        ('PAID', 'Fully Paid')
    )
    payment_status = models.CharField(max_length=25, choices=PAYMENT_STATUS_CHOICES, default='UNPAID', db_index=True)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        verbose_name = 'Supplier Invoice'
        verbose_name_plural = 'Supplier Invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.invoice_number}: NPR {self.billed_amount} [{self.payment_status}]"


class SupplierPayment(BaseModel):
    """
    Payment record made by vendor against a wholesale supplier invoice.
    """
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=50, default='BANK_TRANSFER')
    bank_reference = models.CharField(max_length=120)
    paid_at = models.DateTimeField(default=timezone.now)

    class Meta:
        verbose_name = 'Supplier Payment'
        verbose_name_plural = 'Supplier Payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment of NPR {self.amount} for {self.invoice.invoice_number} via {self.bank_reference}"

