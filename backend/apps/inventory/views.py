from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.common.permissions import IsVendor, IsOperationsAdmin, IsSuperAdmin
from apps.inventory.models import InventoryItem, StockMovement
from apps.inventory.serializers import (
    InventoryItemSerializer,
    StockAdjustmentSerializer,
    StockMovementSerializer
)
from apps.inventory.services import InventoryService

class VendorInventoryListView(generics.ListCreateAPIView):
    """
    List inventory levels across warehouses for the vendor's products,
    or link a product variant to a warehouse inventory record.
    """
    serializer_class = InventoryItemSerializer
    permission_classes = [IsVendor | IsSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['variant__sku', 'variant__product__name', 'warehouse__code']
    ordering_fields = ['quantity_on_hand', 'variant__sku']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return InventoryItem.objects.none()
        user = self.request.user
        if not user or not user.is_authenticated:
            return InventoryItem.objects.none()
        if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']:
            qs = InventoryItem.objects.all()
        elif hasattr(user, 'vendor_profile'):
            qs = InventoryItem.objects.filter(variant__product__vendor=user.vendor_profile)
        else:
            return InventoryItem.objects.none()

        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            qs = qs.filter(warehouse_id=warehouse_id)

        low_stock_only = self.request.query_params.get('low_stock')
        if low_stock_only and low_stock_only.lower() == 'true':
            # Low stock condition: available <= reorder_threshold
            # (quantity_on_hand - quantity_reserved) <= reorder_threshold
            from django.db.models import F
            qs = qs.filter(quantity_on_hand__lte=F('quantity_reserved') + F('reorder_threshold'))

        return qs.select_related('warehouse', 'variant', 'variant__product')

    @extend_schema(
        summary="List Inventory Items",
        parameters=[
            OpenApiParameter('warehouse', str, description="Filter by Warehouse ID"),
            OpenApiParameter('low_stock', bool, description="Show only items below reorder threshold"),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Create Inventory Record for Variant")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class VendorInventoryDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update threshold settings (reorder threshold, safety stock) of an inventory item."""
    serializer_class = InventoryItemSerializer
    permission_classes = [IsVendor | IsSuperAdmin]
    lookup_field = 'id'

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return InventoryItem.objects.none()
        user = self.request.user
        if not user or not user.is_authenticated:
            return InventoryItem.objects.none()
        if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']:
            return InventoryItem.objects.all()
        if hasattr(user, 'vendor_profile'):
            return InventoryItem.objects.filter(variant__product__vendor=user.vendor_profile)
        return InventoryItem.objects.none()

    @extend_schema(summary="Retrieve Inventory Item Detail")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Update Inventory Thresholds")
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class StockAdjustmentView(APIView):
    """Execute an atomic manual stock adjustment with mandatory audit logging."""
    permission_classes = [IsVendor | IsSuperAdmin]

    @extend_schema(
        summary="Adjust Stock Quantity",
        description="Add or reduce physical stock units with audit movement log and balance computation.",
        request=StockAdjustmentSerializer,
        responses={200: InventoryItemSerializer}
    )
    def post(self, request, id):
        serializer = StockAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        try:
            if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']:
                item = InventoryItem.objects.get(id=id)
            else:
                item = InventoryItem.objects.get(id=id, variant__product__vendor=user.vendor_profile)
        except InventoryItem.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Inventory item not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            updated_item = InventoryService.adjust_stock(
                inventory_item_id=item.id,
                delta=serializer.validated_data['delta'],
                movement_type=serializer.validated_data['movement_type'],
                reason=serializer.validated_data['reason'],
                user=user,
                reference_id=serializer.validated_data.get('reference_id', '')
            )
            return Response({
                'success': True,
                'message': 'Stock adjusted successfully.',
                'data': InventoryItemSerializer(updated_item).data
            })
        except ValueError as e:
            return Response({
                'success': False,
                'error': {'code': 'ADJUSTMENT_ERROR', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class LowStockAlertsView(generics.ListAPIView):
    """List all inventory items currently at or below their reorder safety thresholds."""
    serializer_class = InventoryItemSerializer
    permission_classes = [IsVendor | IsSuperAdmin]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return InventoryItem.objects.none()
        from django.db.models import F
        user = self.request.user
        if not user or not user.is_authenticated:
            return InventoryItem.objects.none()
        if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']:
            qs = InventoryItem.objects.all()
        elif hasattr(user, 'vendor_profile'):
            qs = InventoryItem.objects.filter(variant__product__vendor=user.vendor_profile)
        else:
            return InventoryItem.objects.none()

        return qs.filter(
            quantity_on_hand__lte=F('quantity_reserved') + F('reorder_threshold')
        ).select_related('warehouse', 'variant', 'variant__product')

    @extend_schema(summary="List Low-Stock Alerts")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class StockMovementHistoryView(generics.ListAPIView):
    """Audit log of historical movements for an inventory item."""
    serializer_class = StockMovementSerializer
    permission_classes = [IsVendor | IsSuperAdmin]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return StockMovement.objects.none()
        item_id = self.kwargs.get('id')
        user = self.request.user
        if not user or not user.is_authenticated:
            return StockMovement.objects.none()
        if user.is_superuser or user.role in ['SUPER_ADMIN', 'OPERATIONS_ADMIN']:
            return StockMovement.objects.filter(inventory_item_id=item_id).select_related('created_by', 'inventory_item')
        if hasattr(user, 'vendor_profile'):
            return StockMovement.objects.filter(
                inventory_item_id=item_id,
                inventory_item__variant__product__vendor=user.vendor_profile
            ).select_related('created_by', 'inventory_item')
        return StockMovement.objects.none()

    @extend_schema(summary="List Stock Movement History")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
