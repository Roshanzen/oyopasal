from decimal import Decimal
from datetime import timedelta
import math
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from apps.catalogue.models import Product, ProductVariant, ProductStatus
from apps.inventory.models import InventoryItem
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus

class RecommendationEngine:
    @classmethod
    def get_frequently_bought_together(cls, product_id, limit: int = 4) -> list:
        """
        Calculates item-based co-occurrence matrix across completed/confirmed sub-orders.
        """
        # Find all suborders containing this product
        suborder_ids = OrderItem.objects.filter(
            variant__product_id=product_id
        ).values_list('sub_order_id', flat=True)

        if not suborder_ids:
            return []

        # Find other products frequently co-occurring in the same suborders
        co_items = (
            OrderItem.objects.filter(sub_order_id__in=suborder_ids)
            .exclude(variant__product_id=product_id)
            .values(
                'variant__product_id',
                'variant__product__name',
                'variant__product__slug',
                'variant__product__vendor__business_name'
            )
            .annotate(co_count=Count('id'))
            .order_by('-co_count')[:limit]
        )

        return [
            {
                'product_id': str(row['variant__product_id']),
                'name': row['variant__product__name'],
                'slug': row['variant__product__slug'],
                'vendor_name': row['variant__product__vendor__business_name'],
                'confidence_score': round(min(1.0, row['co_count'] / max(1, len(suborder_ids))), 2)
            }
            for row in co_items
        ]

    @classmethod
    def get_trending_products(cls, days: int = 7, limit: int = 8) -> list:
        """
        Ranks products by recent sales volume velocity.
        """
        since = timezone.now() - timedelta(days=days)
        trending = (
            OrderItem.objects.filter(
                created_at__gte=since,
                sub_order__status__in=[
                    OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
                    OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED
                ]
            )
            .values(
                'variant__product_id',
                'variant__product__name',
                'variant__product__slug',
                'variant__product__vendor__business_name'
            )
            .annotate(
                units_sold=Sum('quantity'),
                orders_count=Count('id')
            )
            .order_by('-units_sold')[:limit]
        )

        return [
            {
                'product_id': str(row['variant__product_id']),
                'name': row['variant__product__name'],
                'slug': row['variant__product__slug'],
                'vendor_name': row['variant__product__vendor__business_name'],
                'units_sold': row['units_sold'],
                'orders_count': row['orders_count']
            }
            for row in trending
        ]

    @classmethod
    def get_personalized_recommendations(cls, user, limit: int = 6) -> list:
        """
        User collaborative filtering based on historical purchases and category preferences.
        """
        purchased_category_ids = []
        if user and user.is_authenticated:
            purchased_category_ids = list(
                OrderItem.objects.filter(sub_order__parent_order__customer=user)
                .values_list('variant__product__category_id', flat=True)
                .distinct()
            )

        qs = Product.objects.filter(
            status=ProductStatus.APPROVED,
            store__is_active=True
        )

        if purchased_category_ids:
            qs = qs.filter(category_id__in=purchased_category_ids)

        products = qs.select_related('vendor', 'store', 'category')[:limit]

        return [
            {
                'product_id': str(p.id),
                'name': p.name,
                'slug': p.slug,
                'category_name': p.category.name if p.category else 'General',
                'vendor_name': p.vendor.business_name if p.vendor else 'Platform Store',
                'recommendation_reason': 'Based on your recent shopping preferences' if purchased_category_ids else 'Popular on Oyo Pasal'
            }
            for p in products
        ]


