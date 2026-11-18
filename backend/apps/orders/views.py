from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.common.permissions import IsVendor, IsOperationsAdmin, IsSuperAdmin
from apps.customers.models import Address
from apps.orders.models import Order, VendorSubOrder
from apps.orders.serializers import (
    OrderDetailSerializer,
    OrderListSerializer,
    VendorSubOrderDetailSerializer,
    VendorSubOrderListSerializer,
    CheckoutRequestSerializer,
    SubOrderTransitionSerializer,
)
from apps.orders.services import CheckoutService, OrderService, InsufficientStockError

class CustomerCheckoutView(APIView):
    """
    Execute multi-vendor checkout on current active cart.
    Creates parent order, vendor sub-orders, and reserves inventory.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Customer Checkout",
        request=CheckoutRequestSerializer,
        responses={201: OrderDetailSerializer}
    )
    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        address_id = serializer.validated_data.get('address_id')
        shipping_data = serializer.validated_data.get('shipping_address')

        if address_id:
            try:
                addr = Address.objects.get(id=address_id, customer__user=user)
                shipping_data = {
                    'recipient_name': addr.recipient_name,
                    'recipient_phone': addr.recipient_phone,
                    'province': addr.province,
                    'district': addr.district,
                    'municipality': addr.municipality,
                    'ward_number': addr.ward_number,
                    'tole_street': addr.tole_street,
                    'landmark': addr.landmark
                }
            except Address.DoesNotExist:
                return Response({
                    'success': False,
                    'error': {'code': 'INVALID_ADDRESS', 'message': 'Specified address not found.'}
                }, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = CheckoutService.process_checkout(
                user=user,
                shipping_address_data=shipping_data,
                payment_method=serializer.validated_data.get('payment_method', 'COD'),
                customer_notes=serializer.validated_data.get('customer_notes', '')
            )
            return Response({
                'success': True,
                'message': 'Order placed successfully.',
                'data': OrderDetailSerializer(order).data
            }, status=status.HTTP_201_CREATED)
        except (ValueError, InsufficientStockError) as e:
            return Response({
                'success': False,
                'error': {'code': 'CHECKOUT_FAILED', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class CustomerOrderListCreateView(APIView):
    """
    Combined view supporting:
    - GET /api/v1/orders/ (Order history)
    - POST /api/v1/orders/ (Place new order / checkout)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return CustomerOrderListView.as_view()(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        return CustomerCheckoutView.as_view()(request, *args, **kwargs)


class CustomerOrderCancelView(APIView):
    """Cancel customer's pending or placed order."""
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        order = Order.objects.filter(id=id, customer=request.user).first()
        if not order:
            return Response({'success': False, 'message': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status in ['DELIVERED', 'CANCELLED']:
            return Response({'success': False, 'message': f'Order cannot be cancelled in state {order.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        order.status = 'CANCELLED'
        order.save(update_fields=['status', 'updated_at'])
        return Response({
            'success': True,
            'message': 'Order has been cancelled.',
            'order': OrderDetailSerializer(order).data
        })


class CustomerOrderReorderView(APIView):
    """Reorder items from a past order into active cart."""
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        from apps.cart.views import get_or_create_cart
        from apps.cart.models import CartItem
        from apps.cart.serializers import CartSerializer

        order = Order.objects.filter(id=id, customer=request.user).prefetch_related('suborders__items__variant').first()
        if not order:
            return Response({'success': False, 'message': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        cart = get_or_create_cart(request)
        added_count = 0
        skipped = []

        for suborder in order.suborders.all():
            for item in suborder.items.all():
                if item.variant and item.variant.is_active:
                    cart_item, created = CartItem.objects.get_or_create(
                        cart=cart,
                        variant=item.variant,
                        defaults={'quantity': item.quantity}
                    )
                    if not created:
                        cart_item.quantity += item.quantity
                        cart_item.save(update_fields=['quantity', 'updated_at'])
                    added_count += 1
                else:
                    skipped.append(item.product_name)

        return Response({
            'success': True,
            'added_count': added_count,
            'skipped_items': skipped,
            'cart': CartSerializer(cart).data
        })


class CustomerOrderRefundView(APIView):
    """Request return and refund for an order."""
    permission_classes = [IsAuthenticated]

    def post(self, request, id):
        from apps.refunds.models import RefundRequest
        from decimal import Decimal
        order = Order.objects.filter(id=id, customer=request.user).first()
        if not order:
            return Response({'success': False, 'message': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', 'Customer requested return/refund.')
        amount = Decimal(str(request.data.get('amount', order.grand_total)))

        refund = RefundRequest.objects.create(
            order=order,
            customer=request.user,
            requested_amount=amount,
            reason=reason,
            status='PENDING'
        )

        return Response({
            'success': True,
            'message': 'Refund request submitted successfully.',
            'refund': {
                'id': str(refund.id),
                'amount': float(refund.requested_amount),
                'status': refund.status,
                'reason': refund.reason
            }
        }, status=status.HTTP_201_CREATED)



class CustomerOrderListView(generics.ListAPIView):
    """List authenticated customer's order history."""
    serializer_class = OrderListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'grand_total']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none()
        return Order.objects.filter(customer=self.request.user)

    @extend_schema(summary="Customer Order History")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class CustomerOrderDetailView(generics.RetrieveAPIView):
    """Retrieve full details of customer's order."""
    serializer_class = OrderDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none()
        return Order.objects.filter(customer=self.request.user).prefetch_related(
            'suborders', 'suborders__items', 'timeline'
        )

    @extend_schema(summary="Customer Order Detail")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class VendorSubOrderListView(generics.ListAPIView):
    """List vendor's assigned suborders with status filters."""
    serializer_class = VendorSubOrderListSerializer
    permission_classes = [IsVendor]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sub_order_number', 'parent_order__order_number']
    ordering_fields = ['created_at', 'subtotal']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VendorSubOrder.objects.none()
        user = self.request.user
        if not hasattr(user, 'vendor_profile'):
            return VendorSubOrder.objects.none()

        qs = VendorSubOrder.objects.filter(vendor=user.vendor_profile)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs.select_related('parent_order', 'vendor', 'store').prefetch_related('items')

    @extend_schema(
        summary="Vendor Sub-Orders List",
        parameters=[
            OpenApiParameter('status', str, description="Filter by SubOrder Status")
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class VendorSubOrderDetailView(generics.RetrieveAPIView):
    """Retrieve full suborder details for vendor fulfillment."""
    serializer_class = VendorSubOrderDetailSerializer
    permission_classes = [IsVendor]
    lookup_field = 'id'

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return VendorSubOrder.objects.none()
        user = self.request.user
        if not hasattr(user, 'vendor_profile'):
            return VendorSubOrder.objects.none()
        return VendorSubOrder.objects.filter(vendor=user.vendor_profile).prefetch_related(
            'items', 'timeline'
        )

    @extend_schema(summary="Vendor Sub-Order Detail")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class VendorSubOrderTransitionView(APIView):
    """Update fulfillment status of vendor sub-order."""
    permission_classes = [IsVendor]

    @extend_schema(
        summary="Transition Sub-Order Status",
        request=SubOrderTransitionSerializer,
        responses={200: VendorSubOrderDetailSerializer}
    )
    def post(self, request, id):
        serializer = SubOrderTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        try:
            sub_order = VendorSubOrder.objects.get(id=id, vendor=user.vendor_profile)
        except VendorSubOrder.DoesNotExist:
            return Response({
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Sub-order not found.'}
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            updated_sub = OrderService.transition_suborder(
                sub_order_id=sub_order.id,
                new_status=serializer.validated_data['new_status'],
                user=user,
                remarks=serializer.validated_data.get('remarks', ''),
                tracking_number=serializer.validated_data.get('tracking_number', ''),
                delivery_provider=serializer.validated_data.get('delivery_provider', '')
            )
            return Response({
                'success': True,
                'message': f"Sub-order updated to {updated_sub.status}",
                'data': VendorSubOrderDetailSerializer(updated_sub).data
            })
        except ValueError as e:
            return Response({
                'success': False,
                'error': {'code': 'TRANSITION_ERROR', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)


class AdminOrderListView(generics.ListAPIView):
    """Admin view of all marketplace orders."""
    serializer_class = OrderListSerializer
    permission_classes = [IsSuperAdmin | IsOperationsAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['order_number', 'customer__email']
    ordering_fields = ['created_at', 'grand_total']

    def get_queryset(self):
        return Order.objects.all().select_related('customer').prefetch_related('suborders')

    @extend_schema(summary="List All Orders (Admin)")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

