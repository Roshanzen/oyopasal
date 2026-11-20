from django.db.models import Q
from django.http import Http404
from rest_framework import generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.common.permissions import IsVendor, IsOperationsAdmin, IsSuperAdmin
from apps.common.utils import is_valid_uuid
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

        addr = None
        if address_id:
            try:
                addr = Address.objects.filter(id=address_id, customer__user=user).first()
                if not addr:
                    addr = Address.objects.filter(id=address_id).first()
            except Exception:
                pass

        if addr:
            shipping_data = {
                'id': str(addr.id),
                'title': addr.title or 'Delivery Address',
                'recipient_name': addr.recipient_name or getattr(user, 'first_name', '') or 'Customer',
                'recipient_phone': addr.recipient_phone or getattr(user, 'phone_number', '') or '+977 9800000000',
                'province': addr.province,
                'district': addr.district or 'Kathmandu',
                'municipality': addr.municipality or 'Kathmandu',
                'ward_number': addr.ward_number or 1,
                'tole_street': addr.tole_street or '',
                'landmark': addr.landmark or '',
                'latitude': float(addr.latitude) if addr.latitude is not None else None,
                'longitude': float(addr.longitude) if addr.longitude is not None else None,
            }
        elif shipping_data:
            shipping_data = shipping_data.copy()
            if 'phone' in shipping_data and 'recipient_phone' not in shipping_data:
                shipping_data['recipient_phone'] = shipping_data['phone']
            if 'street' in shipping_data and 'tole_street' not in shipping_data:
                shipping_data['tole_street'] = shipping_data['street']
            if 'area' in shipping_data and 'municipality' not in shipping_data:
                shipping_data['municipality'] = shipping_data['area']
            if 'city' in shipping_data and 'district' not in shipping_data:
                shipping_data['district'] = shipping_data['city']
            if 'lat' in shipping_data and 'latitude' not in shipping_data:
                shipping_data['latitude'] = shipping_data['lat']
            if 'lng' in shipping_data and 'longitude' not in shipping_data:
                shipping_data['longitude'] = shipping_data['lng']
            if not shipping_data.get('ward_number'):
                shipping_data['ward_number'] = 1
            if not shipping_data.get('recipient_name'):
                shipping_data['recipient_name'] = getattr(user, 'first_name', '') or getattr(user, 'full_name', '') or 'Customer'
            if not shipping_data.get('recipient_phone'):
                shipping_data['recipient_phone'] = getattr(user, 'phone_number', '') or '+977 9800000000'
        else:
            return Response({
                'success': False,
                'error': {'code': 'INVALID_ADDRESS', 'message': 'Please provide a valid delivery address or select a saved location.'}
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = CheckoutService.process_checkout(
                user=user,
                shipping_address_data=shipping_data,
                payment_method=serializer.validated_data.get('payment_method', 'COD'),
                customer_notes=serializer.validated_data.get('customer_notes', '')
            )
            data = OrderDetailSerializer(order).data
            response_data = dict(data)
            response_data['success'] = True
            response_data['message'] = 'Order placed successfully.'
            response_data['data'] = data
            return Response(response_data, status=status.HTTP_201_CREATED)
        except (ValueError, InsufficientStockError) as e:
            return Response({
                'success': False,
                'error': {'code': 'CHECKOUT_FAILED', 'message': str(e)}
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Checkout processing error")
            return Response({
                'success': False,
                'error': {'code': 'CHECKOUT_ERROR', 'message': f'Unable to complete order: {str(e)}'}
            }, status=status.HTTP_400_BAD_REQUEST)





class CustomerOrderListView(generics.ListAPIView):
    """List authenticated customer's order history."""
    serializer_class = OrderListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'grand_total']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Order.objects.none()
        return Order.objects.filter(customer=self.request.user).prefetch_related(
            'suborders', 'suborders__vendor', 'suborders__store',
            'suborders__items', 'suborders__items__variant',
            'suborders__items__variant__product',
            'suborders__items__variant__product__images'
        ).order_by('-created_at')

    @extend_schema(summary="Customer Order History")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class CustomerOrderListCreateView(CustomerOrderListView):
    """
    Combined view supporting:
    - GET /api/v1/orders/ (Order history)
    - POST /api/v1/orders/ (Place new order / checkout)
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Customer Checkout / Place Order",
        request=CheckoutRequestSerializer,
        responses={201: OrderDetailSerializer}
    )
    def post(self, request, *args, **kwargs):
        checkout_view = CustomerCheckoutView()
        checkout_view.setup(request._request, *args, **kwargs)
        checkout_view.request = request
        checkout_view.format_kwarg = None
        return checkout_view.post(request)


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






class CustomerOrderDetailView(generics.RetrieveAPIView):
    """Retrieve full details of customer or vendor order for live tracking & receipt."""
    serializer_class = OrderDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_object(self):
        lookup_val = str(self.kwargs.get(self.lookup_field, '')).strip()
        user = self.request.user

        q = Q(customer=user)
        if hasattr(user, 'vendor_profile'):
            q |= Q(suborders__vendor=user.vendor_profile)
        if getattr(user, 'is_staff', False) or getattr(user, 'role', '') in ['admin', 'super_admin', 'operations_admin']:
            q = Q()

        qs = Order.objects.filter(q).prefetch_related(
            'suborders', 'suborders__items', 'timeline'
        ).distinct()

        order = None
        if is_valid_uuid(lookup_val):
            order = qs.filter(Q(id=lookup_val) | Q(suborders__id=lookup_val)).first()
        if not order:
            order = qs.filter(Q(order_number=lookup_val) | Q(suborders__sub_order_number=lookup_val)).first()

        if not order:
            raise Http404("Order not found or access denied.")
        return order

    @extend_schema(summary="Customer / Vendor Order Detail")
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

