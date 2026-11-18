from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsVendor, IsSuperAdmin, IsFinanceAdmin
from apps.vendors.models import VendorProfile
from apps.settlements.models import VendorSettlement, SettlementStatus
from apps.settlements.serializers import (
    VendorSettlementSerializer,
    GenerateSettlementSerializer,
    MarkSettlementPaidSerializer
)
from apps.settlements.services import SettlementService

class VendorSettlementListView(generics.ListAPIView):
    """Vendor view of their own settlement payout batches and financial history."""
    serializer_class = VendorSettlementSerializer
    permission_classes = [IsVendor]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'net_payout']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VendorSettlement.objects.none()
        user = self.request.user
        if not hasattr(user, 'vendor_profile'):
            return VendorSettlement.objects.none()
        return VendorSettlement.objects.filter(vendor=user.vendor_profile).prefetch_related('items')

    @extend_schema(summary="List Vendor Settlements")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class AdminGenerateSettlementView(APIView):
    """Finance Admin generates a consolidated settlement batch for eligible vendor deliveries."""
    permission_classes = [IsSuperAdmin | IsFinanceAdmin]

    @extend_schema(
        summary="Generate Vendor Settlement Batch",
        request=GenerateSettlementSerializer,
        responses={201: VendorSettlementSerializer}
    )
    def post(self, request):
        serializer = GenerateSettlementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            vendor = VendorProfile.objects.get(id=serializer.validated_data['vendor_id'])
        except VendorProfile.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Vendor profile not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            settlement = SettlementService.generate_settlement_for_vendor(vendor, user=request.user)
            return Response({
                'success': True,
                'message': f"Settlement batch generated for {vendor.business_name}",
                'data': VendorSettlementSerializer(settlement).data
            }, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response({
                'success': False,
                'error': {'code': 'SETTLEMENT_ERROR', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class AdminMarkSettlementPaidView(APIView):
    """Finance Admin records bank payout reference for an approved settlement batch."""
    permission_classes = [IsSuperAdmin | IsFinanceAdmin]

    @extend_schema(
        summary="Mark Settlement Paid",
        request=MarkSettlementPaidSerializer,
        responses={200: VendorSettlementSerializer}
    )
    def post(self, request, id):
        serializer = MarkSettlementPaidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            settlement = SettlementService.mark_settlement_paid(
                settlement_id=id,
                bank_reference=serializer.validated_data['bank_reference'],
                user=request.user
            )
            return Response({
                'success': True,
                'message': f"Settlement {settlement.settlement_number} marked as PAID.",
                'data': VendorSettlementSerializer(settlement).data
            })
        except VendorSettlement.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Settlement not found.'}
            }, status=status.HTTP_404_NOT_FOUND)


class AdminSettlementListView(generics.ListAPIView):
    """Super Admin / Finance view of all vendor settlements across the platform."""
    serializer_class = VendorSettlementSerializer
    permission_classes = [IsSuperAdmin | IsFinanceAdmin]
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['settlement_number', 'vendor__business_name', 'bank_reference']
    ordering_fields = ['created_at', 'net_payout', 'status']

    def get_queryset(self):
        qs = VendorSettlement.objects.select_related('vendor').prefetch_related('items').all()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        vendor_id = self.request.query_params.get('vendor_id')
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)
        return qs

    @extend_schema(summary="List All Settlements (Admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


