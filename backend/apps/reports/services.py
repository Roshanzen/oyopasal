import csv
import io
from decimal import Decimal
from django.utils import timezone
from apps.orders.models import VendorSubOrder, OrderStatus
from apps.settlements.models import VendorSettlement
from apps.inventory.models import InventoryItem

class ReportService:
    @staticmethod
    def export_sales_csv(start_date=None, end_date=None, vendor=None) -> str:
        """
        Generates a CSV string containing granular line-by-line vendor sales data.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'SubOrder Number',
            'Parent Order Number',
            'Order Date',
            'Vendor Name',
            'Store Name',
            'Customer Email',
            'Subtotal (NPR)',
            'Delivery Fee (NPR)',
            'Commission (NPR)',
            'Vendor Net (NPR)',
            'Status'
        ])

        queryset = VendorSubOrder.objects.select_related(
            'parent_order', 'vendor', 'store', 'parent_order__customer'
        ).order_by('-created_at')

        if vendor:
            queryset = queryset.filter(vendor=vendor)
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        for sub in queryset:
            writer.writerow([
                sub.sub_order_number,
                sub.parent_order.order_number if sub.parent_order else 'N/A',
                sub.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                sub.vendor.business_name if sub.vendor else 'N/A',
                sub.store.name if sub.store else 'N/A',
                sub.parent_order.customer.email if (sub.parent_order and sub.parent_order.customer) else 'Guest',
                f"{sub.subtotal:.2f}",
                f"{sub.delivery_fee:.2f}",
                f"{sub.commission_amount:.2f}",
                f"{sub.vendor_net_amount:.2f}",
                sub.status
            ])

        return output.getvalue()

    @staticmethod
    def export_tax_vat_csv(start_date=None, end_date=None) -> str:
        """
        Generates a VAT & Tax audit CSV for Nepal inland revenue compliance.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'Date',
            'Order Number',
            'SubOrder Number',
            'Vendor Name',
            'Vendor PAN/VAT',
            'Taxable Subtotal (NPR)',
            'VAT Rate (%)',
            'Status'
        ])

        queryset = VendorSubOrder.objects.select_related('parent_order', 'vendor').exclude(
            status=OrderStatus.CANCELLED
        ).order_by('-created_at')

        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        for sub in queryset:
            writer.writerow([
                sub.created_at.strftime('%Y-%m-%d'),
                sub.parent_order.order_number if sub.parent_order else 'N/A',
                sub.sub_order_number,
                sub.vendor.business_name if sub.vendor else 'Platform',
                getattr(sub.vendor, 'pan_number', 'N/A'),
                f"{sub.subtotal:.2f}",
                '13.00',
                sub.status
            ])

        return output.getvalue()

    @staticmethod
    def export_settlements_csv(vendor=None) -> str:
        """
        Generates a financial payouts and settlements ledger CSV.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'Settlement Number',
            'Vendor Name',
            'Date',
            'Gross Sales (NPR)',
            'Platform Commission (NPR)',
            'Net Payout (NPR)',
            'Status',
            'Bank Name',
            'Account Number',
            'Paid At'
        ])

        queryset = VendorSettlement.objects.select_related('vendor').order_by('-created_at')
        if vendor:
            queryset = queryset.filter(vendor=vendor)

        for s in queryset:
            writer.writerow([
                s.settlement_number,
                s.vendor.business_name if s.vendor else 'N/A',
                s.created_at.strftime('%Y-%m-%d'),
                f"{s.gross_amount:.2f}",
                f"{s.platform_commission:.2f}",
                f"{s.net_payout:.2f}",
                s.status,
                getattr(s.vendor, 'bank_name', 'N/A'),
                getattr(s.vendor, 'bank_account_number', 'N/A'),
                s.paid_at.strftime('%Y-%m-%d %H:%M:%S') if s.paid_at else 'Unpaid'
            ])

        return output.getvalue()

    @staticmethod
    def export_inventory_csv(warehouse=None) -> str:
        """
        Generates an inventory stock audit CSV.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            'Product Name',
            'SKU',
            'Warehouse',
            'Quantity On Hand',
            'Quantity Reserved',
            'Quantity Available',
            'Reorder Threshold',
            'Stock Health'
        ])

        queryset = InventoryItem.objects.select_related(
            'variant', 'variant__product', 'warehouse'
        ).order_by('variant__product__name')

        if warehouse:
            queryset = queryset.filter(warehouse=warehouse)

        for item in queryset:
            health = 'HEALTHY'
            if item.quantity_available <= 0:
                health = 'OUT_OF_STOCK'
            elif item.quantity_available <= item.reorder_threshold:
                health = 'LOW_STOCK'

            writer.writerow([
                item.variant.product.name if item.variant and item.variant.product else 'N/A',
                item.variant.sku if item.variant else 'N/A',
                item.warehouse.name if item.warehouse else 'N/A',
                item.quantity_on_hand,
                item.quantity_reserved,
                item.quantity_available,
                item.reorder_threshold,
                health
            ])

        return output.getvalue()
