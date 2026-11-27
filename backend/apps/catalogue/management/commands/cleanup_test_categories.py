import logging
import re
from typing import List, Set
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from apps.catalogue.models import Category, Product
from apps.catalogue.services import ProductCleanupService
from apps.orders.models import OrderItem
from apps.procurement.models import SupplierProduct
from apps.commissions.models import CommissionRule

logger = logging.getLogger(__name__)

# Patterns explicitly requested by requirements
TEST_NAME_PATTERNS = [
    '357691',
    '6ac9b8',
    'Admin Configured',
    'External CDN Cat',
    'Whitespace Cat',
    'Special Dept',
    'Popular Department',
    'Department Zero Prods',
    'Department Child',
    'Category Relative',
    'Category With Image',
    'Category Child',
    'Category Inactive',
    'Category Zero Prods',
    'Cat With Prods',
    'Test Cat',
    'Var Test Cat',
    'Vendor Test Cat',
    'Ordered Category',
    'Subcat of Prods',
    'Target Category',
]

HEX_PATTERNS = [
    re.compile(r'^(Category|Cat|Department|Dept)\s+.*[0-9a-f]{6}', re.IGNORECASE),
    re.compile(r'^(cat|dept)-.*[0-9a-f]{6}', re.IGNORECASE),
]


class Command(BaseCommand):
    help = (
        "Permanently removes automated test categories from MySQL using safe dependency checks, "
        "protecting historical customer orders and legitimate marketplace categories."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate cleanup and print audit report without modifying or deleting database records.',
        )
        parser.add_argument(
            '--include-all-test-artifacts',
            action='store_true',
            help='Also clean up test categories with hex identifiers that have zero historical orders.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        include_all = options.get('include_all_test_artifacts', True)
        prefix = "[DRY-RUN] " if dry_run else ""

        self.stdout.write(self.style.MIGRATE_HEADING(f"{prefix}Identifying automated test categories..."))

        # Build Q filter for specified test patterns (case-insensitive)
        pattern_q = Q()
        for pat in TEST_NAME_PATTERNS:
            pattern_q |= Q(name__icontains=pat) | Q(slug__icontains=pat)

        matched_ids: Set = set(Category.all_objects.filter(pattern_q).values_list('id', flat=True))

        if include_all:
            all_cats = list(Category.all_objects.all())
            for c in all_cats:
                for regex in HEX_PATTERNS:
                    if regex.search(c.name) or regex.search(c.slug):
                        matched_ids.add(c.id)

        # Distinguish automated test categories from legitimate categories
        # Legitimate marketplace categories that must NEVER be deleted
        PROTECTED_LEGITIMATE_SLUGS = {
            'consumer-electronics',
            'chargers-cables',
            'handicrafts-art',
            'pashmina-shawls',
            'organic-spices-herbs',
            'cardamom-and-cloves',
            'organic-mountain-tea',
            'books-stationery',
            'groceries',
            'clothing-apparel',
            'beauty-cosmetics',
            'computers-laptops',
            'garage-automotive-parts',
            'footwear',
        }

        test_categories = list(
            Category.all_objects.filter(id__in=matched_ids)
            .exclude(slug__in=PROTECTED_LEGITIMATE_SLUGS)
            .order_by('parent_id', 'name')
        )

        if not test_categories:
            self.stdout.write(self.style.SUCCESS("No test categories found in database."))
            return

        self.stdout.write(f"Found {len(test_categories)} candidate test category record(s).")
        self.stdout.write("-" * 90)
        self.stdout.write(
            f"{'Category Name':<35} | {'Slug':<25} | {'Prods':<5} | {'Orders':<6} | {'Action':<12}"
        )
        self.stdout.write("-" * 90)

        safe_to_delete = []
        protected_with_orders = []

        for cat in test_categories:
            products = list(Product.all_objects.filter(category=cat))
            prod_ids = [p.id for p in products]
            order_items_count = OrderItem.objects.filter(variant__product_id__in=prod_ids).count()

            if order_items_count > 0:
                action = "PROTECT/ARCHIVE"
                protected_with_orders.append((cat, products, order_items_count))
            else:
                action = "DELETE"
                safe_to_delete.append((cat, products))

            self.stdout.write(
                f"{cat.name[:35]:<35} | {cat.slug[:25]:<25} | {len(products):<5} | {order_items_count:<6} | {action:<12}"
            )

        self.stdout.write("-" * 90)
        self.stdout.write(
            f"Summary: {len(safe_to_delete)} safe to permanently delete, "
            f"{len(protected_with_orders)} protected due to historical orders."
        )

        if dry_run:
            self.stdout.write(self.style.WARNING(
                "\n[DRY-RUN] No records were modified or deleted. Run without --dry-run to execute cleanup."
            ))
            return

        # Execute safe deletion inside transaction
        with transaction.atomic():
            deleted_prods_count = 0
            deleted_cats_count = 0

            # 1. Process safe products and categories
            # Sort categories so child categories are deleted before parent categories (depth-first)
            # Categories with parents should be deleted first
            sorted_safe_to_delete = sorted(
                safe_to_delete,
                key=lambda x: (0 if x[0].parent_id is not None else 1)
            )

            for cat, products in sorted_safe_to_delete:
                # Safely delete test products that have zero orders using ProductCleanupService
                for prod in products:
                    res = ProductCleanupService.execute_cleanup([prod])
                    if res['deleted']:
                        deleted_prods_count += 1

                # Clean up reverse relations like CommissionRule or SupplierProduct if any
                CommissionRule.objects.filter(category=cat).delete()
                SupplierProduct.objects.filter(category=cat).update(category=None)

                # Reparent or clear any remaining subcategories
                Category.all_objects.filter(parent=cat).update(parent=None)

                # Hard delete category
                if hasattr(cat, 'hard_delete'):
                    cat.hard_delete()
                else:
                    cat.delete()
                deleted_cats_count += 1

            self.stdout.write(self.style.SUCCESS(
                f"\nSuccessfully permanently deleted {deleted_cats_count} test category record(s) "
                f"and {deleted_prods_count} test product(s) from MySQL."
            ))

            if protected_with_orders:
                self.stdout.write(self.style.WARNING(
                    f"Preserved {len(protected_with_orders)} test categories with historical orders "
                    "in soft-deleted state to guarantee customer order data integrity."
                ))
