from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.permissions import IsSuperAdmin, IsFinanceAdmin
from apps.orders.models import Order
from apps.payments.models import Payment, FinancialLedgerEntry
from apps.payments.serializers import (
    PaymentSerializer,
    InitiatePaymentSerializer,
    VerifyPaymentSerializer,
    FinancialLedgerEntrySerializer
)
from apps.payments.services import PaymentProcessingService

class PaymentInitiateView(APIView):
    """Initiate payment session with Nepal payment gateway (eSewa, Khalti, or COD)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Initiate Order Payment",
        request=InitiatePaymentSerializer,
        responses={200: dict}
    )
    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            order = Order.objects.get(id=serializer.validated_data['order_id'], customer=request.user)
        except Order.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Order not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        result = PaymentProcessingService.initiate_order_payment(
            order=order,
            provider=serializer.validated_data['provider'],
            return_url=serializer.validated_data.get('return_url', 'http://localhost:3000/checkout/success')
        )

        return Response({
            'success': True,
            'message': f"Payment session initialized for {serializer.validated_data['provider']}",
            'data': result
        })


class PaymentVerifyView(APIView):
    """
    Verify payment callback from eSewa, Khalti, or manual verification.
    Applies idempotency protection and updates financial ledger.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Verify Payment Callback",
        request=VerifyPaymentSerializer,
        responses={200: PaymentSerializer}
    )
    def post(self, request):
        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ref = serializer.validated_data['transaction_reference']
        data = serializer.validated_data.get('callback_data', {})

        try:
            payment = PaymentProcessingService.verify_order_payment(
                transaction_reference=ref,
                callback_data=data
            )
            return Response({
                'success': True,
                'message': 'Payment verified and confirmed successfully.',
                'data': PaymentSerializer(payment).data
            })
        except Payment.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Payment transaction reference not found.'}
            }, status=status.HTTP_404_NOT_FOUND)


class AdminLedgerListView(generics.ListAPIView):
    """Auditable double-entry platform ledger view for Finance Admins."""
    serializer_class = FinancialLedgerEntrySerializer
    permission_classes = [IsSuperAdmin | IsFinanceAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['reference_id', 'description', 'vendor__business_name']
    ordering_fields = ['created_at', 'amount']

    def get_queryset(self):
        return FinancialLedgerEntry.objects.all().select_related('order', 'sub_order', 'vendor')

    @extend_schema(summary="List Financial Ledger Entries (Admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

