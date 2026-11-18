from datetime import timedelta
from decimal import Decimal
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Category, Product, ProductVariant, ProductStatus
from apps.warehouse.models import Warehouse
from apps.inventory.models import (
    InventoryItem,
    StockMovement,
    StockMovementType,
    StockReservation
)
from apps.inventory.services import InventoryService, InsufficientStockError

User = get_user_model()

class InventoryAndWarehouseTests(APITestCase):
    def setUp(self):
        # 1. Super Admin
        self.admin_user = User.objects.create_superuser(
            email='admin@oyopasal.com',
            password='AdminPassword123!'
        )

        # 2. Vendor Owner
        self.vendor_user = User.objects.create_user(
            email='vendor@oyopasal.com',
            password='VendorPassword123!',
            role=UserRole.VENDOR_OWNER,
            is_verified=True
        )
        self.vendor_profile = VendorProfile.objects.create(
            user=self.vendor_user,
            business_name='Kathmandu Electronics Hub',
            slug='kathmandu-electronics',
            status=VendorStatus.APPROVED
        )
        self.store = Store.objects.create(
            vendor=self.vendor_profile,
            name='KTM Hub Store',
            slug='ktm-hub-store'
        )

        # 3. Product & Variant
        self.category = Category.objects.create(name='Gadgets', slug='gadgets')
        self.product = Product.objects.create(
            vendor=self.vendor_profile,
            store=self.store,
            category=self.category,
            name='Wireless Earbuds Pro',
            base_sku='EAR-PRO-01',
            status=ProductStatus.APPROVED
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku='EAR-PRO-01-BLK',
            regular_price=Decimal('5000.00'),
            selling_price=Decimal('4200.00'),
            is_default=True
        )

        # 4. Warehouses
        self.platform_warehouse = Warehouse.objects.create(
            name='Kathmandu Central Hub',
            code='KTM-HUB-01',
            district='Kathmandu',
            city='Kathmandu',
            address_line='Teku, Kathmandu',
            is_default=True
        )
        self.vendor_warehouse = Warehouse.objects.create(
            vendor=self.vendor_profile,
            name='Vendor Lalitpur Depot',
            code='LLT-DEPOT-01',
            district='Lalitpur',
            city='Patan',
            address_line='Kumaripati, Lalitpur'
        )

        # 5. Inventory Item
        self.inv_item = InventoryItem.objects.create(
            warehouse=self.vendor_warehouse,
            variant=self.variant,
            quantity_on_hand=50,
            quantity_reserved=0,
            reorder_threshold=10
        )

    def test_warehouse_creation_and_vendor_isolation(self):
        """Verify warehouse APIs enforce vendor ownership isolation."""
        self.client.force_authenticate(user=self.vendor_user)
        url = reverse('warehouse:warehouse_list_create')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should see both platform hub and own warehouse
        codes = [w['code'] for w in response.data['data']]
        self.assertIn('KTM-HUB-01', codes)
        self.assertIn('LLT-DEPOT-01', codes)

    def test_atomic_stock_adjustment(self):
        """Verify manual stock adjustment updates balance and creates an audit movement."""
        self.client.force_authenticate(user=self.vendor_user)
        adjust_url = reverse('inventory:inventory_adjust', kwargs={'id': self.inv_item.id})

        # Add 25 units
        payload = {
            'delta': 25,
            'movement_type': StockMovementType.INCOMING,
            'reason': 'Stock received from supplier PO #PO-9001'
        }
        response = self.client.post(adjust_url, payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['quantity_on_hand'], 75)
        self.assertEqual(response.data['data']['quantity_available'], 75)

        # Verify audit log
        movement = StockMovement.objects.filter(inventory_item=self.inv_item).latest('created_at')
        self.assertEqual(movement.movement_type, StockMovementType.INCOMING)
        self.assertEqual(movement.quantity, 25)
        self.assertEqual(movement.balance_after, 75)

    def test_disallow_negative_stock_adjustment(self):
        """Verify cannot reduce physical stock below 0."""
        self.client.force_authenticate(user=self.vendor_user)
        adjust_url = reverse('inventory:inventory_adjust', kwargs={'id': self.inv_item.id})

        payload = {
            'delta': -100,  # Currently has 50
            'movement_type': StockMovementType.ADJUSTMENT,
            'reason': 'Accidental recount'
        }
        response = self.client.post(adjust_url, payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_stock_reservation_service_lifecycle(self):
        """
        Verify end-to-end atomic stock reservation:
        1. Reserve 15 units.
        2. Available drops to 35, reserved becomes 15.
        3. Try reserving 40 units -> raises InsufficientStockError.
        4. Release reservation -> Available back to 50, reserved 0.
        """
        # Step 1: Reserve 15 units
        reservation = InventoryService.reserve_stock(
            warehouse_id=self.vendor_warehouse.id,
            variant_id=self.variant.id,
            quantity=15,
            session_id='sess_cart_xyz_123',
            timeout_minutes=15
        )
        self.inv_item.refresh_from_db()
        self.assertEqual(self.inv_item.quantity_reserved, 15)
        self.assertEqual(self.inv_item.quantity_available, 35)
        self.assertEqual(self.inv_item.quantity_on_hand, 50)

        # Step 2: Try reserving more than available (Available: 35, requested: 40)
        with self.assertRaises(InsufficientStockError):
            InventoryService.reserve_stock(
                warehouse_id=self.vendor_warehouse.id,
                variant_id=self.variant.id,
                quantity=40,
                session_id='sess_cart_fail_999'
            )

        # Step 3: Release the reservation
        released = InventoryService.release_reservation(reservation.id)
        self.assertTrue(released)
        self.inv_item.refresh_from_db()
        self.assertEqual(self.inv_item.quantity_reserved, 0)
        self.assertEqual(self.inv_item.quantity_available, 50)

    def test_stock_reservation_commit_on_order(self):
        """Verify committing reservation decreases both on_hand and reserved simultaneously."""
        reservation = InventoryService.reserve_stock(
            warehouse_id=self.vendor_warehouse.id,
            variant_id=self.variant.id,
            quantity=10,
            session_id='sess_order_conf_01'
        )
        self.inv_item.refresh_from_db()
        self.assertEqual(self.inv_item.quantity_on_hand, 50)
        self.assertEqual(self.inv_item.quantity_reserved, 10)

        # Commit reservation
        committed = InventoryService.commit_reservation(reservation.id, reference_id='ORD-NP-2026-0001')
        self.assertTrue(committed)

        self.inv_item.refresh_from_db()
        self.assertEqual(self.inv_item.quantity_on_hand, 40)
        self.assertEqual(self.inv_item.quantity_reserved, 0)
        self.assertEqual(self.inv_item.quantity_available, 40)

        # Verify dispatch movement log
        dispatch_mov = StockMovement.objects.filter(
            inventory_item=self.inv_item,
            movement_type=StockMovementType.DISPATCH
        ).first()
        self.assertIsNotNone(dispatch_mov)
        self.assertEqual(dispatch_mov.reference_id, 'ORD-NP-2026-0001')
        self.assertEqual(dispatch_mov.balance_after, 40)

    def test_release_expired_reservations(self):
        """Verify expired reservations are released automatically."""
        # Create an expired reservation directly
        expired_time = timezone.now() - timedelta(minutes=10)
        res = StockReservation.objects.create(
            inventory_item=self.inv_item,
            session_id='sess_expired_01',
            quantity=20,
            expires_at=expired_time
        )
        self.inv_item.quantity_reserved = 20
        self.inv_item.save()

        self.assertEqual(self.inv_item.quantity_available, 30)

        released_count = InventoryService.release_expired_reservations()
        self.assertEqual(released_count, 1)

        self.inv_item.refresh_from_db()
        self.assertEqual(self.inv_item.quantity_reserved, 0)
        self.assertEqual(self.inv_item.quantity_available, 50)

    def test_low_stock_alerts_api(self):
        """Verify items breach reorder threshold trigger low stock alerts."""
        # Reduce stock so available <= reorder_threshold (10)
        self.inv_item.quantity_on_hand = 8
        self.inv_item.save()

        self.client.force_authenticate(user=self.vendor_user)
        alerts_url = reverse('inventory:low_stock_alerts')

        response = self.client.get(alerts_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['meta']['total_count'], 1)
        self.assertEqual(response.data['data'][0]['variant_sku'], 'EAR-PRO-01-BLK')
        self.assertTrue(response.data['data'][0]['is_low_stock'])

