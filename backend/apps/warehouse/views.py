from rest_framework import generics, filters
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsVendor, IsOperationsAdmin, IsSuperAdmin
from apps.warehouse.models import Warehouse
from apps.warehouse.serializers import WarehouseSerializer

class WarehouseListCreateView(generics.ListCreateAPIView):
    """List accessible warehouses or create a new warehouse facility."""
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'city', 'district']
    ordering_fields = ['name', 'code', 'created_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Warehouse.objects.none()
        user = self.request.user
        if not user or not user.is_authenticated:
            return Warehouse.objects.none()
        if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN']:
            return Warehouse.objects.all()
        if hasattr(user, 'vendor_profile'):
            # Return vendor's own warehouses as well as platform central hubs (vendor__isnull=True)
            return Warehouse.objects.filter(vendor=user.vendor_profile) | Warehouse.objects.filter(vendor__isnull=True)
        return Warehouse.objects.none()

    @extend_schema(summary="List Warehouses")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Create Warehouse")
    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'vendor_profile'):
            serializer.save(vendor=user.vendor_profile)
        else:
            serializer.save(vendor=None)


class WarehouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or soft-delete warehouse facility."""
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']:
            return Warehouse.objects.all()
        if hasattr(user, 'vendor_profile'):
            return Warehouse.objects.filter(vendor=user.vendor_profile)
        return Warehouse.objects.none()

    @extend_schema(summary="Retrieve Warehouse Details")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Update Warehouse Details")
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(summary="Delete Warehouse")
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)
