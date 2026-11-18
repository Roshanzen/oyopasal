import uuid
from datetime import timedelta
from decimal import Decimal
from django.db.models import Sum, Count, Avg, F, Q
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.catalogue.models import Product, ProductVariant, ProductImage, Category
from apps.catalogue.serializers import ProductListSerializer, ProductDetailSerializer
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.inventory.models import InventoryItem, StockMovement
from apps.reviews.models import ProductReview
from apps.stores.models import Store


from apps.common.utils import is_valid_uuid


def get_target_vendor(request, vendor_id=None):
    """
    Resolve vendor profile from query param (admin/support) or active user session.
    """
    user = request.user
    if vendor_id:
        v = VendorProfile.objects.filter(id=vendor_id).first() if is_valid_uuid(vendor_id) else VendorProfile.objects.filter(slug=vendor_id).first()
        if v:
            return v

    if hasattr(user, 'vendor_profile'):
        return user.vendor_profile

    return VendorProfile.objects.first()


class SellerDashboardView(APIView):
    """
    Vendor store KPIs: daily orders, revenue, inventory health, store status.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'stats': {}, 'products': [], 'vendor': {}}, status=status.HTTP_200_OK)

        store = vendor.stores.filter(is_active=True).first()
        products_qs = Product.objects.filter(vendor=vendor)
        total_products = products_qs.count()

        # Low stock products (quantity on hand <= 5)
        low_stock_count = InventoryItem.objects.filter(
            variant__product__vendor=vendor,
            quantity_on_hand__lte=5
        ).count()

        suborders = VendorSubOrder.objects.filter(vendor=vendor)
        total_orders = suborders.count()
        pending_orders = suborders.filter(
            status__in=[
                OrderStatus.PENDING_PAYMENT,
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.PACKED
            ]
        ).count()

        delivered_suborders = suborders.filter(status=OrderStatus.DELIVERED)
        total_revenue = delivered_suborders.aggregate(rev=Sum('vendor_net_amount'))['rev'] or Decimal('0.0')

        stats = {
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'total_products': total_products,
            'low_stock_count': low_stock_count,
            'total_revenue': float(total_revenue),
            'currency': 'NPR'
        }

        avg_rating = getattr(vendor, 'average_rating', None)
        if avg_rating is None:
            rev_agg = ProductReview.objects.filter(product__vendor=vendor).aggregate(avg=Avg('rating'))
            avg_rating = rev_agg.get('avg') or 4.8

        vendor_data = {
            'id': str(vendor.id),
            'name': vendor.business_name,
            'slug': vendor.slug,
            'is_online': store.is_active if store else True,
            'open_time': '06:00',
            'close_time': '22:00',
            'delivery_time_mins': '10-15 mins',
            'rating': round(float(avg_rating), 1),
            'description': vendor.store_description or (store.description if store else ''),
            'logo_url': vendor.logo_url or '',
            'cover_image_url': getattr(vendor, 'banner_url', '') or '',
            'area': store.address if store else 'Kathmandu'
        }

        # Serialized product list for dashboard quick view
        products_serializer = ProductListSerializer(products_qs[:20], many=True)

        return Response({
            'success': True,
            'stats': stats,
            'vendor': vendor_data,
            'products': products_serializer.data
        }, status=status.HTTP_200_OK)


class SellerProductsView(APIView):
    """List or create products for the authenticated vendor."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'count': 0, 'results': []})

        qs = Product.objects.filter(vendor=vendor).select_related('category', 'brand').prefetch_related('variants', 'images').order_by('-created_at')
        serializer = ProductListSerializer(qs, many=True)
        return Response({
            'count': len(serializer.data),
            'results': serializer.data
        })

    def post(self, request):
        vendor_id = request.data.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'success': False, 'message': 'Vendor profile not found.'}, status=status.HTTP_400_BAD_REQUEST)

        store = vendor.stores.first()
        if not store:
            store = Store.objects.create(
                vendor=vendor,
                name=vendor.business_name,
                slug=vendor.slug,
                description=vendor.store_description,
                is_active=True
            )

        category_slug = request.data.get('category_slug')
        category = Category.objects.filter(slug=category_slug).first() or Category.objects.first()

        name = request.data.get('name', 'New Product').strip()
        original_price = Decimal(str(request.data.get('original_price', 100)))
        discounted_price = Decimal(str(request.data.get('discounted_price', original_price)))
        stock = int(request.data.get('stock', 50))
        unit = request.data.get('unit', 'piece')
        image_url = request.data.get('image_url', '')

        from django.utils.text import slugify
        base_slug = slugify(name) or f"prod-{str(uuid.uuid4())[:8]}"
        prod_slug = f"{base_slug}-{str(uuid.uuid4())[:6]}"

        product = Product.objects.create(
            vendor=vendor,
            store=store,
            category=category,
            name=name,
            slug=prod_slug,
            unit=unit,
            description=request.data.get('description', ''),
            short_description=name,
            status='APPROVED',
            base_sku=f"SKU-{str(uuid.uuid4())[:8].upper()}"
        )

        variant = ProductVariant.objects.create(
            product=product,
            name="Standard",
            sku=f"{product.base_sku}-STD",
            regular_price=original_price,
            selling_price=discounted_price,
            is_active=True
        )

        from apps.warehouse.models import Warehouse
        warehouse = Warehouse.objects.filter(is_active=True).first()
        if not warehouse:
            warehouse = Warehouse.objects.create(
                name="Central KTM Hub",
                code="KTM-HUB-01",
                address="Kathmandu Valley",
                is_active=True
            )

        InventoryItem.objects.create(
            variant=variant,
            warehouse=warehouse,
            quantity_on_hand=stock,
            reorder_threshold=5
        )

        if image_url:
            ProductImage.objects.create(
                product=product,
                image_url=image_url,
                is_primary=True,
                display_order=0
            )

        serialized = ProductListSerializer(product).data
        return Response({
            'success': True,
            'message': 'Product published successfully.',
            'product': serialized
        }, status=status.HTTP_201_CREATED)


