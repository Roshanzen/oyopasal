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
from apps.catalogue.models import Product, ProductVariant, Category, ProductStatus
from apps.inventory.models import InventoryItem
from apps.warehouse.models import Warehouse

def run_e2e_test():
    print("=== STARTING OYOPASAL END-TO-END MARKETPLACE INTEGRATION TEST ===")
    
    # 1. Verify Vendor & Store (using an approved vendor)
    vendor = VendorProfile.objects.filter(status=VendorStatus.APPROVED).first()
    assert vendor is not None, "Approved vendor not found"
    user = vendor.user
    store = Store.objects.filter(vendor=vendor, is_active=True).first()
    assert store is not None, "Active store not found"
    print(f"✓ Step 1: Verified Vendor: '{vendor.business_name}' and Active Store: '{store.name}' (ID: {store.id})")
    
    # 2. Pick Category
    category = Category.objects.filter(is_active=True).first()
    assert category is not None, "Category not found"
    print(f"✓ Step 2: Selected Category: '{category.name}' (Slug: {category.slug})")

    # 3. Simulate Vendor Product Creation (via Serializer)
    from apps.catalogue.serializers import ProductCreateUpdateSerializer
    test_sku = "E2E-TEST-NEPAL-001"
    
    # Clean up old test product if existed
    Product.objects.filter(base_sku=test_sku).delete()

    serializer_data = {
        'name': 'Himalayan Organic Yarsagumba Honey',
        'base_sku': test_sku,
        'category': category.id,
        'description': 'Pure organic wildflower honey infused with high-altitude Himalayan herbs.',
        'short_description': '100% natural organic honey from Manang, Nepal.',
        'tax_rate': '13.00',
        'is_featured': True,
        'variants': [
            {
                'sku': f"{test_sku}-500G",
                'regular_price': '2500.00',
                'selling_price': '2200.00',
                'attributes': {'weight': '500g'},
                'is_default': True,
                'is_active': True,
                'stock_quantity': 45
            }
        ]
    }

    # Simulate request with vendor user context
    class DummyRequest:
        def __init__(self, u):
            self.user = u
            self.build_absolute_uri = lambda uri: f"http://localhost:8000{uri}"

    serializer = ProductCreateUpdateSerializer(data=serializer_data, context={'request': DummyRequest(user)})
    assert serializer.is_valid(), f"Serializer errors: {serializer.errors}"
    new_product = serializer.save()
    print(f"✓ Step 3: Product created via serializer: '{new_product.name}' (Status: {new_product.status}, Store: {new_product.store.name})")

    # 4. Check that product is automatically APPROVED for approved vendors
    assert new_product.status == ProductStatus.APPROVED, f"Expected status APPROVED, got {new_product.status}"
    print("✓ Step 4: Product auto-approval verified (immediate publication)")

    # 5. Check InventoryItem creation
    variant = new_product.variants.first()
    assert variant is not None, "Variant not found"
    inv_item = InventoryItem.objects.filter(variant=variant).first()
    assert inv_item is not None, "InventoryItem was not created automatically"
    assert inv_item.quantity_on_hand == 45, f"Expected 45 in stock, got {inv_item.quantity_on_hand}"
    print(f"✓ Step 5: InventoryItem synchronized: {inv_item.quantity_on_hand} units available in warehouse '{inv_item.warehouse.code}'")

    # 6. Check Customer Public API Query
    from apps.catalogue.serializers import ProductListSerializer
    public_prods = Product.objects.filter(
        status=ProductStatus.APPROVED,
        is_deleted=False,
        store__is_active=True,
        vendor__status=VendorStatus.APPROVED
    ).filter(id=new_product.id)

    assert public_prods.exists(), "Product is NOT visible in public customer queryset!"
    list_serializer = ProductListSerializer(public_prods.first(), context={'request': DummyRequest(user)})
    prod_dict = list_serializer.data
    assert prod_dict['is_in_stock'] == True, "Public serializer shows is_in_stock=False"
    assert prod_dict['stock_quantity'] == 45, f"Expected stock_quantity=45, got {prod_dict.get('stock_quantity')}"
    print(f"✓ Step 6: Public Customer API Output verified:")
    print(f"   - Name: {prod_dict['name']}")
    print(f"   - Store: {prod_dict['store_name']}")
    print(f"   - In Stock: {prod_dict['is_in_stock']}")
    print(f"   - Stock Quantity: {prod_dict['stock_quantity']}")
    print(f"   - Selling Price: NPR {prod_dict.get('selling_price')}")

    # Detail API Serializer check
    from apps.catalogue.serializers import ProductDetailSerializer
    detail_serializer = ProductDetailSerializer(public_prods.first(), context={'request': DummyRequest(user)})
    detail_dict = detail_serializer.data
    assert len(detail_dict['variants']) > 0, "No variants in ProductDetailSerializer"
    print(f"   - Detail Variants count: {len(detail_dict['variants'])}")

    # 7. Test Vendor Updating Price and Stock
    update_data = {
        'name': 'Himalayan Organic Yarsagumba Honey (Updated)',
        'variants': [
            {
                'id': variant.id,
                'sku': variant.sku,
                'regular_price': '2800.00',
                'selling_price': '2400.00',
                'attributes': {'weight': '500g'},
                'is_default': True,
                'is_active': True,
                'stock_quantity': 0 # Out of stock!
            }
        ]
    }
    update_serializer = ProductCreateUpdateSerializer(
        instance=new_product,
        data=update_data,
        partial=True,
        context={'request': DummyRequest(user)}
    )
    assert update_serializer.is_valid(), f"Update errors: {update_serializer.errors}"
    updated_product = update_serializer.save()
    
    # Re-fetch inventory
    inv_item.refresh_from_db()
    assert inv_item.quantity_on_hand == 0, f"Expected 0 stock, got {inv_item.quantity_on_hand}"
    print("✓ Step 7: Vendor updated price to NPR 2,400.00 and stock to 0")

    # 8. Check Customer API reflection of Out of Stock
    public_prods_refreshed = Product.objects.filter(id=new_product.id)
    refreshed_data = ProductListSerializer(public_prods_refreshed.first(), context={'request': DummyRequest(user)}).data
    assert refreshed_data['is_in_stock'] == False, "Expected is_in_stock=False after stock set to 0"
    assert refreshed_data['stock_quantity'] == 0, f"Expected stock_quantity=0, got {refreshed_data['stock_quantity']}"
    print(f"✓ Step 8: Customer Marketplace immediately reflects real-time updates:")
    print(f"   - Updated Name: {refreshed_data['name']}")
    print(f"   - Selling Price: NPR {refreshed_data.get('selling_price')}")
    print(f"   - In Stock: {refreshed_data['is_in_stock']} (Stock: {refreshed_data['stock_quantity']})")

    # Clean up test product
    new_product.delete()
    print("✓ Step 9: Cleaned up test record")
    print("\n🎉 ALL 9 END-TO-END INTEGRATION ASSERTIONS PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    run_e2e_test()
