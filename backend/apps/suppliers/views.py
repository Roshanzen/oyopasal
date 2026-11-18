from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics, viewsets
from drf_spectacular.utils import extend_schema, OpenApiResponse
from apps.common.permissions import IsSupplier
from .models import SupplierProfile, SupplierDocument, SupplierStaffMember
from .services import SupplierDashboardService
from .serializers import (
    SupplierProfileSerializer,
    SupplierDocumentSerializer,
    SupplierDashboardOverviewResponseSerializer,
    SupplierVerificationSerializer,
    SupplierStaffMemberSerializer,
)

class SupplierProfileView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update wholesale supplier profile, commercial credit terms, and bank details.
    """
    serializer_class = SupplierProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupplier]

    def get_object(self):
        return self.request.user.supplier_profile


class SupplierDocumentUploadView(generics.ListCreateAPIView):
    """
    Upload and list commercial business registration documents for supplier verification.
    """
    serializer_class = SupplierDocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupplier]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SupplierDocument.objects.none()
        return SupplierDocument.objects.filter(supplier=self.request.user.supplier_profile)

    def perform_create(self, serializer):
        serializer.save(supplier=self.request.user.supplier_profile)


class SupplierDashboardOverviewView(APIView):
    """
    Wholesale supplier operations dashboard: RFQs, active quotations, purchase orders pipeline, and receivables.
    """
    permission_classes = [permissions.IsAuthenticated, IsSupplier]

    @extend_schema(
        summary="Supplier: Dashboard Overview KPIs",
        description="Consolidates catalog status, quotation pipeline, purchase orders, and invoice receivables.",
        responses={200: SupplierDashboardOverviewResponseSerializer}
    )
    def get(self, request, *args, **kwargs):
        supplier = request.user.supplier_profile
        data = SupplierDashboardService.get_overview_metrics(supplier)
        serializer = SupplierDashboardOverviewResponseSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminSupplierKYCListView(generics.ListAPIView):
    """
    List suppliers with verification documents for administrative review.
    """
    serializer_class = SupplierProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SupplierProfile.objects.none()
        from apps.accounts.models import UserRole
        if self.request.user.role not in [UserRole.SUPER_ADMIN, UserRole.OPERATIONS_ADMIN]:
            return SupplierProfile.objects.none()
        status_filter = self.request.query_params.get('status', 'PENDING')
        return SupplierProfile.objects.filter(status=status_filter).prefetch_related('documents')


class AdminSupplierVerifyView(APIView):
    """
    Super Admin endpoint to verify and approve/reject wholesale supplier applications.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary="Admin: Verify Supplier KYC",
        description="Approves or rejects a supplier organization with audit logging.",
        request=SupplierVerificationSerializer,
        responses={200: OpenApiResponse(description="Supplier verification updated")}
    )
    def post(self, request, pk, *args, **kwargs):
        from apps.accounts.models import UserRole
        from apps.audit.services import AuditService
        from apps.audit.models import AuditAction

        if request.user.role not in [UserRole.SUPER_ADMIN, UserRole.OPERATIONS_ADMIN]:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supplier = SupplierProfile.objects.get(id=pk)
        except SupplierProfile.DoesNotExist:
            return Response({'error': 'Supplier not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SupplierVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        rejection_reason = serializer.validated_data.get('rejection_reason', '')

        old_status = supplier.status
        supplier.status = new_status
        supplier.rejection_reason = rejection_reason
        supplier.save()

        if new_status == 'APPROVED':
            from django.utils import timezone
            supplier.documents.all().update(is_verified=True, verified_at=timezone.now())

        AuditService.log(
            action=AuditAction.KYC_VERIFICATION,
            target_model='SupplierProfile',
            user=request.user,
            target_id=str(supplier.id),
            description=f"Supplier {supplier.company_name} status updated from {old_status} to {new_status}. Reason: {rejection_reason}",
            delta_changes={'old_status': old_status, 'new_status': new_status, 'rejection_reason': rejection_reason},
            request=request
        )

        return Response({
            'success': True,
            'message': f"Supplier {supplier.company_name} successfully updated to {new_status}."
        }, status=status.HTTP_200_OK)


class SupplierStaffViewSet(viewsets.ModelViewSet):
    """
    Manage staff accounts and permissions for the authenticated supplier's organization.
    """
    serializer_class = SupplierStaffMemberSerializer
    permission_classes = [permissions.IsAuthenticated, IsSupplier]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return SupplierStaffMember.objects.none()
        return SupplierStaffMember.objects.filter(supplier=self.request.user.supplier_profile).select_related('user')

    def perform_create(self, serializer):
        serializer.save(supplier=self.request.user.supplier_profile)


