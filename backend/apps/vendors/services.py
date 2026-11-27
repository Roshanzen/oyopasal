from decimal import Decimal
from datetime import timedelta
from dataclasses import dataclass
from typing import List, Dict, Any
from django.db import models, transaction
from django.db.models import Sum, Count, Avg, F, Q, ProtectedError
from django.db.models.functions import TruncDate
from django.utils import timezone
from apps.vendors.models import VendorProfile, VendorStatus
from apps.catalogue.models import (
    Product, ProductVariant, ProductStatus, ProductImage, ProductModerationLog
)
from apps.inventory.models import InventoryItem
from apps.orders.models import VendorSubOrder, OrderStatus, OrderItem
from apps.settlements.models import VendorSettlement, SettlementStatus, SettlementItem
from apps.stores.models import Store
from apps.cart.models import CartItem
from apps.customers.models import WishlistItem
from apps.reviews.models import ProductReview
from apps.messaging.models import Conversation
from apps.notifications.models import VendorOrderNotificationLog
from apps.payments.models import FinancialLedgerEntry
from apps.commissions.models import CommissionRecord
from apps.refunds.models import Refund

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


@dataclass
class VendorDependencyAnalysis:
    vendor: VendorProfile
    business_name: str
    is_test_vendor: bool
    has_orders_or_transactions: bool
    reasons_to_protect: List[str]
    suborders_count: int
    order_items_count: int
    settlements_count: int
    purchase_orders_count: int
    supplier_invoices_count: int
    products_count: int
    variants_count: int
    stores_count: int
    action_recommendation: str  # 'ARCHIVE' or 'DELETE'


