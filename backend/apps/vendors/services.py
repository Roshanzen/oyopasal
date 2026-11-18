from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, Count, Avg, F, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from apps.vendors.models import VendorProfile
from apps.catalogue.models import Product, ProductVariant, ProductStatus
from apps.inventory.models import InventoryItem
from apps.orders.models import VendorSubOrder, OrderStatus, OrderItem
from apps.settlements.models import VendorSettlement, SettlementStatus

class VendorDashboardService:
    @classmethod
    def get_overview_metrics(cls, vendor: VendorProfile) -> dict:
        now = timezone.now()
        today = now.date()
        yesterday = today - timedelta(days=1)
        start_of_week = today - timedelta(days=today.weekday())
        start_of_month = today.replace(day=1)

        suborders = VendorSubOrder.objects.filter(vendor=vendor)
        valid_suborders = suborders.exclude(status=OrderStatus.CANCELLED)

        # Sales
        today_sales = valid_suborders.filter(created_at__date=today).aggregate(tot=Sum('subtotal'))['tot'] or Decimal('0.00')
        yesterday_sales = valid_suborders.filter(created_at__date=yesterday).aggregate(tot=Sum('subtotal'))['tot'] or Decimal('0.00')
        week_sales = valid_suborders.filter(created_at__date__gte=start_of_week).aggregate(tot=Sum('subtotal'))['tot'] or Decimal('0.00')
        month_sales = valid_suborders.filter(created_at__date__gte=start_of_month).aggregate(tot=Sum('subtotal'))['tot'] or Decimal('0.00')
        
        all_time_aggr = valid_suborders.aggregate(
            gross=Sum('subtotal'),
            total_orders=Count('id'),
            aov=Avg('subtotal'),
            total_comm=Sum('commission_amount'),
            net_earnings=Sum('vendor_net_amount')
        )
        total_sales = all_time_aggr['gross'] or Decimal('0.00')
        total_orders = all_time_aggr['total_orders'] or 0
        avg_order_value = round(all_time_aggr['aov'] or Decimal('0.00'), 2)
        total_commission = all_time_aggr['total_comm'] or Decimal('0.00')
        total_net_earnings = all_time_aggr['net_earnings'] or Decimal('0.00')

        # Order Statuses
        today_orders = valid_suborders.filter(created_at__date=today).count()
        pending_orders = suborders.filter(status__in=[
            OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.READY_FOR_DISPATCH
        ]).count()
        in_transit_orders = suborders.filter(status__in=[
            OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY
        ]).count()
        delivered_orders = suborders.filter(status=OrderStatus.DELIVERED).count()
        cancelled_orders = suborders.filter(status=OrderStatus.CANCELLED).count()

        # Products & Inventory
        products = Product.objects.filter(vendor=vendor)
        total_products = products.count()
        active_products = products.filter(status=ProductStatus.APPROVED).count()

        vendor_inventory = InventoryItem.objects.filter(variant__product__vendor=vendor)
        out_of_stock = vendor_inventory.filter(
            quantity_on_hand__lte=F('quantity_reserved')
        ).count()
        low_stock = vendor_inventory.filter(
            quantity_on_hand__gt=F('quantity_reserved'),
            quantity_on_hand__lte=F('quantity_reserved') + F('reorder_threshold')
        ).count()

        # Settlements
        settlements = VendorSettlement.objects.filter(vendor=vendor)
        pending_settlements = settlements.filter(
            status__in=[SettlementStatus.PENDING, SettlementStatus.APPROVED]
        ).aggregate(tot=Sum('net_payout'))['tot'] or Decimal('0.00')
        completed_settlements = settlements.filter(
            status=SettlementStatus.PAID
        ).aggregate(tot=Sum('net_payout'))['tot'] or Decimal('0.00')

        return {
            'sales': {
                'today_sales': str(today_sales),
                'yesterday_sales': str(yesterday_sales),
                'week_sales': str(week_sales),
                'month_sales': str(month_sales),
                'total_sales': str(total_sales),
                'average_order_value': str(avg_order_value),
            },
            'orders': {
                'total_orders': total_orders,
                'today_orders': today_orders,
                'pending_orders': pending_orders,
                'in_transit_orders': in_transit_orders,
                'delivered_orders': delivered_orders,
                'cancelled_orders': cancelled_orders,
            },
            'products': {
                'total_products': total_products,
                'active_products': active_products,
                'out_of_stock_products': out_of_stock,
                'low_stock_products': low_stock,
            },
            'financials': {
                'platform_commission': str(total_commission),
                'vendor_net_earnings': str(total_net_earnings),
                'pending_settlements': str(pending_settlements),
                'completed_settlements': str(completed_settlements),
            }
        }

    @classmethod
    def get_sales_trends(cls, vendor: VendorProfile, days: int = 30) -> list:
        since_date = timezone.now().date() - timedelta(days=days)
        trends = (
            VendorSubOrder.objects.filter(
                vendor=vendor,
                created_at__date__gte=since_date
            )
            .exclude(status=OrderStatus.CANCELLED)
            .annotate(order_date=TruncDate('created_at'))
            .values('order_date')
            .annotate(
                gross_sales=Sum('subtotal'),
                net_earnings=Sum('vendor_net_amount'),
                order_count=Count('id')
            )
            .order_by('order_date')
        )

        return [
            {
                'date': str(row['order_date']),
                'gross_sales': str(row['gross_sales'] or Decimal('0.00')),
                'net_earnings': str(row['net_earnings'] or Decimal('0.00')),
                'order_count': row['order_count']
            }
            for row in trends
        ]

    @classmethod
    def get_top_selling_products(cls, vendor: VendorProfile, limit: int = 5) -> list:
        items = (
            OrderItem.objects.filter(sub_order__vendor=vendor)
            .values('variant__product__id', 'variant__product__name')
            .annotate(
                units_sold=Sum('quantity'),
                revenue=Sum('total_price')
            )
            .order_by('-units_sold')[:limit]
        )

        return [
            {
                'product_id': str(row['variant__product__id']),
                'product_name': row['variant__product__name'],
                'units_sold': row['units_sold'],
                'revenue': str(row['revenue'] or Decimal('0.00'))
            }
            for row in items
        ]
