from rest_framework import viewsets, permissions, generics, status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema, OpenApiResponse
from .models import CustomerProfile, Address
from .serializers import CustomerProfileSerializer, AddressSerializer

class CustomerProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the authenticated customer's profile.
    """
    serializer_class = CustomerProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = CustomerProfile.objects.get_or_create(user=self.request.user)
        return profile


class CustomerAddressViewSet(viewsets.ModelViewSet):
    """
    Customer address book management across Nepal administrative divisions.
    """
    serializer_class = AddressSerializer

    def get_permissions(self):
        if self.action in ['list']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return Response({'count': 0, 'next': None, 'previous': None, 'results': []}, status=status.HTTP_200_OK)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Address.objects.none()
        if not self.request.user or not self.request.user.is_authenticated:
            return Address.objects.none()
        profile, _ = CustomerProfile.objects.get_or_create(user=self.request.user)
        return Address.objects.filter(customer=profile)

    def perform_create(self, serializer):
        profile, _ = CustomerProfile.objects.get_or_create(user=self.request.user)
        # If this is the customer's first address, make it default shipping
        is_first = not Address.objects.filter(customer=profile).exists()
        is_default = serializer.validated_data.get('is_default_shipping', False) or is_first

        if is_default:
            Address.objects.filter(customer=profile, is_default_shipping=True).update(is_default_shipping=False)

        serializer.save(customer=profile, is_default_shipping=is_default)

    def perform_update(self, serializer):
        profile, _ = CustomerProfile.objects.get_or_create(user=self.request.user)
        is_default = serializer.validated_data.get('is_default_shipping', False)
        if is_default:
            Address.objects.filter(customer=profile, is_default_shipping=True).exclude(id=self.get_object().id).update(is_default_shipping=False)
        serializer.save()

    @extend_schema(
        summary="Customer: Set Default Address",
        description="Designates the target address as the default shipping or billing address.",
        responses={200: OpenApiResponse(description="Address set as default")}
    )
    @action(detail=True, methods=['post'], url_path='set-default')
    def set_default(self, request, pk=None):
        address = self.get_object()
        profile = address.customer

        target_type = request.data.get('type', 'shipping')
        if target_type == 'billing':
            Address.objects.filter(customer=profile, is_default_billing=True).update(is_default_billing=False)
            address.is_default_billing = True
        else:
            Address.objects.filter(customer=profile, is_default_shipping=True).update(is_default_shipping=False)
            address.is_default_shipping = True

        address.save()
        return Response({'success': True, 'message': f'Address set as default {target_type}.'}, status=status.HTTP_200_OK)


from rest_framework.views import APIView
from django.db.models import Q
from apps.catalogue.models import Product
from apps.catalogue.serializers import ProductListSerializer

class WishlistListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user = request.user if request.user.is_authenticated else None
        session_key = request.headers.get('X-Session-Key') or 'guest'
        from .models import WishlistItem

        if user:
            items = WishlistItem.objects.filter(user=user)
        elif session_key:
            items = WishlistItem.objects.filter(session_key=session_key)
        else:
            items = WishlistItem.objects.none()

        products = [item.product for item in items.select_related('product', 'product__category', 'product__vendor', 'product__store')]
        serialized = ProductListSerializer(products, many=True, context={'request': request}).data
        return Response({
            'count': len(serialized),
            'next': None,
            'previous': None,
            'results': serialized,
            'data': serialized,
            'success': True
        })


class WishlistToggleView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({'success': False, 'message': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # resolve product by id or slug
        import uuid
        product = None
        try:
            val_uuid = uuid.UUID(str(product_id))
            product = Product.objects.filter(id=val_uuid).first()
        except (ValueError, TypeError):
            pass
        if not product:
            product = Product.objects.filter(slug=product_id).first()
        if not product:
            return Response({'success': False, 'message': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user if request.user.is_authenticated else None
        session_key = request.headers.get('X-Session-Key') or 'guest'
        from .models import WishlistItem

        filter_kwargs = {'product': product}
        if user:
            filter_kwargs['user'] = user
        else:
            filter_kwargs['session_key'] = session_key

        existing = WishlistItem.objects.filter(**filter_kwargs).first()
        if existing:
            existing.delete()
            is_wishlisted = False
        else:
            WishlistItem.objects.create(user=user, session_key=session_key if not user else None, product=product)
            is_wishlisted = True

        owner_kwargs = {'user': user} if user else {'session_key': session_key}
        wishlist_ids = list(WishlistItem.objects.filter(**owner_kwargs).values_list('product_id', flat=True))
        wishlist_ids = [str(wid) for wid in wishlist_ids]

        return Response({
            'product_id': str(product.id),
            'is_wishlisted': is_wishlisted,
            'wishlist_ids': wishlist_ids,
            'success': True
        })


