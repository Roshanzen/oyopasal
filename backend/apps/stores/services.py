from dataclasses import dataclass
from typing import List, Dict, Any, Tuple
from django.db import models, transaction
from django.db.models import ProtectedError
from django.utils.translation import gettext_lazy as _

from apps.stores.models import Store, StoreGalleryImage
from apps.catalogue.models import (
    Product, ProductVariant, ProductImage, ProductModerationLog
)
from apps.orders.models import OrderItem, VendorSubOrder
from apps.inventory.models import InventoryItem
from apps.cart.models import CartItem
from apps.reviews.models import ProductReview
from apps.customers.models import WishlistItem
from apps.messaging.models import Conversation
from apps.notifications.models import VendorOrderNotificationLog
from apps.payments.models import FinancialLedgerEntry
from apps.settlements.models import SettlementItem
from apps.commissions.models import CommissionRecord
from apps.refunds.models import Refund


@dataclass
class StoreDependencyAnalysis:
    store: Store
    is_test_store: bool
    has_orders_or_transactions: bool
    reasons_to_protect: List[str]
    order_items_count: int
    suborders_count: int
    products_count: int
    variants_count: int
    action_recommendation: str  # 'DELETE', 'ARCHIVE', 'SKIP_PRODUCTION'


class StoreCleanupService:
    """
    Dependency-aware cleanup and archival service for stores in OyoPasal.
    Ensures customer orders, receipts, financial transactions, and production
    vendor records are never permanently deleted or corrupted.
    """
    TEST_KEYWORDS = ('test', 'demo', 'dummy', 'sample', 'mock', 'temp')
    TEST_EMAIL_DOMAINS = ('@example.com', '@test.com', '@demo.com', '@oyopasal.test')

    @classmethod
    def is_test_or_demo_store(cls, store: Store) -> bool:
        """
        Safely identifies whether a store is explicitly an identified test/demo record.
        Prevents accidental modification or deletion of real production vendor storefronts.
        """
        name_lower = (store.name or '').lower()
        slug_lower = (store.slug or '').lower()
        vendor_name = (store.vendor.business_name if store.vendor else '').lower()
        vendor_slug = (store.vendor.slug if store.vendor else '').lower()
        email_lower = (store.contact_email or '').lower()

        # Keyword checks in store name or slug
        has_test_name = any(kw in name_lower for kw in cls.TEST_KEYWORDS)
        has_test_slug = any(kw in slug_lower for kw in cls.TEST_KEYWORDS)
        # Keyword checks in linked vendor profile
        has_test_vendor = any(kw in vendor_name or kw in vendor_slug for kw in cls.TEST_KEYWORDS)
        # Email domain check
        has_test_email = any(email_lower.endswith(domain) for domain in cls.TEST_EMAIL_DOMAINS)

        return bool(has_test_name or has_test_slug or has_test_vendor or has_test_email)

    @classmethod
    def analyze_store(cls, store: Store) -> StoreDependencyAnalysis:
        """
        Inspects the complete dependency graph of a store to determine if it can be
        safely hard-deleted, must be archived to preserve historical integrity,
        or skipped because it is an active production storefront.
        """
        is_test = cls.is_test_or_demo_store(store)
        reasons: List[str] = []

        # 1. Direct sub-orders
        suborders_count = store.suborders.count()
        if suborders_count > 0:
            reasons.append(f"{suborders_count} direct sub-order(s)")

        # 2. Direct order items
        order_items_count = store.order_items.count()
        if order_items_count > 0:
            reasons.append(f"{order_items_count} direct order item(s)")

        # 3. Order items referencing store product variants (even if store FK is null)
        variant_order_items = OrderItem.objects.filter(variant__product__store=store).count()
        if variant_order_items > 0:
            reasons.append(f"{variant_order_items} order item(s) referencing store product variants")

        # 4. Financial ledger entries
        ledgers = FinancialLedgerEntry.objects.filter(sub_order__store=store).count()
        if ledgers > 0:
            reasons.append(f"{ledgers} financial ledger transaction(s)")

        # 5. Settlements
        settlements = SettlementItem.objects.filter(sub_order__store=store).count()
        if settlements > 0:
            reasons.append(f"{settlements} settlement record(s)")

        # 6. Commissions
        commissions = CommissionRecord.objects.filter(sub_order__store=store).count()
        if commissions > 0:
            reasons.append(f"{commissions} commission record(s)")

        # 7. Refunds
        refunds = Refund.objects.filter(sub_order__store=store).count()
        if refunds > 0:
            reasons.append(f"{refunds} refund transaction(s)")

        has_transactions = len(reasons) > 0
        products_count = store.products.count()
        variants_count = ProductVariant.objects.filter(product__store=store).count()

        if not is_test:
            recommendation = 'SKIP_PRODUCTION'
        elif has_transactions:
            recommendation = 'ARCHIVE'
        else:
            recommendation = 'DELETE'

        return StoreDependencyAnalysis(
            store=store,
            is_test_store=is_test,
            has_orders_or_transactions=has_transactions,
            reasons_to_protect=reasons,
            order_items_count=order_items_count + variant_order_items,
            suborders_count=suborders_count,
            products_count=products_count,
            variants_count=variants_count,
            action_recommendation=recommendation
        )

    @classmethod
    def execute_cleanup(
        cls,
        queryset: models.QuerySet,
        user=None
    ) -> Dict[str, Any]:
        """
        Executes dependency-aware cleanup with transaction.atomic() safeguards.
        Guarantees:
        - Production stores are skipped.
        - Stores with historical transactions are archived/deactivated (NEVER deleted).
        - Test stores with NO historical transactions have non-order dependencies removed,
          then safely hard-deleted.
        - Any unexpected ProtectedError is caught and rolls back safely.
        """
        results: Dict[str, List[Any]] = {
            'deleted': [],
            'archived': [],
            'skipped': [],
            'errors': [],
        }

        for store in queryset:
            analysis = cls.analyze_store(store)

            # Case 1: Real / production store -> Protect & skip
            if not analysis.is_test_store:
                results['skipped'].append({
                    'store': store,
                    'name': store.name,
                    'reason': 'Production store: Cleanup is strictly restricted to test/demo stores.'
                })
                continue

            # Case 2: Test store with historical orders or financial transactions -> ARCHIVE ONLY
            if analysis.has_orders_or_transactions:
                with transaction.atomic():
                    # Preserve store receipts and snapshots
                    VendorSubOrder.objects.filter(store=store, store_name_snapshot='').update(store_name_snapshot=store.name)
                    OrderItem.objects.filter(store=store, store_name_snapshot='').update(store_name_snapshot=store.name)
                    was_active = store.is_active
                    if store.is_active:
                        store.is_active = False
                        store.save(update_fields=['is_active', 'updated_at'])

                    reasons_str = "; ".join(analysis.reasons_to_protect)
                    results['archived'].append({
                        'store': store,
                        'name': store.name,
                        'was_active': was_active,
                        'reason': f"Retained and archived/deactivated to protect historical records ({reasons_str})."
                    })
                continue

            # Case 3: Test store with NO historical transactions -> SAFE HARD DELETE
            try:
                with transaction.atomic():
                    # Clean up dependent test catalog records safely before store deletion
                    products = list(store.products.all())
                    product_ids = [p.id for p in products]
                    variants = ProductVariant.objects.filter(product_id__in=product_ids)
                    variant_ids = list(variants.values_list('id', flat=True))

                    # Safely remove non-order dependent records
                    CartItem.objects.filter(variant_id__in=variant_ids).delete()
                    InventoryItem.objects.filter(variant_id__in=variant_ids).delete()
                    ProductImage.objects.filter(product_id__in=product_ids).delete()
                    ProductReview.objects.filter(product_id__in=product_ids).delete()
                    WishlistItem.objects.filter(product_id__in=product_ids).delete()
                    ProductModerationLog.objects.filter(product_id__in=product_ids).delete()
                    Conversation.objects.filter(
                        models.Q(store=store) | models.Q(product_id__in=product_ids)
                    ).delete()
                    VendorOrderNotificationLog.objects.filter(store=store).delete()
                    store.gallery_images.all().delete()

                    # Explicitly hard-delete products before store
                    for prod in products:
                        prod.hard_delete()

                    store_name = store.name
                    store.hard_delete()

                    results['deleted'].append({
                        'store_id': str(store.id),
                        'name': store_name,
                        'reason': 'Safely deleted with 0 historical dependencies.'
                    })
            except ProtectedError as pe:
                # ProtectedError caught: Fall back to safe archiving
                store.refresh_from_db()
                store.is_active = False
                store.save(update_fields=['is_active', 'updated_at'])
                results['archived'].append({
                    'store': store,
                    'name': store.name,
                    'reason': f"Protected reference encountered ({pe.protected_objects}). Safely archived instead."
                })
            except Exception as ex:
                results['errors'].append({
                    'store': store,
                    'name': store.name,
                    'error': str(ex)
                })

        return results