class DemandForecastingService:
    @classmethod
    def forecast_sku_demand(cls, variant_id, lookback_days: int = 30, forecast_days: int = 30) -> dict:
        """
        Calculates sales velocity, predicted stockout day, and optimal reorder quantity.
        """
        try:
            variant = ProductVariant.objects.select_related('product').get(id=variant_id)
        except ProductVariant.DoesNotExist:
            raise ValueError("Product variant not found.")

        since = timezone.now() - timedelta(days=lookback_days)
        
        # Calculate total units sold in lookback window
        sold_aggr = OrderItem.objects.filter(
            variant=variant,
            created_at__gte=since,
            sub_order__status__in=[
                OrderStatus.CONFIRMED, OrderStatus.PROCESSING,
                OrderStatus.PACKED, OrderStatus.SHIPPED, OrderStatus.DELIVERED
            ]
        ).aggregate(tot=Sum('quantity'))
        
        units_sold = sold_aggr['tot'] or 0
        daily_velocity = units_sold / max(1, lookback_days)
        projected_demand = round(daily_velocity * forecast_days)

        # Inventory on hand
        inv_aggr = InventoryItem.objects.filter(variant=variant).aggregate(
            on_hand=Sum('quantity_on_hand'),
            reserved=Sum('quantity_reserved'),
            reorder=Sum('reorder_threshold')
        )
        on_hand = inv_aggr['on_hand'] or 0
        reserved = inv_aggr['reserved'] or 0
        available_stock = max(0, on_hand - reserved)
        reorder_threshold = inv_aggr['reorder'] or 10

        # Calculate days until stockout
        if daily_velocity > 0:
            days_to_stockout = math.floor(available_stock / daily_velocity)
        else:
            days_to_stockout = 999 # Stable stock

        # Recommended procurement order quantity to cover forecast days plus safety buffer
        safety_stock = reorder_threshold
        recommended_reorder = max(0, (projected_demand + safety_stock) - available_stock)

        return {
            'variant_id': str(variant.id),
            'sku': variant.sku,
            'product_name': variant.product.name,
            'lookback_days': lookback_days,
            'historical_units_sold': units_sold,
            'daily_run_rate_velocity': round(daily_velocity, 2),
            'forecast_window_days': forecast_days,
            'projected_demand_units': projected_demand,
            'current_available_stock': available_stock,
            'days_until_stockout': days_to_stockout,
            'stockout_risk_level': 'HIGH' if days_to_stockout <= 7 else ('MODERATE' if days_to_stockout <= 14 else 'LOW'),
            'recommended_reorder_units': recommended_reorder
        }


class FraudRiskScoringService:
    @classmethod
    def evaluate_order_risk(cls, order: Order) -> dict:
        """
        Evaluates risk signals (0 = safe, 100 = extreme risk) for transaction fraud & abuse prevention.
        """
        score = 0
        flags = []

        # 1. High transaction value anomaly
        if order.grand_total > Decimal('50000.00'):
            score += 25
            flags.append('HIGH_TRANSACTION_VALUE_ABOVE_NPR_50K')

        # 2. Velocity check: rapid successive orders by same customer in last 1 hour
        one_hour_ago = timezone.now() - timedelta(hours=1)
        recent_order_count = Order.objects.filter(
            customer=order.customer,
            created_at__gte=one_hour_ago
        ).count()

        if recent_order_count >= 3:
            score += 35
            flags.append(f'HIGH_ORDER_VELOCITY_{recent_order_count}_IN_1_HOUR')

        # 3. Failed payment attempts on this order
        failed_payments = order.payments.filter(status='FAILED').count()
        if failed_payments >= 2:
            score += 20
            flags.append(f'MULTIPLE_FAILED_PAYMENT_ATTEMPTS_{failed_payments}')

        # 4. Cash On Delivery high-value threshold
        if order.payment_method == 'COD' and order.grand_total > Decimal('20000.00'):
            score += 15
            flags.append('HIGH_VALUE_COD_ORDER')

        score = min(100, score)
        risk_level = 'LOW'
        if score >= 60:
            risk_level = 'HIGH'
        elif score >= 30:
            risk_level = 'MEDIUM'

        return {
            'order_number': order.order_number,
            'risk_score': score,
            'risk_level': risk_level,
            'is_flagged_for_manual_review': score >= 50,
            'risk_signals': flags
        }

