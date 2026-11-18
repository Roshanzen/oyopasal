from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, Count, Avg, F, Q, Case, When, Value, DecimalField
from django.db.models.functions import TruncDate
from django.utils import timezone
from apps.accounts.models import User, UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.suppliers.models import SupplierProfile, SupplierStatus
from apps.stores.models import Store
from apps.catalogue.models import Product, ProductStatus
from apps.inventory.models import InventoryItem
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.payments.models import Payment, PaymentStatus, FinancialLedgerEntry
from apps.commissions.models import CommissionRecord
from apps.settlements.models import VendorSettlement, SettlementStatus
from apps.procurement.models import PurchaseOrder, PurchaseOrderStatus, SupplierInvoice

class AnalyticsService:
    @classmethod
    def get_dashboard_kpis(cls) -> dict:
        now = timezone.now()
        today = now.date()
        yesterday = today - timedelta(days=1)
        start_of_month = today.replace(day=1)

        # 1. Business Overview
        total_vendors = VendorProfile.objects.count()
        active_vendors = VendorProfile.objects.filter(status=VendorStatus.APPROVED).count()
        pending_vendors = VendorProfile.objects.filter(status=VendorStatus.PENDING).count()
        suspended_vendors = VendorProfile.objects.filter(status=VendorStatus.SUSPENDED).count()

        total_suppliers = SupplierProfile.objects.count()
        active_suppliers = SupplierProfile.objects.filter(status=SupplierStatus.APPROVED).count()
        pending_suppliers = SupplierProfile.objects.filter(status=SupplierStatus.PENDING).count()

        total_customers = User.objects.filter(role=UserRole.CUSTOMER).count()
        customers_today = User.objects.filter(role=UserRole.CUSTOMER, created_at__date=today).count()

        total_stores = Store.objects.count()
        active_stores = Store.objects.filter(is_active=True).count()

        total_products = Product.objects.count()
        approved_products = Product.objects.filter(status=ProductStatus.APPROVED).count()
        pending_products = Product.objects.filter(status=ProductStatus.SUBMITTED).count()
        rejected_products = Product.objects.filter(status=ProductStatus.REJECTED).count()

        low_stock_count = InventoryItem.objects.filter(
            quantity_on_hand__lte=F('quantity_reserved') + F('reorder_threshold')
        ).count()

        # 2. Sales Overview
        valid_orders = Order.objects.exclude(status=OrderStatus.CANCELLED)

        # Today's sales
        today_orders = valid_orders.filter(created_at__date=today)
        today_sales_aggr = today_orders.aggregate(gross=Sum('grand_total'), count=Count('id'))
        today_gross_sales = today_sales_aggr['gross'] or Decimal('0.00')
        today_order_count = today_sales_aggr['count'] or 0

        # Yesterday's sales
        yesterday_sales = valid_orders.filter(created_at__date=yesterday).aggregate(gross=Sum('grand_total'))['gross'] or Decimal('0.00')

        # Monthly sales
        month_sales = valid_orders.filter(created_at__date__gte=start_of_month).aggregate(gross=Sum('grand_total'))['gross'] or Decimal('0.00')

        # Overall GMV & totals
        gmv_aggr = valid_orders.aggregate(
            gmv=Sum('grand_total'),
            total_count=Count('id'),
            aov=Avg('grand_total')
        )
        total_gmv = gmv_aggr['gmv'] or Decimal('0.00')
        all_time_orders = gmv_aggr['total_count'] or 0
        avg_order_value = round(gmv_aggr['aov'] or Decimal('0.00'), 2)

        completed_orders = Order.objects.filter(status=OrderStatus.DELIVERED).count()
        pending_orders = Order.objects.filter(status__in=[
            OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY
        ]).count()
        cancelled_orders = Order.objects.filter(status=OrderStatus.CANCELLED).count()

        # 3. Financial Overview
        today_comm = CommissionRecord.objects.filter(created_at__date=today).aggregate(tot=Sum('commission_amount'))['tot'] or Decimal('0.00')
        month_comm = CommissionRecord.objects.filter(created_at__date__gte=start_of_month).aggregate(tot=Sum('commission_amount'))['tot'] or Decimal('0.00')
        total_comm = CommissionRecord.objects.aggregate(tot=Sum('commission_amount'))['tot'] or Decimal('0.00')

        pending_settlements = VendorSettlement.objects.filter(
            status__in=[SettlementStatus.PENDING, SettlementStatus.APPROVED]
        ).aggregate(tot=Sum('net_payout'))['tot'] or Decimal('0.00')

        completed_settlements = VendorSettlement.objects.filter(
            status=SettlementStatus.PAID
        ).aggregate(tot=Sum('net_payout'))['tot'] or Decimal('0.00')

        successful_payments = Payment.objects.filter(status=PaymentStatus.SUCCESS).count()
        failed_payments = Payment.objects.filter(status=PaymentStatus.FAILED).count()

        # 4. Procurement & B2B Wholesale Overview
        total_pos = PurchaseOrder.objects.count()
        in_transit_pos = PurchaseOrder.objects.filter(status=PurchaseOrderStatus.DISPATCHED).count()
        delivered_pos = PurchaseOrder.objects.filter(status=PurchaseOrderStatus.DELIVERED).count()
        unpaid_invoices_aggr = SupplierInvoice.objects.filter(payment_status='UNPAID').aggregate(
            count=Count('id'),
            total=Sum('billed_amount')
        )
        unpaid_invoices_count = unpaid_invoices_aggr['count'] or 0
        unpaid_invoices_amount = unpaid_invoices_aggr['total'] or Decimal('0.00')

        return {
            'business': {
                'total_vendors': total_vendors,
                'active_vendors': active_vendors,
                'pending_vendors': pending_vendors,
                'suspended_vendors': suspended_vendors,
                'total_suppliers': total_suppliers,
                'active_suppliers': active_suppliers,
                'pending_suppliers': pending_suppliers,
                'total_customers': total_customers,
                'new_customers_today': customers_today,
                'total_stores': total_stores,
                'active_stores': active_stores,
                'total_products': total_products,
                'approved_products': approved_products,
                'pending_products': pending_products,
                'rejected_products': rejected_products,
                'low_stock_items': low_stock_count,
            },
            'sales': {
                'today_gross_sales': str(today_gross_sales),
                'yesterday_gross_sales': str(yesterday_sales),
                'month_gross_sales': str(month_sales),
                'total_gmv': str(total_gmv),
                'today_orders_count': today_order_count,
                'all_time_orders_count': all_time_orders,
                'average_order_value': str(avg_order_value),
                'completed_orders': completed_orders,
                'pending_orders': pending_orders,
                'cancelled_orders': cancelled_orders,
            },
            'financial': {
                'today_platform_commission': str(today_comm),
                'monthly_platform_commission': str(month_comm),
                'total_platform_revenue': str(total_comm),
                'pending_settlements_payable': str(pending_settlements),
                'completed_settlements_paid': str(completed_settlements),
                'successful_payments_count': successful_payments,
                'failed_payments_count': failed_payments,
            },
            'procurement': {
                'total_purchase_orders': total_pos,
                'in_transit_pos': in_transit_pos,
                'delivered_pos': delivered_pos,
                'unpaid_supplier_invoices_count': unpaid_invoices_count,
                'unpaid_supplier_invoices_amount': str(unpaid_invoices_amount),
            }
        }

    @classmethod
    def get_sales_trends(cls, days: int = 30) -> list:
        """Returns daily aggregated sales, GMV, and order volumes for timeseries charts."""
        since_date = timezone.now().date() - timedelta(days=days)
        trends = (
            Order.objects.filter(created_at__date__gte=since_date)
            .exclude(status=OrderStatus.CANCELLED)
            .annotate(order_date=TruncDate('created_at'))
            .values('order_date')
            .annotate(
                gmv=Sum('grand_total'),
                subtotal=Sum('subtotal'),
                tax=Sum('tax_total'),
                order_count=Count('id')
            )
            .order_by('order_date')
        )

        return [
            {
                'date': str(row['order_date']),
                'gmv': str(row['gmv'] or Decimal('0.00')),
                'subtotal': str(row['subtotal'] or Decimal('0.00')),
                'tax': str(row['tax'] or Decimal('0.00')),
                'order_count': row['order_count']
            }
            for row in trends
        ]

    @classmethod
    def get_top_performing_vendors(cls, limit: int = 10) -> list:
        """Ranks vendors by gross revenue and completed order volume."""
        vendors = (
            VendorSubOrder.objects.filter(status=OrderStatus.DELIVERED)
            .values('vendor__id', 'vendor__business_name')
            .annotate(
                total_sales=Sum('subtotal'),
                orders_fulfilled=Count('id'),
                platform_commission=Sum('commission_amount')
            )
            .order_by('-total_sales')[:limit]
        )

        return [
            {
                'vendor_id': str(row['vendor__id']),
                'business_name': row['vendor__business_name'],
                'total_sales': str(row['total_sales'] or Decimal('0.00')),
                'orders_fulfilled': row['orders_fulfilled'],
                'platform_commission': str(row['platform_commission'] or Decimal('0.00'))
            }
            for row in vendors
        ]

    @classmethod
    def get_top_selling_products(cls, limit: int = 10) -> list:
        """Ranks products by total units purchased."""
        products = (
            OrderItem.objects.values(
                'variant__product__id',
                'variant__product__name',
                'variant__product__vendor__business_name'
            )
            .annotate(
                total_units_sold=Sum('quantity'),
                total_revenue=Sum('total_price')
            )
            .order_by('-total_units_sold')[:limit]
        )

        return [
            {
                'product_id': str(row['variant__product__id']),
                'product_name': row['variant__product__name'],
                'vendor_name': row['variant__product__vendor__business_name'],
                'total_units_sold': row['total_units_sold'],
                'total_revenue': str(row['total_revenue'] or Decimal('0.00'))
            }
            for row in products
        ]

