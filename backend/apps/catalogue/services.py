from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from django.db import models, transaction
from django.db.models import ProtectedError
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.catalogue.models import (
    Category, Product, ProductVariant, ProductStatus, ProductImage, ProductModerationLog
)
from apps.orders.models import OrderItem
from apps.cart.models import CartItem
from apps.inventory.models import InventoryItem
from apps.customers.models import WishlistItem
from apps.reviews.models import ProductReview
from apps.messaging.models import Conversation


@dataclass
class VariantDependencyAnalysis:
    variant: ProductVariant
    sku: str
    product_name: str
    order_items_count: int
    cart_items_count: int
    inventory_count: int
    has_historical_orders: bool
    reasons_to_protect: List[str]
    action_recommendation: str  # 'ARCHIVE' or 'DELETE'


class ProductVariantCleanupService:
    """
    Dependency-aware cleanup and archival service for ProductVariant instances.
    Safely purges unreferenced variants and transient cart/inventory data while
    preserving historical OrderItem rows, order prices, parent orders, and parent products.
    """

    @classmethod
    def analyze_variant(cls, variant: ProductVariant) -> VariantDependencyAnalysis:
        reasons: List[str] = []
        order_items_count = variant.order_items.count()
        if order_items_count > 0:
            reasons.append(f"{order_items_count} historical order item(s)")

        cart_items_count = variant.cart_items.count()
        inventory_count = variant.inventory_records.count()
        has_orders = order_items_count > 0

        action = 'ARCHIVE' if has_orders else 'DELETE'

        return VariantDependencyAnalysis(
            variant=variant,
            sku=variant.sku,
            product_name=variant.product.name if variant.product else 'Unknown Product',
            order_items_count=order_items_count,
            cart_items_count=cart_items_count,
            inventory_count=inventory_count,
            has_historical_orders=has_orders,
            reasons_to_protect=reasons,
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

        for variant in queryset:
            analysis = cls.analyze_variant(variant)

            if analysis.has_historical_orders:
                # Case 1: Variant has historical order references -> ARCHIVE ONLY
                try:
                    with transaction.atomic():
                        # Ensure immutable snapshots on OrderItems
                        OrderItem.objects.filter(
                            variant=variant,
                            product_title_snapshot=''
                        ).update(product_title_snapshot=variant.product.name if variant.product else '')
                        OrderItem.objects.filter(
                            variant=variant,
                            variant_sku=''
                        ).update(variant_sku=variant.sku)

                        # Clean up transient active cart entries
                        CartItem.objects.filter(variant=variant).delete()

                        # Soft-delete and deactivate variant
                        variant.is_active = False
                        variant.is_deleted = True
                        variant.deleted_at = timezone.now()
                        variant.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])

                        # If this was the default variant, promote another active variant if available
                        if variant.is_default and variant.product:
                            alt = variant.product.variants.filter(
                                is_active=True,
                                is_deleted=False
                            ).exclude(id=variant.id).first()
                            if alt:
                                alt.is_default = True
                                alt.save(update_fields=['is_default', 'updated_at'])

                        results['archived'].append({
                            'variant': variant,
                            'sku': variant.sku,
                            'product_name': analysis.product_name,
                            'reason': f"Preserved & archived to protect {analysis.order_items_count} historical order item(s)."
                        })
                except Exception as ex:
                    results['errors'].append({
                        'variant': variant,
                        'sku': variant.sku,
                        'error': str(ex)
                    })
            else:
                # Case 2: Variant has NO historical orders -> SAFE HARD DELETE
                try:
                    with transaction.atomic():
                        parent_product = variant.product
                        was_default = variant.is_default

                        # Clean up transient non-historical dependencies
                        CartItem.objects.filter(variant=variant).delete()
                        variant.inventory_records.all().delete()
                        variant.images.all().update(variant=None)

                        sku_name = variant.sku
                        product_name = analysis.product_name
                        variant.hard_delete()

                        # If deleted variant was default, assign default to another variant on parent
                        if was_default and parent_product:
                            alt = parent_product.variants.filter(is_deleted=False).first()
                            if alt:
                                alt.is_default = True
                                alt.save(update_fields=['is_default', 'updated_at'])

                        results['deleted'].append({
                            'sku': sku_name,
                            'product_name': product_name,
                            'reason': 'Permanently deleted with 0 historical order dependencies.'
                        })
                except ProtectedError as pe:
                    try:
                        with transaction.atomic():
                            variant.refresh_from_db()
                            variant.is_active = False
                            variant.is_deleted = True
                            variant.deleted_at = timezone.now()
                            variant.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])
                            results['archived'].append({
                                'variant': variant,
                                'sku': variant.sku,
                                'product_name': analysis.product_name,
                                'reason': f"Protected reference encountered ({pe.protected_objects}). Safely archived instead."
                            })
                    except Exception as inner_ex:
                        results['errors'].append({
                            'variant': variant,
                            'sku': variant.sku,
                            'error': str(inner_ex)
                        })
                except Exception as ex:
                    results['errors'].append({
                        'variant': variant,
                        'sku': variant.sku,
                        'error': str(ex)
                    })

        return results


