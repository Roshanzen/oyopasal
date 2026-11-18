from datetime import timedelta
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import UserRole
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.catalogue.serializers import CategoryTreeSerializer
from apps.vendors.models import VendorProfile
from apps.stores.models import Store
from apps.warehouse.models import Warehouse
from apps.inventory.models import InventoryItem, StockMovement, StockMovementType, StockReservation
from apps.inventory.services import InventoryService, InsufficientStockError
from apps.inventory.tasks import release_expired_reservations_task
from apps.common.services.imagekit_service import ImageKitService

User = get_user_model()


class CatalogueAndInventoryStage4Tests(APITestCase):
    def setUp(self):
        # 1. Create Users
        self.vendor_user = User.objects.create_user(
            email='stage4vendor@example.com',
            password='Password123!',
            first_name='Tech',
            last_name='Merchant',
            role=UserRole.VENDOR_OWNER,
            is_active=True
        )
        self.customer_user = User.objects.create_user(
            email='stage4customer@example.com',
            password='Password123!',
            first_name='Ram',
            last_name='Thapa',
            role=UserRole.CUSTOMER,
            is_active=True
        )

        # 2. Create Vendor and Store
        self.vendor = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Kathmandu Tech Mart',
            slug='kathmandu-tech-mart',
            pan_vat_number='123456789',
            status='APPROVED'
        )
        self.store = Store.objects.create(
            vendor=self.vendor,
            name='Kathmandu Tech Mart Store',
            slug='kathmandu-tech-mart-store',
            is_active=True
        )

        # 3. Create Hierarchical Categories: Electronics -> Computers -> Laptops
        self.cat_root = Category.objects.create(name='Electronics', slug='electronics', is_active=True)
        self.cat_mid = Category.objects.create(name='Computers', slug='computers', parent=self.cat_root, is_active=True)
        self.cat_leaf = Category.objects.create(name='Laptops', slug='laptops', parent=self.cat_mid, is_active=True)

        # 4. Create Product under leaf category
        self.product = Product.objects.create(
            vendor=self.vendor,
            store=self.store,
            category=self.cat_leaf,
            name='Pro Ultra Laptop 16',
            slug='pro-ultra-laptop-16',
            base_sku='PUL-16',
            status=ProductStatus.APPROVED,
            tax_rate=Decimal('13.00')
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku='PUL-16-16GB-512GB',
            regular_price=Decimal('150000.00'),
            selling_price=Decimal('142000.00'),
            attributes={'ram': '16GB', 'ssd': '512GB'},
            is_default=True,
            is_active=True
        )

        # 5. Create Warehouse & Inventory
        self.warehouse = Warehouse.objects.create(
            name='Kathmandu Central Hub',
            code='KTM-01',
            city='Kathmandu',
            district='Kathmandu',
            province='BAGMATI',
            address_line='Tripureshwor Trade Center',
            is_active=True
        )
        self.inventory_item = InventoryItem.objects.create(
            warehouse=self.warehouse,
            variant=self.variant,
            quantity_on_hand=20,
            quantity_reserved=0,
            reorder_threshold=5
        )

    def test_category_ancestor_and_descendant_hierarchy(self):
        """Test recursive ancestor breadcrumbs and descendant query logic."""
        ancestors = self.cat_leaf.get_ancestors()
        self.assertEqual([a.slug for a in ancestors], ['electronics', 'computers'])

        descendants = self.cat_root.get_descendant_ids()
        self.assertIn(self.cat_root.id, descendants)
        self.assertIn(self.cat_mid.id, descendants)
        self.assertIn(self.cat_leaf.id, descendants)

        serializer = CategoryTreeSerializer(self.cat_leaf)
        self.assertEqual(len(serializer.data['breadcrumbs']), 2)
        self.assertEqual(serializer.data['breadcrumbs'][0]['slug'], 'electronics')
        self.assertEqual(serializer.data['breadcrumbs'][1]['slug'], 'computers')

    def test_public_product_filter_by_parent_category(self):
        """Querying with parent category slug returns products in all descendant categories."""
        url = f"/api/v1/products/?category={self.cat_root.slug}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return the product even though product is assigned to leaf subcategory
        items = response.data['data'] if 'data' in response.data else response.data
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['base_sku'], 'PUL-16')

    def test_inventory_service_atomic_reservation(self):
        """Reserving stock locks units and creates audit trail."""
        reservation = InventoryService.reserve_stock(
            warehouse_id=self.warehouse.id,
            variant_id=self.variant.id,
            quantity=3,
            session_id='checkout_session_abc123',
            timeout_minutes=15
        )
        self.inventory_item.refresh_from_db()
        self.assertEqual(self.inventory_item.quantity_reserved, 3)
        self.assertEqual(self.inventory_item.quantity_available, 17)
        self.assertFalse(reservation.is_released)
        self.assertFalse(reservation.is_committed)

        # Audit movement check
        movement = StockMovement.objects.filter(reference_id=str(reservation.id)).first()
        self.assertIsNotNone(movement)
        self.assertEqual(movement.movement_type, StockMovementType.RESERVATION)
        self.assertEqual(movement.quantity, 3)

    def test_insufficient_stock_error_on_overselling(self):
        """Attempting to reserve more units than available raises InsufficientStockError."""
        with self.assertRaises(InsufficientStockError):
            InventoryService.reserve_stock(
                warehouse_id=self.warehouse.id,
                variant_id=self.variant.id,
                quantity=25,  # only 20 on hand
                session_id='checkout_excess'
            )

    def test_release_and_commit_stock_reservation(self):
        """Test manually releasing and committing stock reservations."""
        # 1. Test release
        res = InventoryService.reserve_stock(
            warehouse_id=self.warehouse.id,
            variant_id=self.variant.id,
            quantity=2,
            session_id='checkout_rel'
        )
        self.assertTrue(InventoryService.release_reservation(res.id))
        self.inventory_item.refresh_from_db()
        self.assertEqual(self.inventory_item.quantity_reserved, 0)
        self.assertEqual(self.inventory_item.quantity_available, 20)

        # 2. Test commit
        res2 = InventoryService.reserve_stock(
            warehouse_id=self.warehouse.id,
            variant_id=self.variant.id,
            quantity=4,
            session_id='checkout_commit'
        )
        self.assertTrue(InventoryService.commit_reservation(res2.id, reference_id='ORD-99901'))
        self.inventory_item.refresh_from_db()
        self.assertEqual(self.inventory_item.quantity_on_hand, 16)
        self.assertEqual(self.inventory_item.quantity_reserved, 0)
        self.assertEqual(self.inventory_item.quantity_available, 16)

    def test_celery_task_releases_expired_reservations(self):
        """Expired stock reservations are automatically released by background job."""
        expired_res = StockReservation.objects.create(
            inventory_item=self.inventory_item,
            session_id='expired_sess_456',
            quantity=5,
            expires_at=timezone.now() - timedelta(minutes=10)
        )
        self.inventory_item.quantity_reserved = 5
        self.inventory_item.save(update_fields=['quantity_reserved'])

        # Run background task
        result = release_expired_reservations_task()
        self.assertGreaterEqual(result['released_count'], 1)

        expired_res.refresh_from_db()
        self.assertTrue(expired_res.is_released)
        self.inventory_item.refresh_from_db()
        self.assertEqual(self.inventory_item.quantity_reserved, 0)

    def test_imagekit_service_and_auth_endpoint(self):
        """ImageKit URL transformation and signed upload token generation."""
        # URL transformation
        thumb = ImageKitService.get_thumbnail_url('products/laptop.jpg', width=200, height=200)
        self.assertIn('tr:w-200,h-200', thumb)
        self.assertIn('cm-pad_resize', thumb)
        self.assertIn('products/laptop.jpg', thumb)

        # Direct client auth parameters
        auth_data = ImageKitService.get_client_upload_auth()
        self.assertIn('token', auth_data)
        self.assertIn('expire', auth_data)
        self.assertIn('signature', auth_data)

        # Test auth endpoint requires login
        endpoint = '/api/v1/media/imagekit-auth/'
        unauth_resp = self.client.get(endpoint)
        self.assertEqual(unauth_resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Test authenticated access
        self.client.force_authenticate(user=self.vendor_user)
        auth_resp = self.client.get(endpoint)
        self.assertEqual(auth_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(auth_resp.data['success'])
        self.assertIn('signature', auth_resp.data['data'])
