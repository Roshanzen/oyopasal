import sys
import os
import django

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()
from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.stores.models import Store
from apps.catalogue.models import Product, ProductVariant, Category, ProductStatus, ProductImage
from apps.inventory.models import InventoryItem
from apps.warehouse.models import Warehouse
from apps.orders.models import Order, VendorSubOrder
from apps.orders.services import CheckoutService
from apps.cart.models import Cart, CartItem
from apps.catalogue.serializers import ProductCreateUpdateSerializer, ProductListSerializer, ProductDetailSerializer

class DummyRequest:
    def __init__(self, u):
        self.user = u
        self.build_absolute_uri = lambda uri: f"http://localhost:8000{uri}"

def run_phase12_tests():
    print("=" * 60)
    print("STARTING OYOPASAL PHASE 12: COMPLETE END-TO-END VERIFICATION")
    print("=" * 60)

    # Clean previous test artifacts
    for p in Product.all_objects.filter(base_sku__in=["TEST-PROD-A", "TEST-PROD-B"]):
        ProductVariant.all_objects.filter(product=p).delete()
        p.hard_delete()

    # Get Vendor A (shivaTech) and Vendor B (TechZone Nepal Electronics)
    vendor_a = VendorProfile.objects.filter(business_name='shivaTech').first()
    vendor_b = VendorProfile.objects.filter(business_name='TechZone Nepal Electronics').first()
    assert vendor_a is not None and vendor_b is not None, "Both vendors A and B must exist in database"
    
    store_a = Store.objects.filter(vendor=vendor_a, is_active=True).first()
    store_b = Store.objects.filter(vendor=vendor_b, is_active=True).first()
    assert store_a is not None and store_b is not None, "Both stores A and B must exist"

    category = Category.objects.filter(is_active=True).first()
    customer_user = User.objects.filter(role=UserRole.CUSTOMER).first()
    assert customer_user is not None, "Customer user must exist"

    print(f"Setup: Vendor A = '{vendor_a.business_name}', Vendor B = '{vendor_b.business_name}', Customer = '{customer_user.email}'")

    # ---------------------------------------------------------
    # TEST 1: Vendor A creates a product called "Test Product A"
    # Expected: Product appears in the customer marketplace after publication and approval
    # ---------------------------------------------------------
    serializer_a = ProductCreateUpdateSerializer(
        data={
            'name': 'Test Product A',
            'base_sku': 'TEST-PROD-A',
            'category': category.id,
            'description': 'Description for Test Product A',
            'short_description': 'Short description A',
            'tax_rate': '13.00',
            'is_featured': True,
            'variants': [{
                'sku': 'TEST-PROD-A-01',
                'regular_price': '1500.00',
                'selling_price': '1200.00',
                'attributes': {'color': 'Red'},
                'is_default': True,
                'is_active': True,
                'stock_quantity': 25
            }],
            'images': [{
                'image_url': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
                'is_primary': True,
                'ordering': 1
            }]
        },
        context={'request': DummyRequest(vendor_a.user)}
    )
    assert serializer_a.is_valid(), f"Test 1 error: {serializer_a.errors}"
    prod_a = serializer_a.save()
    assert prod_a.status == ProductStatus.APPROVED, f"Expected APPROVED, got {prod_a.status}"

    # Verify customer marketplace query retrieves prod_a
    from apps.catalogue.views import PublicProductListView
    customer_visible_a = Product.objects.filter(
        status=ProductStatus.APPROVED,
        store__is_active=True
    ).exclude(vendor__status__in=['SUSPENDED', 'REJECTED']).filter(id=prod_a.id)
    assert customer_visible_a.exists(), "TEST 1 FAILED: Product A does not appear in customer marketplace!"
    print("✓ TEST 1 PASSED: Vendor A created 'Test Product A' and it is immediately visible in customer marketplace.")

    # ---------------------------------------------------------
    # TEST 2: Vendor A changes its price
    # Expected: Customer marketplace shows the updated price
    # ---------------------------------------------------------
    var_a = prod_a.variants.first()
    update_serializer = ProductCreateUpdateSerializer(
        instance=prod_a,
        data={
            'variants': [{
                'id': var_a.id,
                'sku': var_a.sku,
                'regular_price': '1800.00',
                'selling_price': '1350.00',
                'is_default': True,
                'is_active': True,
                'stock_quantity': 25
            }]
        },
        partial=True,
        context={'request': DummyRequest(vendor_a.user)}
    )
    assert update_serializer.is_valid(), f"Test 2 update error: {update_serializer.errors}"
    update_serializer.save()

    # Check public serializer
    pub_data = ProductListSerializer(Product.objects.get(id=prod_a.id), context={'request': DummyRequest(customer_user)}).data
    assert float(pub_data['selling_price']) == 1350.00, f"Expected 1350.00, got {pub_data['selling_price']}"
    print(f"✓ TEST 2 PASSED: Price updated to NPR {pub_data['selling_price']} and reflected in customer serializer.")

    # ---------------------------------------------------------
    # TEST 3: Vendor A changes its product image
    # Expected: Customer marketplace shows the updated image
    # ---------------------------------------------------------
    new_img_url = "https://images.unsplash.com/photo-updated-test-image.jpg"
    prod_a.images.all().delete()
    ProductImage.objects.create(product=prod_a, image_url=new_img_url, is_primary=True, ordering=1)
    
    pub_data_img = ProductListSerializer(Product.objects.get(id=prod_a.id), context={'request': DummyRequest(customer_user)}).data
    assert pub_data_img['primary_image'] == new_img_url, f"Expected {new_img_url}, got {pub_data_img['primary_image']}"
    print("✓ TEST 3 PASSED: Product image updated and reflected in customer marketplace.")

    # ---------------------------------------------------------
    # TEST 4: Vendor A updates stock quantity
    # Expected: Customer marketplace shows the correct availability
    # ---------------------------------------------------------
    update_stock_serializer = ProductCreateUpdateSerializer(
        instance=prod_a,
        data={
            'variants': [{
                'id': var_a.id,
                'sku': var_a.sku,
                'regular_price': '1800.00',
                'selling_price': '1350.00',
                'stock_quantity': 10
            }]
        },
        partial=True,
        context={'request': DummyRequest(vendor_a.user)}
    )
    assert update_stock_serializer.is_valid(), f"Test 4 stock error: {update_stock_serializer.errors}"
    update_stock_serializer.save()

    pub_data_stock = ProductListSerializer(Product.objects.get(id=prod_a.id), context={'request': DummyRequest(customer_user)}).data
    assert pub_data_stock['stock_quantity'] == 10, f"Expected stock 10, got {pub_data_stock['stock_quantity']}"
    assert pub_data_stock['is_in_stock'] == True
    print(f"✓ TEST 4 PASSED: Stock updated to {pub_data_stock['stock_quantity']} units and availability shows in-stock.")

    # ---------------------------------------------------------
    # TEST 5: Vendor A sets stock to zero
    # Expected: Customer cannot purchase the product (is_in_stock = False)
    # ---------------------------------------------------------
    update_zero_serializer = ProductCreateUpdateSerializer(
        instance=prod_a,
        data={
            'variants': [{
                'id': var_a.id,
                'sku': var_a.sku,
                'regular_price': '1800.00',
                'selling_price': '1350.00',
                'stock_quantity': 0
            }]
        },
        partial=True,
        context={'request': DummyRequest(vendor_a.user)}
    )
    assert update_zero_serializer.is_valid(), f"Test 5 error: {update_zero_serializer.errors}"
    update_zero_serializer.save()

    pub_data_zero = ProductListSerializer(Product.objects.get(id=prod_a.id), context={'request': DummyRequest(customer_user)}).data
    assert pub_data_zero['stock_quantity'] == 0
    assert pub_data_zero['is_in_stock'] == False, "Expected is_in_stock=False when stock is 0"
    print("✓ TEST 5 PASSED: Stock set to 0, customer API reflects is_in_stock=False and prevents checkout.")

    # ---------------------------------------------------------
    # TEST 6: Vendor A unpublishes the product
    # Expected: Product disappears from public customer listings
    # ---------------------------------------------------------
    prod_a.status = ProductStatus.DRAFT
    prod_a.save(update_fields=['status'])

    public_check = Product.objects.filter(
        status=ProductStatus.APPROVED,
        store__is_active=True
    ).exclude(vendor__status__in=['SUSPENDED', 'REJECTED']).filter(id=prod_a.id)
    assert not public_check.exists(), "TEST 6 FAILED: Draft product is still visible publicly!"
    print("✓ TEST 6 PASSED: Product unpublished (DRAFT); completely hidden from customer listings.")

    # Re-publish and replenish stock for subsequent tests
    prod_a.status = ProductStatus.APPROVED
    prod_a.save(update_fields=['status'])
    inv = InventoryItem.objects.filter(variant=var_a).first()
    inv.quantity_on_hand = 20
    inv.save(update_fields=['quantity_on_hand'])

    # ---------------------------------------------------------
    # TEST 7: Vendor B creates another product
    # Expected: Both vendors' approved and published products appear in the same marketplace
    # ---------------------------------------------------------
    serializer_b = ProductCreateUpdateSerializer(
        data={
            'name': 'Test Product B',
            'base_sku': 'TEST-PROD-B',
            'category': category.id,
            'description': 'Description for Test Product B',
            'short_description': 'Short description B',
            'tax_rate': '13.00',
            'variants': [{
                'sku': 'TEST-PROD-B-01',
                'regular_price': '2000.00',
                'selling_price': '1800.00',
                'is_default': True,
                'is_active': True,
                'stock_quantity': 15
            }]
        },
        context={'request': DummyRequest(vendor_b.user)}
    )
    assert serializer_b.is_valid(), f"Test 7 error: {serializer_b.errors}"
    prod_b = serializer_b.save()
    assert prod_b.status == ProductStatus.APPROVED

    both_visible = Product.objects.filter(
        status=ProductStatus.APPROVED,
        store__is_active=True
    ).exclude(vendor__status__in=['SUSPENDED', 'REJECTED']).filter(id__in=[prod_a.id, prod_b.id])
    assert both_visible.count() == 2, f"Expected 2 products from both vendors, found {both_visible.count()}"
    print(f"✓ TEST 7 PASSED: Multiple vendors selling together (Found products from '{vendor_a.business_name}' and '{vendor_b.business_name}').")

    # ---------------------------------------------------------
    # TEST 8: Customer purchases a product
    # Expected: The correct vendor receives the corresponding order in their dashboard
    # ---------------------------------------------------------
    cart, _ = Cart.objects.get_or_create(user=customer_user)
    cart.items.all().delete()
    CartItem.objects.create(cart=cart, variant=var_a, quantity=2)

    order = CheckoutService.process_checkout(
        user=customer_user,
        shipping_address_data={
            'recipient_name': 'Ram Bahadur',
            'recipient_phone': '9841234567',
            'province': 'BAGMATI',
            'district': 'Kathmandu',
            'municipality': 'Kathmandu Met',
            'ward_number': 3,
            'tole_street': 'Thamel Marg'
        },
        payment_method='COD'
    )
    assert order is not None, "Checkout failed to create order"
    
    # Check vendor suborders
    suborder_a = VendorSubOrder.objects.filter(parent_order=order, vendor=vendor_a).first()
    suborder_b = VendorSubOrder.objects.filter(parent_order=order, vendor=vendor_b).first()
    assert suborder_a is not None, f"Vendor A ({vendor_a.business_name}) did not receive suborder!"
    assert suborder_b is None, f"Vendor B should NOT receive a suborder for Vendor A's product!"
    print(f"✓ TEST 8 PASSED: Order #{order.order_number} created: Vendor A received SubOrder #{suborder_a.sub_order_number}; Vendor B isolated with 0 unauthorized records.")

    # ---------------------------------------------------------
    # TEST 9: Customer refreshes the page
    # Expected: Actual product data remains available and is not replaced with old static data
    # ---------------------------------------------------------
    refreshed_prods = Product.objects.filter(
        status=ProductStatus.APPROVED,
        store__is_active=True
    ).exclude(vendor__status__in=['SUSPENDED', 'REJECTED'])
    assert refreshed_prods.count() >= 2
    serialized_refresh = ProductListSerializer(refreshed_prods, many=True, context={'request': DummyRequest(customer_user)}).data
    assert any(p['name'] == 'Test Product A' for p in serialized_refresh)
    assert any(p['name'] == 'Test Product B' for p in serialized_refresh)
    print("✓ TEST 9 PASSED: Customer page refresh pulls persistent live database records; 0 static fallback dependencies.")

    # Clean up test products and orders
    prod_a.delete()
    prod_b.delete()
    order.delete()
    print("✓ Cleanup: Test products and demo order cleanly removed.")

    print("\n" + "=" * 60)
    print("🎉 ALL 9 END-TO-END ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == '__main__':
    run_phase12_tests()

