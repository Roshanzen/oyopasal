from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema

from apps.common.permissions import IsVendor, IsSuperAdmin, IsOperationsAdmin
from apps.stores.models import Store
from apps.stores.serializers import (
    StoreDetailSerializer,
    StoreListSerializer,
    StoreCreateUpdateSerializer
)

class PublicStoreListView(generics.ListAPIView):
    """List all active and verified marketplace stores."""
    queryset = Store.objects.filter(
        is_active=True,
        is_verified=True,
        vendor__status='APPROVED'
    ).select_related('vendor')
    serializer_class = StoreListSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'vendor__business_name']
    ordering_fields = ['name', 'created_at']

    @extend_schema(summary="List Active Marketplace Stores")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class PublicStoreDetailView(generics.RetrieveAPIView):
    """Retrieve public storefront profile by unique slug, id, or linked vendor slug/id."""
    serializer_class = StoreDetailSerializer
    lookup_field = 'slug'
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Store.objects.filter(
            is_active=True,
            is_verified=True,
            vendor__status='APPROVED'
        ).select_related('vendor')

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field) or self.kwargs.get('slug')
        from django.db.models import Q
        from apps.common.utils import is_valid_uuid
        from apps.vendors.models import VendorProfile

        base_qs = Store.objects.filter(
            is_active=True,
            is_verified=True,
            vendor__status='APPROVED'
        ).select_related('vendor')

        store = base_qs.filter(slug=lookup).first()
        if not store and is_valid_uuid(lookup):
            store = base_qs.filter(id=lookup).first()
        if not store:
            store = base_qs.filter(vendor__slug=lookup).first()
        if not store and is_valid_uuid(lookup):
            store = base_qs.filter(vendor__id=lookup).first()
        if not store:
            store = base_qs.filter(
                Q(name__iexact=lookup) | Q(vendor__business_name__iexact=lookup)
            ).first()

        # If not found among verified stores, check if vendor is approved
        if not store:
            vp = None
            if is_valid_uuid(lookup):
                vp = VendorProfile.objects.filter(id=lookup, status='APPROVED').first()
            if not vp:
                vp = VendorProfile.objects.filter(slug=lookup, status='APPROVED').first()
            if not vp:
                vp = VendorProfile.objects.filter(business_name__iexact=lookup, status='APPROVED').first()

            if vp:
                store = vp.stores.filter(is_active=True, is_verified=True).first()
                if not store:
                    store = vp.stores.filter(is_active=True).first()
                    if store:
                        store.is_verified = True
                        store.save(update_fields=['is_verified', 'updated_at'])

        if not store:
            from rest_framework.exceptions import NotFound
            raise NotFound("Store profile not found or pending verification.")
        return store

    @extend_schema(summary="Retrieve Public Store Profile")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class VendorStoreListCreateView(generics.ListCreateAPIView):
    """List or create storefronts for the authenticated vendor."""
    permission_classes = [IsVendor]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StoreCreateUpdateSerializer
        return StoreDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'vendor_profile'):
            return Store.objects.filter(vendor=user.vendor_profile)
        return Store.objects.none()

    @extend_schema(summary="List Vendor's Own Stores")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Create New Storefront")
    def perform_create(self, serializer):
        from apps.subscriptions.services import SubscriptionService, SubscriptionLimitExceededError
        from rest_framework.exceptions import ValidationError
        try:
            SubscriptionService.enforce_store_limit(self.request.user.vendor_profile)
        except SubscriptionLimitExceededError as e:
            raise ValidationError({'detail': str(e)})
        serializer.save(vendor=self.request.user.vendor_profile)


class VendorStoreDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or soft-delete a specific store owned by the vendor."""
    permission_classes = [IsVendor]
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StoreCreateUpdateSerializer
        return StoreDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'vendor_profile'):
            return Store.objects.filter(vendor=user.vendor_profile)
        return Store.objects.none()

    @extend_schema(summary="Retrieve Vendor Store Detail")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Update Vendor Store Profile")
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(summary="Delete Storefront")
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


class CurrentVendorStoreView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update the authenticated vendor's primary store profile.
    Auto-initializes the primary store from vendor profile if one does not exist yet.
    """
    permission_classes = [IsVendor]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return StoreCreateUpdateSerializer
        return StoreDetailSerializer

    def get_object(self):
        user = self.request.user
        vendor = user.vendor_profile
        store = vendor.stores.filter(is_active=True).first() or vendor.stores.first()
        if not store:
            from django.utils.text import slugify
            base_slug = slugify(vendor.business_name) or f"store-{str(vendor.id)[:8]}"
            slug = base_slug
            counter = 1
            while Store.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            store = Store.objects.create(
                vendor=vendor,
                name=vendor.business_name,
                slug=slug,
                description=vendor.store_description or f"Official storefront of {vendor.business_name}",
                contact_email=getattr(user, 'email', ''),
                is_active=True,
                is_verified=False
            )
        return store

    @extend_schema(summary="Retrieve Current Vendor Store")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Update Current Vendor Store")
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(summary="Update Current Vendor Store (Full)")
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)