class SellerProductDetailView(APIView):
    """Retrieve, update, or remove a vendor product."""
    permission_classes = [permissions.AllowAny]

    def put(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        if 'name' in request.data:
            product.name = request.data['name']
        if 'description' in request.data:
            product.description = request.data['description']
        if 'unit' in request.data:
            product.unit = request.data['unit']
        product.save()

        variant = product.variants.first()
        if variant:
            if 'discounted_price' in request.data:
                variant.selling_price = Decimal(str(request.data['discounted_price']))
            if 'original_price' in request.data:
                variant.regular_price = Decimal(str(request.data['original_price']))
            variant.save()

        return Response({
            'success': True,
            'message': 'Product updated successfully.',
            'product': ProductListSerializer(product).data
        })

    def delete(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        product.delete()
        return Response({
            'success': True,
            'message': 'Product deleted successfully.'
        })


class SellerToggleStockView(APIView):
    """Quick toggle in_stock status for a product."""
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        variant = product.variants.first()
        new_status = True
        if variant:
            inv = InventoryItem.objects.filter(variant=variant).first()
            if inv:
                if inv.quantity_on_hand > 0:
                    inv.quantity_on_hand = 0
                    new_status = False
                else:
                    inv.quantity_on_hand = 25
                    new_status = True
                inv.save(update_fields=['quantity_on_hand', 'updated_at'])

        return Response({
            'success': True,
            'in_stock': new_status,
            'product': ProductListSerializer(product).data
        })


class SellerRestockView(APIView):
    """Add stock to product inventory."""
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        add_stock = int(request.data.get('add_stock', 25))
        variant = product.variants.first()
        stock_val = add_stock
        if variant:
            inv = InventoryItem.objects.filter(variant=variant).first()
            if inv:
                inv.quantity_on_hand += add_stock
                inv.save(update_fields=['quantity_on_hand', 'updated_at'])
                stock_val = inv.quantity_on_hand

        return Response({
            'success': True,
            'message': f'Added {add_stock} units to inventory.',
            'stock': stock_val,
            'in_stock': stock_val > 0,
            'product': ProductListSerializer(product).data
        })


class SellerOrdersView(APIView):
    """List orders and fulfillments for this vendor."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'count': 0, 'results': []})

        suborders = VendorSubOrder.objects.filter(vendor=vendor).select_related('parent_order', 'parent_order__customer').prefetch_related('items').order_by('-created_at')
        results = []
        for so in suborders:
            parent = so.parent_order
            customer_name = 'Customer'
            customer_phone = ''
            if parent and parent.customer:
                customer_name = getattr(parent.customer, 'full_name', '') or getattr(parent.customer, 'first_name', '') or 'Customer'
                customer_phone = getattr(parent.customer, 'phone_number', '') or ''
            results.append({
                'fulfillment_id': str(so.id),
                'order_number': so.sub_order_number or (parent.order_number if parent else f"ORD-{so.id}"),
                'status': so.status,
                'total_amount': float(so.subtotal or 0.0),
                'created_at': so.created_at.isoformat() if so.created_at else None,
                'customer_name': customer_name,
                'customer_phone': customer_phone,
                'customer_area': getattr(parent, 'delivery_area', 'Kathmandu') if parent else 'Kathmandu',
                'delivery_address': getattr(parent, 'delivery_street', '') if parent else '',
                'delivery_city': getattr(parent, 'delivery_city', 'Kathmandu') if parent else 'Kathmandu',
                'payment_method': getattr(parent, 'payment_method', 'CASH_ON_DELIVERY') if parent else 'CASH_ON_DELIVERY',
                'payment_status': getattr(parent, 'payment_status', 'PENDING') if parent else 'PENDING',
                'notes': getattr(parent, 'delivery_instructions', '') if parent else '',
                'items_count': so.items.count(),
                'items': [
                    {
                        'product_name': item.product_name,
                        'quantity': item.quantity,
                        'price': float(item.unit_price),
                        'unit': 'piece',
                    }
                    for item in so.items.all()
                ]
            })

        return Response({
            'count': len(results),
            'results': results
        })


class SellerOrderStatusView(APIView):
    """Update fulfillment status (e.g. PACKED_BY_VENDOR, READY_FOR_RIDER_PICKUP)."""
    permission_classes = [permissions.AllowAny]

    def patch(self, request, fulfillment_id):
        new_status = request.data.get('status')
        so = VendorSubOrder.objects.filter(id=fulfillment_id).first()
        if not so:
            return Response({'success': False, 'message': 'Vendor sub-order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if new_status:
            so.status = new_status
            so.save(update_fields=['status', 'updated_at'])
        return Response({
            'success': True,
            'status': so.status,
            'message': f'Fulfillment status updated to {so.status}'
        })


class SellerStoreView(APIView):
    """Get or update vendor store profile."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'vendor': {}, 'settlements': []})

        store = vendor.stores.first()
        avg_rating = getattr(vendor, 'average_rating', None)
        if avg_rating is None:
            rev_agg = ProductReview.objects.filter(product__vendor=vendor).aggregate(avg=Avg('rating'))
            avg_rating = rev_agg.get('avg') or 4.8

        vendor_data = {
            'id': str(vendor.id),
            'name': vendor.business_name,
            'slug': vendor.slug,
            'description': vendor.store_description or (store.description if store else ''),
            'is_online': store.is_active if store else True,
            'open_time': '06:00',
            'close_time': '22:00',
            'delivery_time_mins': '10-15 mins',
            'rating': round(float(avg_rating), 1),
            'logo_url': getattr(vendor, 'logo_url', '') or '',
            'cover_image_url': getattr(vendor, 'banner_url', '') or '',
            'area': getattr(store, 'address', '') or 'Kathmandu',
            'phone': getattr(store, 'contact_phone', '') or (vendor.user.phone_number if hasattr(vendor, 'user') else ''),
            'email': getattr(store, 'contact_email', '') or (vendor.user.email if hasattr(vendor, 'user') else ''),
        }
        return Response({
            'vendor': vendor_data,
            'settlements': []
        })

    def put(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'success': False, 'message': 'Vendor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        if 'description' in request.data:
            vendor.store_description = request.data['description']
        if 'logo_url' in request.data:
            vendor.logo_url = request.data['logo_url']
        if 'cover_image_url' in request.data:
            vendor.banner_url = request.data['cover_image_url']
        vendor.save()

        store = vendor.stores.first()
        if store:
            if 'is_online' in request.data:
                store.is_active = bool(request.data['is_online'])
            if 'phone' in request.data:
                store.contact_phone = request.data['phone']
            if 'area' in request.data:
                store.address = request.data['area']
            store.save()

        return Response({
            'success': True,
            'message': 'Store settings updated successfully.',
            'vendor': {
                'id': str(vendor.id),
                'name': vendor.business_name,
                'slug': vendor.slug,
                'description': vendor.store_description,
                'is_online': store.is_active if store else True,
                'rating': 4.8,
                'logo_url': getattr(vendor, 'logo_url', '') or '',
                'cover_image_url': getattr(vendor, 'banner_url', '') or '',
            }
        })


class SellerAnalyticsView(APIView):
    """
    Dedicated vendor analytics endpoint calculating:
    - summary: total_revenue, total_orders, avg_order_value, pending_orders, completed_orders, total_products
    - monthly_trend: month-by-month sales, orders, net payout
    - top_products: best performing products by revenue & units
    - category_breakdown: category distribution
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({
                'vendor_id': '',
                'period_months': 6,
                'summary': {'total_revenue': 0.0, 'total_orders': 0, 'avg_order_value': 0.0},
                'monthly_trend': [],
                'top_products': [],
                'category_breakdown': []
            })

        months = int(request.query_params.get('months', 6))
        
        # 1. Suborders query
        suborders = VendorSubOrder.objects.filter(vendor=vendor)
        valid_orders = suborders.exclude(status=OrderStatus.CANCELLED)

        # 2. Summary
        agg = valid_orders.aggregate(
            tot_rev=Sum('subtotal'),
            tot_cnt=Count('id'),
            avg_val=Avg('subtotal')
        )
        total_revenue = float(agg['tot_rev'] or 0.0)
        total_orders = agg['tot_cnt'] or 0
        avg_order_value = float(round(agg['avg_val'] or 0.0, 2))

        # 3. Monthly trend (last N months)
        now = timezone.now()
        monthly_trend = []
        for i in range(months - 1, -1, -1):
            m_date = (now.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
            month_label = m_date.strftime('%b %Y')
            next_m = (m_date + timedelta(days=32)).replace(day=1)
            
            m_qs = valid_orders.filter(created_at__gte=m_date, created_at__lt=next_m)
            m_agg = m_qs.aggregate(
                rev=Sum('subtotal'),
                cnt=Count('id'),
                payout=Sum('vendor_net_amount')
            )
            monthly_trend.append({
                'month': month_label,
                'revenue': float(m_agg['rev'] or 0.0),
                'orders': m_agg['cnt'] or 0,
                'netPayout': float(m_agg['payout'] or 0.0)
            })

        # 4. Top products
        top_items = (
            OrderItem.objects.filter(sub_order__vendor=vendor)
            .values('product_name')
            .annotate(
                units=Sum('quantity'),
                revenue=Sum('total_price')
            )
            .order_by('-units')[:5]
        )
        top_products = [
            {
                'name': row['product_name'],
                'shortName': (row['product_name'][:18] + '...') if len(row['product_name']) > 18 else row['product_name'],
                'units': row['units'],
                'revenue': float(row['revenue'] or 0.0)
            }
            for row in top_items
        ]

        # 5. Category breakdown
        cat_items = (
            OrderItem.objects.filter(sub_order__vendor=vendor)
            .values('variant__product__category__name')
            .annotate(
                count=Count('id'),
                revenue=Sum('total_price')
            )
            .order_by('-revenue')[:6]
        )
        total_cat_rev = sum(float(r['revenue'] or 0.0) for r in cat_items) or 1.0
        category_breakdown = [
            {
                'name': row['variant__product__category__name'] or 'General',
                'count': row['count'],
                'revenue': float(row['revenue'] or 0.0),
                'sharePercent': round((float(row['revenue'] or 0.0) / total_cat_rev) * 100, 1)
            }
            for row in cat_items
        ]

        return Response({
            'vendor_id': str(vendor.id),
            'period_months': months,
            'summary': {
                'total_revenue': total_revenue,
                'total_orders': total_orders,
                'avg_order_value': avg_order_value,
            },
            'monthly_trend': monthly_trend,
            'top_products': top_products,
            'category_breakdown': category_breakdown,
            'success': True
        })


class SellerReviewsView(APIView):
    """Reviews received for products from this vendor."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'count': 0, 'average_rating': 5.0, 'results': []})

        reviews = ProductReview.objects.filter(product__vendor=vendor).order_by('-created_at')
        avg_rating = reviews.aggregate(a=Avg('rating'))['a'] or 5.0
        results = [
            {
                'id': str(r.id),
                'product_name': r.product.name,
                'user_name': r.user.full_name if r.user else 'Customer',
                'rating': r.rating,
                'comment': r.comment,
                'created_at': r.created_at.isoformat()
            }
            for r in reviews[:50]
        ]
        return Response({
            'count': len(results),
            'average_rating': round(float(avg_rating), 1),
            'results': results
        })


class SellerInventoryMovementsView(APIView):
    """Inventory audit log for vendor products."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        vendor_id = request.query_params.get('vendor_id')
        vendor = get_target_vendor(request, vendor_id)
        if not vendor:
            return Response({'count': 0, 'results': []})

        movements = StockMovement.objects.filter(
            inventory_item__variant__product__vendor=vendor
        ).select_related('inventory_item__variant__product').order_by('-created_at')[:50]

        results = [
            {
                'id': str(m.id),
                'product_name': m.inventory_item.variant.product.name,
                'change_quantity': m.quantity,
                'movement_type': m.movement_type,
                'created_at': m.created_at.isoformat()
            }
            for m in movements
        ]
        return Response({
            'count': len(results),
            'results': results
        })
        return Response({
            'count': len(results),
            'results': results
        })
