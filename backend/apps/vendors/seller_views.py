import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Sum, Count, Avg, F, Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.accounts.models import UserRole
from apps.vendors.models import VendorProfile, VendorStatus
from apps.catalogue.models import Product, ProductVariant, ProductImage, Category, ProductStatus
from apps.catalogue.serializers import ProductListSerializer, ProductDetailSerializer
from apps.orders.models import Order, VendorSubOrder, OrderItem, OrderStatus
from apps.inventory.models import InventoryItem, StockMovement
from apps.reviews.models import ProductReview
from apps.stores.models import Store
from apps.warehouse.models import Warehouse

from apps.common.utils import is_valid_uuid
from apps.common.services.image_resolver import resolve_image_url


def is_valid_image_url(url):
    """
    Validates whether a string is a legitimate image URL or relative media path.
    Rejects text blocks, prompts, debug prose, newlines, and non-image strings.
    """
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    if len(url) > 500:
        return False
    if '\n' in url or '\r' in url:
        return False
    valid_prefixes = (
        'http://',
        'https://',
        '/uploads/',
        '/media/',
        'data:image/',
        '/static/'
    )
    return any(url.startswith(p) for p in valid_prefixes)


ADMIN_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.SUPPORT_ADMIN,
    UserRole.FINANCE_ADMIN,
    UserRole.OPERATIONS_ADMIN,
    'ADMIN',
    'OPS_MANAGER'
]


def resolve_authenticated_vendor(request, vendor_id=None):
    """
    Resolves vendor profile and prevents vendor ID spoofing.
    - If user is authenticated as a vendor, enforces ownership (cannot spoof another vendor).
    - If user is staff/admin, allows specifying vendor_id.
    - If user is authenticated customer without vendor profile, returns (None, 'FORBIDDEN').
    - If unauthenticated, allows vendor_id or fallback to default vendor.
    """
    user = request.user
    if user and user.is_authenticated:
        if hasattr(user, 'vendor_profile'):
            vendor = user.vendor_profile
            if vendor_id and str(vendor.id) != str(vendor_id) and vendor.slug != str(vendor_id):
                if getattr(user, 'role', '') not in ADMIN_ROLES and not user.is_staff:
                    return None, 'FORBIDDEN'
            return vendor, None
        elif getattr(user, 'role', '') in ADMIN_ROLES or user.is_staff:
            vendor = None
            if vendor_id:
                vendor = VendorProfile.objects.filter(id=vendor_id).first() if is_valid_uuid(vendor_id) else VendorProfile.objects.filter(slug=vendor_id).first()
            if not vendor:
                vendor = VendorProfile.objects.first()
            return vendor, None
        else:
            return None, 'NOT_A_VENDOR'

    # Unauthenticated / Demo mode
    vendor = None
    if vendor_id:
        vendor = VendorProfile.objects.filter(id=vendor_id).first() if is_valid_uuid(vendor_id) else VendorProfile.objects.filter(slug=vendor_id).first()
    if not vendor:
        vendor = VendorProfile.objects.first()
    return vendor, None


