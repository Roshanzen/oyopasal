from django.db import transaction
from django.db.models import Q, Prefetch, Count
from django.utils import timezone
from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.common.permissions import IsVendor, IsSuperAdmin, IsOperationsAdmin, CanManageCategories
from apps.catalogue.models import (
    Category,
    Brand,
    Product,
    ProductVariant,
    ProductStatus,
    ProductModerationLog
)
from apps.catalogue.serializers import (
    CategoryTreeSerializer,
    CategoryCreateSerializer,
    BrandSerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateUpdateSerializer,
    ProductModerationActionSerializer,
)

# -------------------------------------------------------------
# Public Catalogue Views
# -------------------------------------------------------------

class PublicCategoryListView(generics.ListCreateAPIView):
    """
    GET: List root categories with their active subcategories ordered by ordering ascending.
    POST: Create a new category or subcategory with auto-generated slug and instant persistence.
    """
    queryset = Category.objects.filter(
        is_active=True,
        parent__isnull=True
    ).prefetch_related(
        Prefetch(
            'subcategories',
            queryset=Category.objects.filter(is_active=True).order_by('ordering', 'name')
        )
    ).order_by('ordering', 'name')
    permission_classes = [CanManageCategories]
    pagination_class = None

    def get_queryset(self):
        return Category.objects.filter(
            is_active=True,
            parent__isnull=True
        ).prefetch_related(
            Prefetch(
                'subcategories',
                queryset=Category.objects.filter(is_active=True).order_by('ordering', 'name')
            )
        ).order_by('ordering', 'name').distinct()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CategoryCreateSerializer
        return CategoryTreeSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        categories = list(queryset)

        # Batch compute dynamic product counts across root categories and subcategories in 1 query
        cat_map = {c.id: c.get_descendant_ids() for c in categories}
        all_cat_ids = set()
        for ids in cat_map.values():
            all_cat_ids.update(ids)

        counts = (
            Product.objects.filter(
                category_id__in=all_cat_ids,
                is_deleted=False,
                status=ProductStatus.APPROVED,
                store__is_active=True
            )
            .values('category_id')
            .annotate(total=Count('id'))
        )
        cat_count_lookup = {item['category_id']: item['total'] for item in counts}

        for c in categories:
            c.product_count = sum(cat_count_lookup.get(cid, 0) for cid in cat_map.get(c.id, []))
            c.item_count = c.product_count
            subcategories = getattr(c, '_prefetched_objects_cache', {}).get('subcategories', [])
            for sub in subcategories:
                sub.product_count = cat_count_lookup.get(sub.id, 0)
                sub.item_count = sub.product_count

        serializer = self.get_serializer(categories, many=True, context={'request': request})
        return Response(serializer.data)

    @extend_schema(summary="List or Create Categories")
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        out_serializer = CategoryTreeSerializer(category, context={'request': request})
        return Response({
            'success': True,
            'message': f"Category '{category.name}' created successfully.",
            'category': out_serializer.data
        }, status=status.HTTP_201_CREATED)


class PublicCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete category details with active subcategories."""
    queryset = Category.objects.all().prefetch_related('subcategories')
    serializer_class = CategoryTreeSerializer
    lookup_field = 'slug'
    permission_classes = [CanManageCategories]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return CategoryCreateSerializer
        return CategoryTreeSerializer

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field) or self.kwargs.get('slug')
        from apps.common.utils import is_valid_uuid
        cat = Category.objects.filter(slug=lookup).first()
        if not cat and is_valid_uuid(lookup):
            cat = Category.objects.filter(id=lookup).first()
        if not cat:
            from rest_framework.exceptions import NotFound
            raise NotFound("Category not found.")
        return cat

    @extend_schema(summary="Retrieve Category Details")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PublicBrandListView(generics.ListAPIView):
    """List all active brands."""
    queryset = Brand.objects.filter(is_active=True)
    serializer_class = BrandSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name']

    @extend_schema(summary="List Public Brands")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PublicProductListView(generics.ListAPIView):
    """
    Search, filter, and paginate approved marketplace products.
    Supports filtering by category, brand, vendor, store, price range, and featured status.
    """
    serializer_class = ProductListSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'short_description', 'description', 'base_sku', 'brand__name', 'category__name']
    ordering_fields = ['created_at', 'name']

    def get_queryset(self):
        qs = Product.objects.filter(
            status=ProductStatus.APPROVED,
            store__is_active=True
        ).exclude(
            vendor__status__in=['SUSPENDED', 'REJECTED']
        ).select_related('category', 'brand', 'vendor', 'store').prefetch_related(
            'variants', 'variants__images', 'variants__inventory_records', 'images'
        )

        # Filter parameters
        category_slug = self.request.query_params.get('category')
        if category_slug:
            target_cat = Category.objects.filter(slug=category_slug, is_active=True).first()
            if target_cat:
                qs = qs.filter(category_id__in=target_cat.get_descendant_ids())
            else:
                qs = qs.none()

        brand_slug = self.request.query_params.get('brand')
        if brand_slug:
            qs = qs.filter(brand__slug=brand_slug)

        store_slug = self.request.query_params.get('store')
        if store_slug:
            from apps.common.utils import is_valid_uuid
            if is_valid_uuid(store_slug):
                qs = qs.filter(Q(store_id=store_slug) | Q(store__slug=store_slug))
            else:
                qs = qs.filter(store__slug=store_slug)

        vendor_slug = self.request.query_params.get('vendor')
        if vendor_slug:
            from apps.common.utils import is_valid_uuid
            if is_valid_uuid(vendor_slug):
                qs = qs.filter(Q(vendor_id=vendor_slug) | Q(vendor__slug=vendor_slug) | Q(store_id=vendor_slug))
            else:
                qs = qs.filter(Q(vendor__slug=vendor_slug) | Q(store__slug=vendor_slug) | Q(vendor__business_name__iexact=vendor_slug))

        is_featured = self.request.query_params.get('is_featured')
        if is_featured is not None:
            qs = qs.filter(is_featured=is_featured.lower() == 'true')

        min_price = self.request.query_params.get('min_price')
        if min_price:
            qs = qs.filter(variants__selling_price__gte=min_price, variants__is_active=True)

        max_price = self.request.query_params.get('max_price')
        if max_price:
            qs = qs.filter(variants__selling_price__lte=max_price, variants__is_active=True)

        in_stock = self.request.query_params.get('in_stock')
        if in_stock and in_stock.lower() == 'true':
            from apps.inventory.models import InventoryItem
            from django.db.models import F
            in_stock_variants = InventoryItem.objects.filter(
                quantity_on_hand__gt=F('quantity_reserved')
            ).values_list('variant_id', flat=True)
            qs = qs.filter(variants__id__in=in_stock_variants, variants__is_active=True)

        has_discount = self.request.query_params.get('has_discount')
        if has_discount and has_discount.lower() == 'true':
            from django.db.models import F
            qs = qs.filter(variants__regular_price__gt=F('variants__selling_price'), variants__is_active=True)

        ordering = self.request.query_params.get('ordering', '-created_at')
        if ordering == 'price_asc':
            qs = qs.order_by('variants__selling_price')
        elif ordering == 'price_desc':
            qs = qs.order_by('-variants__selling_price')
        elif ordering == 'name':
            qs = qs.order_by('name')
        elif ordering == 'popularity':
            from django.db.models import Count
            qs = qs.annotate(order_count=Count('variants__order_items')).order_by('-order_count', '-created_at')
        else:
            qs = qs.order_by('-created_at')

        return qs.distinct()

    @extend_schema(
        summary="Search & Filter Public Products",
        parameters=[
            OpenApiParameter('category', str, description="Filter by Category Slug"),
            OpenApiParameter('brand', str, description="Filter by Brand Slug"),
            OpenApiParameter('store', str, description="Filter by Store Slug"),
            OpenApiParameter('is_featured', bool, description="Filter featured items"),
            OpenApiParameter('min_price', float, description="Minimum price filter"),
            OpenApiParameter('max_price', float, description="Maximum price filter"),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PublicProductDetailView(generics.RetrieveAPIView):
    """Retrieve full product details for approved items by UUID or slug."""
    serializer_class = ProductDetailSerializer
    lookup_field = 'slug'
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Product.objects.filter(
            status=ProductStatus.APPROVED,
            store__is_active=True
        ).select_related('category', 'brand', 'vendor', 'store').prefetch_related(
            'variants', 'variants__images', 'variants__inventory_records', 'images'
        )

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field)
        qs = self.get_queryset()
        obj = None
        try:
            import uuid
            uuid.UUID(str(lookup))
            obj = qs.filter(id=lookup).first()
        except (ValueError, AttributeError):
            pass
        if not obj:
            obj = qs.filter(slug=lookup).first()
        if not obj:
            from django.http import Http404
            raise Http404("No product found matching the given identifier.")
        self.check_object_permissions(self.request, obj)
        return obj

    @extend_schema(summary="Retrieve Product Details")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class ProductAutocompleteView(APIView):
    """Search autocomplete for navbar dropdown returning matching products and categories."""
    permission_classes = [AllowAny]

    @extend_schema(summary="Product Search Autocomplete Suggestions")
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if not q:
            return Response({'suggestions': [], 'categories': []})

        products = Product.objects.filter(
            status=ProductStatus.APPROVED,
            store__is_active=True,
            name__icontains=q
        ).select_related('category').prefetch_related('variants', 'images')[:8]

        suggestions = []
        for p in products:
            active_vars = [v for v in p.variants.all() if v.is_active]
            variant = active_vars[0] if active_vars else None
            imgs = list(p.images.all())
            img = next((i for i in imgs if i.is_primary), None) or (imgs[0] if imgs else None)
            img_url = (img.image_url if getattr(img, 'image_url', None) else (img.image.url if getattr(img, 'image', None) else '')) if img else ''
            suggestions.append({
                'id': str(p.id),
                'name': p.name,
                'category': p.category.name if p.category else 'General',
                'price': float(variant.selling_price) if variant else 0.0,
                'image_url': img_url,
                'unit': getattr(p, 'unit', 'piece') or 'piece'
            })

        categories = Category.objects.filter(
            is_active=True,
            name__icontains=q
        )[:5]
        categories_found = [{'id': str(c.id), 'name': c.name, 'slug': c.slug} for c in categories]

        return Response({
            'suggestions': suggestions,
            'categories': categories_found
        })


class SimilarProductsView(generics.ListAPIView):
    """Return similar products based on the requested product's category."""
    permission_classes = [AllowAny]
    serializer_class = ProductListSerializer

    def get_queryset(self):
        lookup = self.kwargs.get('pk') or self.kwargs.get('slug') or self.kwargs.get('id')
        base_product = None
        try:
            import uuid
            uuid.UUID(str(lookup))
            base_product = Product.objects.filter(id=lookup).first()
        except (ValueError, AttributeError):
            pass
        if not base_product:
            base_product = Product.objects.filter(slug=lookup).first()

        qs = Product.objects.filter(status=ProductStatus.APPROVED, store__is_active=True)
        if base_product and base_product.category:
            qs = qs.filter(category=base_product.category).exclude(id=base_product.id)

        return qs.select_related('category', 'brand', 'vendor', 'store').prefetch_related('variants', 'images')[:6]


