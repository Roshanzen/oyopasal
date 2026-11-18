import uuid
from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceipt,
    SupplierInvoice,
    SupplierPayment,
    RFQStatus,
    PurchaseOrderStatus
)
from apps.inventory.models import InventoryItem, StockMovementType
from apps.inventory.services import InventoryService
from apps.catalogue.models import ProductVariant

class ProcurementService:
    @classmethod
    @transaction.atomic
    def create_rfq(cls, vendor, product: SupplierProduct, quantity: int, target_price: Decimal = None, notes: str = '') -> QuotationRequest:
        """Vendor submits RFQ to wholesale supplier."""
        if quantity < product.moq:
            raise ValueError(f"Requested quantity ({quantity}) must meet or exceed Minimum Order Quantity ({product.moq}).")

        rfq_num = f"RFQ-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        return QuotationRequest.objects.create(
            rfq_number=rfq_num,
            vendor=vendor,
            supplier=product.supplier,
            product=product,
            requested_quantity=quantity,
            target_price=target_price,
            notes=notes,
            status=RFQStatus.SUBMITTED
        )

    @classmethod
    @transaction.atomic
    def submit_quotation(cls, supplier, rfq_id, unit_price: Decimal, lead_time_days: int = 3, validity_days: int = 14, remarks: str = '') -> SupplierQuotation:
        """Supplier submits formal quotation in response to RFQ."""
        rfq = QuotationRequest.objects.select_for_update().get(id=rfq_id, supplier=supplier)
        if rfq.status not in [RFQStatus.SUBMITTED, RFQStatus.QUOTED]:
            raise ValueError(f"Cannot quote an RFQ currently in {rfq.status} state.")

        total_amount = round(unit_price * rfq.requested_quantity, 2)
        quote_num = f"QUO-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        valid_until = timezone.now() + timedelta(days=validity_days)

        quotation = SupplierQuotation.objects.create(
            quotation_number=quote_num,
            rfq=rfq,
            vendor=rfq.vendor,
            supplier=supplier,
            product=rfq.product,
            quantity=rfq.requested_quantity,
            unit_price=unit_price,
            total_amount=total_amount,
            lead_time_days=lead_time_days,
            valid_until=valid_until,
            status=RFQStatus.QUOTED,
            remarks=remarks
        )

        rfq.status = RFQStatus.QUOTED
        rfq.save(update_fields=['status', 'updated_at'])

        return quotation

    @classmethod
    @transaction.atomic
    def accept_quotation_and_create_po(cls, vendor, quotation_id, warehouse_id, payment_terms: str = '30_DAYS_CREDIT', notes: str = '') -> PurchaseOrder:
        """Vendor accepts supplier quotation and generates official Purchase Order (PO)."""
        quote = SupplierQuotation.objects.select_for_update().get(id=quotation_id, vendor=vendor)
        if quote.status != RFQStatus.QUOTED:
            raise ValueError(f"Quotation cannot be accepted from {quote.status} state.")
        if timezone.now() > quote.valid_until:
            quote.status = RFQStatus.EXPIRED
            quote.save(update_fields=['status', 'updated_at'])
            raise ValueError("This quotation has expired.")

        po_num = f"PO-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        due_date = (timezone.now() + timedelta(days=quote.lead_time_days + 2)).date()

        po = PurchaseOrder.objects.create(
            po_number=po_num,
            vendor=vendor,
            supplier=quote.supplier,
            quotation=quote,
            destination_warehouse_id=warehouse_id,
            status=PurchaseOrderStatus.SUBMITTED,
            total_amount=quote.total_amount,
            grand_total=quote.total_amount,
            payment_terms=payment_terms,
            delivery_due_date=due_date,
            notes=notes
        )

        PurchaseOrderItem.objects.create(
            purchase_order=po,
            supplier_product=quote.product,
            product_name=quote.product.name,
            sku=quote.product.sku,
            unit_price=quote.unit_price,
            quantity=quote.quantity,
            total_price=quote.total_amount
        )

        quote.status = RFQStatus.ACCEPTED
        quote.save(update_fields=['status', 'updated_at'])

        quote.rfq.status = RFQStatus.ACCEPTED
        quote.rfq.save(update_fields=['status', 'updated_at'])

        return po

    @classmethod
    @transaction.atomic
    def confirm_and_dispatch_po(cls, supplier, po_id, tracking_number: str = '') -> PurchaseOrder:
        """Supplier accepts and dispatches purchase order."""
        po = PurchaseOrder.objects.select_for_update().get(id=po_id, supplier=supplier)
        po.status = PurchaseOrderStatus.DISPATCHED
        po.tracking_number = tracking_number
        po.dispatched_at = timezone.now()
        po.save(update_fields=['status', 'tracking_number', 'dispatched_at', 'updated_at'])
        return po

    @classmethod
    @transaction.atomic
    def process_goods_receipt(cls, vendor, po_id, accepted_items: dict, damaged_items: dict = None, missing_items: dict = None, user=None, remarks: str = '') -> GoodsReceipt:
        """
        Vendor receives bulk shipment and verifies accepted vs damaged units.
        Atomically updates vendor warehouse inventory for accepted units and generates supplier invoice.
        """
        po = PurchaseOrder.objects.select_for_update().get(id=po_id, vendor=vendor)
        if po.status not in [PurchaseOrderStatus.DISPATCHED, PurchaseOrderStatus.CONFIRMED]:
            raise ValueError(f"Cannot accept delivery for PO currently in {po.status} state.")

        damaged_items = damaged_items or {}
        missing_items = missing_items or {}

        grn_num = f"GRN-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        grn = GoodsReceipt.objects.create(
            grn_number=grn_num,
            purchase_order=po,
            received_by=user,
            accepted_quantities=accepted_items,
            damaged_quantities=damaged_items,
            missing_quantities=missing_items,
            remarks=remarks,
            is_inventory_updated=True
        )

        # Update physical inventory for accepted quantities
        billed_total = Decimal('0.00')
        for item in po.items.all():
            accepted_qty = int(accepted_items.get(str(item.id), item.quantity))
            billed_total += (item.unit_price * accepted_qty)

            # Match or create inventory item in vendor's destination warehouse
            variant = ProductVariant.objects.filter(product__vendor=vendor, sku=item.sku).first()
            if not variant:
                # Match by base sku or first variant of vendor's matching product
                variant = ProductVariant.objects.filter(product__vendor=vendor).first()

            if variant and accepted_qty > 0:
                inv_item, _ = InventoryItem.objects.get_or_create(
                    warehouse=po.destination_warehouse,
                    variant=variant,
                    defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
                )
                InventoryService.adjust_stock(
                    inventory_item_id=inv_item.id,
                    delta=accepted_qty,
                    movement_type=StockMovementType.INCOMING,
                    reason=f"Procurement GRN {grn_num} from Supplier {po.supplier.company_name}",
                    user=user,
                    reference_id=po.po_number
                )

        # Generate Supplier Invoice
        inv_num = f"INV-SUP-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
        due_date = (timezone.now() + timedelta(days=po.supplier.credit_terms_days)).date()

        SupplierInvoice.objects.create(
            invoice_number=inv_num,
            purchase_order=po,
            supplier=po.supplier,
            vendor=vendor,
            billed_amount=billed_total,
            due_date=due_date,
            payment_status='UNPAID'
        )

        po.status = PurchaseOrderStatus.DELIVERED
        po.delivered_at = timezone.now()
        po.save(update_fields=['status', 'delivered_at', 'updated_at'])

        return grn

    @classmethod
    @transaction.atomic
    def record_supplier_payment(cls, invoice_id, amount: Decimal, bank_reference: str) -> SupplierPayment:
        """Records vendor payment against supplier wholesale invoice."""
        invoice = SupplierInvoice.objects.select_for_update().get(id=invoice_id)
        new_paid = invoice.paid_amount + amount

        payment = SupplierPayment.objects.create(
            invoice=invoice,
            amount=amount,
            bank_reference=bank_reference
        )

        invoice.paid_amount = new_paid
        if new_paid >= invoice.billed_amount:
            invoice.payment_status = 'PAID'
        elif new_paid > 0:
            invoice.payment_status = 'PARTIALLY_PAID'
        invoice.save(update_fields=['paid_amount', 'payment_status', 'updated_at'])

        return payment