def get_target_vendor(request, vendor_id=None):
    """
    Resolve vendor profile from query param (admin/support) or active user session.
    """
    user = getattr(request, 'user', None)
    if vendor_id:
        v = None
        if is_valid_uuid(vendor_id):
            v = VendorProfile.objects.filter(id=vendor_id).first()
        if not v:
            v = VendorProfile.objects.filter(slug=vendor_id).first()
        if not v:
            v = VendorProfile.objects.filter(business_name__iexact=vendor_id).first()
        if not v:
            v = VendorProfile.objects.filter(business_name__icontains=vendor_id).first()
        if v:
            return v

    if user and getattr(user, 'is_authenticated', False) and hasattr(user, 'vendor_profile'):
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

        has_verified_store = bool(store and store.is_verified) or vendor.stores.filter(is_verified=True).exists()
        is_approved = (vendor.status == VendorStatus.APPROVED) or has_verified_store
        effective_status = 'APPROVED' if is_approved else (vendor.status or 'PENDING')
        approval_status = 'approved' if is_approved else effective_status.lower()

        vendor_data = {
            'id': str(vendor.id),
            'name': vendor.business_name,
            'business_name': vendor.business_name,
            'slug': vendor.slug,
            'status': effective_status,
            'approval_status': approval_status,
            'is_approved': is_approved,
            'is_verified': is_approved,
            'verified': is_approved,
            'kyc_status': 'verified' if is_approved else 'pending',
            'is_online': store.is_active if store else True,
            'open_time': '06:00',
            'close_time': '22:00',
            'delivery_time_mins': '10-15 mins',
            'rating': round(float(avg_rating), 1),
            'description': vendor.store_description or (store.description if store else ''),
            'logo_url': vendor.logo_url or '',
            'cover_image_url': getattr(vendor, 'banner_url', '') or '',
            'area': store.address if store else 'Kathmandu',
            'store': {
                'id': str(store.id) if store else '',
                'name': store.name if store else vendor.business_name,
                'slug': store.slug if store else vendor.slug,
                'is_verified': is_approved,
                'is_active': store.is_active if store else True,
            } if store else None
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
        vendor, err = resolve_authenticated_vendor(request, vendor_id)
        if err == 'FORBIDDEN':
            return Response({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'You do not have permission to manage products for this vendor.'
                }
            }, status=status.HTTP_403_FORBIDDEN)
        elif err == 'NOT_A_VENDOR':
            return Response({
                'success': False,
                'error': {
                    'code': 'FORBIDDEN',
                    'message': 'Vendor profile required to create products.'
                }
            }, status=status.HTTP_403_FORBIDDEN)
        elif not vendor:
            return Response({
                'success': False,
                'error': {
                    'code': 'NOT_FOUND',
                    'message': 'Vendor profile not found.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # 1. Product Name Validation
        name = request.data.get('name')
        if not name or not isinstance(name, str) or not name.strip():
            return Response({
                'success': False,
                'error': {'code': 'INVALID_NAME', 'message': 'Product name is required.'}
            }, status=status.HTTP_400_BAD_REQUEST)
        name = name.strip()
        if len(name) < 2 or len(name) > 255:
            return Response({
                'success': False,
                'error': {'code': 'INVALID_NAME', 'message': 'Product name must be between 2 and 255 characters.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Category Validation
        category_slug = request.data.get('category_slug')
        category = None
        if category_slug:
            category = Category.objects.filter(slug=category_slug).first()
            if not category and is_valid_uuid(category_slug):
                category = Category.objects.filter(id=category_slug).first()
            if not category:
                category = Category.objects.filter(name__iexact=category_slug).first()
        if not category:
            category = Category.objects.first()
        if not category:
            return Response({
                'success': False,
                'error': {'code': 'INVALID_CATEGORY', 'message': 'No valid product category found in system.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        # 3. Prices Validation
        raw_disc_price = request.data.get('discounted_price')
        raw_orig_price = request.data.get('original_price', raw_disc_price)
        try:
            discounted_price = Decimal(str(raw_disc_price))
            if discounted_price <= 0:
                raise ValueError()
        except (TypeError, ValueError, InvalidOperation):
            return Response({
                'success': False,
                'error': {'code': 'INVALID_PRICE', 'message': 'Selling price must be a valid positive number.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            original_price = Decimal(str(raw_orig_price))
            if original_price <= 0:
                original_price = discounted_price
        except (TypeError, ValueError, InvalidOperation):
            original_price = discounted_price

        # 4. Stock Validation
        raw_stock = request.data.get('stock', 25)
        try:
            stock = int(raw_stock)
            if stock < 0:
                raise ValueError()
        except (TypeError, ValueError):
            return Response({
                'success': False,
                'error': {'code': 'INVALID_STOCK', 'message': 'Stock quantity must be a non-negative integer.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        # 5. Unit Validation
        unit = str(request.data.get('unit', 'piece')).strip()
        if not unit:
            unit = 'piece'
        elif len(unit) > 50:
            return Response({
                'success': False,
                'error': {'code': 'INVALID_UNIT', 'message': 'Unit must be 50 characters or fewer.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        # 6. Main Image & Multi-Image Gallery Validation (Up to 6 images)
        images_payload = request.data.get('images')
        image_url = request.data.get('image_url')
        gallery_urls = request.data.get('gallery_urls', [])

        if images_payload and isinstance(images_payload, list) and len(images_payload) > 0:
            image_url = images_payload[0]
            gallery_urls = images_payload[1:6]

        clean_image_url = ''
        if image_url is not None:
            image_url_str = str(image_url).strip()
            if image_url_str:
                if not is_valid_image_url(image_url_str):
                    return Response({
                        'success': False,
                        'error': {
                            'code': 'INVALID_IMAGE_URL',
                            'message': 'Image URL must be a valid web URL or media path (e.g. https://... or /uploads/...). Plain text or debugging prompts are not permitted.'
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)
                clean_image_url = image_url_str

        # 7. Gallery Images Validation
        valid_gallery_urls = []
        if gallery_urls:
            if not isinstance(gallery_urls, list):
                return Response({
                    'success': False,
                    'error': {'code': 'INVALID_GALLERY', 'message': 'Gallery URLs must be a list.'}
                }, status=status.HTTP_400_BAD_REQUEST)
            for g_url in gallery_urls[:5]:
                g_url_str = str(g_url).strip()
                if g_url_str:
                    if not is_valid_image_url(g_url_str):
                        return Response({
                            'success': False,
                            'error': {
                                'code': 'INVALID_IMAGE_URL',
                                'message': f'Invalid gallery image URL: {g_url_str[:60]}...'
                            }
                        }, status=status.HTTP_400_BAD_REQUEST)
                    valid_gallery_urls.append(g_url_str)

        # Resolve indirect URLs (e.g. Google share links, redirects)
        if clean_image_url:
            clean_image_url = resolve_image_url(clean_image_url)
        valid_gallery_urls = [resolve_image_url(g) for g in valid_gallery_urls]

        # 8. Organic Status, Sections & Description
        is_organic = bool(request.data.get('is_organic', False))
        description = str(request.data.get('description', '')).strip()
        short_description = description[:490] if description else name[:490]
        sections = request.data.get('sections', [])
        if not isinstance(sections, list):
            sections = ['fresh_arrivals', 'best_sellers']

        # 9. Atomic Transaction
        with transaction.atomic():
            store = vendor.stores.first()
            if not store:
                store = Store.objects.create(
                    vendor=vendor,
                    name=vendor.business_name,
                    slug=f"{vendor.slug}-{uuid.uuid4().hex[:4]}",
                    description=vendor.store_description,
                    is_active=True
                )

            base_slug = slugify(name) or f"prod-{uuid.uuid4().hex[:8]}"
            prod_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"
            base_sku = f"SKU-{uuid.uuid4().hex[:8].upper()}"

            is_featured = any(s in sections for s in ['best_sellers', 'trending', 'featured'])

            product = Product.objects.create(
                vendor=vendor,
                store=store,
                category=category,
                name=name,
                slug=prod_slug,
                unit=unit,
                is_organic=is_organic,
                sections=sections,
                description=description,
                short_description=short_description,
                status=ProductStatus.APPROVED,
                is_featured=is_featured,
                base_sku=base_sku
            )

            warehouse = Warehouse.objects.filter(is_active=True).first()
            if not warehouse:
                warehouse = Warehouse.objects.create(
                    name="Central KTM Hub",
                    code="KTM-HUB-01",
                    address="Kathmandu Valley",
                    is_active=True
                )

            variants_input = request.data.get('variants')
            if isinstance(variants_input, str):
                import json
                try:
                    variants_input = json.loads(variants_input)
                except (ValueError, TypeError):
                    variants_input = None

            created_variants = []
            if variants_input and isinstance(variants_input, list) and len(variants_input) > 0:
                for idx, v_item in enumerate(variants_input):
                    c_name = str(v_item.get('color') or v_item.get('color_name') or '').strip()
                    c_code = str(v_item.get('color_code') or v_item.get('color_value') or '').strip()
                    s_name = str(v_item.get('size') or '').strip()
                    v_sell = Decimal(str(v_item.get('price') or v_item.get('discounted_price') or discounted_price))
                    v_reg = Decimal(str(v_item.get('original_price') or v_item.get('regular_price') or original_price))
                    v_stock = int(v_item.get('stock') or v_item.get('stock_quantity') or stock)
                    v_img = str(v_item.get('image_url') or '').strip()
                    v_sku = str(v_item.get('sku') or f"{base_sku}-V{idx+1}")

                    attrs = {
                        'name': f"{c_name} / {s_name}" if c_name and s_name else (c_name or s_name or f"Option {idx+1}"),
                        'unit': unit
                    }
                    if c_name:
                        attrs['color'] = c_name
                        attrs['color_name'] = c_name
                    if c_code:
                        attrs['color_code'] = c_code
                    if s_name:
                        attrs['size'] = s_name
                    if v_img:
                        attrs['image_url'] = v_img

                    new_v = ProductVariant.objects.create(
                        product=product,
                        sku=v_sku,
                        regular_price=v_reg,
                        selling_price=v_sell,
                        attributes=attrs,
                        is_default=(idx == 0),
                        is_active=bool(v_item.get('is_active', True))
                    )
                    created_variants.append((new_v, v_stock, v_img))
            else:
                variant = ProductVariant.objects.create(
                    product=product,
                    sku=f"{base_sku}-STD",
                    regular_price=original_price,
                    selling_price=discounted_price,
                    attributes={"name": "Standard", "unit": unit},
                    is_default=True,
                    is_active=True
                )
                created_variants.append((variant, stock, clean_image_url))

            for v_obj, v_stk, v_pic in created_variants:
                inv_item, _ = InventoryItem.objects.get_or_create(
                    variant=v_obj,
                    warehouse=warehouse,
                    defaults={
                        'quantity_on_hand': v_stk,
                        'reorder_threshold': 5
                    }
                )
                if inv_item.quantity_on_hand != v_stk:
                    inv_item.quantity_on_hand = v_stk
                    inv_item.save(update_fields=['quantity_on_hand', 'updated_at'])

                if v_pic and is_valid_image_url(v_pic):
                    ProductImage.objects.create(
                        product=product,
                        variant=v_obj,
                        image_url=v_pic,
                        is_primary=v_obj.is_default and not clean_image_url,
                        ordering=10
                    )

            if clean_image_url:
                ProductImage.objects.create(
                    product=product,
                    variant=created_variants[0][0],
                    image_url=clean_image_url,
                    is_primary=True,
                    ordering=0
                )

            for idx, g_url in enumerate(valid_gallery_urls):
                if g_url != clean_image_url:
                    ProductImage.objects.create(
                        product=product,
                        variant=created_variants[0][0],
                        image_url=g_url,
                        is_primary=False,
                        ordering=idx + 1
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

    def get(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'success': True,
            'product': ProductDetailSerializer(product, context={'request': request}).data
        })

    def put(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check vendor ownership if authenticated
        user = request.user
        if user and user.is_authenticated and hasattr(user, 'vendor_profile'):
            if product.vendor != user.vendor_profile and getattr(user, 'role', '') not in ADMIN_ROLES and not user.is_staff:
                return Response({
                    'success': False,
                    'error': {'code': 'FORBIDDEN', 'message': 'You cannot edit products of another vendor.'}
                }, status=status.HTTP_403_FORBIDDEN)

        with transaction.atomic():
            if 'name' in request.data:
                product.name = str(request.data['name']).strip()
            if 'description' in request.data:
                product.description = str(request.data['description']).strip()
                product.short_description = product.description[:490]
            if 'unit' in request.data:
                product.unit = str(request.data['unit']).strip()
            if 'is_organic' in request.data:
                product.is_organic = bool(request.data['is_organic'])
            if 'sections' in request.data and isinstance(request.data['sections'], list):
                product.sections = request.data['sections']
                if any(s in product.sections for s in ['best_sellers', 'trending', 'featured']):
                    product.is_featured = True
            product.save()

            variants_payload = request.data.get('variants')
            if variants_payload is not None and isinstance(variants_payload, list) and len(variants_payload) > 0:
                warehouse = Warehouse.objects.filter(is_active=True).first()
                product.variants.all().delete()
                for idx, v_item in enumerate(variants_payload):
                    c_name = str(v_item.get('color') or v_item.get('color_name') or '').strip()
                    c_code = str(v_item.get('color_code') or v_item.get('color_value') or '').strip()
                    s_name = str(v_item.get('size') or '').strip()
                    v_sell = Decimal(str(v_item.get('price') or v_item.get('discounted_price') or '100'))
                    v_reg = Decimal(str(v_item.get('original_price') or v_item.get('regular_price') or v_sell))
                    v_stock = int(v_item.get('stock') or v_item.get('stock_quantity') or 20)
                    v_img = str(v_item.get('image_url') or '').strip()
                    v_sku = str(v_item.get('sku') or f"{product.base_sku}-V{idx+1}")

                    attrs = {
                        'name': f"{c_name} / {s_name}" if c_name and s_name else (c_name or s_name or f"Option {idx+1}"),
                        'unit': product.unit
                    }
                    if c_name:
                        attrs['color'] = c_name
                        attrs['color_name'] = c_name
                    if c_code:
                        attrs['color_code'] = c_code
                    if s_name:
                        attrs['size'] = s_name
                    if v_img:
                        attrs['image_url'] = v_img

                    new_v = ProductVariant.objects.create(
                        product=product,
                        sku=v_sku,
                        regular_price=v_reg,
                        selling_price=v_sell,
                        attributes=attrs,
                        is_default=(idx == 0),
                        is_active=bool(v_item.get('is_active', True))
                    )
                    if warehouse:
                        InventoryItem.objects.create(
                            variant=new_v,
                            warehouse=warehouse,
                            quantity_on_hand=v_stock,
                            reorder_threshold=5
                        )
                    if v_img and is_valid_image_url(v_img):
                        ProductImage.objects.create(
                            product=product,
                            variant=new_v,
                            image_url=v_img,
                            is_primary=False,
                            ordering=idx + 5
                        )
            else:
                variant = product.variants.first()
                if variant:
                    if 'discounted_price' in request.data:
                        variant.selling_price = Decimal(str(request.data['discounted_price']))
                    if 'original_price' in request.data:
                        variant.regular_price = Decimal(str(request.data['original_price']))
                    if 'unit' in request.data:
                        attrs = variant.attributes or {}
                        attrs['unit'] = str(request.data['unit']).strip()
                        variant.attributes = attrs
                    variant.save()

                    if 'stock' in request.data:
                        inv = InventoryItem.objects.filter(variant=variant).first()
                        if inv:
                            inv.quantity_on_hand = int(request.data['stock'])
                            inv.save(update_fields=['quantity_on_hand', 'updated_at'])

            # Multi-image sync (up to 6 images)
            images_payload = request.data.get('images')
            if images_payload is not None and isinstance(images_payload, list):
                valid_imgs = [
                    resolve_image_url(str(u).strip())
                    for u in images_payload
                    if str(u).strip() and is_valid_image_url(str(u).strip())
                ][:6]
                if valid_imgs:
                    ProductImage.objects.filter(product=product).delete()
                    primary_img = valid_imgs[0]
                    ProductImage.objects.create(
                        product=product,
                        variant=variant,
                        image_url=primary_img,
                        is_primary=True,
                        ordering=0
                    )
                    for idx, g_url in enumerate(valid_imgs[1:]):
                        ProductImage.objects.create(
                            product=product,
                            variant=variant,
                            image_url=g_url,
                            is_primary=False,
                            ordering=idx + 1
                        )
            elif 'image_url' in request.data or 'gallery_urls' in request.data:
                p_url = str(request.data.get('image_url', '')).strip()
                g_urls = request.data.get('gallery_urls', [])
                if not isinstance(g_urls, list):
                    g_urls = []
                if p_url and is_valid_image_url(p_url):
                    ProductImage.objects.filter(product=product).delete()
                    primary_resolved = resolve_image_url(p_url)
                    ProductImage.objects.create(
                        product=product,
                        variant=variant,
                        image_url=primary_resolved,
                        is_primary=True,
                        ordering=0
                    )
                    for idx, g_u in enumerate(g_urls[:5]):
                        g_str = str(g_u).strip()
                        if g_str and g_str != p_url and is_valid_image_url(g_str):
                            ProductImage.objects.create(
                                product=product,
                                variant=variant,
                                image_url=resolve_image_url(g_str),
                                is_primary=False,
                                ordering=idx + 1
                            )

        product.refresh_from_db()
        return Response({
            'success': True,
            'message': 'Product updated successfully.',
            'product': ProductListSerializer(product, context={'request': request}).data
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
    """Quick toggle in_stock status for a product or variant."""
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        variant_id = request.data.get('variant_id')
        variant = None
        if variant_id:
            variant = product.variants.filter(id=variant_id).first()
        if not variant:
            variant = product.variants.first()

        new_status = True
        if variant:
            warehouse = Warehouse.objects.filter(is_active=True).first()
            inv, _ = InventoryItem.objects.get_or_create(
                variant=variant,
                defaults={'warehouse': warehouse, 'quantity_on_hand': 25, 'reorder_threshold': 5}
            )
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
    """Add stock to product inventory or specific variant."""
    permission_classes = [permissions.AllowAny]

    def patch(self, request, id):
        product = Product.objects.filter(id=id).first() if is_valid_uuid(id) else Product.objects.filter(slug=id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        add_stock = int(request.data.get('add_stock', 25))
        variant_id = request.data.get('variant_id')
        variant = None
        if variant_id:
            variant = product.variants.filter(id=variant_id).first()
        if not variant:
            variant = product.variants.first()

        stock_val = add_stock
        if variant:
            warehouse = Warehouse.objects.filter(is_active=True).first()
            inv, _ = InventoryItem.objects.get_or_create(
                variant=variant,
                defaults={'warehouse': warehouse, 'quantity_on_hand': 0, 'reorder_threshold': 5}
            )
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

        suborders = VendorSubOrder.objects.filter(vendor=vendor).select_related(
            'parent_order', 'parent_order__customer'
        ).prefetch_related('items', 'items__variant', 'items__variant__product').order_by('-created_at')

        results = []
        for so in suborders:
            parent = so.parent_order
            customer_name = 'Customer'
            customer_phone = ''
            if parent and parent.customer:
                customer_name = getattr(parent.customer, 'first_name', '') or getattr(parent.customer, 'full_name', '') or 'Customer'
                customer_phone = getattr(parent.customer, 'phone_number', '') or ''

            snap = parent.shipping_address_snapshot if (parent and parent.shipping_address_snapshot) else {}
            customer_name = snap.get('recipient_name') or customer_name
            customer_phone = snap.get('recipient_phone') or customer_phone
            customer_area = snap.get('municipality') or snap.get('area', 'Kathmandu')
            delivery_street = snap.get('tole_street') or snap.get('street', '')
            delivery_city = snap.get('district') or snap.get('city', 'Kathmandu')
            notes = (parent.customer_notes if parent else '') or snap.get('landmark', '')

            # Normalize status for vendor frontend
            st = so.status
            if st == 'CONFIRMED':
                st = 'CONFIRMED_BY_VENDOR'

            subtotal_val = float(so.subtotal or 0.0)
            net_val = float(so.vendor_net_amount or so.subtotal or 0.0)
            comm_val = float(so.commission_amount or 0.0)

            items_list = []
            for item in so.items.all():
                prod = getattr(item.variant, 'product', None) if item.variant else None
                unit_str = getattr(prod, 'unit', 'piece') or 'piece' if prod else 'piece'
                u_price = float(item.unit_price or 0.0)
                t_price = float(item.total_price or (u_price * item.quantity))
                attrs = getattr(item.variant, 'attributes', {}) or {} if item.variant else {}
                color_val = attrs.get('color') or attrs.get('color_name') or ''
                size_val = attrs.get('size') or ''
                items_list.append({
                    'id': str(item.id),
                    'product_name': item.product_name,
                    'quantity': item.quantity,
                    'price': u_price,
                    'unit_price': u_price,
                    'total': t_price,
                    'unit': unit_str,
                    'color': color_val,
                    'size': size_val,
                    'variant_name': attrs.get('name') or '',
                })

            results.append({
                'fulfillment_id': str(so.id),
                'order_id': str(parent.id) if parent else str(so.id),
                'order_number': so.sub_order_number or (parent.order_number if parent else f"ORD-{so.id}"),
                'status': st,
                'parent_order_status': parent.status if parent else st,
                'subtotal': subtotal_val,
                'total_amount': subtotal_val,
                'commission_amount': comm_val,
                'net_payout': net_val,
                'created_at': so.created_at.isoformat() if so.created_at else None,
                'customer_name': customer_name,
                'customer_phone': customer_phone,
                'customer_area': customer_area,
                'delivery_address': delivery_street,
                'delivery_city': delivery_city,
                'payment_method': getattr(parent, 'payment_method', 'COD') if parent else 'COD',
                'payment_status': getattr(parent, 'payment_status', 'UNPAID') if parent else 'UNPAID',
                'notes': notes,
                'items_count': len(items_list),
                'items': items_list
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
        so = None
        if is_valid_uuid(fulfillment_id):
            so = VendorSubOrder.objects.filter(id=fulfillment_id).first()
        if not so:
            so = VendorSubOrder.objects.filter(sub_order_number=fulfillment_id).first()
        if not so:
            return Response({'success': False, 'message': 'Vendor sub-order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if new_status:
            so.status = new_status
            so.save(update_fields=['status', 'updated_at'])
            if new_status in ['PACKED_BY_VENDOR', 'PACKED'] and so.parent_order:
                so.parent_order.status = 'PACKED'
                so.parent_order.save(update_fields=['status', 'updated_at'])
            elif new_status in ['READY_FOR_RIDER_PICKUP', 'READY_FOR_DISPATCH'] and so.parent_order:
                so.parent_order.status = 'READY_FOR_DISPATCH'
                so.parent_order.save(update_fields=['status', 'updated_at'])
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

        has_verified_store = bool(store and store.is_verified) or vendor.stores.filter(is_verified=True).exists()
        is_approved = (vendor.status == VendorStatus.APPROVED) or has_verified_store
        effective_status = 'APPROVED' if is_approved else (vendor.status or 'PENDING')
        approval_status = 'approved' if is_approved else effective_status.lower()

        vendor_data = {
            'id': str(vendor.id),
            'name': vendor.business_name,
            'business_name': vendor.business_name,
            'slug': vendor.slug,
            'status': effective_status,
            'approval_status': approval_status,
            'is_approved': is_approved,
            'is_verified': is_approved,
            'verified': is_approved,
            'kyc_status': 'verified' if is_approved else 'pending',
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
            'store': {
                'id': str(store.id) if store else '',
                'name': store.name if store else vendor.business_name,
                'slug': store.slug if store else vendor.slug,
                'is_verified': is_approved,
                'is_active': store.is_active if store else True,
            } if store else None
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