class ProductReviewsCombinedView(APIView):
    """Fetch reviews for a product or submit a new review."""
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, product_id):
        from apps.reviews.models import ProductReview
        from apps.reviews.serializers import ProductReviewSerializer
        from django.db.models import Avg

        reviews = ProductReview.objects.filter(
            Q(product__id=product_id) | Q(product__slug=product_id),
            is_approved=True
        ).select_related('user').order_by('-created_at')

        avg = reviews.aggregate(a=Avg('rating'))['a'] or 5.0
        serializer = ProductReviewSerializer(reviews, many=True)
        return Response({
            'count': len(serializer.data),
            'average_rating': round(float(avg), 1),
            'results': serializer.data
        })

    def post(self, request, product_id):
        from apps.reviews.models import ProductReview
        from apps.reviews.serializers import CreateReviewSerializer, ProductReviewSerializer
        from apps.common.utils import is_valid_uuid
        product = Product.objects.filter(id=product_id).first() if is_valid_uuid(product_id) else Product.objects.filter(slug=product_id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        review, _ = ProductReview.objects.update_or_create(
            user=user,
            product=product,
            defaults={
                'rating': serializer.validated_data['rating'],
                'comment': serializer.validated_data['comment'],
                'title': serializer.validated_data.get('title', ''),
                'is_approved': True
            }
        )
        return Response({
            'success': True,
            'review': ProductReviewSerializer(review).data
        }, status=status.HTTP_201_CREATED)


# -------------------------------------------------------------
# Vendor Product Management Views
# -------------------------------------------------------------

class VendorProductListCreateView(generics.ListCreateAPIView):
    """List own products or create a new draft product."""
    permission_classes = [IsVendor]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'base_sku']
    ordering_fields = ['created_at', 'name', 'status']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProductCreateUpdateSerializer
        return ProductListSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'vendor_profile'):
            qs = Product.objects.filter(vendor=user.vendor_profile).select_related(
                'category', 'brand', 'vendor', 'store'
            ).prefetch_related('variants', 'images')

            status_param = self.request.query_params.get('status')
            if status_param:
                qs = qs.filter(status=status_param.upper())
            return qs
        return Product.objects.none()

    @extend_schema(summary="List Vendor's Products")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Create Draft Product (Vendor)")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class VendorProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or soft-delete vendor's product."""
    permission_classes = [IsVendor]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'vendor_profile'):
            return Product.objects.filter(vendor=user.vendor_profile).select_related(
                'category', 'brand', 'vendor', 'store'
            ).prefetch_related('variants', 'images')
        return Product.objects.none()

    @extend_schema(summary="Retrieve Vendor Product Details")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Update Vendor Product")
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(summary="Delete Product")
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class VendorProductSubmitView(APIView):
    """Submit a draft or rejected product for administrator review."""
    permission_classes = [IsVendor]

    @extend_schema(
        summary="Submit Product for Moderation",
        description="Transition product status from DRAFT or REJECTED to SUBMITTED for admin approval.",
        request=None,
        responses={200: dict}
    )
    def post(self, request, id):
        user = request.user
        if not hasattr(user, 'vendor_profile'):
            return Response({'success': False, 'error': {'code': 'FORBIDDEN', 'message': 'Vendor profile required.'}}, status=status.HTTP_403_FORBIDDEN)

        try:
            product = Product.objects.get(id=id, vendor=user.vendor_profile)
        except Product.DoesNotExist:
            return Response({'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'Product not found.'}}, status=status.HTTP_404_NOT_FOUND)

        if product.status not in [ProductStatus.DRAFT, ProductStatus.REJECTED]:
            return Response({
                'success': False,
                'error': {
                    'code': 'INVALID_STATUS',
                    'message': f'Cannot submit product currently in {product.status} state.'
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            prev_status = product.status
            product.status = ProductStatus.SUBMITTED
            product.rejection_reason = ''
            product.save(update_fields=['status', 'rejection_reason', 'updated_at'])

            ProductModerationLog.objects.create(
                product=product,
                action='SUBMIT',
                previous_status=prev_status,
                new_status=ProductStatus.SUBMITTED,
                reason='Submitted by vendor for review',
                action_by=user
            )

        return Response({
            'success': True,
            'message': 'Product submitted successfully for administrator moderation.',
            'data': {'product_id': str(product.id), 'status': product.status}
        })


# -------------------------------------------------------------
# Admin Moderation Views
# -------------------------------------------------------------

class AdminProductModerationListView(generics.ListAPIView):
    """List products pending administrator approval (SUBMITTED)."""
    permission_classes = [IsOperationsAdmin | IsSuperAdmin]
    serializer_class = ProductListSerializer

    def get_queryset(self):
        return Product.objects.filter(status=ProductStatus.SUBMITTED).select_related(
            'category', 'brand', 'vendor', 'store'
        ).prefetch_related('variants', 'images')

    @extend_schema(summary="List Pending Products for Moderation (Admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class AdminProductModerateView(APIView):
    """Approve, Reject, or Suspend a product."""
    permission_classes = [IsOperationsAdmin | IsSuperAdmin]

    @extend_schema(
        summary="Moderate Product (Approve / Reject / Suspend)",
        request=ProductModerationActionSerializer,
        responses={200: dict}
    )
    def post(self, request, id):
        serializer = ProductModerationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            product = Product.objects.get(id=id)
        except Product.DoesNotExist:
            return Response({'success': False, 'error': {'code': 'NOT_FOUND', 'message': 'Product not found.'}}, status=status.HTTP_404_NOT_FOUND)

        action = serializer.validated_data['action']
        reason = serializer.validated_data.get('reason', '')
        prev_status = product.status

        target_status_map = {
            'APPROVE': ProductStatus.APPROVED,
            'REJECT': ProductStatus.REJECTED,
            'SUSPEND': ProductStatus.SUSPENDED,
        }
        new_status = target_status_map[action]

        with transaction.atomic():
            product.status = new_status
            if action == 'REJECT':
                product.rejection_reason = reason
            elif action == 'APPROVE':
                product.rejection_reason = ''
            product.moderated_by = request.user
            product.moderated_at = timezone.now()
            product.save(update_fields=['status', 'rejection_reason', 'moderated_by', 'moderated_at', 'updated_at'])

            ProductModerationLog.objects.create(
                product=product,
                action=action,
                previous_status=prev_status,
                new_status=new_status,
                reason=reason,
                action_by=request.user
            )

        return Response({
            'success': True,
            'message': f"Product {product.name} successfully updated to {new_status}.",
            'data': {
                'product_id': str(product.id),
                'status': product.status,
                'rejection_reason': product.rejection_reason
            }
        })
