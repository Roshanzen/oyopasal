import logging
from collections import defaultdict
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify
from apps.catalogue.models import Category, Product
from apps.commissions.models import CommissionRule
from apps.procurement.models import SupplierProduct

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Identifies and consolidates duplicate top-level categories by normalized name "
        "(case-insensitive and trimmed whitespace), reassigns all dependent products and records, "
        "and removes duplicate category rows safely and idempotently."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Inspect duplicate categories without applying changes or reassigning records.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        prefix = "[DRY-RUN] " if dry_run else ""

        self.stdout.write(self.style.MIGRATE_HEADING(f"{prefix}Starting top-level category deduplication cleanup..."))

        with transaction.atomic():
            # Query all top-level categories (parent IS NULL)
            # Use all_objects if available so soft-deleted records are also consolidated
            manager = getattr(Category, 'all_objects', Category.objects)
            top_level_categories = list(manager.filter(parent__isnull=True).order_by('ordering', 'created_at'))

            # Group categories by normalized name: name.strip().lower()
            groups = defaultdict(list)
            for cat in top_level_categories:
                normalized_name = (cat.name or '').strip().lower()
                if normalized_name:
                    groups[normalized_name].append(cat)

            merged_groups_count = 0
            total_duplicates_removed = 0
            total_products_reassigned = 0
            total_subcategories_reassigned = 0
            total_rules_reassigned = 0
            total_supplier_prods_reassigned = 0

            for norm_name, cats in groups.items():
                if len(cats) <= 1:
                    # Single category, ensure name is cleanly trimmed
                    single = cats[0]
                    trimmed = (single.name or '').strip()
                    if trimmed != single.name and not dry_run:
                        single.name = trimmed
                        single.save(update_fields=['name'])
                    continue

                merged_groups_count += 1
                self.stdout.write(self.style.WARNING(
                    f"\nFound duplicate group for '{norm_name}': {len(cats)} categories detected."
                ))

                # Determine the primary category to retain:
                # 1. Prefer category with exact desired slug (e.g. 'groceries' for groceries)
                # 2. Prefer category that currently has active products attached
                # 3. Prefer category that has subcategories attached
                # 4. Fallback to earliest created category
                target_slug = slugify(norm_name) or 'groceries'

                def primary_score(c):
                    score = 0
                    if c.slug == target_slug:
                        score += 1000
                    if c.products.count() > 0:
                        score += 500 + c.products.count()
                    if c.subcategories.count() > 0:
                        score += 200 + c.subcategories.count()
                    if c.is_active:
                        score += 50
                    return score

                sorted_cats = sorted(cats, key=primary_score, reverse=True)
                primary = sorted_cats[0]
                duplicates = sorted_cats[1:]

                self.stdout.write(
                    f"  -> Retaining primary Category: ID={primary.id}, slug='{primary.slug}', name='{primary.name}'"
                )

                for dup in duplicates:
                    dup_prods = list(Product.objects.filter(category=dup))
                    dup_subcats = list(Category.objects.filter(parent=dup))
                    dup_rules = list(CommissionRule.objects.filter(category=dup))
                    dup_supplier_prods = list(SupplierProduct.objects.filter(category=dup))

                    self.stdout.write(
                        f"  -> Processing duplicate Category ID={dup.id} (slug='{dup.slug}'): "
                        f"{len(dup_prods)} products, {len(dup_subcats)} subcategories, "
                        f"{len(dup_rules)} commission rules, {len(dup_supplier_prods)} supplier products."
                    )

                    if not dry_run:
                        # Reassign all dependent products
                        if dup_prods:
                            updated_prods = Product.objects.filter(category=dup).update(category=primary)
                            total_products_reassigned += updated_prods
                            self.stdout.write(f"     Reassigned {updated_prods} products to primary category.")

                        # Reassign child subcategories
                        if dup_subcats:
                            updated_sub = Category.objects.filter(parent=dup).update(parent=primary)
                            total_subcategories_reassigned += updated_sub
                            self.stdout.write(f"     Reassigned {updated_sub} subcategories to primary category.")

                        # Reassign commission rules
                        if dup_rules:
                            updated_rules = CommissionRule.objects.filter(category=dup).update(category=primary)
                            total_rules_reassigned += updated_rules
                            self.stdout.write(f"     Reassigned {updated_rules} commission rules to primary category.")

                        # Reassign supplier products
                        if dup_supplier_prods:
                            updated_supp = SupplierProduct.objects.filter(category=dup).update(category=primary)
                            total_supplier_prods_reassigned += updated_supp
                            self.stdout.write(f"     Reassigned {updated_supp} supplier products to primary category.")

                        # Dynamically check and reassign any other foreign keys pointing to Category
                        for rel in Category._meta.related_objects:
                            if rel.related_model in (Product, Category, CommissionRule, SupplierProduct):
                                continue
                            if not rel.many_to_many and hasattr(rel.related_model, rel.field.name):
                                count = rel.related_model.objects.filter(**{rel.field.name: dup}).count()
                                if count > 0:
                                    rel.related_model.objects.filter(**{rel.field.name: dup}).update(**{rel.field.name: primary})
                                    self.stdout.write(f"     Reassigned {count} {rel.related_model.__name__} records.")

                        # Now safely hard delete the duplicate category row
                        if hasattr(dup, 'hard_delete'):
                            dup.hard_delete()
                        else:
                            Category.all_objects.filter(id=dup.id).delete()
                        total_duplicates_removed += 1
                        self.stdout.write(self.style.SUCCESS(f"     Hard-deleted duplicate Category ID={dup.id}."))
                    else:
                        total_duplicates_removed += 1
                        total_products_reassigned += len(dup_prods)
                        total_subcategories_reassigned += len(dup_subcats)

                if not dry_run:
                    # Clean up primary category name & preferred slug
                    primary.name = primary.name.strip()
                    if norm_name == 'groceries' and primary.slug != 'groceries':
                        # Check if another category currently holds 'groceries'
                        if not Category.objects.filter(slug='groceries').exclude(id=primary.id).exists():
                            primary.slug = 'groceries'
                            self.stdout.write(self.style.SUCCESS(f"  -> Normalized primary slug to 'groceries'."))
                    primary.save()

            if dry_run:
                self.stdout.write(self.style.WARNING(
                    f"\n[DRY-RUN COMPLETE] Would merge {merged_groups_count} groups, "
                    f"remove {total_duplicates_removed} duplicates, "
                    f"and reassign {total_products_reassigned} products."
                ))
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"\n[CLEANUP COMPLETE] Successfully merged {merged_groups_count} duplicate groups.\n"
                    f"  - Duplicate categories removed: {total_duplicates_removed}\n"
                    f"  - Products reassigned: {total_products_reassigned}\n"
                    f"  - Subcategories reassigned: {total_subcategories_reassigned}\n"
                    f"  - Commission rules reassigned: {total_rules_reassigned}\n"
                    f"  - Supplier products reassigned: {total_supplier_prods_reassigned}"
                ))
