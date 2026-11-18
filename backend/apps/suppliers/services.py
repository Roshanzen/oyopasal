from decimal import Decimal
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from apps.suppliers.models import SupplierProfile
from apps.procurement.models import (
    SupplierProduct,
    QuotationRequest,
    SupplierQuotation,
    PurchaseOrder,
    PurchaseOrderStatus,
    SupplierInvoice,
    SupplierPayment
)

class SupplierDashboardService:
    @classmethod
    def get_overview_metrics(cls, supplier: SupplierProfile) -> dict:
        # Wholesale Catalog
        products = SupplierProduct.objects.filter(supplier=supplier)
        total_products = products.count()
        active_products = products.filter(is_active=True).count()

        # Quotations & RFQs
        rfqs = QuotationRequest.objects.filter(supplier=supplier)
        total_rfqs = rfqs.count()
        pending_rfqs = rfqs.filter(status='REQUESTED').count()

        quotes = SupplierQuotation.objects.filter(supplier=supplier)
        submitted_quotes = quotes.count()
        accepted_quotes = quotes.filter(status='ACCEPTED').count()

        # Purchase Orders
        pos = PurchaseOrder.objects.filter(supplier=supplier)
        total_pos = pos.count()
        pending_pos = pos.filter(status=PurchaseOrderStatus.CONFIRMED).count()
        dispatched_pos = pos.filter(status=PurchaseOrderStatus.DISPATCHED).count()
        delivered_pos = pos.filter(status=PurchaseOrderStatus.DELIVERED).count()

        po_aggr = pos.exclude(status=PurchaseOrderStatus.CANCELLED).aggregate(
            total_gmv=Sum('grand_total')
        )
        total_wholesale_sales = po_aggr['total_gmv'] or Decimal('0.00')

        # Invoices & Receivables
        invoices = SupplierInvoice.objects.filter(supplier=supplier)
        unpaid_invoices_aggr = invoices.filter(payment_status='UNPAID').aggregate(
            count=Count('id'),
            total=Sum('billed_amount')
        )
        unpaid_count = unpaid_invoices_aggr['count'] or 0
        unpaid_amount = unpaid_invoices_aggr['total'] or Decimal('0.00')

        paid_invoices_aggr = invoices.filter(payment_status='PAID').aggregate(
            count=Count('id'),
            total=Sum('billed_amount')
        )
        paid_count = paid_invoices_aggr['count'] or 0
        paid_amount = paid_invoices_aggr['total'] or Decimal('0.00')

        # Top ordering vendors
        top_vendors = (
            pos.filter(status=PurchaseOrderStatus.DELIVERED)
            .values('vendor__id', 'vendor__business_name')
            .annotate(
                total_spent=Sum('grand_total'),
                pos_count=Count('id')
            )
            .order_by('-total_spent')[:5]
        )

        return {
            'catalog': {
                'total_products': total_products,
                'active_products': active_products,
            },
            'quotations': {
                'total_rfqs_received': total_rfqs,
                'pending_rfqs': pending_rfqs,
                'submitted_quotes': submitted_quotes,
                'accepted_quotes': accepted_quotes,
            },
            'orders': {
                'total_purchase_orders': total_pos,
                'pending_pos': pending_pos,
                'dispatched_pos': dispatched_pos,
                'delivered_pos': delivered_pos,
                'total_wholesale_sales': str(total_wholesale_sales),
            },
            'invoices': {
                'unpaid_invoices_count': unpaid_count,
                'unpaid_invoices_amount': str(unpaid_amount),
                'paid_invoices_count': paid_count,
                'paid_invoices_amount': str(paid_amount),
            },
            'top_vendors': [
                {
                    'vendor_id': str(row['vendor__id']),
                    'business_name': row['vendor__business_name'],
                    'total_spent': str(row['total_spent'] or Decimal('0.00')),
                    'orders_count': row['pos_count']
                }
                for row in top_vendors
            ]
        }
