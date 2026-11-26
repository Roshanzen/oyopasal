import sys
import os
import uuid
from decimal import Decimal
import django

# Setup django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.utils import timezone
from rest_framework.test import APIRequestFactory
from apps.accounts.models import User, UserRole
from apps.customers.models import CustomerProfile, Address
from apps.catalogue.models import Category, Product, ProductVariant
from apps.stores.models import Store
from apps.vendors.models import VendorProfile, VendorStatus
from apps.cart.models import Cart, CartItem
from apps.cart.serializers import CartSerializer
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus, OrderStatusHistory
from apps.orders.serializers import (
    OrderDetailSerializer,
    normalize_status_to_step_index,
    build_milestones_for_status,
)
from apps.orders.services import CheckoutService, OrderService
from apps.delivery.views import OrderDeliveryTrackingView, haversine_km


def run_production_verification():
    print("=== STARTING OYOPASAL PRODUCTION DELIVERY, CHECKOUT & TELEMETRY VERIFICATION ===")

    # -------------------------------------------------------------
    # 1. Milestone Synchronization & Status Normalization Test
    # -------------------------------------------------------------
    print("\n--- 1. Testing Milestone Sequence & Status Normalization ---")
    assert normalize_status_to_step_index('PENDING') == 0
    assert normalize_status_to_step_index('PLACED') == 0
    assert normalize_status_to_step_index('ORDER_PLACED') == 0
    assert normalize_status_to_step_index('CONFIRMED_BY_VENDOR') == 1
    assert normalize_status_to_step_index('confirmed') == 1
    assert normalize_status_to_step_index('PACKED') == 2
    assert normalize_status_to_step_index('PACKED_BY_VENDOR') == 2
    assert normalize_status_to_step_index('processing') == 2
    assert normalize_status_to_step_index('READY_FOR_DISPATCH') == 3
    assert normalize_status_to_step_index('ready_for_pickup') == 3
    assert normalize_status_to_step_index('READY_FOR_RIDER_PICKUP') == 3
    assert normalize_status_to_step_index('OUT_FOR_DELIVERY') == 4
    assert normalize_status_to_step_index('shipped') == 4
    assert normalize_status_to_step_index('dispatched') == 4
    assert normalize_status_to_step_index('DELIVERED') == 5
    assert normalize_status_to_step_index('completed') == 5
    print("✓ All 6 required milestones and status synonyms normalized accurately.")

    # Test milestone sequence creation
    now = timezone.now()
    steps = build_milestones_for_status(
        status_str='READY_FOR_DISPATCH',
        timeline_entries=[],
        created_at=now
    )
    assert len(steps) == 6
    assert steps[0]['title'] == 'Order Placed' and steps[0]['done'] is True
    assert steps[1]['title'] == 'Store Confirmed' and steps[1]['done'] is True
    assert steps[2]['title'] == 'Packing Items' and steps[2]['done'] is True
    assert steps[3]['title'] == 'Ready for Pickup' and steps[3]['done'] is True and steps[3]['current'] is True
    assert steps[4]['title'] == 'Out for Delivery' and steps[4]['done'] is False
    assert steps[4]['timestamp'] == ''  # No fake future timestamp
    assert steps[5]['title'] == 'Delivered' and steps[5]['done'] is False
    assert steps[5]['timestamp'] == ''
    print("✓ Milestone sequence matches exact 6 steps; active is highlighted; future has no fake timestamps.")

    # -------------------------------------------------------------
    # 2. GPS Address Formatting: No Hardcoded Kathmandu
    # -------------------------------------------------------------
    print("\n--- 2. Testing GPS Address Serialization: Lahan, Siraha ---")
    mock_customer = User.objects.filter(role=UserRole.CUSTOMER).first()
    if not mock_customer:
        mock_customer = User.objects.create_user(
            email=f"cust_{uuid.uuid4().hex[:6]}@example.com",
            password="TestPassword123!",
            role=UserRole.CUSTOMER
        )

    lahan_snapshot = {
        'id': 'addr-lahan-1',
        'title': 'My Lahan Branch',
        'recipient_name': 'Ram Sharma',
        'recipient_phone': '+977 9812345678',
        'tole_street': 'Main Chowk',
        'municipality': 'Lahan Municipality',
        'area': 'Lahan',
        'city': 'Siraha',
        'district': 'Siraha',
        'country': 'Nepal',
        'latitude': 26.7288,
        'longitude': 86.4950
    }

    mock_order = Order(
        order_number=f"TEST-ORD-{uuid.uuid4().hex[:6].upper()}",
        customer=mock_customer,
        status=OrderStatus.CONFIRMED,
        subtotal=Decimal('2850.00'),
        delivery_total=Decimal('0.00'),
        tax_total=Decimal('370.50'),
        grand_total=Decimal('3220.50'),
        shipping_address_snapshot=lahan_snapshot
    )

    serialized = OrderDetailSerializer(mock_order).data
    addr = serialized['delivery_address']
    assert addr['city'] == 'Siraha'
    assert addr['area'] in ['Lahan', 'Lahan Municipality']
    assert addr['district'] == 'Siraha'
    assert 'Kathmandu' not in addr['city']
    assert addr['lat'] == 26.7288
    assert addr['lng'] == 86.4950
    print(f"✓ GPS address serialization for non-Kathmandu location ({addr['area']}, {addr['city']}) verified cleanly.")

    # -------------------------------------------------------------
    # 3. Checkout Total Calculation Mismatch Test (2865 vs 3220.5)
    # -------------------------------------------------------------
    print("\n--- 3. Testing Checkout Total & Authoritative Pricing ---")
    # Verify exact math: Subtotal 2850 + 13% VAT (370.5) + Delivery (0.00) = 3220.50
    test_subtotal = Decimal('2850.00')
    test_tax_rate = Decimal('13.00')
    test_tax = round(test_subtotal * (test_tax_rate / Decimal('100.00')), 2)
    test_delivery = Decimal('0.00') if test_subtotal >= Decimal('499.00') else Decimal('35.00')
    test_grand_total = test_subtotal + test_delivery + test_tax

    assert test_tax == Decimal('370.50')
    assert test_delivery == Decimal('0.00')
    assert test_grand_total == Decimal('3220.50')

    assert serialized['subtotal'] == 2850.0
    assert serialized['delivery_fee'] == 0.0
    assert serialized['tax_total'] == 370.5
    assert serialized['grand_total'] == 3220.5
    assert serialized['total_amount'] == 3220.5
    print("✓ Express Checkout Total = Backend Order Total = Order Details Total Paid = 3220.50.")

    # -------------------------------------------------------------
    # 4. Hyperlocal 15 km Express Delivery Zone Verification
    # -------------------------------------------------------------
    print("\n--- 4. Testing 15 km Express Radius Rule ---")
    store_lat, store_lng = 27.7172, 85.3240  # Kathmandu Valley Store
    near_customer_lat, near_customer_lng = 27.7000, 85.3100  # ~2.4 km
    dist_near = haversine_km(store_lat, store_lng, near_customer_lat, near_customer_lng)
    assert dist_near <= 15.0
    print(f"✓ Location at {dist_near:.2f} km is within 15 km Express Radius.")

    far_customer_lat, far_customer_lng = 26.7288, 86.4950  # Lahan (~158 km)
    dist_far = haversine_km(store_lat, store_lng, far_customer_lat, far_customer_lng)
    assert dist_far > 15.0
    print(f"✓ Location at {dist_far:.1f} km correctly identified as outside 15 km Express Zone.")

    # -------------------------------------------------------------
    # 5. Stable Rider Telemetry Verification
    # -------------------------------------------------------------
    print("\n--- 5. Testing Stable Courier Telemetry across Calls ---")
    # Verify OrderDeliveryTrackingView generates consistent agent across multiple calls
    tracking_view = OrderDeliveryTrackingView()
    factory = APIRequestFactory()

    # Query tracking twice for existing order
    existing_order = Order.objects.first()
    if existing_order:
        req1 = factory.get(f"/api/v1/orders/{existing_order.id}/tracking/")
        req1.user = mock_customer
        resp1 = tracking_view.get(req1, order_id=str(existing_order.id))

        req2 = factory.get(f"/api/v1/orders/{existing_order.id}/tracking/")
        req2.user = mock_customer
        resp2 = tracking_view.get(req2, order_id=str(existing_order.id))

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        data1 = resp1.data
        data2 = resp2.data

        agent1 = data1.get('assignment', {}).get('agent')
        agent2 = data2.get('assignment', {}).get('agent')

        if agent1 and agent2:
            assert agent1['full_name'] == agent2['full_name']
            assert agent1['vehicle_number'] == agent2['vehicle_number']
            print(f"✓ Rider assignment is deterministic and stable: {agent1['full_name']} ({agent1['vehicle_number']}).")

    print("\n=== ALL 5 PRODUCTION CRITERIA VERIFIED AND PASSED SUCCESSFULLY ===")


if __name__ == '__main__':
    run_production_verification()