@dataclass
class ProductDependencyAnalysis:
    product: Product
    name: str
    variants_count: int
    order_items_count: int
    cart_items_count: int
    has_historical_orders: bool
    reasons_to_protect: List[str]
    action_recommendation: str  # 'ARCHIVE' or 'DELETE'


class ProductCleanupService:
    """
    Dependency-aware cleanup and archival service for Product instances.
    Ensures products with historical order references are archived rather than
    breaking customer order history.
    """

    @classmethod
    def analyze_product(cls, product: Product) -> ProductDependencyAnalysis:
        reasons: List[str] = []
        variants = list(ProductVariant.all_objects.filter(product=product))
        variant_ids = [v.id for v in variants]

        order_items_count = OrderItem.objects.filter(variant_id__in=variant_ids).count()
        if order_items_count > 0:
            reasons.append(f"{order_items_count} historical order item(s)")

        cart_items_count = CartItem.objects.filter(variant_id__in=variant_ids).count()
        has_orders = order_items_count > 0
        action = 'ARCHIVE' if has_orders else 'DELETE'

        return ProductDependencyAnalysis(
            product=product,
            name=product.name,
            variants_count=len(variants),
            order_items_count=order_items_count,
            cart_items_count=cart_items_count,
            has_historical_orders=has_orders,
            reasons_to_protect=reasons,
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

        for product in queryset:
            analysis = cls.analyze_product(product)

            if analysis.has_historical_orders:
                try:
                    with transaction.atomic():
                        variants = ProductVariant.all_objects.filter(product=product)
                        variant_ids = list(variants.values_list('id', flat=True))

                        for v in variants:
                            OrderItem.objects.filter(variant=v, product_title_snapshot='').update(
                                product_title_snapshot=product.name
                            )
                            OrderItem.objects.filter(variant=v, variant_sku='').update(
                                variant_sku=v.sku
                            )

                        CartItem.objects.filter(variant_id__in=variant_ids).delete()
                        WishlistItem.objects.filter(product=product).delete()

                        variants.update(
                            is_active=False,
                            is_deleted=True,
                            deleted_at=timezone.now()
                        )

                        product.status = ProductStatus.ARCHIVED
                        product.is_deleted = True
                        product.deleted_at = timezone.now()
                        product.save(update_fields=['status', 'is_deleted', 'deleted_at', 'updated_at'])

                        results['archived'].append({
                            'product': product,
                            'name': product.name,
                            'reason': f"Preserved & archived to protect {analysis.order_items_count} historical order item(s)."
                        })
                except Exception as ex:
                    results['errors'].append({
                        'product': product,
                        'name': product.name,
                        'error': str(ex)
                    })
            else:
                try:
                    with transaction.atomic():
                        variants = ProductVariant.all_objects.filter(product=product)
                        variant_ids = list(variants.values_list('id', flat=True))

                        CartItem.objects.filter(variant_id__in=variant_ids).delete()
                        InventoryItem.objects.filter(variant_id__in=variant_ids).delete()
                        ProductImage.objects.filter(product=product).delete()
                        ProductReview.objects.filter(product=product).delete()
                        WishlistItem.objects.filter(product=product).delete()
                        ProductModerationLog.objects.filter(product=product).delete()
                        Conversation.objects.filter(product=product).delete()

                        for v in variants:
                            v.hard_delete()

                        prod_name = product.name
                        product.hard_delete()

                        results['deleted'].append({
                            'name': prod_name,
                            'reason': 'Permanently deleted with 0 historical dependencies.'
                        })
                except ProtectedError as pe:
                    try:
                        with transaction.atomic():
                            product.refresh_from_db()
                            product.status = ProductStatus.ARCHIVED
                            product.is_deleted = True
                            product.deleted_at = timezone.now()
                            product.save(update_fields=['status', 'is_deleted', 'deleted_at', 'updated_at'])
                            results['archived'].append({
                                'product': product,
                                'name': product.name,
                                'reason': f"Protected reference encountered ({pe.protected_objects}). Safely archived instead."
                            })
                    except Exception as inner_ex:
                        results['errors'].append({
                            'product': product,
                            'name': product.name,
                            'error': str(inner_ex)
                        })
                except Exception as ex:
                    results['errors'].append({
                        'product': product,
                        'name': product.name,
                        'error': str(ex)
                    })

        return results


@dataclass
class CategoryDependencyAnalysis:
    category: Category
    name: str
    parent_name: Optional[str]
    products_count: int
    ordered_products_count: int
    unpurchased_products_count: int
    subcategories_count: int
    can_safely_delete: bool
    reasons_to_protect: List[str]
    action_recommendation: str  # 'DELETE', 'REASSIGN_OR_ARCHIVE', 'ARCHIVE'


class CategoryCleanupService:
    """
    Dependency-aware cleanup, reassignment, and archival service for Category instances.
    Guarantees:
    - Categories with 0 products and 0 subcategories are permanently hard-deleted.
    - Categories with products can have all products safely reassigned to an active target category,
      reparenting subcategories cleanly before permanent deletion of the old category.
    - If no target category is selected, categories containing products are safely archived
      (soft-deleted and deactivated), preserving all product records, variants, orders, and receipts.
    - Products and orders are NEVER deleted as a side effect of category deletion.
    - Circular category hierarchies and invalid reassignments are strictly prevented.
    """

    @classmethod
    def is_descendant(cls, candidate: Category, potential_ancestor_id) -> bool:
        """Checks if candidate is a descendant of the category with potential_ancestor_id."""
        curr = candidate.parent
        while curr:
            if str(curr.id) == str(potential_ancestor_id):
                return True
            curr = curr.parent
        return False

    @classmethod
    def analyze_category(cls, category: Category) -> CategoryDependencyAnalysis:
        reasons: List[str] = []
        products = list(Product.all_objects.filter(category=category))
        products_count = len(products)
        product_ids = [p.id for p in products]

        ordered_product_ids = set(
            OrderItem.objects.filter(
                variant__product_id__in=product_ids
            ).values_list('variant__product_id', flat=True)
        )
        ordered_products_count = len(ordered_product_ids)
        unpurchased_products_count = products_count - ordered_products_count
        subcategories_count = category.subcategories.count()

        if ordered_products_count > 0:
            reasons.append(f"{ordered_products_count} product(s) with historical orders")
        if unpurchased_products_count > 0:
            reasons.append(f"{unpurchased_products_count} unpurchased product(s)")
        if subcategories_count > 0:
            reasons.append(f"{subcategories_count} subcategory(s)")

        can_safely_delete = (products_count == 0 and subcategories_count == 0)

        if can_safely_delete:
            action = 'DELETE'
        elif products_count > 0:
            action = 'REASSIGN_OR_ARCHIVE'
        else:
            action = 'ARCHIVE'

        parent_name = category.parent.name if category.parent else None

        return CategoryDependencyAnalysis(
            category=category,
            name=category.name,
            parent_name=parent_name,
            products_count=products_count,
            ordered_products_count=ordered_products_count,
            unpurchased_products_count=unpurchased_products_count,
            subcategories_count=subcategories_count,
            can_safely_delete=can_safely_delete,
            reasons_to_protect=reasons,
            action_recommendation=action
        )

    @classmethod
    def execute_cleanup(
        cls,
        queryset: models.QuerySet,
        target_category: Optional[Category] = None,
        user=None
    ) -> Dict[str, List[Any]]:
        results: Dict[str, List[Any]] = {
            'deleted': [],
            'archived': [],
            'reassigned': [],
            'errors': []
        }

        # Resolve target_category if UUID or string was passed
        if target_category and not isinstance(target_category, Category):
            target_category = Category.objects.filter(id=target_category).first()

        selected_ids = set(queryset.values_list('id', flat=True))

        # Validate target category if provided
        if target_category:
            if target_category.id in selected_ids:
                results['errors'].append({
                    'category': target_category,
                    'name': target_category.name,
                    'error': "Target category cannot be one of the categories selected for deletion."
                })
                return results

            if not target_category.is_active or target_category.is_deleted:
                results['errors'].append({
                    'category': target_category,
                    'name': target_category.name,
                    'error': "Target category must be an active, non-archived category."
                })
                return results

            for cat in queryset:
                if cls.is_descendant(target_category, cat.id):
                    results['errors'].append({
                        'category': cat,
                        'name': cat.name,
                        'error': f"Cannot reassign products to '{target_category.name}' because it is a descendant of category '{cat.name}' being deleted (circular hierarchy prevented)."
                    })
                    return results

        for category in queryset:
            analysis = cls.analyze_category(category)

            if target_category:
                # Option 1: Reassign products safely, reparent subcategories, and hard delete
                try:
                    with transaction.atomic():
                        cat_name = category.name
                        # 1. Reassign all products
                        reassigned_count = Product.all_objects.filter(
                            category=category
                        ).update(category=target_category)

                        # 2. Reparent subcategories to old category's parent
                        sub_count = Category.all_objects.filter(
                            parent=category
                        ).update(parent=category.parent)

                        # 3. Clean up commission rules & supplier products
                        category.commission_rules.all().delete()
                        category.supplier_products.all().update(category=target_category)

                        # 4. Hard delete old empty category
                        category.hard_delete()

                        results['reassigned'].append({
                            'name': cat_name,
                            'target': target_category.name,
                            'products_count': reassigned_count,
                            'subcategories_reparented': sub_count
                        })
                        results['deleted'].append({
                            'name': cat_name,
                            'reason': f"Reassigned {reassigned_count} product(s) to '{target_category.name}' and safely deleted."
                        })
                except Exception as ex:
                    results['errors'].append({
                        'category': category,
                        'name': category.name,
                        'error': str(ex)
                    })

            elif analysis.can_safely_delete:
                # Option 2: Empty category with 0 products and 0 subcategories -> Safe permanent deletion
                try:
                    with transaction.atomic():
                        cat_name = category.name
                        category.commission_rules.all().delete()
                        category.supplier_products.all().update(category=None)
                        category.hard_delete()
                        results['deleted'].append({
                            'name': cat_name,
                            'reason': "Permanently deleted with 0 products and 0 subcategories."
                        })
                except ProtectedError as pe:
                    # Protected reference encountered -> Fall back to archival
                    try:
                        with transaction.atomic():
                            category.refresh_from_db()
                            category.is_active = False
                            category.is_deleted = True
                            category.deleted_at = timezone.now()
                            category.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])
                            results['archived'].append({
                                'category': category,
                                'name': category.name,
                                'reason': f"Protected reference encountered ({pe.protected_objects}). Safely archived instead."
                            })
                    except Exception as inner_ex:
                        results['errors'].append({
                            'category': category,
                            'name': category.name,
                            'error': str(inner_ex)
                        })
                except Exception as ex:
                    results['errors'].append({
                        'category': category,
                        'name': category.name,
                        'error': str(ex)
                    })

            else:
                # Option 3: Category contains products or subcategories and no reassignment target was given -> Safe Archival
                try:
                    with transaction.atomic():
                        category.is_active = False
                        category.is_deleted = True
                        category.deleted_at = timezone.now()
                        category.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])

                        # Deactivate subcategories so they don't remain active under archived parent
                        Category.all_objects.filter(parent=category).update(
                            is_active=False,
                            is_deleted=True,
                            deleted_at=timezone.now()
                        )

                        reasons_str = "; ".join(analysis.reasons_to_protect)
                        results['archived'].append({
                            'category': category,
                            'name': category.name,
                            'reason': f"Preserved and safely archived ({reasons_str}) to protect products and order history."
                        })
                except Exception as ex:
                    results['errors'].append({
                        'category': category,
                        'name': category.name,
                        'error': str(ex)
                    })

        return results

    @classmethod
    def reactivate_categories(cls, queryset: models.QuerySet, user=None) -> int:
        """
        Reactivates archived categories and ensures parent hierarchy is restored.
        """
        with transaction.atomic():
            count = 0
            for category in queryset:
                category.is_active = True
                category.is_deleted = False
                category.deleted_at = None
                category.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])

                # Reactivate any inactive ancestor categories to keep hierarchy navigable
                curr = category.parent
                while curr:
                    if not curr.is_active or curr.is_deleted:
                        curr.is_active = True
                        curr.is_deleted = False
                        curr.deleted_at = None
                        curr.save(update_fields=['is_active', 'is_deleted', 'deleted_at', 'updated_at'])
                    curr = curr.parent

                count += 1
            return count