class VendorCleanupService:
    """
    Dependency-aware cleanup and archival service for VendorProfile instances.
    Safely purges unreferenced vendors and their catalog/storefront records,
    while guaranteeing that vendors with historical customer orders, delivered sub-orders,
    payments, invoices, and settlements are permanently preserved and safely archived.
    """
    TEST_KEYWORDS = ('test', 'demo', 'dummy', 'sample', 'mock', 'temp')
    TEST_EMAIL_DOMAINS = ('@example.com', '@test.com', '@demo.com', '@oyopasal.test')

    @classmethod
    def is_test_or_demo_vendor(cls, vendor: VendorProfile) -> bool:
        name_lower = (vendor.business_name or '').lower()
        slug_lower = (vendor.slug or '').lower()
        email_lower = (vendor.user.email if vendor.user else '').lower()

        has_test_name = any(kw in name_lower for kw in cls.TEST_KEYWORDS)
        has_test_slug = any(kw in slug_lower for kw in cls.TEST_KEYWORDS)
        has_test_email = any(email_lower.endswith(domain) for domain in cls.TEST_EMAIL_DOMAINS)
        return bool(has_test_name or has_test_slug or has_test_email)

    @classmethod
    def analyze_vendor(cls, vendor: VendorProfile) -> VendorDependencyAnalysis:
        reasons: List[str] = []

        # 1. Direct sub-orders
        suborders_count = vendor.suborders.count()
        if suborders_count > 0:
            reasons.append(f"{suborders_count} direct sub-order(s)")

        # 2. Order items referencing vendor products/variants or sub-orders
        order_items_count = OrderItem.objects.filter(
            Q(sub_order__vendor=vendor) | Q(variant__product__vendor=vendor)
        ).distinct().count()
        if order_items_count > 0 and suborders_count == 0:
            reasons.append(f"{order_items_count} order line item(s) referencing vendor products")

        # 3. Settlements
        settlements_count = vendor.settlements.count()
        if settlements_count > 0:
            reasons.append(f"{settlements_count} vendor settlement record(s)")

        # 4. Purchase orders (B2B)
        purchase_orders_count = getattr(vendor, 'purchase_orders', VendorProfile.objects.none()).count() if hasattr(vendor, 'purchase_orders') else 0
        if purchase_orders_count > 0:
            reasons.append(f"{purchase_orders_count} purchase order(s)")

        # 5. Supplier invoices
        supplier_invoices_count = getattr(vendor, 'supplier_invoices', VendorProfile.objects.none()).count() if hasattr(vendor, 'supplier_invoices') else 0
        if supplier_invoices_count > 0:
            reasons.append(f"{supplier_invoices_count} supplier invoice(s)")

        # 6. Financial ledger entries
        ledgers_count = FinancialLedgerEntry.objects.filter(
            Q(sub_order__vendor=vendor) | Q(vendor=vendor)
        ).count()
        if ledgers_count > 0:
            reasons.append(f"{ledgers_count} financial ledger entry(s)")

        # 7. Refunds
        refunds_count = Refund.objects.filter(sub_order__vendor=vendor).count()
        if refunds_count > 0:
            reasons.append(f"{refunds_count} customer refund record(s)")

        has_transactions = len(reasons) > 0
        products_count = vendor.products.count()
        variants_count = ProductVariant.all_objects.filter(product__vendor=vendor).count()
        stores_count = vendor.stores.count()
        is_test = cls.is_test_or_demo_vendor(vendor)

        action = 'ARCHIVE' if has_transactions else 'DELETE'

        return VendorDependencyAnalysis(
            vendor=vendor,
            business_name=vendor.business_name,
            is_test_vendor=is_test,
            has_orders_or_transactions=has_transactions,
            reasons_to_protect=reasons,
            suborders_count=suborders_count,
            order_items_count=order_items_count,
            settlements_count=settlements_count,
            purchase_orders_count=purchase_orders_count,
            supplier_invoices_count=supplier_invoices_count,
            products_count=products_count,
            variants_count=variants_count,
            stores_count=stores_count,
            action_recommendation=action
        )

    @classmethod
    def execute_cleanup(
        cls,
        queryset: models.QuerySet,
        user=None
    ) -> Dict[str, List[Any]]:
        results: Dict[str, List[Any]] = {
            'deleted': [],
            'archived': [],
            'errors': []
        }

        for vendor in queryset:
            analysis = cls.analyze_vendor(vendor)

            if analysis.has_orders_or_transactions:
                # Case 1: Vendor has historical transactions -> SAFE ARCHIVAL & PRESERVATION
                try:
                    with transaction.atomic():
                        # Preserve historical sub-order and order item snapshots
                        VendorSubOrder.objects.filter(
                            vendor=vendor,
                            store_name_snapshot=''
                        ).update(store_name_snapshot=vendor.business_name)

                        vendor_order_items = OrderItem.objects.filter(
                            Q(sub_order__vendor=vendor) | Q(variant__product__vendor=vendor)
                        ).select_related('variant', 'variant__product', 'store')

                        for item in vendor_order_items:
                            updated_fields = []
                            if not item.product_title_snapshot and item.variant and item.variant.product:
                                item.product_title_snapshot = item.variant.product.name
                                updated_fields.append('product_title_snapshot')
                            if not item.store_name_snapshot:
                                item.store_name_snapshot = (item.store.name if item.store else '') or vendor.business_name
                                updated_fields.append('store_name_snapshot')
                            if not item.variant_sku and item.variant:
                                item.variant_sku = item.variant.sku
                                updated_fields.append('variant_sku')
                            if updated_fields:
                                item.save(update_fields=updated_fields)

                        # Clean up products: remove non-order products, archive ordered products
                        for product in list(vendor.products.all()):
                            prod_variants = list(ProductVariant.all_objects.filter(product=product))
                            prod_variant_ids = [v.id for v in prod_variants]
                            has_prod_orders = OrderItem.objects.filter(variant_id__in=prod_variant_ids).exists()

                            # Always purge transient cart items & wishlist entries
                            CartItem.objects.filter(variant_id__in=prod_variant_ids).delete()
                            WishlistItem.objects.filter(product=product).delete()

                            if has_prod_orders:
                                # Archive product & variants to keep order detail FKs intact
                                for v in prod_variants:
                                    v.is_active = False
                                    v.is_deleted = True
                                    v.deleted_at = timezone.now()
                                    v.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])

                                product.status = ProductStatus.ARCHIVED
                                product.is_deleted = True
                                product.deleted_at = timezone.now()
                                product.save(update_fields=['status', 'is_deleted', 'deleted_at', 'updated_at'])
                            else:
                                # Safe to hard delete unpurchased products
                                InventoryItem.objects.filter(variant_id__in=prod_variant_ids).delete()
                                ProductImage.objects.filter(product=product).delete()
                                ProductReview.objects.filter(product=product).delete()
                                ProductModerationLog.objects.filter(product=product).delete()
                                Conversation.objects.filter(product=product).delete()
                                for v in prod_variants:
                                    v.hard_delete()
                                product.hard_delete()

                        # Deactivate and archive stores
                        for store in vendor.stores.all():
                            store.is_active = False
                            store.is_deleted = True
                            store.deleted_at = timezone.now()
                            store.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])

                        # Archive vendor
                        vendor.status = VendorStatus.ARCHIVED
                        vendor.rejection_reason = "Archived by admin: historical transactions preserved."
                        vendor.save(update_fields=['status', 'rejection_reason', 'updated_at'])

                        reasons_str = "; ".join(analysis.reasons_to_protect)
                        results['archived'].append({
                            'vendor': vendor,
                            'business_name': vendor.business_name,
                            'reason': f"Preserved & archived to protect historical records ({reasons_str})."
                        })
                except Exception as ex:
                    results['errors'].append({
                        'vendor': vendor,
                        'business_name': vendor.business_name,
                        'error': str(ex)
                    })
            else:
                # Case 2: Vendor has NO historical transactions -> SAFE PERMANENT DELETION
                try:
                    with transaction.atomic():
                        # Delete all products & variants
                        products = list(vendor.products.all())
                        for product in products:
                            variants = list(ProductVariant.all_objects.filter(product=product))
                            variant_ids = [v.id for v in variants]

                            CartItem.objects.filter(variant_id__in=variant_ids).delete()
                            InventoryItem.objects.filter(variant_id__in=variant_ids).delete()
                            ProductImage.objects.filter(product=product).delete()
                            ProductReview.objects.filter(product=product).delete()
                            WishlistItem.objects.filter(product=product).delete()
                            ProductModerationLog.objects.filter(product=product).delete()
                            Conversation.objects.filter(product=product).delete()

                            for v in variants:
                                v.hard_delete()
                            product.hard_delete()

                        # Delete all stores
                        for store in list(vendor.stores.all()):
                            store.gallery_images.all().delete()
                            Conversation.objects.filter(store=store).delete()
                            VendorOrderNotificationLog.objects.filter(store=store).delete()
                            store.hard_delete()

                        # Clean up documents, staff, RFQs, notifications, conversations, warehouses
                        vendor.documents.all().delete()
                        vendor.staff_members.all().delete()
                        if hasattr(vendor, 'application') and vendor.application:
                            vendor.application.delete()
                        if hasattr(vendor, 'subscription') and vendor.subscription:
                            vendor.subscription.delete()
                        if hasattr(vendor, 'rfqs'):
                            vendor.rfqs.all().delete()
                        if hasattr(vendor, 'received_quotations'):
                            vendor.received_quotations.all().delete()
                        vendor.order_notification_logs.all().delete()
                        vendor.vendor_conversations.all().delete()
                        for wh in vendor.warehouses.all():
                            wh.inventory_items.all().delete()
                            wh.hard_delete()

                        b_name = vendor.business_name
                        vendor.delete()

                        results['deleted'].append({
                            'business_name': b_name,
                            'reason': f"Permanently deleted with {len(products)} products and all associated assets."
                        })
                except ProtectedError as pe:
                    try:
                        with transaction.atomic():
                            vendor.refresh_from_db()
                            vendor.status = VendorStatus.ARCHIVED
                            vendor.rejection_reason = f"Archived: protected reference encountered ({pe.protected_objects})"
                            vendor.save(update_fields=['status', 'rejection_reason', 'updated_at'])
                            results['archived'].append({
                                'vendor': vendor,
                                'business_name': vendor.business_name,
                                'reason': f"Protected reference encountered ({pe.protected_objects}). Safely archived instead."
                            })
                    except Exception as inner_ex:
                        results['errors'].append({
                            'vendor': vendor,
                            'business_name': vendor.business_name,
                            'error': str(inner_ex)
                        })
                except Exception as ex:
                    results['errors'].append({
                        'vendor': vendor,
                        'business_name': vendor.business_name,
                        'error': str(ex)
                    })

        return results

