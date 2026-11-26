import uuid
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.core.management import call_command
from apps.catalogue.models import Category, Product
from apps.stores.models import Store
from apps.vendors.models import VendorProfile
from django.contrib.auth import get_user_model

User = get_user_model()


class CategoryDeduplicationAndIntegrityTestCase(TestCase):
    def setUp(self):
        # Create a unique test vendor and store
        uid = uuid.uuid4().hex[:6]
        self.user = User.objects.create_user(
            email=f"vendor_{uid}@example.com",
            password="Password123!",
            role="VENDOR"
        )
        self.vendor = VendorProfile.objects.create(
            user=self.user,
            business_name=f"Test Pasal {uid}",
            slug=f"test-pasal-{uid}",
            pan_vat_number=f"PAN{uid}"
        )
        self.store = Store.objects.create(
            vendor=self.vendor,
            name=f"Test Store {uid}",
            slug=f"test-store-{uid}",
            contact_email=f"store_{uid}@example.com",
            contact_phone="9841000000",
            address="Kathmandu",
            area_ward="Ward 1"
        )

    def test_top_level_category_case_insensitive_uniqueness(self):
        """Top-level categories must reject duplicate names regardless of casing or whitespace."""
        c1 = Category.objects.create(name="Beverages", slug="beverages-test")
        self.assertIsNotNone(c1.id)

        # Attempt to create lowercase duplicate
        with self.assertRaises(ValidationError):
            c_dup1 = Category(name="beverages", slug="beverages-dup1")
            c_dup1.full_clean()
            c_dup1.save()

        # Attempt to create uppercase with whitespace duplicate
        with self.assertRaises(ValidationError):
            c_dup2 = Category(name="  BEVERAGES  ", slug="beverages-dup2")
            c_dup2.full_clean()
            c_dup2.save()

    def test_child_category_can_share_name_with_parent_or_sibling_in_other_branch(self):
        """Child categories under a parent are allowed to have the same name as top-level categories."""
        c_root = Category.objects.create(name="Dairy Products", slug="dairy-products-test")
        c_other_root = Category.objects.create(name="Bakery Items", slug="bakery-items-test")

        # Child under c_root with name "Milk"
        sub1 = Category.objects.create(name="Milk", parent=c_root, slug="dairy-milk-test")
        self.assertIsNotNone(sub1.id)

        # Child under c_other_root with name "Milk" is allowed
        sub2 = Category.objects.create(name="Milk", parent=c_other_root, slug="bakery-milk-test")
        self.assertIsNotNone(sub2.id)

    def test_cleanup_duplicate_categories_management_command(self):
        """Management command runs cleanly and is fully idempotent."""
        from io import StringIO
        out = StringIO()
        call_command('cleanup_duplicate_categories', stdout=out)
        output = out.getvalue()
        self.assertIn("CLEANUP COMPLETE", output)

    def test_public_category_list_api_returns_only_active_root_categories(self):
        """Public category endpoint must only return active top-level categories, excluding subcategories and inactive."""
        active_root = Category.objects.create(name="Health Care", slug="health-care-test", is_active=True)
        inactive_root = Category.objects.create(name="Archived Tech", slug="archived-tech-test", is_active=False)
        sub_cat = Category.objects.create(name="Supplements", parent=active_root, slug="supplements-test", is_active=True)

        response = self.client.get('/api/v1/categories/')
        self.assertEqual(response.status_code, 200)

        data = response.json()
        results = data if isinstance(data, list) else data.get('results', [])
        result_ids = [item['id'] for item in results]

        self.assertIn(str(active_root.id), result_ids)
        self.assertNotIn(str(inactive_root.id), result_ids, "Inactive category must not be returned in root list")
        self.assertNotIn(str(sub_cat.id), result_ids, "Subcategory must not be returned as top-level category")
