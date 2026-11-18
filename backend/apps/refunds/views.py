from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from apps.common.permissions import IsSuperAdmin, IsOperationsAdmin
from apps.refunds.models import Refund, RefundStatus
from apps.refunds.serializers import (
    RefundRequestSerializer,
    RefundDetailSerializer,
    RefundActionSerializer,
)
from apps.orders.models import Order, OrderStatus
from apps.payments.models import FinancialLedgerEntry, LedgerEntryType, DebitCredit
from apps.audit.models import AuditLog, AuditAction

class CustomerRefundRequestView(generics.ListCreateAPIView):
    """
    Customer: submit a new return/refund request, or list existing refund requests.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RefundRequestSerializer
        return RefundDetailSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Refund.objects.none()
        return Refund.objects.filter(customer=self.request.user).select_related('order', 'sub_order')

    @extend_schema(summary="Customer: List My Refunds")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(summary="Customer: Submit Return / Refund Request", request=RefundRequestSerializer)
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        refund = serializer.save()

        # Update order status to RETURN_REQUESTED if not already
        if refund.order.status == OrderStatus.DELIVERED:
            refund.order.status = OrderStatus.RETURN_REQUESTED
            refund.order.save(update_fields=['status'])

        return Response({
            'success': True,
            'message': 'Return/refund request submitted for supervisor review.',
            'data': RefundDetailSerializer(refund).data
        }, status=status.HTTP_201_CREATED)


class AdminRefundListView(generics.ListAPIView):
    """
    Super Admin / Operations: list all refund requests across the platform.
    """
    serializer_class = RefundDetailSerializer
    permission_classes = [IsSuperAdmin | IsOperationsAdmin]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Refund.objects.none()
        qs = Refund.objects.all().select_related('order', 'sub_order', 'customer', 'processed_by')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @extend_schema(
        summary="Admin: List Platform Refunds",
        parameters=[
            OpenApiParameter('status', str, description="Filter by RefundStatus (PENDING, APPROVED, PROCESSED, REJECTED)")
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class AdminRefundActionView(APIView):
    """
    Super Admin / Operations: Approve or Reject a customer refund request.
    Approve triggers double-entry ledger debit and audit logging.
    """
    permission_classes = [IsSuperAdmin | IsOperationsAdmin]

    @extend_schema(
        summary="Admin: Process Refund (Approve/Reject)",
        request=RefundActionSerializer,
        responses={200: RefundDetailSerializer}
    )
    def post(self, request, id):
        try:
            refund = Refund.objects.select_related('order', 'sub_order', 'customer').get(id=id)
        except Refund.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Refund request not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        if refund.status != RefundStatus.PENDING:
            return Response({
                'success': False,
                'error': {'code': 'INVALID_STATE', 'message': f'Refund is already {refund.status}.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = RefundActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data['action']
        now = timezone.now()

        if action == 'APPROVE':
            refund.status = RefundStatus.APPROVED
            refund.processed_by = request.user
            refund.processed_at = now
            refund.save(update_fields=['status', 'processed_by', 'processed_at'])

            # Transition order status
            refund.order.status = OrderStatus.REFUNDED
            refund.order.save(update_fields=['status'])

            if refund.sub_order:
                refund.sub_order.status = OrderStatus.REFUNDED
                refund.sub_order.save(update_fields=['status'])

            # Double-entry ledger entry
            FinancialLedgerEntry.objects.create(
                entry_type=LedgerEntryType.REFUND,
                direction=DebitCredit.DEBIT,
                amount=refund.amount,
                order=refund.order,
                sub_order=refund.sub_order,
                vendor=refund.sub_order.vendor if refund.sub_order else None,
                reference_id=refund.refund_number,
                description=f"Approved customer refund for {refund.order.order_number}"
            )

            # Audit log
            AuditLog.objects.create(
                user=request.user,
                user_email=request.user.email,
                action=AuditAction.REFUND_DISBURSEMENT,
                target_model='Refund',
                target_id=str(refund.id),
                description=f"Approved NPR {refund.amount} refund for order {refund.order.order_number}",
                delta_changes={'amount': str(refund.amount), 'refund_number': refund.refund_number}
            )

            return Response({
                'success': True,
                'message': f"Refund {refund.refund_number} approved and ledger debited successfully.",
                'data': RefundDetailSerializer(refund).data
            }, status=status.HTTP_200_OK)

        else: # REJECT
            refund.status = RefundStatus.REJECTED
            refund.rejection_reason = serializer.validated_data.get('rejection_reason', '')
            refund.processed_by = request.user
            refund.processed_at = now
            refund.save(update_fields=['status', 'rejection_reason', 'processed_by', 'processed_at'])

            return Response({
                'success': True,
                'message': f"Refund {refund.refund_number} rejected.",
                'data': RefundDetailSerializer(refund).data
            }, status=status.HTTP_200_OK)
